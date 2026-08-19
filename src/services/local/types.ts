export interface LocalHealth {
  ok: boolean
  service: string
  version: string
  workspaceRoot: string
  port: number
  agentRuntime?: 'internal' | 'deepseek-harness' | string
}

export interface WorkspaceInfo {
  workspaceRoot: string
}

export interface LocalSystemInfo {
  platform: string
  release: string
  arch: string
  hostname: string
  nodeVersion: string
  cpuCount: number
  memoryGB: number
  tools: Record<string, boolean>
}

export interface LocalFileItem {
  name: string
  path: string
  type: 'directory' | 'file'
  size: number
  modifiedAt: number
  readable: boolean
}

export interface DirectoryListing {
  root: string
  dir: string
  parent: string
  items: LocalFileItem[]
}

export interface LocalFileContent {
  path: string
  name: string
  size: number
  modifiedAt: number
  language: string
  content: string
}

export interface SearchMatch {
  line: string
  lineNumber: number
}

export interface SearchResult {
  path: string
  nameMatch: boolean
  matches: SearchMatch[]
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
}

export interface DetectedPeripheral {
  id: string
  label: string
  files: string[]
}

export type DetectedProtocol = DetectedPeripheral

export interface DetectedDependency {
  name: string
  kind: 'include' | 'platformio' | string
  files: string[]
}

export interface LanguageStatistic {
  language: string
  files: number
  lines: number
}

export interface CodeStatistics {
  totalLines: number
  codeLines: number
  commentLines: number
  blankLines: number
  commentRatio: number
  languages: LanguageStatistic[]
}

export interface DetectedPin {
  name: string
  pin: number
  path: string
  line: number
  source: string
}

export interface AnalysisIssue {
  severity: 'info' | 'warning' | 'error'
  message: string
  category?: 'hardware' | 'security' | 'maintainability' | 'connectivity' | string
  path?: string
  line?: number
}

export interface SecurityFinding {
  id: string
  severity: 'info' | 'warning' | 'error'
  message: string
  path: string
  line: number
}

export interface BuildProfile {
  id: string
  label: string
  command: string
  available: boolean
}

export interface HealthScore {
  score: number
  dimensions: {
    structure: number
    hardware: number
    security: number
    maintainability: number
    connectivity: number
  }
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low'
  title: string
  detail: string
}

export interface WorkspaceAnalysis {
  workspaceRoot: string
  scannedAt: number
  totalFiles: number
  analyzedFiles: number
  scannedLimitHit: boolean
  projectTypes: string[]
  primaryProjectType: string
  chips: string[]
  peripherals: DetectedPeripheral[]
  protocols: DetectedProtocol[]
  dependencies: DetectedDependency[]
  statistics: CodeStatistics
  pins: DetectedPin[]
  securityFindings: SecurityFinding[]
  buildProfiles: BuildProfile[]
  keyFiles: string[]
  issues: AnalysisIssue[]
  health: HealthScore
  recommendations: Recommendation[]
}

export interface FileWriteResponse {
  file: LocalFileContent
  backup: {
    id: string
    path: string
    createdAt: number
  }
}

export interface BackupInfo {
  id: string
  path: string
  reason: string
  size: number
  modifiedAt: number
  createdAt: number
}

export interface BackupsResponse {
  backups: BackupInfo[]
}

export interface BuildResult {
  profileId: string
  command: string
  exitCode: number
  success: boolean
  timedOut: boolean
  durationMs: number
  stdout: string
  stderr: string
  truncated: boolean
}

export interface OperationLogEntry {
  id: string
  type: string
  status: 'success' | 'failed'
  detail: Record<string, unknown>
  createdAt: number
}

export interface OperationLogsResponse {
  logs: OperationLogEntry[]
}

export interface ReportResponse {
  analysis: WorkspaceAnalysis
  markdown: string
}
