import { describe, expect, it } from 'vitest'
import { KNOWLEDGE_SCHEMA_VERSION, type KnowledgePack } from '@/types/knowledge'
import { createLocalKnowledgeBase } from './registry'

function createPack(id = 'test.registry', version = '1.0.0', entityId = 'vendor.sensor.demo'): KnowledgePack {
  return {
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    id,
    name: id,
    version,
    sources: [{ id: `${id}.source`, type: 'datasheet', title: 'Datasheet', owner: 'Vendor', official: true, url: 'https://example.com/datasheet.pdf', revision: version }],
    entities: [{
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      id: entityId,
      kind: 'sensor',
      manufacturer: 'Vendor',
      model: 'DEMO-1',
      displayName: 'Demo Sensor',
      aliases: ['Demo 1', '示例传感器'],
      tags: ['i2c', 'teaching'],
      facts: { voltage: { value: '3.3V', critical: true, evidence: [{ sourceId: `${id}.source`, page: 3 }] } },
      pins: [],
      interfaces: [{ type: 'I2C', name: 'I2C', addresses: ['0x40'], evidence: [{ sourceId: `${id}.source`, page: 5 }] }],
      constraints: [],
      relations: [],
      drivers: [],
      sourceRefs: [`${id}.source`],
      reviewStatus: 'verified',
      revision: version,
    }],
  }
}

describe('local knowledge registry', () => {
  it('installs immutable packs and resolves aliases', () => {
    const base = createLocalKnowledgeBase()
    expect(base.installPack(createPack()).valid).toBe(true)
    const result = base.resolve('demo_1')
    expect(result?.entity.id).toBe('vendor.sensor.demo')
    expect(result?.matchedBy).toContain('normalized')
    expect(Object.isFrozen(result?.entity)).toBe(true)
  })

  it('filters by kind, manufacturer and tags', () => {
    const base = createLocalKnowledgeBase()
    base.installPack(createPack())
    expect(base.search({ kinds: ['sensor'], manufacturers: ['vendor'], tags: ['I2C'] })).toHaveLength(1)
    expect(base.search({ kinds: ['chip'] })).toHaveLength(0)
  })

  it('rejects non-integer or out-of-range pack priority', () => {
    const pack = createPack()
    pack.priority = 1.5
    const result = createLocalKnowledgeBase().installPack(pack)
    expect(result.valid).toBe(false)
    expect(result.issues.some((item) => item.code === 'PACK_PRIORITY_INVALID')).toBe(true)
  })

  it('rejects duplicate entities without mutating installed state', () => {
    const base = createLocalKnowledgeBase()
    base.installPack(createPack())
    const conflicting = createPack('test.other', '1.0.0', 'vendor.sensor.demo')
    const result = base.installPack(conflicting)
    expect(result.valid).toBe(false)
    expect(result.issues.some((item) => item.code === 'ENTITY_CONFLICT')).toBe(true)
    expect(base.stats().packs).toBe(1)
  })

  it('supports explicit atomic pack replacement and snapshots', () => {
    const base = createLocalKnowledgeBase()
    base.installPack(createPack())
    const updated = createPack('test.registry', '1.1.0')
    updated.entities[0].revision = '1.1.0'
    expect(base.installPack(updated, { replace: true }).valid).toBe(true)
    const snapshot = base.createSnapshot('vendor.sensor.demo', '2026-08-28T12:00:00.000Z')
    expect(snapshot).toMatchObject({ packId: 'test.registry', packVersion: '1.1.0', entityRevision: '1.1.0' })
    expect(snapshot?.sourceRevisions).toEqual([{ sourceId: 'test.registry.source', revision: '1.1.0', checksum: undefined }])
  })

  it('enforces declared pack dependencies', () => {
    const base = createLocalKnowledgeBase()
    const dependent = createPack('test.dependent')
    dependent.dependencies = [{ packId: 'test.base', minimumVersion: '1.0.0' }]
    const result = base.installPack(dependent)
    expect(result.valid).toBe(false)
    expect(result.issues.some((item) => item.code === 'PACK_DEPENDENCY_MISSING')).toBe(true)
  })

  it('treats prerelease dependencies as older than stable releases', () => {
    const base = createLocalKnowledgeBase()
    expect(base.installPack(createPack('test.base', '1.0.0-beta.1', 'vendor.sensor.base')).valid).toBe(true)
    const dependent = createPack('test.dependent', '1.0.0', 'vendor.sensor.dependent')
    dependent.dependencies = [{ packId: 'test.base', minimumVersion: '1.0.0' }]
    const result = base.installPack(dependent)
    expect(result.valid).toBe(false)
    expect(result.issues.some((item) => item.code === 'PACK_DEPENDENCY_VERSION')).toBe(true)
  })
})
