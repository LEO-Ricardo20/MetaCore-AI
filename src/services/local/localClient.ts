import type {
  BackupsResponse,
  BuildProfile,
  BuildResult,
  DirectoryListing,
  FileWriteResponse,
  LocalFileContent,
  LocalHealth,
  LocalSystemInfo,
  OperationLogsResponse,
  ReportResponse,
  SearchResponse,
  WorkspaceAnalysis,
  WorkspaceInfo,
} from './types'

const API_BASE = 'http://127.0.0.1:3766/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new Error(data.error ?? `本地服务请求失败 (${res.status})`)
  }
  return data as T
}

export function checkLocalHealth() {
  return request<LocalHealth>('/health')
}

export function getLocalSystemInfo() {
  return request<LocalSystemInfo>('/system/info')
}

export function getOperationLogs() {
  return request<OperationLogsResponse>('/logs')
}

export function getCurrentWorkspace() {
  return request<WorkspaceInfo>('/workspace/current')
}

export function setWorkspace(root: string) {
  return request<WorkspaceInfo>('/workspace/set', {
    method: 'POST',
    body: JSON.stringify({ root }),
  })
}

export function listDirectory(dir = '') {
  return request<DirectoryListing>(`/files/list?dir=${encodeURIComponent(dir)}`)
}

export function readLocalFile(path: string) {
  return request<LocalFileContent>(`/files/read?path=${encodeURIComponent(path)}`)
}

export function writeLocalFile(path: string, content: string, expectedModifiedAt: number) {
  return request<FileWriteResponse>('/files/write', {
    method: 'POST',
    body: JSON.stringify({ path, content, expectedModifiedAt }),
  })
}

export function searchLocalFiles(query: string, maxResults = 60) {
  return request<SearchResponse>('/files/search', {
    method: 'POST',
    body: JSON.stringify({ query, maxResults }),
  })
}

export function analyzeWorkspace() {
  return request<WorkspaceAnalysis>('/analyze', { method: 'POST' })
}

export function listBackups() {
  return request<BackupsResponse>('/backups/list')
}

export function restoreBackup(backupId: string) {
  return request<{ file: LocalFileContent; restoredBackupId: string }>('/backups/restore', {
    method: 'POST',
    body: JSON.stringify({ backupId }),
  })
}

export function detectBuildProfiles() {
  return request<{ profiles: BuildProfile[] }>('/build/detect')
}

export function runBuild(profileId: string) {
  return request<BuildResult>('/build/run', {
    method: 'POST',
    body: JSON.stringify({ profileId }),
  })
}

export function generateLocalReport() {
  return request<ReportResponse>('/report', { method: 'POST' })
}
