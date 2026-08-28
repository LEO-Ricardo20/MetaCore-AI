import { describe, expect, it } from 'vitest'
import { KNOWLEDGE_SCHEMA_VERSION, type KnowledgePack } from '@/types/knowledge'
import { validateKnowledgePack } from './schema'

function createPack(): KnowledgePack {
  return {
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    id: 'test.core',
    name: 'Test Core',
    version: '1.0.0',
    sources: [{
      id: 'vendor.datasheet',
      type: 'datasheet',
      title: 'Vendor Datasheet',
      owner: 'Vendor',
      official: true,
      url: 'https://example.com/datasheet.pdf',
      revision: '1.0',
    }],
    entities: [{
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      id: 'vendor.chip.demo',
      kind: 'chip',
      manufacturer: 'Vendor',
      model: 'DEMO-1',
      displayName: 'Demo Chip',
      aliases: ['demo1'],
      tags: ['mcu'],
      facts: {
        voltage: { value: '3.3V', critical: true, evidence: [{ sourceId: 'vendor.datasheet', page: 4 }] },
      },
      pins: [{ id: 'P1', signals: ['GPIO'], evidence: [{ sourceId: 'vendor.datasheet', page: 8 }] }],
      interfaces: [{ type: 'UART', name: 'UART0', defaultPins: { TX: 'P1' }, evidence: [{ sourceId: 'vendor.datasheet', page: 12 }] }],
      constraints: [{ id: 'boot', category: 'boot', severity: 'warning', description: 'P1 is sampled at boot', evidence: [{ sourceId: 'vendor.datasheet', page: 16 }] }],
      relations: [],
      drivers: [],
      sourceRefs: ['vendor.datasheet'],
      reviewStatus: 'verified',
      revision: '1.0',
    }],
  }
}

describe('knowledge schema validation', () => {
  it('accepts a sourced and verified pack', () => {
    const result = validateKnowledgePack(createPack())
    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('rejects critical facts without evidence', () => {
    const pack = createPack()
    pack.entities[0].facts.voltage.evidence = []
    const result = validateKnowledgePack(pack)
    expect(result.valid).toBe(false)
    expect(result.issues.some((item) => item.code === 'CRITICAL_FACT_EVIDENCE_REQUIRED')).toBe(true)
  })

  it('does not allow verified entities to rely only on legacy sources', () => {
    const pack = createPack()
    pack.sources[0] = { ...pack.sources[0], official: false, type: 'legacy' }
    const result = validateKnowledgePack(pack)
    expect(result.valid).toBe(false)
    expect(result.issues.some((item) => item.code === 'VERIFIED_SOURCE_REQUIRED')).toBe(true)
  })

  it('reports unknown evidence sources', () => {
    const pack = createPack()
    pack.entities[0].pins[0].evidence[0].sourceId = 'missing.source'
    const result = validateKnowledgePack(pack)
    expect(result.valid).toBe(false)
    expect(result.issues.some((item) => item.code === 'EVIDENCE_SOURCE_UNKNOWN')).toBe(true)
  })

  it('returns validation errors for malformed input instead of throwing', () => {
    expect(() => validateKnowledgePack({ schemaVersion: 1, id: 'broken', name: 'Broken', version: '1.0.0', sources: [{}], entities: [{}] })).not.toThrow()
    const result = validateKnowledgePack({ schemaVersion: 1, id: 'broken', name: 'Broken', version: '1.0.0', sources: [{}], entities: [{}] })
    expect(result.valid).toBe(false)
    expect(result.issues.length).toBeGreaterThan(3)
  })
})
