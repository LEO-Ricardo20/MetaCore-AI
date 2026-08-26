import { describe, expect, it } from 'vitest'
import {
  buildHardwareCandidatePrompt,
  candidateToClarificationAnswer,
  DEFAULT_SELECTION_PRIORITIES,
  parseHardwareCandidatePlan,
  selectionPriorityTotal,
  updateSelectionPriority,
} from './selectionAssistant'

const candidateData = {
  sets: [{
    questionIndex: 2,
    question: '请确认电机驱动型号',
    candidates: [
      { id: 'q2-best', category: 'best', model: 'DRV8876', answer: 'DRV8876，按数据手册配置电流限制', rationale: '保护能力和余量高', confidence: 'medium', estimatedCost: '¥20-35', safetyNotes: ['校验温升'], risks: ['成本较高'] },
      { id: 'q2-common', category: 'common', model: 'TB6612FNG', answer: 'TB6612FNG，电机峰值电流不得超过数据手册限值', rationale: '资料和应用经验成熟', confidence: 'high', estimatedCost: '¥5-12', safetyNotes: ['保留去耦和散热'], risks: ['需复核堵转电流'] },
      { id: 'q2-value', category: 'value', model: 'DRV8833', answer: 'DRV8833，确认实际模块散热铺铜', rationale: '在安全余量上优化成本', confidence: 'medium', estimatedCost: '¥3-8', safetyNotes: ['增加电源去耦'], risks: ['模块版型差异'] },
      { id: 'q2-optimal', category: 'optimal', model: 'DRV8251A', answer: 'DRV8251A，按实际电机选择限流电阻', rationale: '与单路电机和限流需求匹配', confidence: 'medium', estimatedCost: '¥10-18', safetyNotes: ['限流降额'], risks: ['需确认封装'] },
    ],
    recommendedId: 'q2-common',
    recommendationReason: '成熟度和安全余量的综合风险最低',
  }],
  safetySummary: '设计冻结前复核峰值电流、温升和保护电路。',
}

describe('hardware selection assistant', () => {
  it('keeps the allocation exactly at the 100-point budget when increasing or decreasing a slider', () => {
    const freed = updateSelectionPriority(DEFAULT_SELECTION_PRIORITIES, 'best', 0)
    expect(freed.best).toBe(0)
    expect(selectionPriorityTotal(freed)).toBe(100)

    const increased = updateSelectionPriority(freed, 'value', 40)
    expect(increased.value).toBe(40)
    expect(selectionPriorityTotal(increased)).toBe(100)

    const maxed = updateSelectionPriority(DEFAULT_SELECTION_PRIORITIES, 'common', 100)
    expect(maxed.common).toBe(100)
    expect(selectionPriorityTotal(maxed)).toBe(100)
    expect(Object.values(maxed).every((value) => value >= 0 && value <= 100)).toBe(true)
  })

  it('redistributes points without producing negative values at the slider extremes', () => {
    let priorities = DEFAULT_SELECTION_PRIORITIES
    for (const key of ['common', 'optimal', 'value', 'best'] as const) {
      priorities = updateSelectionPriority(priorities, key, 0)
      expect(selectionPriorityTotal(priorities)).toBe(100)
      expect(Object.values(priorities).every((value) => Number.isInteger(value) && value >= 0 && value <= 100)).toBe(true)
    }
    priorities = updateSelectionPriority(priorities, 'best', 100)
    expect(selectionPriorityTotal(priorities)).toBe(100)
    expect(Object.values(priorities).every((value) => value >= 0 && value <= 100)).toBe(true)
  })

  it('parses and orders all four candidate categories', () => {
    const plan = parseHardwareCandidatePlan(JSON.stringify(candidateData))
    expect(plan.sets[0].questionIndex).toBe(2)
    expect(plan.sets[0].candidates.map((candidate) => candidate.category)).toEqual(['common', 'optimal', 'value', 'best'])
    expect(plan.sets[0].recommendedId).toBe('q2-common')
    expect(candidateToClarificationAnswer(plan.sets[0], plan.sets[0].candidates[0])).toContain('已选型号/方案：TB6612FNG')
  })

  it('rejects an incomplete category set', () => {
    const incomplete = structuredClone(candidateData)
    incomplete.sets[0].candidates.pop()
    expect(() => parseHardwareCandidatePlan(JSON.stringify(incomplete))).toThrow(/四类完整候选/)
  })

  it('puts conservative safety gates ahead of preference weights', () => {
    const prompt = buildHardwareCandidatePrompt(
      [{ questionIndex: 4, question: '请确认电池型号与容量' }],
      DEFAULT_SELECTION_PRIORITIES,
      { requirement: '电池供电的便携设备', target: 'ESP32-S3', format: 'espidf' },
    )
    expect(prompt.system).toContain('安全门槛（优先级高于用户权重）')
    expect(prompt.system).toContain('不得为了低价、小体积或理论性能牺牲稳定性')
    expect(prompt.system).toContain('保险、限流、反接、TVS/续流')
    expect(prompt.user).toContain('common / 最常用：35')
    expect(prompt.user).toContain('questionIndex 必须保留')
  })

  it('passes the current user answer into candidate generation context', () => {
    const prompt = buildHardwareCandidatePrompt(
      [{ questionIndex: 1, question: '请确认传感器型号', answer: '已知使用 3.3V，I2C，环境温度 -20~60C' }],
      DEFAULT_SELECTION_PRIORITIES,
      { requirement: '读取温度', target: 'ESP32-S3', format: 'espidf' },
    )
    expect(prompt.user).toContain('用户当前回答：已知使用 3.3V，I2C，环境温度 -20~60C')
  })
})
