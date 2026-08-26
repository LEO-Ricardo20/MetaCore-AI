import { parseJSON } from '@/lib/utils'
import { useAIConfigStore } from '@/store/aiConfigStore'
import { useGenerationStore } from '@/store/generationStore'
import { useProjectStore } from '@/store/projectStore'
import { callTaskContract } from './contracts'

export type SelectionPriorityKey = 'common' | 'optimal' | 'value' | 'best'

export type SelectionPriorities = Record<SelectionPriorityKey, number>

export interface HardwareCandidate {
  id: string
  category: SelectionPriorityKey
  model: string
  answer: string
  rationale: string
  confidence: 'high' | 'medium' | 'low'
  estimatedCost: string
  safetyNotes: string[]
  risks: string[]
}

export interface HardwareCandidateSet {
  questionIndex: number
  question: string
  candidates: HardwareCandidate[]
  recommendedId: string
  recommendationReason: string
}

export interface HardwareCandidatePlan {
  sets: HardwareCandidateSet[]
  safetySummary: string
}

export interface CandidateQuestion {
  questionIndex: number
  question: string
  answer?: string
}

export const DEFAULT_SELECTION_PRIORITIES: SelectionPriorities = {
  common: 35,
  optimal: 35,
  value: 20,
  best: 10,
}

export const SELECTION_PRIORITY_META: Array<{
  key: SelectionPriorityKey
  label: string
  shortLabel: string
  description: string
}> = [
  { key: 'common', label: '最常用', shortLabel: '成熟', description: '优先量产验证充分、资料和供应稳定的型号' },
  { key: 'optimal', label: '最优', shortLabel: '匹配', description: '优先与当前功能、接口和环境约束最匹配' },
  { key: 'value', label: '最有性价比', shortLabel: '性价比', description: '在安全和稳定底线之上优化采购和维护成本' },
  { key: 'best', label: '最好', shortLabel: '上限', description: '优先性能、余量、品质和后续扩展能力' },
]

const CATEGORY_ORDER = SELECTION_PRIORITY_META.map((item) => item.key)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string, maxLength = 2_000) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`AI 候选结果缺少字段：${field}`)
  return value.trim().slice(0, maxLength)
}

function stringArray(value: unknown, maxItems = 12) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim().slice(0, 1_000)).slice(0, maxItems)
    : []
}

function normalizeConfidence(value: unknown): HardwareCandidate['confidence'] {
  return value === 'high' || value === 'low' ? value : 'medium'
}

function normalizeCategory(value: unknown): SelectionPriorityKey | null {
  const category = String(value ?? '').trim().toLowerCase()
  return CATEGORY_ORDER.includes(category as SelectionPriorityKey) ? category as SelectionPriorityKey : null
}

export function selectionPriorityTotal(priorities: SelectionPriorities) {
  return CATEGORY_ORDER.reduce((sum, key) => sum + priorities[key], 0)
}

function validSelectionPriorities(priorities: SelectionPriorities) {
  return CATEGORY_ORDER.every((key) => Number.isInteger(priorities[key]) && priorities[key] >= 0 && priorities[key] <= 100)
}

/**
 * Move one slider while keeping the four-way allocation exactly at 100.
 * Points released by the edited category are redistributed to the other
 * categories; points needed by it are taken from the other categories first.
 * The one-point loop keeps every value integral and makes the 0/100 edges
 * deterministic without allowing negative values or a total above 100.
 */
export function updateSelectionPriority(priorities: SelectionPriorities, key: SelectionPriorityKey, requestedValue: number): SelectionPriorities {
  const currentValue = priorities[key]
  const value = Math.max(0, Math.min(100, Math.round(Number(requestedValue) || 0)))
  const delta = value - currentValue
  if (delta === 0) return priorities

  const next = { ...priorities, [key]: value }
  const others = CATEGORY_ORDER.filter((item) => item !== key)
  let remaining = Math.abs(delta)

  while (remaining > 0) {
    const eligible = others.filter((item) => delta > 0 ? next[item] > 0 : next[item] < 100)
    if (!eligible.length) break
    eligible.sort((left, right) => {
      const leftCapacity = delta > 0 ? next[left] : 100 - next[left]
      const rightCapacity = delta > 0 ? next[right] : 100 - next[right]
      return rightCapacity - leftCapacity || CATEGORY_ORDER.indexOf(left) - CATEGORY_ORDER.indexOf(right)
    })
    const selected = eligible[0]
    next[selected] += delta > 0 ? -1 : 1
    remaining -= 1
  }

  return next
}

export function parseHardwareCandidatePlan(text: string): HardwareCandidatePlan {
  const parsed = parseJSON<unknown>(text)
  if (!isRecord(parsed) || !Array.isArray(parsed.sets)) throw new Error('AI 没有返回有效的候选型号列表')
  const sets = parsed.sets.slice(0, 30).map((rawSet, setIndex) => {
    if (!isRecord(rawSet) || !Array.isArray(rawSet.candidates)) throw new Error(`AI 候选结果 sets[${setIndex}] 无效`)
    const questionIndex = Number(rawSet.questionIndex)
    if (!Number.isInteger(questionIndex) || questionIndex < 0) throw new Error(`AI 候选结果 sets[${setIndex}].questionIndex 无效`)
    const seen = new Set<SelectionPriorityKey>()
    const candidates = rawSet.candidates.slice(0, 8).map((rawCandidate, candidateIndex) => {
      if (!isRecord(rawCandidate)) throw new Error(`AI 候选结果 candidates[${candidateIndex}] 无效`)
      const category = normalizeCategory(rawCandidate.category)
      if (!category || seen.has(category)) throw new Error('每个问题必须分别返回最常用、最优、最有性价比和最好四类候选')
      seen.add(category)
      return {
        id: requiredString(rawCandidate.id, `candidates[${candidateIndex}].id`, 120),
        category,
        model: requiredString(rawCandidate.model, `candidates[${candidateIndex}].model`, 300),
        answer: requiredString(rawCandidate.answer, `candidates[${candidateIndex}].answer`, 2_000),
        rationale: requiredString(rawCandidate.rationale, `candidates[${candidateIndex}].rationale`, 2_000),
        confidence: normalizeConfidence(rawCandidate.confidence),
        estimatedCost: typeof rawCandidate.estimatedCost === 'string' && rawCandidate.estimatedCost.trim() ? rawCandidate.estimatedCost.trim().slice(0, 300) : '待供应商报价',
        safetyNotes: stringArray(rawCandidate.safetyNotes),
        risks: stringArray(rawCandidate.risks),
      }
    }).sort((left, right) => CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category))
    if (candidates.length !== CATEGORY_ORDER.length || seen.size !== CATEGORY_ORDER.length) throw new Error('每个问题必须返回四类完整候选')
    const requestedRecommendedId = requiredString(rawSet.recommendedId, `sets[${setIndex}].recommendedId`, 120)
    const recommendedId = candidates.some((candidate) => candidate.id === requestedRecommendedId)
      ? requestedRecommendedId
      : candidates[0].id
    return {
      questionIndex,
      question: requiredString(rawSet.question, `sets[${setIndex}].question`, 2_000),
      candidates,
      recommendedId,
      recommendationReason: requiredString(rawSet.recommendationReason, `sets[${setIndex}].recommendationReason`, 2_000),
    }
  })
  return {
    sets,
    safetySummary: requiredString(parsed.safetySummary, 'safetySummary', 4_000),
  }
}

export function buildHardwareCandidatePrompt(
  questions: CandidateQuestion[],
  priorities: SelectionPriorities,
  context: { requirement: string; target: string; format: string; esp32?: unknown },
) {
  const questionText = questions.map((item) => [
    `问题 ${item.questionIndex}：${item.question}`,
    item.answer?.trim() ? `用户当前回答：${item.answer.trim()}` : '用户当前回答：尚未填写',
  ].join('\n')).join('\n')
  return {
    system: `你是负责量产前选型评审的资深嵌入式硬件工程师。你的任务是为用户没有指定的型号或工程参数提供四类可复核候选，并按用户权重给出一个保守推荐。

## 安全门槛（优先级高于用户权重）
1. 宁可选择性能余量更大、资料更完整、生态更成熟的型号，也不得为了低价、小体积或理论性能牺牲稳定性。
2. 先排除电压、峰值/持续电流、功耗、热设计、逻辑电平、带宽、引脚、封装、通信协议或安规不兼容的候选，再进行权重评分。
3. 优先使用可获得官方数据手册、应用设计经验充分、供应稳定且非 NRND/EOL 的型号；无法验证时必须降低 confidence 并列入 risks。
4. 感性负载、大电流、电池、市电、加热、高压或人身安全相关设计必须保留合理降额，并强制列出保险、限流、反接、TVS/续流、温升和隔离等复核项。
5. 不得声称已查询实时价格、库存、认证或真实测试。价格只能是区间估算，且必须提醒以供应商报价为准。
6. 严格区分 SoC、模组、开发板、外设 IC 和成品模块；model 应写可采购和可核对的完整型号或明确规格。
7. 如果没有任何候选能通过安全门槛，返回 needs_clarification 并提出缺失的最少必要参数，不得强行推荐。

## 四类候选的固定含义
- common：最常用，成熟度、文档、供应和可维护性优先。
- optimal：最优，与当前已知功能和约束的匹配度优先。
- value：最有性价比，在安全门槛之上优化总成本，不得推荐廉价但高风险的替代品。
- best：最好，优先品质、余量、性能和扩展上限，但仍必须与需求兼容。`,
    user: `## 项目上下文
原始需求：${context.requirement}
目标平台：${context.target}
工程格式：${context.format}
开发板与存储配置：${context.esp32 ? JSON.stringify(context.esp32) : '未提供'}

## 待处理问题
${questionText}

## 用户权重（合计必须为 100）
- common / 最常用：${priorities.common}
- optimal / 最优：${priorities.optimal}
- value / 最有性价比：${priorities.value}
- best / 最好：${priorities.best}

先用安全门槛剔除不合格方案，再对通过者按权重、稳定性和可验证性综合排序。每个问题必须返回四个不重复的候选，category 依次覆盖 common、optimal、value、best。recommendedId 必须指向已通过安全门槛的一项，且推荐理由必须说明风险取舍。

data 严格按以下结构返回：
{
  "sets": [
    {
      "questionIndex": 0,
      "question": "原问题",
      "candidates": [
        {
          "id": "q0-common",
          "category": "common|optimal|value|best",
          "model": "完整器件型号或明确方案规格",
          "answer": "可直接作为该问题用户回答的完整参数",
          "rationale": "选择依据和关键取舍",
          "confidence": "high|medium|low",
          "estimatedCost": "人民币估算区间或待报价",
          "safetyNotes": ["安全/稳定性保障和必要外围"],
          "risks": ["仍需人工核对的数据手册、环境或采购风险"]
        }
      ],
      "recommendedId": "q0-common",
      "recommendationReason": "结合用户权重与安全门槛的推荐理由"
    }
  ],
  "safetySummary": "本次选型中已应用的保守策略和后续必查项"
}

questionIndex 必须保留“待处理问题”中的原数字，不得按数组位置重新编号。`,
  }
}

export async function requestHardwareCandidates(
  questions: CandidateQuestion[],
  priorities: SelectionPriorities,
  signal?: AbortSignal,
) {
  if (!questions.length) throw new Error('没有需要生成候选的问题')
  if (!validSelectionPriorities(priorities) || selectionPriorityTotal(priorities) !== 100) throw new Error('四项选型权重必须是 0-100 的整数，且合计等于 100')
  const service = useAIConfigStore.getState().getStructuredGenerationService()
  if (!service) throw new Error('请先在设置页配置并启用 AI 服务')
  const generationProjectId = useGenerationStore.getState().projectId
  const projectState = useProjectStore.getState()
  const project = (generationProjectId ? projectState.projects.find((item) => item.id === generationProjectId) : null) ?? projectState.getCurrentProject()
  if (!project) throw new Error('找不到当前项目上下文')
  const prompt = buildHardwareCandidatePrompt(questions, priorities, {
    requirement: project.requirement,
    target: project.target,
    format: project.format,
    esp32: project.esp32,
  })
  const result = await callTaskContract(
    service,
    'hardware-candidates',
    [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
    parseHardwareCandidatePlan,
    { signal, temperature: 0.1 },
  )
  return result.contract.data
}

export function candidateToClarificationAnswer(set: HardwareCandidateSet, candidate: HardwareCandidate) {
  const meta = SELECTION_PRIORITY_META.find((item) => item.key === candidate.category)
  return [
    `已选型号/方案：${candidate.model}`,
    `选型类型：${meta?.label ?? candidate.category}`,
    `确认参数：${candidate.answer}`,
    `选择依据：${candidate.rationale}`,
    candidate.safetyNotes.length ? `安全与稳定要求：${candidate.safetyNotes.join('；')}` : '',
    candidate.risks.length ? `生成前必须保留的风险复核：${candidate.risks.join('；')}` : '',
    `AI 推荐说明：${set.recommendationReason}`,
  ].filter(Boolean).join('\n')
}
