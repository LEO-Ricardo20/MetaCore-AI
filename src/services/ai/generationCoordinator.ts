import { useAIConfigStore } from '@/store/aiConfigStore'
import { useChipStore } from '@/store/chipStore'
import { useGenerationStore, type GenerationMode, type GenerationStage } from '@/store/generationStore'
import { useProjectStore } from '@/store/projectStore'
import type { ChipTarget, ProjectFormat } from '@/types/hardware'
import type { Esp32ProjectConfig } from '@/types/esp32'
import type { HardwareScheme } from '@/types/project'
import type { HardwareModelSelection } from '@/types/project'
import { buildCodegenPrompt, buildFlowPrompt, buildSchemePrompt, buildVerifyPrompt } from './prompts'
import { parseCodeFiles, parseFlowGraph, parseHardwareScheme, parseVerification } from './validation'
import { AITaskClarificationError, parseTaskContract, taskContractInstruction } from './contracts'
import type { AIServiceConfig } from '@/types/ai'
import { isEsp32Target, validateEsp32PinAssignments, validateEsp32ProjectConfig } from '@/services/esp32/esp32Config'
import type { SelectionPriorities } from './selectionAssistant'

interface StartInput {
  requirement?: string
  target?: ChipTarget
  format?: ProjectFormat
  selectedDriverIds?: string[]
  esp32?: Esp32ProjectConfig
  mode: GenerationMode
  projectId?: string
  createMode?: 'update-current' | 'new-version'
  modelSelection?: HardwareModelSelection
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const NON_MODEL_TOKENS = new Set(['GPIO', 'I2C', 'SPI', 'UART', 'CAN', 'USB', 'PWM', 'ADC', 'DAC', 'BLE', 'WIFI', 'MQTT'])

/** Conservative preflight: generic requirements must enter model selection first. */
export function buildMissingModelQuestions(requirement: string, target: string) {
  const text = requirement.trim()
  const normalizedTarget = target.trim().toUpperCase()
  const explicitTokens = text.toUpperCase().match(/\b[A-Z]{2,}[A-Z0-9-]*\d[A-Z0-9-]*\b/g) ?? []
  const hasExplicitModel = explicitTokens.some((token) => {
    const normalized = token.replace(/[^A-Z0-9]/g, '')
    const isNonModelToken = [...NON_MODEL_TOKENS].some((prefix) => normalized === prefix || normalized.startsWith(prefix))
    const isTargetVariant = normalized === normalizedTarget.replace(/[^A-Z0-9]/g, '') || normalized.startsWith(normalizedTarget.replace(/[^A-Z0-9]/g, ''))
    return !isTargetVariant && !isNonModelToken
  }) || /(?:型号|料号|part\s*(?:number|no\.?))\s*[:：]?\s*[A-Z0-9][A-Z0-9-]{2,}/i.test(text)
  if (hasExplicitModel) return []

  const questions: string[] = []
  if (/(传感器|温度|湿度|压力|光照|加速度|陀螺|IMU|测量)/i.test(text)) questions.push('请确认传感器的完整型号、接口、电压、量程和精度')
  if (/(显示|OLED|LCD|屏幕|屏)/i.test(text)) questions.push('请确认显示屏的完整型号、尺寸、接口和工作电压')
  if (/(电机|继电器|电磁阀|阀门|舵机|执行器|加热)/i.test(text)) questions.push('请确认执行器及驱动器的完整型号、工作电压、持续/峰值电流和保护要求')
  if (/(电池|电源|供电|充电|锂电|电压转换)/i.test(text)) questions.push('请确认电池/电源和保护器件的型号、输入输出电压、电流与功率余量')
  if (/(Wi-?Fi|蓝牙|BLE|LoRa|CAN|RS485|串口|通信|MQTT|以太网)/i.test(text)) questions.push('请确认通信模块/收发器的完整型号、接口、电平和终端要求')
  if (!questions.length) questions.push('请确认所有关键外部器件的完整型号或明确规格（传感器、显示、执行器、驱动、电源、通信模块）')
  return questions
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

/** 用用户在澄清对话框中填写的答案继续最近一次生成任务。 */
export async function resumeGenerationWithClarification(answers: string[], options: { selectionPriorities?: SelectionPriorities; candidateSafetySummary?: string; modelSelection?: HardwareModelSelection } = {}) {
  const state = useGenerationStore.getState()
  const project = state.projectId ? useProjectStore.getState().projects.find((item) => item.id === state.projectId) : useProjectStore.getState().getCurrentProject()
  const clarification = state.clarification ?? project?.pendingClarification
  const mode = state.mode ?? clarification?.generationMode ?? 'scheme-only'
  if (!clarification || !project) throw new Error('没有可继续的澄清任务')
  const normalized = answers.map((answer) => answer.trim())
  if (normalized.length !== clarification.questions.length || normalized.some((answer) => !answer)) throw new Error('请逐项回答所有问题，或使用“让 AI 给出候选方案”')
  const clarificationText = clarification.questions.map((question, index) => `问题 ${index + 1}：${question}\n用户回答：${normalized[index]}`).join('\n\n')
  const priorityText = options.selectionPriorities
    ? `\n\n## 用户的 AI 硬件选型权重（合计 100）\n最常用：${options.selectionPriorities.common}\n最优：${options.selectionPriorities.optimal}\n最有性价比：${options.selectionPriorities.value}\n最好：${options.selectionPriorities.best}\n注意：权重只能在通过电气安全、器件降额、资料完整性和可供应性门槛的候选中排序，不得用权重覆盖安全门槛。`
    : ''
  const safetyText = options.candidateSafetySummary?.trim() ? `\n\n## AI 候选阶段的安全摘要\n${options.candidateSafetySummary.trim()}` : ''
  const requirement = `${project.requirement}\n\n## 用户确认的补充信息\n${clarificationText}${priorityText}${safetyText}`
  useProjectStore.getState().clearPendingClarification()
  useGenerationStore.getState().update({ clarification: undefined, error: undefined })
  return startGeneration({
    requirement,
    target: project.target,
    format: project.format,
    selectedDriverIds: project.selectedDriverIds,
    esp32: project.esp32,
    modelSelection: options.modelSelection,
    mode,
    projectId: project.id,
    createMode: 'update-current',
  })
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
  const contract = parseTaskContract(result.content, taskType, parse)
  // The contract metadata is part of the design review surface. Some models
  // put assumptions, open questions and risks only in the envelope rather
  // than inside data, so carry it into the HardwareScheme artifact.
  if (taskType === 'hardware-scheme' && isRecord(contract.data)) {
    contract.data = {
      ...contract.data,
      assumptions: contract.assumptions,
      openQuestions: contract.openQuestions,
      risks: contract.risks,
    } as T
  }
  return contract
}

async function runPinValidationJob(projectId: string, scheme: HardwareScheme, sessionId: string, signal: AbortSignal, onProgress: (progress: number, message: string) => void) {
  const pins = scheme.pins.map((pin) => ({
    pin: pin.pinNumber,
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

function pinIdentifier(value: string) {
  const raw = value.trim().toUpperCase().replace(/\s+/g, '')
  return /^(GPIO|IO)\d+$/.test(raw) ? `GPIO${raw.replace(/^(GPIO|IO)/, '')}` : raw
}

function findSchemePinConflicts(scheme: HardwareScheme) {
  const seen = new Map<string, { name: string; assignment: string }>()
  const conflicts: Array<{ pin: string; assignments: string[] }> = []
  for (const pin of scheme.pins) {
    const key = pinIdentifier(pin.pinNumber)
    if (!key) continue
    const current = { name: pin.pinName || pin.function, assignment: `${pin.function} -> ${pin.connectedTo}` }
    const previous = seen.get(key)
    if (previous && (previous.name !== current.name || previous.assignment !== current.assignment)) {
      conflicts.push({ pin: key, assignments: [previous.assignment, current.assignment] })
    } else if (!previous) {
      seen.set(key, current)
    }
  }
  return conflicts
}

export async function startGeneration(input: StartInput) {
  if (isGenerationRunning()) return false
  // Long hardware/code/flow contracts need a provider that reliably returns
  // a complete JSON document. Keep ordinary chat on getActive(), but prefer
  // verified official DeepSeek and then SiliconFlow DeepSeek for generation.
  const svc = useAIConfigStore.getState().getStructuredGenerationService()
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
      esp32: input.esp32,
      modelSelection: input.modelSelection,
    }, input.createMode ?? 'update-current')
  }
  if (!project) throw new Error('请先选择一个项目')
  if (isEsp32Target(project.target) && project.esp32) {
    const configError = validateEsp32ProjectConfig(project.esp32, project.format).find((issue) => issue.severity === 'error')
    if (configError) throw new Error(configError.message)
  }
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
      if (!project.modelSelection) {
        const missingModelQuestions = buildMissingModelQuestions(project.requirement, project.target)
        if (missingModelQuestions.length) throw new AITaskClarificationError('hardware-scheme', missingModelQuestions)
      }
      updateStage(run?.id ?? null, 'scheme', 12, '正在分析需求并设计硬件方案', { model: svc.model, provider: svc.provider })
      const prompt = buildSchemePrompt(project.requirement, project.target, chipSpec, project.esp32, project.format, project.modelSelection)
      let schemeContract = await runAgentStage('scheme-generation', svc, [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }], sessionId, signal, parseHardwareScheme, (progress, message) => updateStage(run?.id ?? null, 'scheme', Math.max(12, progress), message, { model: svc.model, provider: svc.provider }))
      useProjectStore.getState().setScheme(schemeContract.data)
      completeStage(run?.id ?? null, 'scheme', '硬件方案已生成')
      activeStage = 'scheme-validation'
      updateStage(run?.id ?? null, 'scheme-validation', 78, '正在校验引脚、电源和外设约束')
      let pinValidation
      try {
        pinValidation = await runPinValidationJob(project.id, schemeContract.data, sessionId, signal, (progress, message) => updateStage(run?.id ?? null, 'scheme-validation', Math.max(78, progress), message))
      } catch (validationError) {
        const conflicts = findSchemePinConflicts(schemeContract.data)
        const validationMessage = String((validationError as { message?: string })?.message ?? validationError)
        if (!conflicts.length || isCancelled(validationError) || !/PIN_CONFLICT|引脚冲突/i.test(validationMessage)) throw validationError
        updateStage(run?.id ?? null, 'scheme', 48, `发现 ${conflicts.length} 组引脚冲突，正在自动重新规划`, { model: svc.model, provider: svc.provider, repairAttempt: true, conflicts })
        const repairPrompt = `原始硬件方案已经返回，但引脚校验发现以下冲突，不能接受：\n${conflicts.map((item) => `${item.pin}：${item.assignments.join('；')}`).join('\n')}\n\n请在保持原需求、芯片和外设功能不变的前提下，重新规划所有受影响引脚，并重新输出完整硬件方案。每个完整引脚编号只能出现一次；STM32 的 PA12、PB12 等不同端口不能混淆。输出必须严格遵循上一条消息要求的 JSON Task Contract，不要解释过程。\n\n原始方案：\n${JSON.stringify(schemeContract.data).slice(0, 60_000)}`
        schemeContract = await runAgentStage('scheme-generation', svc, [{ role: 'system', content: prompt.system }, { role: 'user', content: `${prompt.user}\n\n${repairPrompt}` }], sessionId, signal, parseHardwareScheme, (progress, message) => updateStage(run?.id ?? null, 'scheme', Math.max(48, progress), message, { model: svc.model, provider: svc.provider, repairAttempt: true }), 0.1)
        useProjectStore.getState().setScheme(schemeContract.data)
        completeStage(run?.id ?? null, 'scheme', '硬件方案已自动修正', { repairAttempt: true, conflictsResolved: conflicts })
        updateStage(run?.id ?? null, 'scheme-validation', 78, '正在复核自动修正后的引脚分配')
        pinValidation = await runPinValidationJob(project.id, schemeContract.data, sessionId, signal, (progress, message) => updateStage(run?.id ?? null, 'scheme-validation', Math.max(78, progress), message))
      }
      const esp32Issues = project.esp32 ? validateEsp32PinAssignments(project.esp32, schemeContract.data.pins) : []
      const blockingPinIssue = esp32Issues.find((issue) => issue.severity === 'error')
      if (blockingPinIssue) {
        useProjectStore.getState().setArtifactStatus('pinMap', 'invalid', blockingPinIssue.code)
        throw new Error(`${blockingPinIssue.message}（${blockingPinIssue.code}）`)
      }
      completeStage(run?.id ?? null, 'scheme-validation', esp32Issues.length ? `硬件约束校验通过，${esp32Issues.length} 项需复核` : '硬件约束校验通过', { validationResult: { ...pinValidation, esp32Issues } })
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
      const codePrompt = buildCodegenPrompt(codeProject.scheme!, codeProject.target, codeProject.format, chipSpec, codeProject.esp32)
      const codeContract = await runAgentStage('code-generation', svc, [{ role: 'system', content: codePrompt.system }, { role: 'user', content: codePrompt.user }], sessionId, signal, parseCodeFiles, (progress, message) => updateStage(run?.id ?? null, 'code', Math.max(12, progress), message, { model: svc.model, provider: svc.provider }), 0.15)
      useProjectStore.getState().setCodeFiles(codeContract.data)
      completeStage(run?.id ?? null, 'code', '固件工程已生成')
      activeStage = 'code-validation'
      updateStage(run?.id ?? null, 'code-validation', 90, '正在校验代码与方案一致性')
      const verifyPrompt = buildVerifyPrompt(codeProject.scheme!, codeContract.data, codeProject.target)
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
    if (error instanceof AITaskClarificationError) {
      const clarification = { ...error.clarification, generationMode: input.mode }
      useGenerationStore.getState().update({ clarification, stage: activeStage === 'preparing' ? 'scheme' : activeStage })
      useGenerationStore.getState().finish('needs_clarification')
      useProjectStore.getState().setPendingClarification(clarification)
      if (run) useProjectStore.getState().pausePipelineForClarification(run.id, '等待用户补充工程约束')
      return false
    }
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
