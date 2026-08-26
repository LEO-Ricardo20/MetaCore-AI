import type { ChipTarget, ProjectFormat, PinAssignment, BOMItem, WiringEntry } from './hardware'
import type { Esp32ProjectConfig } from './esp32'
import type { AITaskClarification } from './agent'

export const PROJECT_SCHEMA_VERSION = 3

export type ProjectStage =
  | 'draft'
  | 'requirements-ready'
  | 'planning'
  | 'design-review'
  | 'implementation'
  | 'verification'
  | 'ready-to-export'
  | 'failed'
  | 'cancelled'

export type StageRunStatus = 'idle' | 'waiting' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'skipped'

export type ArtifactStatus = 'missing' | 'generating' | 'fresh' | 'stale' | 'validating' | 'valid' | 'invalid'

export type ArtifactKey =
  | 'requirements'
  | 'scheme'
  | 'pinMap'
  | 'bom'
  | 'wiring'
  | 'code'
  | 'flow'
  | 'localAnalysis'
  | 'consistencyReport'
  | 'buildResult'
  | 'releaseReport'

export type PipelineStage =
  | 'requirements'
  | 'clarification'
  | 'scheme-generation'
  | 'scheme-validation'
  | 'code-generation'
  | 'code-validation'
  | 'flow-generation'
  | 'local-analysis'
  | 'build'
  | 'release-check'

export interface ArtifactState {
  status: ArtifactStatus
  version: number
  updatedAt?: number
  staleReason?: string
  sourceVersion?: number
}

export type ProjectArtifacts = Record<ArtifactKey, ArtifactState>

export interface TokenUsage {
  input: number
  output: number
  total: number
  estimatedCost?: number
}

export interface PipelineStageState {
  id: PipelineStage
  status: StageRunStatus
  progress: number
  currentAction: string
  startedAt?: number
  finishedAt?: number
  model?: string
  provider?: string
  promptVersion?: string
  tokenUsage?: TokenUsage
  retryCount: number
  errorCode?: string
  errorMessage?: string
  rawResponse?: string
  structuredResult?: unknown
  validationResult?: unknown
}

export interface ProjectRun {
  id: string
  status: StageRunStatus
  createdAt: number
  startedAt?: number
  finishedAt?: number
  currentStage?: PipelineStage
  sessionId?: string
  stages: PipelineStageState[]
}

export interface ProjectVersion {
  id: string
  label: string
  createdAt: number
  sourceProjectId: string
  schemeVersion: number
  codeVersion: number
}

export interface ProjectValidationSummary {
  status: 'unchecked' | 'running' | 'warning' | 'error' | 'passed' | 'stale'
  issueCount: number
  blockingCount: number
  updatedAt?: number
}

export interface ProjectVerificationState {
  consistency?: {
    status: 'idle' | 'running' | 'passed' | 'warning' | 'failed'
    findings: Array<{ severity: 'error' | 'warning' | 'info'; message: string; file?: string; line?: number; expected?: string; actual?: string }>
    updatedAt: number
  }
  security?: {
    status: 'idle' | 'running' | 'passed' | 'warning' | 'failed'
    findings: Array<{ severity: 'error' | 'warning'; message: string; file: string; line: number }>
    updatedAt: number
  }
  build?: {
    status: 'idle' | 'running' | 'passed' | 'warning' | 'failed' | 'skipped'
    profiles: Array<{ id: string; label: string; command: string; available: boolean }>
    result?: { profileId: string; command: string; exitCode: number; success: boolean; timedOut: boolean; durationMs: number; stdout: string; stderr: string; truncated: boolean }
    error?: string
    updatedAt: number
  }
  release?: {
    status: 'idle' | 'running' | 'passed' | 'warning' | 'failed'
    reasons: string[]
    checkedAt?: number
    updatedAt: number
  }
}

export interface HardwareScheme {
  description: string
  pins: PinAssignment[]
  bom: BOMItem[]
  wiring: WiringEntry[]
  assumptions?: string[]
  openQuestions?: string[]
  risks?: Array<{ severity: 'info' | 'warning' | 'error'; message: string; evidence?: string }>
}

/** 用户已确认的 AI 选型结果，作为方案生成的输入证据保存。 */
export interface HardwareModelSelection {
  items: Array<{
    question: string
    selectedModel: string
    selectedAnswer: string
    selectedCategory?: 'common' | 'optimal' | 'value' | 'best'
    rationale?: string
    source: 'user' | 'ai-candidate' | 'ai-auto'
  }>
  priorities: Record<'common' | 'optimal' | 'value' | 'best', number>
  safetySummary?: string
  confirmedAt: number
}

export interface CodeFile {
  path: string
  content: string
  language: 'c' | 'h' | 'cpp' | 'cmake' | 'ini' | 'makefile' | 'other'
}

/** 流程图节点 */
export interface FlowNode {
  id: string
  label: string
  codeFileRef?: string
  codeLine?: number
  functionName?: string
  evidence?: string
  codeSnippet?: string
  /** 节点分类样式（如 init/sensor/comm/display/error/logic） */
  nodeStyle?: string
  position: { x: number; y: number }
  type?: string
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface Project {
  schemaVersion: number
  id: string
  name: string
  requirement: string
  target: ChipTarget
  format: ProjectFormat
  /** ESP32 系列项目的具体开发板、存储与工具链配置；旧项目加载时自动补全。 */
  esp32?: Esp32ProjectConfig
  scheme?: HardwareScheme
  selectedDriverIds?: string[]
  codeFiles: CodeFile[]
  flowNodes: FlowNode[]
  flowEdges: FlowEdge[]
  currentStage: ProjectStage
  artifacts: ProjectArtifacts
  runs: ProjectRun[]
  versions: ProjectVersion[]
  validation: ProjectValidationSummary
  verification?: ProjectVerificationState
  /** 最近一次生成暂停时要求用户补充的结构化问题。 */
  pendingClarification?: AITaskClarification
  /** 用户已确认的器件选型，在方案重新生成时作为明确约束。 */
  modelSelection?: HardwareModelSelection
  lastSessionId?: string
  createdAt: number
  updatedAt: number
}
