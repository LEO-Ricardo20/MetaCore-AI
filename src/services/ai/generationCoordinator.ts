import { useAIConfigStore } from '@/store/aiConfigStore'
import { useChipStore } from '@/store/chipStore'
import { useGenerationStore, type GenerationMode, type GenerationStage } from '@/store/generationStore'
import { useProjectStore } from '@/store/projectStore'
import type { ChipTarget, ProjectFormat } from '@/types/hardware'
import type { HardwareScheme } from '@/types/project'
import { buildCodegenPrompt, buildFlowPrompt, buildSchemePrompt, buildVerifyPrompt } from './prompts'
import { parseCodeFiles, parseFlowGraph, parseHardwareScheme, parseVerification } from './validation'
import { parseTaskContract, taskContractInstruction } from './contracts'
import type { AIServiceConfig } from '@/types/ai'

interface StartInput {
  requirement?: string
  target?: ChipTarget
  format?: ProjectFormat
  selectedDriverIds?: string[]
  mode: GenerationMode
  projectId?: string
  createMode?: 'update-current' | 'new-version'
}

let controller: AbortController | null = null
let activeServerJobId: string | null = null
let lastStartInput: StartInput | null = null

const LOCAL_AGENT_API = 'http://127.0.0.1:3766/api'

const stageToPipeline: Record<Exclude<GenerationStage, 'preparing'>, 'scheme-generation' | 'scheme-validation' | 'code-generation' | 'code-validation' | 'flow-generation'> = {
  scheme: 'scheme-generation',
  'scheme-validation': 'scheme-validation',
  code: 'code-generation',
  'code-validation': 'code-validation',
  flow: 'flow-generation',
}

function updateStage(runId: string | null, stage: GenerationStage, progress: number, message: string, extra: Record<string, unknown> = {}) {
  const now = Date.now()
  useGenerationStore.getState().update({ stage, progress, message, stageStartedAt: now })
  if (runId && stage !== 'preparing') {
    useProjectStore.getState().updatePipelineStage(runId, stageToPipeline[stage], {
      status: 'running',
      progress,
      currentAction: message,
      startedAt: now,
      ...extra,
    })
  }
}

function completeStage(runId: string | null, stage: GenerationStage, message: string, extra: Record<string, unknown> = {}) {
  if (runId && stage !== 'preparing') {
    useProjectStore.getState().updatePipelineStage(runId, stageToPipeline[stage], {
      status: 'succeeded',
      progress: 100,
      currentAction: message,
      finishedAt: Date.now(),
      ...extra,
    })
  }
}

function skipStage(runId: string | null, stage: 'scheme-validation' | 'code-validation' | 'flow') {
  if (!runId) return
  useProjectStore.getState().updatePipelineStage(runId, stageToPipeline[stage], {
    status: 'skipped',
    progress: 100,
    currentAction: '按当前生成模式跳过',
    finishedAt: Date.now(),
  })
}

function isCancelled(error: unknown) {
  return controller?.signal.aborted || (error as { name?: string } | null)?.name === 'AbortError' || (error as { name?: string } | null)?.name === 'AIRequestCancelledError'
}

export function cancelGeneration() {
  controller?.abort()
  const jobId = activeServerJobId
  if (jobId) {
    void fetch(`${LOCAL_AGENT_API}/jobs/${jobId}/cancel`, { method: 'POST' }).catch(() => {})
  }
}

export function retryGeneration() {
  if (!lastStartInput || isGenerationRunning()) return false
  void startGeneration(lastStartInput).catch(() => {})
  return true
}

export function isGenerationRunning() {
  return useGenerationStore.getState().status === 'running'
}

async function postJSON<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${LOCAL_AGENT_API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') throw error
    throw new Error('无法连接本地 Agent 服务，请先启动 npm run dev:server', { cause: error })
  }
  const payload = await response.json().catch(() => ({})) as T & { error?: string; message?: string }
  if (!response.ok) throw new Error(payload.error ?? payload.message ?? `Agent 请求失败 (${response.status})`)
  return payload
}

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${LOCAL_AGENT_API}${path}`, { signal })
  const payload = await response.json().catch(() => ({})) as T & { error?: string; message?: string }
  if (!response.ok) throw new Error(payload.error ?? payload.message ?? `Agent 请求失败 (${response.status})`)
  return payload
}

async function waitForAgentJob<T>(jobId: string, signal: AbortSignal, onProgress: (progress: number, message: string) => void): Promise<T> {
  const streamController = new AbortController()
  const abortStream = () => streamController.abort()
  signal.addEventListener('abort', abortStream, { once: true })
  let streamTask: Promise<void> | undefined
  try {
    streamTask = (async () => {
      const response = await fetch(`${LOCAL_AGENT_API}/jobs/${jobId}/events`, { signal: streamController.signal, headers: { Accept: 'text/event-stream' } })
      if (!response.ok || !response.body) return
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (!streamController.signal.aborted) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split(/\r?\n\r?\n/)
        buffer = chunks.pop() ?? ''
        for (const chunk of chunks) {
          const data = chunk.split(/\r?\n/).find((line) => line.startsWith('data:'))?.slice(5).trim()
          if (!data) continue
          try {
            const event = JSON.parse(data) as { type?: string; data?: { progress?: number; currentAction?: string } }
            const eventData = event.data ?? {}
            if (event.type === 'stage.progress') onProgress(Number(eventData.progress ?? 0), String(eventData.currentAction ?? '正在执行'))
          } catch {
            // Ignore heartbeat and malformed keep-alive chunks; final job state is authoritative.
          }
        }
      }
    })().catch(() => {})

    while (true) {
      const job = await getJSON<{ status: string; progress: number; currentAction: string; result?: T; errorMessage?: string; errorCode?: string }>(`/jobs/${jobId}`, signal)
      onProgress(job.progress, job.currentAction)
      if (job.status === 'succeeded') return job.result as T
      if (job.status === 'failed') throw new Error(`${job.errorCode ?? 'JOB_FAILED'}：${job.errorMessage ?? '任务失败'}`)
      if (job.status === 'cancelled') {
        const error = new Error('生成任务已取消')
        error.name = 'AIRequestCancelledError'
        throw error
      }
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, 450)
        signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('任务已取消', 'AbortError')) }, { once: true })
      })
    }
  } finally {
    streamController.abort()
    signal.removeEventListener('abort', abortStream)
    await streamTask?.catch(() => {})
  }
}

async function createAgentSession(projectId: string, mode: GenerationMode, signal: AbortSignal) {
  const session = await postJSON<{ id: string }>('/sessions', { projectId, metadata: { source: 'frontend-generation', mode } }, signal)
  useGenerationStore.getState().update({ sessionId: session.id })
  return session.id
}

async function runAgentStage<T>(stage: string, service: AIServiceConfig, messages: Array<{ role: 'system' | 'user'; content: string }>, sessionId: string, signal: AbortSignal, parse: (content: string) => T, onProgress: (progress: number, message: string) => void, temperature = 0.2) {
  const taskType = stage === 'scheme-generation' ? 'hardware-scheme' : stage === 'code-generation' ? 'firmware-generation' : stage === 'code-validation' ? 'code-consistency' : 'flow-graph'
  const domainSystem = messages.find((message) => message.role === 'system')?.content ?? ''
  const contractMessages = [
    { role: 'system' as const, content: `${taskContractInstruction(taskType)}\n\n${domainSystem}` },
    ...messages.filter((message) => message.role !== 'system'),
  ]
  const job = await postJSON<{ id: string }>('/jobs', {
    projectId: useGenerationStore.getState().projectId,
    sessionId,
    stage,
    payload: { service, messages: contractMessages, temperature, taskType },
  })
  activeServerJobId = job.id
  useGenerationStore.getState().update({ jobId: job.id })
  if (signal.aborted) {
    await fetch(`${LOCAL_AGENT_API}/jobs/${job.id}/cancel`, { method: 'POST' }).catch(() => {})
    throw new DOMException('任务已取消', 'AbortError')
  }
  const result = await waitForAgentJob<{ content: string; usage?: unknown }>(job.id, signal, onProgress)
  activeServerJobId = null
  useGenerationStore.getState().update({ jobId: null })
  if (!result?.content) throw new Error('Agent Job 成功但没有返回结构化内容')
  return parseTaskContract(result.content, taskType, parse)
}

async function runPinValidationJob(projectId: string, scheme: HardwareScheme, sessionId: string, signal: AbortSignal, onProgress: (progress: number, message: string) => void) {
  const pins = scheme.pins.map((pin) => ({
    pin: Number(String(pin.pinNumber).match(/\d+/)?.[0] ?? NaN),
    name: pin.pinName || pin.function,
  }))
  const job = await postJSON<{ id: string }>('/jobs', { projectId, sessionId, stage: 'scheme-validation', payload: { pins } })
  activeServerJobId = job.id
  useGenerationStore.getState().update({ jobId: job.id })
  try {
    if (signal.aborted) {
      await fetch(`${LOCAL_AGENT_API}/jobs/${job.id}/cancel`, { method: 'POST' }).catch(() => {})
      throw new DOMException('任务已取消', 'AbortError')
    }
    return await waitForAgentJob<{ valid: boolean; conflicts?: unknown[] }>(job.id, signal, onProgress)
  } finally {
    activeServerJobId = null
    useGenerationStore.getState().update({ jobId: null })
  }
}

export async function startGeneration(input: StartInput) {
  if (isGenerationRunning()) return false
  const svc = useAIConfigStore.getState().getActive()
  if (!svc) throw new Error('请先在设置页配置并选择 AI 服务')

  const projectStore = useProjectStore.getState()
  let project = input.projectId ? projectStore.projects.find((item) => item.id === input.projectId) ?? null : projectStore.getCurrentProject()
  if (input.mode !== 'code-only' && input.mode !== 'flow-only') {
    if (!input.requirement?.trim()) throw new Error('请先填写硬件需求')
    project = projectStore.ensureProject({
      requirement: input.requirement.trim(),
      target: input.target ?? 'ESP32',
      format: input.format ?? 'espidf',
      selectedDriverIds: input.selectedDriverIds ?? [],
    }, input.createMode ?? 'update-current')
  }
  if (!project) throw new Error('请先选择一个项目')
  if ((input.mode === 'code-only' || input.mode === 'flow-only') && !project.scheme && input.mode === 'code-only') throw new Error('当前项目还没有硬件方案，请先生成方案')
  if (input.mode === 'flow-only' && !project.codeFiles.length) throw new Error('当前项目还没有工程代码，请先生成代码')

  lastStartInput = { ...input }

  controller?.abort()
  controller = new AbortController()
  const sessionId = await createAgentSession(project.id, input.mode, controller.signal)
  const run = projectStore.startPipeline(input.mode === 'scheme-only' ? 'scheme-generation' : input.mode === 'code-only' ? 'code-generation' : input.mode === 'flow-only' ? 'flow-generation' : 'scheme-generation', sessionId)
  const state = useGenerationStore.getState()
  state.start({ projectId: project.id, runId: run?.id ?? null, sessionId, jobId: null, mode: input.mode, model: svc.model, provider: svc.provider })
  if (input.mode === 'scheme-only' || input.mode === 'full-generation') projectStore.setGenerating('scheme', true)
  if (input.mode === 'code-only') projectStore.setGenerating('code', true)
  if (input.mode === 'flow-only') projectStore.setGenerating('flow', true)
  const chipSpec = useChipStore.getState().getSpec(project.target) ?? undefined
  let activeStage: GenerationStage = 'preparing'
  const signal = controller.signal

  try {
    if (input.mode === 'scheme-only' || input.mode === 'full-generation') {
      activeStage = 'scheme'
      updateStage(run?.id ?? null, 'scheme', 12, '正在分析需求并设计硬件方案', { model: svc.model, provider: svc.provider })
      const prompt = buildSchemePrompt(project.requirement, project.target, chipSpec)
      const schemeContract = await runAgentStage('scheme-generation', svc, [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }], sessionId, signal, parseHardwareScheme, (progress, message) => updateStage(run?.id ?? null, 'scheme', Math.max(12, progress), message, { model: svc.model, provider: svc.provider }))
      useProjectStore.getState().setScheme(schemeContract.data)
      completeStage(run?.id ?? null, 'scheme', '硬件方案已生成')
      activeStage = 'scheme-validation'
      updateStage(run?.id ?? null, 'scheme-validation', 78, '正在校验引脚、电源和外设约束')
      const pinValidation = await runPinValidationJob(project.id, schemeContract.data, sessionId, signal, (progress, message) => updateStage(run?.id ?? null, 'scheme-validation', Math.max(78, progress), message))
      completeStage(run?.id ?? null, 'scheme-validation', '硬件约束校验通过', { validationResult: pinValidation })
      project = useProjectStore.getState().getCurrentProject()!
      if (input.mode === 'full-generation') {
        useProjectStore.getState().setGenerating('scheme', false)
        useProjectStore.getState().setGenerating('code', true)
      }
    }

    if (input.mode === 'scheme-only') {
      skipStage(run?.id ?? null, 'code-validation')
      skipStage(run?.id ?? null, 'flow')
    }

    if (input.mode === 'full-generation' || input.mode === 'code-only') {
      activeStage = 'code'
      updateStage(run?.id ?? null, 'code', input.mode === 'code-only' ? 12 : 82, '正在根据硬件方案生成模块化工程代码', { model: svc.model, provider: svc.provider })
      const codeProject = useProjectStore.getState().getCurrentProject()!
      const codePrompt = buildCodegenPrompt(codeProject.scheme!, codeProject.target, codeProject.format, chipSpec)
      const codeContract = await runAgentStage('code-generation', svc, [{ role: 'system', content: codePrompt.system }, { role: 'user', content: codePrompt.user }], sessionId, signal, parseCodeFiles, (progress, message) => updateStage(run?.id ?? null, 'code', Math.max(12, progress), message, { model: svc.model, provider: svc.provider }), 0.15)
      useProjectStore.getState().setCodeFiles(codeContract.data)
      completeStage(run?.id ?? null, 'code', '固件工程已生成')
      activeStage = 'code-validation'
      updateStage(run?.id ?? null, 'code-validation', 90, '正在校验代码与方案一致性')
      const verifyPrompt = buildVerifyPrompt(codeProject.scheme!, codeContract.data)
      const verifyContract = await runAgentStage('code-validation', svc, [{ role: 'user', content: verifyPrompt }], sessionId, signal, parseVerification, (progress, message) => updateStage(run?.id ?? null, 'code-validation', Math.max(90, progress), message, { model: svc.model, provider: svc.provider }), 0.1)
      const warning = !verifyContract.data.consistent && verifyContract.data.issues.length > 0 ? `AI 自检发现 ${verifyContract.data.issues.length} 个潜在问题：\n${verifyContract.data.issues.map((issue) => issue.message).join('\n')}` : undefined
      useGenerationStore.getState().update({ warning })
      completeStage(run?.id ?? null, 'code-validation', warning ? '一致性校验有提示' : '代码一致性校验通过', warning ? { validationResult: { warning } } : { validationResult: verifyContract.data })
      useProjectStore.getState().setGenerating('code', false)
      if (input.mode === 'full-generation') useProjectStore.getState().setGenerating('flow', true)
    }

    if (input.mode === 'full-generation' || input.mode === 'flow-only') {
      activeStage = 'flow'
      updateStage(run?.id ?? null, 'flow', 94, '正在根据代码生成执行流程图', { model: svc.model, provider: svc.provider })
      const latestProject = useProjectStore.getState().getCurrentProject()!
      const flowPrompt = buildFlowPrompt(latestProject.codeFiles)
      const flowContract = await runAgentStage('flow-generation', svc, [{ role: 'system', content: flowPrompt.system }, { role: 'user', content: flowPrompt.user }], sessionId, signal, parseFlowGraph, (progress, message) => updateStage(run?.id ?? null, 'flow', Math.max(94, progress), message, { model: svc.model, provider: svc.provider }), 0.2)
      useProjectStore.getState().setFlowData(flowContract.data.nodes, flowContract.data.edges)
      completeStage(run?.id ?? null, 'flow', '执行流程图已生成')
      useProjectStore.getState().setGenerating('flow', false)
    }

    if (run) useProjectStore.getState().finishPipeline(run.id, 'succeeded')
    useGenerationStore.getState().finish('succeeded')
    return true
  } catch (error) {
    const cancelled = isCancelled(error)
    const message = cancelled ? '用户取消了生成任务' : String((error as { message?: string })?.message ?? error)
    if (run) {
      useProjectStore.getState().updatePipelineStage(run.id, stageToPipeline[activeStage === 'preparing' ? 'scheme' : activeStage], {
        status: cancelled ? 'cancelled' : 'failed',
        errorCode: cancelled ? 'CANCELLED' : 'STAGE_FAILED',
        errorMessage: message,
        finishedAt: Date.now(),
      })
      useProjectStore.getState().finishPipeline(run.id, cancelled ? 'cancelled' : 'failed')
    }
    useGenerationStore.getState().finish(cancelled ? 'cancelled' : 'failed', message)
    if (!cancelled) throw error
    return false
  } finally {
    const current = useProjectStore.getState()
    current.setGenerating('scheme', false)
    current.setGenerating('code', false)
    current.setGenerating('flow', false)
    activeServerJobId = null
    controller = null
  }
}
