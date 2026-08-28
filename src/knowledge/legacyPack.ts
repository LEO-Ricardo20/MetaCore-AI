import { CHIP_SPECS } from '@/data/chipSpecs'
import { DRIVER_TEMPLATES, type DriverTemplate } from '@/data/driverTemplates'
import type { ChipSpec } from '@/types/hardware'
import {
  KNOWLEDGE_SCHEMA_VERSION,
  type KnowledgeEntity,
  type KnowledgeEvidenceRef,
  type KnowledgeFact,
  type KnowledgeJson,
  type KnowledgePack,
} from '@/types/knowledge'

const LEGACY_CHIP_SOURCE = 'metacore.legacy-chip-specs'
const LEGACY_DRIVER_SOURCE = 'metacore.legacy-driver-templates'

function slug(value: string) {
  const normalized = value.normalize('NFKC').trim().toLocaleLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized || 'unnamed'
}

function evidence(sourceId: string): KnowledgeEvidenceRef[] {
  return [{ sourceId, confidence: 'medium' }]
}

function fact(value: KnowledgeJson, sourceId: string, critical = false): KnowledgeFact {
  return { value, critical, evidence: evidence(sourceId) }
}

function inferManufacturer(spec: ChipSpec) {
  if (/^ESP32/i.test(spec.name) || /^ESP32/i.test(spec.fullName)) return 'Espressif Systems'
  if (/^STM32/i.test(spec.name) || /^STM32/i.test(spec.fullName)) return 'STMicroelectronics'
  return 'Unknown'
}

function chipToEntity(key: string, spec: ChipSpec): KnowledgeEntity {
  const sourceId = LEGACY_CHIP_SOURCE
  return {
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    id: `legacy.chip.${slug(key)}`,
    kind: /-KIT$/i.test(spec.name) ? 'board' : 'chip',
    manufacturer: inferManufacturer(spec),
    model: spec.fullName,
    displayName: spec.name,
    aliases: [...new Set([key, spec.name, spec.fullName])],
    tags: ['legacy', /^ESP32/i.test(spec.name) ? 'esp32' : /^STM32/i.test(spec.name) ? 'stm32' : 'mcu'],
    facts: {
      architecture: fact(spec.arch, sourceId),
      flash: fact(spec.flash, sourceId),
      sram: fact(spec.sram, sourceId),
      clockSpeed: fact(spec.clockSpeed, sourceId),
      voltage: fact(spec.voltage, sourceId, true),
      bootPins: fact(spec.bootPins, sourceId, true),
    },
    pins: spec.gpios.map((pin) => ({
      id: pin.pin,
      signals: pin.altFunctions,
      ...(Object.hasOwn(pin, 'inputOnly') ? { inputOnly: pin.inputOnly } : {}),
      ...(Object.hasOwn(pin, 'notes') ? { notes: pin.notes ? [pin.notes] : undefined } : {}),
      evidence: evidence(sourceId),
    })),
    interfaces: spec.peripherals.map((peripheral) => ({
      type: peripheral.type,
      name: peripheral.name,
      defaultPins: peripheral.defaultPins,
      evidence: evidence(sourceId),
    })),
    constraints: spec.restrictions.map((description, index) => ({
      id: `legacy-constraint-${index + 1}`,
      category: 'legacy-restriction',
      severity: 'warning',
      description,
      evidence: evidence(sourceId),
    })),
    relations: [],
    drivers: [],
    sourceRefs: [sourceId],
    reviewStatus: 'reviewed',
    revision: 'legacy-1',
    metadata: { legacyChipName: key },
  }
}

function driverDependencies(template: DriverTemplate) {
  return Object.fromEntries(Object.entries(template.templates).map(([framework, code]) => [framework, code?.dependencies ?? []]))
}

function driverToEntity(template: DriverTemplate): KnowledgeEntity {
  const sourceId = LEGACY_DRIVER_SOURCE
  const frameworks = Object.keys(template.templates)
  return {
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    id: `legacy.driver.${slug(template.id)}`,
    kind: 'driver',
    manufacturer: 'MetaCore Studio',
    model: template.id,
    displayName: template.name,
    aliases: [...new Set([template.id, template.name, ...template.matchKeywords])],
    category: template.interface,
    tags: ['legacy', 'driver', template.interface.toLocaleLowerCase()],
    facts: {
      interface: fact(template.interface, sourceId),
      api: fact(template.apiDoc, sourceId),
      frameworks: fact(frameworks, sourceId),
      dependencies: fact(driverDependencies(template), sourceId),
    },
    pins: [],
    interfaces: [{ type: template.interface, name: template.interface, evidence: evidence(sourceId) }],
    constraints: [],
    relations: [],
    drivers: frameworks.map((framework) => ({ framework, status: 'supported', sourceRefs: [sourceId] })),
    sourceRefs: [sourceId],
    reviewStatus: 'reviewed',
    revision: 'legacy-1',
    metadata: { legacyDriverId: template.id },
  }
}

export function createLegacyCoreKnowledgePack(): KnowledgePack {
  return {
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    id: 'metacore.legacy-core',
    name: 'MetaCore Legacy Core Knowledge',
    version: '1.0.0',
    priority: 0,
    description: '将现有静态芯片规格和驱动模板接入本地知识库。该包保留原行为，但不代表已经过官方资料复核。',
    generatedAt: '2026-08-28T00:00:00.000Z',
    sources: [
      {
        id: LEGACY_CHIP_SOURCE,
        type: 'legacy',
        title: 'MetaCore Studio 原有静态芯片规格',
        owner: 'MetaCore Studio',
        official: false,
        revision: 'legacy-1',
        licenseNote: '项目内历史数据；后续由带官方来源的知识包逐项替换。',
      },
      {
        id: LEGACY_DRIVER_SOURCE,
        type: 'legacy',
        title: 'MetaCore Studio 原有驱动模板',
        owner: 'MetaCore Studio',
        official: false,
        revision: 'legacy-1',
        licenseNote: '项目内历史模板；后续补充上游库版本、构建记录和官方来源。',
      },
    ],
    entities: [
      ...Object.entries(CHIP_SPECS).map(([key, spec]) => chipToEntity(key, spec)),
      ...DRIVER_TEMPLATES.map(driverToEntity),
    ],
  }
}
