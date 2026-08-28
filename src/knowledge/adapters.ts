import type { ChipSpec, PeripheralBus } from '@/types/hardware'
import type { KnowledgeEntity, KnowledgeJson } from '@/types/knowledge'

const SUPPORTED_PERIPHERALS = new Set<PeripheralBus['type']>(['I2C', 'SPI', 'UART', 'I2S', 'CAN', 'SDIO', 'USB', 'ADC', 'DAC', 'PWM'])

function stringFact(entity: KnowledgeEntity, key: string, fallback = '未知') {
  const value = entity.facts[key]?.value
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
}

function stringArray(value: KnowledgeJson | undefined) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function knowledgeEntityToChipSpec(entity: KnowledgeEntity): ChipSpec | null {
  if (!['chip', 'module', 'board'].includes(entity.kind)) return null
  const peripherals = entity.interfaces
    .filter((item): item is typeof item & { type: PeripheralBus['type'] } => SUPPORTED_PERIPHERALS.has(item.type as PeripheralBus['type']))
    .map((item) => ({ name: item.name, type: item.type, defaultPins: item.defaultPins ?? {} }))

  return {
    name: entity.displayName,
    fullName: entity.model,
    arch: stringFact(entity, 'architecture'),
    flash: stringFact(entity, 'flash'),
    sram: stringFact(entity, 'sram'),
    clockSpeed: stringFact(entity, 'clockSpeed'),
    voltage: stringFact(entity, 'voltage'),
    gpios: entity.pins.map((pin) => ({
      pin: pin.id,
      altFunctions: pin.signals,
      ...(Object.hasOwn(pin, 'inputOnly') ? { inputOnly: pin.inputOnly } : {}),
      ...(Object.hasOwn(pin, 'notes') ? { notes: pin.notes?.join('；') } : {}),
    })),
    peripherals,
    bootPins: stringArray(entity.facts.bootPins?.value),
    restrictions: entity.constraints.map((constraint) => constraint.description),
  }
}
