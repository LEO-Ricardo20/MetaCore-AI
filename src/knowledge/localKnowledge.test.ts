import { describe, expect, it } from 'vitest'
import { CHIP_SPECS } from '@/data/chipSpecs'
import { DRIVER_TEMPLATES } from '@/data/driverTemplates'
import { getLocalChipNames, getLocalChipSpec, getLocalDriverTemplate, localKnowledgeBase } from './localKnowledge'

describe('built-in local knowledge base', () => {
  it('adapts all existing chip specs and driver templates', () => {
    const stats = localKnowledgeBase.stats()
    expect(stats.packs).toBe(2)
    expect(stats.entities).toBeGreaterThan(Object.keys(CHIP_SPECS).length + DRIVER_TEMPLATES.length)
    expect(stats.byReviewStatus.reviewed).toBe(stats.entities)
  })

  it('preserves current chip lookup behavior through aliases', () => {
    expect(getLocalChipNames()).toEqual(expect.arrayContaining(Object.keys(CHIP_SPECS)))
    Object.keys(CHIP_SPECS).forEach((name) => expect(getLocalChipSpec(name)?.name).toBe(name))
    expect(getLocalChipSpec(CHIP_SPECS.STM32F103.fullName)?.name).toBe('STM32F103')
    expect(getLocalChipSpec('not-a-chip')).toBeNull()
  })

  it('prefers the formal hardware pack over legacy aliases', () => {
    const resolved = localKnowledgeBase.resolve('ESP32')
    expect(resolved?.packId).toBe('metacore.hardware-core')
    expect(resolved?.entity.model).toBe('ESP32-WROOM-32E')
  })

  it('resolves existing drivers without claiming official verification', () => {
    expect(getLocalDriverTemplate('OLED')?.id).toBe('ssd1306')
    const entity = localKnowledgeBase.resolve('ssd1306', { kinds: ['driver'] })?.entity
    expect(entity?.reviewStatus).toBe('reviewed')
    expect(entity?.sourceRefs).toEqual(['metacore.legacy-driver-templates'])
  })
})
