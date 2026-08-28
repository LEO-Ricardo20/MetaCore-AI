import { describe, expect, it } from 'vitest'
import { getLocalHardwareKnowledgeContext } from './context'
import { localKnowledgeBase } from './localKnowledge'

describe('formal hardware core knowledge pack', () => {
  it('loads common MCU and teaching component entities', () => {
    const pack = localKnowledgeBase.getPack('metacore.hardware-core')
    expect(pack?.priority).toBe(100)
    expect(pack?.entities.length).toBeGreaterThanOrEqual(41)
    expect(pack?.entities.filter((entity) => entity.kind === 'chip')).toHaveLength(8)
    expect(pack?.entities.every((entity) => entity.reviewStatus === 'reviewed')).toBe(true)
  })

  it('strictly resolves common part aliases and exposes critical facts', () => {
    const aht20 = localKnowledgeBase.resolve('AHT-20')?.entity
    expect(aht20?.model).toBe('AHT20')
    expect(aht20?.interfaces[0].addresses).toContain('0x38')
    const ultrasonic = localKnowledgeBase.resolve('超声波模块')?.entity
    expect(ultrasonic?.model).toBe('HC-SR04')
    expect(ultrasonic?.constraints.some((item) => item.description.includes('3.3V MCU'))).toBe(true)
    expect(localKnowledgeBase.resolve('STM32F103RBT6')?.entity.model).toBe('STM32F103RBT6')
  })

  it('builds task-scoped prompt context instead of dumping the full pack', () => {
    const context = getLocalHardwareKnowledgeContext('使用 AHT20 和 SSD1306 做温湿度显示', 'ESP32')
    expect(context).toContain('AHT20')
    expect(context).toContain('0x38')
    expect(context).toContain('SSD1306')
    expect(context).not.toContain('HC-SR04')
    expect(context).not.toContain('LED-5MM')
    expect(context).toContain('metacore.hardware-core@1.0.0')
  })

  it('makes missing local coverage explicit', () => {
    const context = getLocalHardwareKnowledgeContext('使用 XYZ-UNKNOWN-999 器件', 'ESP32')
    expect(context).toContain('没有匹配到已收录的教学器件')
    expect(context).toContain('不得自行补全')
  })
})
