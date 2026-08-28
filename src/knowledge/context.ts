import type { ChipTarget } from '@/types/hardware'
import type { HardwareScheme } from '@/types/project'
import type { KnowledgeEntity, KnowledgeSearchResult } from '@/types/knowledge'
import { localKnowledgeBase } from './localKnowledge'
import { normalizeKnowledgeTerm } from './registry'

const COMPONENT_KINDS = ['component', 'sensor', 'display', 'actuator', 'communication', 'storage', 'power', 'driver'] as const

function compact(value: string) {
  return normalizeKnowledgeTerm(value).replace(/[\s._:/-]+/g, '')
}

function factValue(entity: KnowledgeEntity, key: string) {
  const value = entity.facts[key]?.value
  if (value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function formatEntity(result: KnowledgeSearchResult) {
  const entity = result.entity
  const lines = [`### ${entity.displayName} (${entity.model})`, `- 类型：${entity.kind}；厂商/来源：${entity.manufacturer}`]
  const factKeys = ['voltage', 'ioLevel', 'current', 'address', 'capacity', 'resolution', 'sampling', 'range', 'resistance', 'backup']
  for (const key of factKeys) {
    const value = factValue(entity, key)
    if (value) lines.push(`- ${key}：${value}`)
  }
  for (const item of entity.interfaces) {
    const pins = item.defaultPins ? `；默认引脚 ${JSON.stringify(item.defaultPins)}` : ''
    const addresses = item.addresses?.length ? `；地址 ${item.addresses.join(', ')}` : ''
    lines.push(`- 接口：${item.type} ${item.name}${pins}${addresses}`)
    item.notes?.forEach((note) => lines.push(`- 接口约束：${note}`))
  }
  entity.constraints.forEach((item) => lines.push(`- ${item.severity === 'error' ? '限制' : '注意'}：${item.description}`))
  if (entity.drivers.length) lines.push(`- 驱动：${entity.drivers.map((driver) => `${driver.framework}(${driver.status})`).join(', ')}`)
  lines.push(`- 来源：${entity.sourceRefs.join(', ')}；知识包：${result.packId}@${result.packVersion}；状态：${entity.reviewStatus}`)
  return lines.join('\n')
}

function matchesEntity(entity: KnowledgeEntity, text: string) {
  const query = compact(text)
  if (!query) return false
  return [entity.displayName, entity.model, ...entity.aliases].some((value) => {
    const alias = compact(value)
    if (alias.length < 2) return false
    if ([...value].some((character) => character.charCodeAt(0) > 127)) return query.includes(alias) || alias.includes(query)
    const asciiTerms = (text.toLocaleLowerCase().match(/[a-z0-9]+(?:[._:/+-][a-z0-9]+)*/g) ?? []).map(compact)
    return asciiTerms.includes(alias) || (alias.length >= 5 && query.includes(alias))
  })
}

/**
 * 从本地知识库提取当前任务真正相关的器件事实。只发送命中的实体摘要，
 * 未命中的器件明确提示未收录，避免模型把相似型号当成已确认事实。
 */
export function getLocalHardwareKnowledgeContext(requirement: string, target: ChipTarget, scheme?: HardwareScheme) {
  const targetResult = localKnowledgeBase.resolve(target, { kinds: ['chip', 'board'] })
  const combinedText = [requirement, scheme ? JSON.stringify(scheme) : ''].filter(Boolean).join('\n')
  const allComponents = localKnowledgeBase.search({ kinds: [...COMPONENT_KINDS], limit: 200 })
    .filter((result) => result.packId === 'metacore.hardware-core')
  const matched = allComponents.filter((result) => matchesEntity(result.entity, combinedText))
  const unique = new Map<string, KnowledgeSearchResult>()
  matched.forEach((result) => unique.set(result.entity.id, result))

  const lines = ['## 本地硬件知识库事实', `知识库版本：${localKnowledgeBase.listPacks().map((pack) => `${pack.id}@${pack.version}`).join('、')}`]
  if (targetResult) {
    lines.push(`\n### 目标芯片：${targetResult.entity.displayName} (${targetResult.entity.model})`)
    lines.push(`- 知识包：${targetResult.packId}@${targetResult.packVersion}；状态：${targetResult.entity.reviewStatus}`)
    const voltage = factValue(targetResult.entity, 'voltage')
    const flash = factValue(targetResult.entity, 'flash')
    const sram = factValue(targetResult.entity, 'sram')
    if (voltage) lines.push(`- 工作电压：${voltage}`)
    if (flash) lines.push(`- Flash：${flash}`)
    if (sram) lines.push(`- SRAM：${sram}`)
    if (targetResult.entity.constraints.length) lines.push(...targetResult.entity.constraints.slice(0, 12).map((item) => `- 芯片限制：${item.description}`))
  } else {
    lines.push(`\n- 目标芯片“${target}”未在本地知识库中严格解析；不得自行补全芯片引脚或能力。`)
  }

  if (unique.size) {
    lines.push('', ...[...unique.values()].slice(0, 24).map(formatEntity))
  } else {
    lines.push('', '- 需求/BOM 中没有匹配到已收录的教学器件；未收录器件必须先确认完整型号和数据手册，不得自行补全其能力、引脚或地址。')
  }
  return lines.join('\n')
}
