import type { ChipTarget, ProjectFormat, PinAssignment, BOMItem, WiringEntry } from './hardware'

export const PROJECT_SCHEMA_VERSION = 2

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

export interface HardwareScheme {
  description: string
  pins: PinAssignment[]
  bom: BOMItem[]
  wiring: WiringEntry[]
  assumptions?: string[]
  openQuestions?: string[]
  risks?: Array<{ severity: 'info' | 'warning' | 'error'; message: string; evidence?: string }>
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
  lastSessionId?: string
  createdAt: number
  updatedAt: number
}
