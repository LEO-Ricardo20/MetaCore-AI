import { describe, expect, it } from 'vitest'
import { KNOWLEDGE_SCHEMA_VERSION, type KnowledgeEntity } from '@/types/knowledge'
import { knowledgeEntityToChipSpec } from './adapters'

describe('knowledge compatibility adapters', () => {
  it('converts a sourced hardware entity into the current prompt contract', () => {
    const entity: KnowledgeEntity = {
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      id: 'vendor.chip.demo',
      kind: 'chip',
      manufacturer: 'Vendor',
      model: 'DEMO-1',
      displayName: 'Demo',
      aliases: [],
      tags: [],
      facts: {
        architecture: { value: 'RISC-V', evidence: [] },
        flash: { value: '4MB', evidence: [] },
        sram: { value: '512KB', evidence: [] },
        clockSpeed: { value: '160MHz', evidence: [] },
        voltage: { value: '3.3V', evidence: [] },
        bootPins: { value: ['GPIO0'], evidence: [] },
      },
      pins: [{ id: 'GPIO1', signals: ['I2C_SDA'], notes: ['default SDA'], evidence: [] }],
      interfaces: [{ type: 'I2C', name: 'I2C0', defaultPins: { SDA: 'GPIO1' }, evidence: [] }],
      constraints: [{ id: 'boot', category: 'boot', severity: 'warning', description: 'GPIO0 is sampled at boot', evidence: [] }],
      relations: [],
      drivers: [],
      sourceRefs: [],
      reviewStatus: 'draft',
    }
    expect(knowledgeEntityToChipSpec(entity)).toEqual({
      name: 'Demo',
      fullName: 'DEMO-1',
      arch: 'RISC-V',
      flash: '4MB',
      sram: '512KB',
      clockSpeed: '160MHz',
      voltage: '3.3V',
      gpios: [{ pin: 'GPIO1', altFunctions: ['I2C_SDA'], notes: 'default SDA' }],
      peripherals: [{ type: 'I2C', name: 'I2C0', defaultPins: { SDA: 'GPIO1' } }],
      bootPins: ['GPIO0'],
      restrictions: ['GPIO0 is sampled at boot'],
    })
  })

  it('does not treat component entities as MCU specifications', () => {
    const entity = { kind: 'sensor' } as KnowledgeEntity
    expect(knowledgeEntityToChipSpec(entity)).toBeNull()
  })
})
