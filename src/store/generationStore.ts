import { create } from 'zustand'
import type { AITaskClarification } from '@/types/agent'

export type GenerationMode = 'scheme-only' | 'full-generation' | 'code-only' | 'flow-only'
export type GenerationStage = 'preparing' | 'scheme' | 'scheme-validation' | 'code' | 'code-validation' | 'flow'
export type GenerationStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'needs_clarification'

export interface GenerationState {
  projectId: string | null
  runId: string | null
  sessionId: string | null
  jobId: string | null
  mode: GenerationMode | null
  status: GenerationStatus
  stage: GenerationStage
  progress: number
  message: string
  startedAt?: number
  stageStartedAt?: number
  model?: string
  provider?: string
  error?: string
  warning?: string
  clarification?: AITaskClarification
  start: (input: Pick<GenerationState, 'projectId' | 'runId' | 'sessionId' | 'jobId' | 'mode' | 'model' | 'provider'>) => void
  update: (updates: Partial<GenerationState>) => void
  finish: (status: Exclude<GenerationStatus, 'idle' | 'running'>, error?: string) => void
  clear: () => void
}

export const useGenerationStore = create<GenerationState>((set) => ({
  projectId: null,
  runId: null,
  sessionId: null,
  jobId: null,
  mode: null,
  status: 'idle',
  stage: 'preparing',
  progress: 0,
  message: '',
  start: (input) => set({
    ...input,
    status: 'running',
    stage: 'preparing',
    progress: 2,
    message: '正在准备生成任务…',
    startedAt: Date.now(),
    stageStartedAt: Date.now(),
    error: undefined,
    warning: undefined,
    clarification: undefined,
  }),
  update: (updates) => set(updates),
  finish: (status, error) => set({
    status,
    progress: status === 'succeeded' ? 100 : status === 'needs_clarification' ? 78 : 0,
    error,
    message: status === 'succeeded' ? '生成任务已完成' : status === 'cancelled' ? '生成任务已取消' : status === 'needs_clarification' ? '等待补充信息后继续生成' : error ?? '生成任务失败',
  }),
  clear: () => set({
    projectId: null,
    runId: null,
    sessionId: null,
    jobId: null,
    mode: null,
    status: 'idle',
    stage: 'preparing',
    progress: 0,
    message: '',
    startedAt: undefined,
    stageStartedAt: undefined,
    model: undefined,
    provider: undefined,
    error: undefined,
    warning: undefined,
    clarification: undefined,
  }),
}))
