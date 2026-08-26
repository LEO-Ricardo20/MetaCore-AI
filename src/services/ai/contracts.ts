import { parseJSON } from '@/lib/utils'
import type { AITaskContract } from '@/types/agent'
import type { AIServiceConfig } from '@/types/ai'
import type { AITaskClarification } from '@/types/agent'
import { callAI, type CallAIOptions, type ChatMessage } from './client'

export const AI_TASK_SCHEMA_VERSION = '1.0'

export class AITaskClarificationError extends Error {
  readonly clarification: AITaskClarification

  constructor(taskType: string, questions: string[]) {
    const normalizedQuestions = questions.filter(Boolean).map((question) => question.trim()).filter(Boolean)
    super(`AI 需要补充信息：${normalizedQuestions.join('；') || '需求不完整'}`)
    this.name = 'AITaskClarificationError'
    this.clarification = { taskType, questions: normalizedQuestions, createdAt: Date.now() }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : []
}

const TASK_TYPE_ALIASES: Record<string, string> = {
  hardware_design: 'hardware-scheme',
  hardware_scheme: 'hardware-scheme',
  firmware_generation: 'firmware-generation',
  code_generation: 'firmware-generation',
  code_consistency: 'code-consistency',
  flow_graph: 'flow-graph',
  flow_generation: 'flow-graph',
}

function normalizeTaskType(value: unknown) {
  const raw = String(value ?? '').trim()
  const key = raw.toLowerCase().replace(/[\s-]+/g, '_')
  return TASK_TYPE_ALIASES[key] ?? raw
}

function normalizeContractStatus(value: unknown) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'completed' || raw === 'succeeded' || raw === 'success') return 'ok'
  return raw
}

function normalizeRiskItems(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (typeof item === 'string' && item.trim()) return { severity: 'warning' as const, message: item.trim().slice(0, 2_000) }
    return item
  })
}

function normalizeEvidenceItems(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (typeof item === 'string' && item.trim()) return { source: item.trim().slice(0, 500), excerpt: item.trim().slice(0, 2_000) }
    return item
  })
}

export function taskContractInstruction(taskType: string) {
  return `你必须使用 MetaCore Studio AI Task Contract v${AI_TASK_SCHEMA_VERSION}，并把它视为机器接口协议而不是普通回答格式。

## 唯一允许的顶层结构
最终只能输出一个 JSON 对象，不能有 Markdown、代码围栏、标题、前后解释、多个对象或尾随逗号：
{"schemaVersion":"${AI_TASK_SCHEMA_VERSION}","taskType":"${taskType}","status":"ok","assumptions":[],"openQuestions":[],"risks":[],"evidence":[],"data":{},"validationHints":[]}

## 顶层字段规则
- schemaVersion 必须精确为 "${AI_TASK_SCHEMA_VERSION}"。
- taskType 必须精确为 "${taskType}"；不能使用硬件设计、代码生成等别名。
- status 只能是 "ok"、"needs_clarification" 或 "invalid"。
- assumptions、openQuestions、risks、evidence、validationHints 必须始终是数组，不能用字符串、对象或 null 代替。
- risks 每项必须是 {"severity":"info|warning|error","message":"..."}；evidence 每项必须说明真实来源，可带 file、line、excerpt。
- data 必须严格符合当前任务要求的 schema，不能把结果放到顶层，也不能用字符串包裹 JSON。

## 状态规则
- 只有所有事实、约束和证据都已验证时才能 status="ok"；ok 不允许带未披露的猜测。
- 缺少芯片资料、引脚能力、代码证据、用户约束或其他必要信息时必须 status="needs_clarification"，并在 openQuestions 写出可执行的问题；此时不要伪造完整 data。
- 发现输入不可解析、任务类型不匹配或无法生成合法 schema 时使用 status="invalid"，不要伪造 data。
- 所有不确定推断必须显式放入 assumptions、openQuestions 或 risks；不能藏在 description、代码注释或 evidence 中。
- evidence 只能引用真实的用户需求、芯片/开发板资料、代码文件和可见行号；不得声称已经编译、运行或调用 API，除非输入中确有证据。

输出前逐项检查：JSON 可解析、字段类型正确、taskType 正确、data schema 完整、引用不虚构、数组没有空对象。`
}

export function parseTaskContract<T>(raw: string, taskType: string, parseData: (text: string) => T): AITaskContract<T> {
  const parsed = parseJSON<unknown>(raw)
  if (!isRecord(parsed)) throw new Error('AI Task Contract 不是有效 JSON 对象')
  const looksLikeContract = 'schemaVersion' in parsed || 'taskType' in parsed || 'status' in parsed || 'data' in parsed
  if (!looksLikeContract) {
    return { schemaVersion: AI_TASK_SCHEMA_VERSION, taskType, status: 'ok', assumptions: [], openQuestions: [], risks: [], evidence: [], data: parseData(raw), validationHints: [] }
  }
  if (parsed.schemaVersion !== AI_TASK_SCHEMA_VERSION) throw new Error(`AI Task Contract schemaVersion 无效：${String(parsed.schemaVersion)}`)
  if (normalizeTaskType(parsed.taskType) !== normalizeTaskType(taskType)) throw new Error(`AI Task Contract taskType 不匹配：${String(parsed.taskType)}`)
  const status = normalizeContractStatus(parsed.status)
  if (!['ok', 'needs_clarification', 'invalid'].includes(status)) throw new Error('AI Task Contract status 无效')
  if (status === 'invalid') throw new Error(`AI 返回 invalid：${strings(parsed.openQuestions).join('；') || '结果无效'}`)
  if (status === 'needs_clarification') throw new AITaskClarificationError(taskType, strings(parsed.openQuestions))
  const risks = normalizeRiskItems(parsed.risks).filter(isRecord).map((risk) => ({ severity: ['info', 'warning', 'error'].includes(String(risk.severity)) ? risk.severity as 'info' | 'warning' | 'error' : 'warning', message: String(risk.message ?? '').slice(0, 2_000) })).filter((risk) => risk.message)
  const evidence = normalizeEvidenceItems(parsed.evidence).filter(isRecord).map((item) => ({ source: String(item.source ?? '').slice(0, 500), file: typeof item.file === 'string' ? item.file.slice(0, 500) : undefined, line: Number.isFinite(Number(item.line)) ? Number(item.line) : undefined, excerpt: typeof item.excerpt === 'string' ? item.excerpt.slice(0, 2_000) : undefined })).filter((item) => item.source)
  const dataText = typeof parsed.data === 'string' ? parsed.data : JSON.stringify(parsed.data)
  if (!dataText) throw new Error('AI Task Contract 缺少 data 数据')
  return {
    schemaVersion: AI_TASK_SCHEMA_VERSION,
    taskType,
    status: 'ok',
    assumptions: strings(parsed.assumptions),
    openQuestions: strings(parsed.openQuestions),
    risks,
    evidence,
    data: parseData(dataText),
    validationHints: strings(parsed.validationHints),
  }
}

export async function callTaskContract<T>(
  service: AIServiceConfig,
  taskType: string,
  messages: ChatMessage[],
  parseData: (text: string) => T,
  options: Pick<CallAIOptions, 'signal' | 'temperature'> = {},
) {
  const contractMessages: ChatMessage[] = [{ role: 'system', content: taskContractInstruction(taskType) }, ...messages]
  const taskOptions = { ...options, taskType }
  const raw = await callAI(service, contractMessages, taskOptions)
  try {
    return { contract: parseTaskContract(raw, taskType, parseData), raw, repaired: false }
  } catch (initialError) {
    if (initialError instanceof AITaskClarificationError) throw initialError
    if (options.signal?.aborted) throw initialError
    const repairRaw = await callAI(service, [
      { role: 'system', content: taskContractInstruction(taskType) },
      { role: 'user', content: `修复下面的 AI 输出。错误：${initialError instanceof Error ? initialError.message : String(initialError)}\n原始输出：\n${raw.slice(0, 80_000)}` },
    ], { ...taskOptions, temperature: 0 })
    return { contract: parseTaskContract(repairRaw, taskType, parseData), raw, repairRaw, repaired: true }
  }
}
