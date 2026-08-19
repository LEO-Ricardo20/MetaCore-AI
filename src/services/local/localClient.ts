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
import type { AgentEvent, AgentJob, AgentSession } from '@/types/agent'
import type { PipelineStage } from '@/types/project'

const API_BASE = 'http://127.0.0.1:3766/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
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

export function createAgentSession(projectId: string, metadata: Record<string, string | number | boolean> = {}) {
  return request<AgentSession>('/sessions', { method: 'POST', body: JSON.stringify({ projectId, metadata }) })
}

export function getAgentSession(sessionId: string) {
  return request<AgentSession>(`/sessions/${encodeURIComponent(sessionId)}`)
}

export function createAgentJob<TPayload = unknown>(input: { projectId: string; stage: PipelineStage | 'ai'; sessionId?: string; payload?: TPayload }) {
  return request<AgentJob>('/jobs', { method: 'POST', body: JSON.stringify(input) })
}

export function getAgentJob<TResult = unknown>(jobId: string) {
  return request<AgentJob<TResult>>(`/jobs/${encodeURIComponent(jobId)}`)
}

export function cancelAgentJob(jobId: string) {
  return request<AgentJob>(`/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' })
}

export function retryAgentJob(jobId: string) {
  return request<AgentJob>(`/jobs/${encodeURIComponent(jobId)}/retry`, { method: 'POST' })
}

export function subscribeAgentEvents(
  scope: 'jobs' | 'sessions',
  id: string,
  onEvent: (event: AgentEvent) => void,
  onError?: (event: Event) => void,
) {
  const source = new EventSource(`${API_BASE}/${scope}/${encodeURIComponent(id)}/events`)
  const eventTypes = ['session.created', 'session.resumed', 'stage.started', 'stage.progress', 'tool.before', 'tool.approval-required', 'tool.executing', 'tool.completed', 'tool.failed', 'validation.started', 'validation.completed', 'build.started', 'build.completed', 'job.cancelled', 'stage.completed', 'stage.failed']
  const handler = (message: MessageEvent) => {
    try { onEvent(JSON.parse(message.data) as AgentEvent) } catch { /* ignore malformed provider events */ }
  }
  eventTypes.forEach((type) => source.addEventListener(type, handler as EventListener))
  if (onError) source.onerror = onError
  return () => source.close()
}
