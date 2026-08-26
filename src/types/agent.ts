import type { PipelineStage, StageRunStatus, TokenUsage } from './project'

export type JobStatus = Extract<StageRunStatus, 'waiting' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'skipped'>

export type AgentEventType =
  | 'session.created'
  | 'session.resumed'
  | 'stage.started'
  | 'stage.progress'
  | 'tool.before'
  | 'tool.approval-required'
  | 'tool.executing'
  | 'tool.completed'
  | 'tool.failed'
  | 'validation.started'
  | 'validation.completed'
  | 'build.started'
  | 'build.completed'
  | 'job.cancelled'
  | 'stage.completed'
  | 'stage.failed'
  | 'agent.status'
  | 'agent.output'
  | 'agent.runtime-event'
  | 'subagent.started'
  | 'subagent.finished'
  | 'approval.requested'
  | 'approval.approved'
  | 'approval.rejected'
  | 'approval.executed'
  | 'approval.failed'

export interface AgentEvent<T = unknown> {
  id: number
  type: AgentEventType
  timestamp: number
  requestId?: string
  jobId?: string
  sessionId?: string
  data: T
}

export interface AgentJob<TResult = unknown> {
  id: string
  projectId: string
  stage: PipelineStage | 'agent-task'
  status: JobStatus
  createdAt: number
  startedAt?: number
  finishedAt?: number
  progress: number
  currentAction: string
  retryCount: number
  errorCode?: string
  errorMessage?: string
  retryable?: boolean
  resultRef?: string
  result?: TResult
  sessionId: string
  model?: string
  provider?: string
  promptVersion?: string
  tokenUsage?: TokenUsage
  durationMs?: number
}

export interface AgentSession {
  id: string
  projectId: string
  status: 'active' | 'completed' | 'failed' | 'cancelled'
  createdAt: number
  updatedAt: number
  lastEventId: number
  jobIds: string[]
  metadata: Record<string, string | number | boolean>
}

export type AgentRuntimeId = 'internal' | 'deepseek-harness'

export interface AgentRuntimeInfo {
  id: AgentRuntimeId | string
  label: string
  ready: boolean
  experimental: boolean
  capabilities: string[]
  sourceAvailable?: boolean
  dependenciesInstalled?: boolean
  configAvailable?: boolean
  credentialConfigured?: boolean
  acceptsTaskCredential?: boolean
  harnessRoot?: string
  configPath?: string
  version?: string
}

export interface AgentRuntimeStatus {
  selected: AgentRuntimeId | string
  runtimes: AgentRuntimeInfo[]
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed'

export interface AgentApproval {
  id: string
  projectId: string
  sessionId: string
  jobId: string
  runtime: AgentRuntimeId | string
  toolName: string
  kind: 'file-diff' | 'build' | 'action' | string
  title: string
  reason: string
  risk: 'low' | 'medium' | 'high' | string
  args: Record<string, unknown>
  preview: Record<string, unknown> | null
  status: ApprovalStatus
  createdAt: number
  decidedAt?: number
  executedAt?: number
  failedAt?: number
  result?: unknown
  error?: string
}

export interface ToolPermission {
  workspace?: string
  read: boolean
  write: boolean
  build: boolean
  export: boolean
  requiresApproval: boolean
}

export interface AgentPluginManifest {
  id: string
  version: string
  provides: string[]
  requires: string[]
  tools: string[]
  permissions: ToolPermission
  lifecycleHooks: string[]
}

export interface AgentErrorContract {
  code: string
  message: string
  retryable: boolean
  stage?: PipelineStage
  requestId?: string
  details?: Record<string, unknown>
}

export type AITaskStatus = 'ok' | 'needs_clarification' | 'invalid'

/** AI 无法安全继续时，交给用户确认的结构化问题。 */
export interface AITaskClarification {
  taskType: string
  questions: string[]
  createdAt: number
  generationMode?: 'scheme-only' | 'full-generation' | 'code-only' | 'flow-only'
}

export interface AITaskEvidence {
  source: string
  file?: string
  line?: number
  excerpt?: string
}

export interface AITaskContract<TData = unknown> {
  schemaVersion: string
  taskType: string
  status: AITaskStatus
  assumptions: string[]
  openQuestions: string[]
  risks: Array<{ severity: 'info' | 'warning' | 'error'; message: string }>
  evidence: AITaskEvidence[]
  data: TData
  validationHints: string[]
}
