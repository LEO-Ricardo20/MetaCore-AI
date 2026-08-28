import { CHIP_SPECS } from '@/data/chipSpecs'
import { DRIVER_TEMPLATES } from '@/data/driverTemplates'
import type { DriverTemplate } from '@/data/driverTemplates'
import { knowledgeEntityToChipSpec } from './adapters'
import { createLegacyCoreKnowledgePack } from './legacyPack'
import { createHardwareCoreKnowledgePack } from './hardwareCorePack'
import { createLocalKnowledgeBase } from './registry'

export const localKnowledgeBase = createLocalKnowledgeBase()

const legacyPack = createLegacyCoreKnowledgePack()
const installResult = localKnowledgeBase.installPack(legacyPack)
if (!installResult.valid) {
  const details = installResult.issues.map((item) => `${item.code}@${item.path}: ${item.message}`).join('; ')
  throw new Error(`内置知识包加载失败：${details}`)
}

const hardwareCoreInstallResult = localKnowledgeBase.installPack(createHardwareCoreKnowledgePack())
if (!hardwareCoreInstallResult.valid) {
  const details = hardwareCoreInstallResult.issues.map((item) => `${item.code}@${item.path}: ${item.message}`).join('; ')
  throw new Error(`正式硬件知识包加载失败：${details}`)
}

export function getLocalChipSpec(name: string) {
  const resolved = localKnowledgeBase.resolve(name, { kinds: ['chip', 'board'] })
  return resolved ? knowledgeEntityToChipSpec(resolved.entity) : null
}

export function getLocalChipNames() {
  const legacyNames = Object.keys(CHIP_SPECS).filter((name) => Boolean(getLocalChipSpec(name)))
  const additionalNames = localKnowledgeBase.search({ kinds: ['chip', 'board'], limit: 200 })
    .filter((result) => typeof result.entity.metadata?.legacyChipName !== 'string')
    .map((result) => result.entity.displayName)
  return [...new Set([...legacyNames, ...additionalNames])]
}

export function getLocalDriverTemplate(name: string): DriverTemplate | null {
  const resolved = localKnowledgeBase.resolve(name, { kinds: ['driver'] })
  const legacyDriverId = resolved?.entity.metadata?.legacyDriverId
  return typeof legacyDriverId === 'string'
    ? DRIVER_TEMPLATES.find((template) => template.id === legacyDriverId) ?? null
    : null
}
