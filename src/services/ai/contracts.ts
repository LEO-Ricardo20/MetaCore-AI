import { parseJSON } from '@/lib/utils'
import type { AITaskContract } from '@/types/agent'
import type { AIServiceConfig } from '@/types/ai'
import { callAI, type CallAIOptions, type ChatMessage } from './client'

export const AI_TASK_SCHEMA_VERSION = '1.0'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : []
}

export function taskContractInstruction(taskType: string) {
  return `你必须使用 MetaCore Studio AI Task Contract v${AI_TASK_SCHEMA_VERSION}。最终只输出一个 JSON 对象：\n{"schemaVersion":"${AI_TASK_SCHEMA_VERSION}","taskType":"${taskType}","status":"ok|needs_clarification|invalid","assumptions":[],"openQuestions":[],"risks":[{"severity":"info|warning|error","message":"..."}],"evidence":[{"source":"芯片规格、需求或代码","file":"可选路径","line":1,"excerpt":"可选证据"}],"data":任务要求的原始 JSON 结果,"validationHints":[]}\n如果没有证据，必须在 openQuestions 中说明不确定项，不得编造芯片参数、引脚、文件或构建结果。`
}

export function parseTaskContract<T>(raw: string, taskType: string, parseData: (text: string) => T): AITaskContract<T> {
  const parsed = parseJSON<unknown>(raw)
  if (!isRecord(parsed)) throw new Error('AI Task Contract 不是有效 JSON 对象')
  const looksLikeContract = 'schemaVersion' in parsed || 'taskType' in parsed || 'status' in parsed || 'data' in parsed
  if (!looksLikeContract) {
    return { schemaVersion: AI_TASK_SCHEMA_VERSION, taskType, status: 'ok', assumptions: [], openQuestions: [], risks: [], evidence: [], data: parseData(raw), validationHints: [] }
  }
  if (parsed.schemaVersion !== AI_TASK_SCHEMA_VERSION) throw new Error(`AI Task Contract schemaVersion 无效：${String(parsed.schemaVersion)}`)
  if (parsed.taskType !== taskType) throw new Error(`AI Task Contract taskType 不匹配：${String(parsed.taskType)}`)
  if (!['ok', 'needs_clarification', 'invalid'].includes(String(parsed.status))) throw new Error('AI Task Contract status 无效')
  if (parsed.status === 'invalid') throw new Error(`AI 返回 invalid：${strings(parsed.openQuestions).join('；') || '结果无效'}`)
  if (parsed.status === 'needs_clarification') throw new Error(`AI 需要补充信息：${strings(parsed.openQuestions).join('；') || '需求不完整'}`)
  const risks = Array.isArray(parsed.risks) ? parsed.risks.filter(isRecord).map((risk) => ({ severity: ['info', 'warning', 'error'].includes(String(risk.severity)) ? risk.severity as 'info' | 'warning' | 'error' : 'warning', message: String(risk.message ?? '').slice(0, 2_000) })).filter((risk) => risk.message) : []
  const evidence = Array.isArray(parsed.evidence) ? parsed.evidence.filter(isRecord).map((item) => ({ source: String(item.source ?? '').slice(0, 500), file: typeof item.file === 'string' ? item.file.slice(0, 500) : undefined, line: Number.isFinite(Number(item.line)) ? Number(item.line) : undefined, excerpt: typeof item.excerpt === 'string' ? item.excerpt.slice(0, 2_000) : undefined })).filter((item) => item.source) : []
  return {
    schemaVersion: AI_TASK_SCHEMA_VERSION,
    taskType,
    status: 'ok',
    assumptions: strings(parsed.assumptions),
    openQuestions: strings(parsed.openQuestions),
    risks,
    evidence,
    data: parseData(JSON.stringify(parsed.data)),
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
  const raw = await callAI(service, contractMessages, options)
  try {
    return { contract: parseTaskContract(raw, taskType, parseData), raw, repaired: false }
  } catch (initialError) {
    if (options.signal?.aborted) throw initialError
    const repairRaw = await callAI(service, [
      { role: 'system', content: taskContractInstruction(taskType) },
      { role: 'user', content: `修复下面的 AI 输出。错误：${initialError instanceof Error ? initialError.message : String(initialError)}\n原始输出：\n${raw.slice(0, 80_000)}` },
    ], { ...options, temperature: 0 })
    return { contract: parseTaskContract(repairRaw, taskType, parseData), raw, repairRaw, repaired: true }
  }
}
