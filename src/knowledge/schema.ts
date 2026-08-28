import {
  KNOWLEDGE_SCHEMA_VERSION,
  type KnowledgePack,
  type KnowledgeValidationIssue,
  type KnowledgeValidationResult,
} from '@/types/knowledge'

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim())
}

function isKnowledgeJson(value: unknown): boolean {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return typeof value !== 'number' || Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isKnowledgeJson)
  return isRecord(value) && Object.values(value).every(isKnowledgeJson)
}

function validIsoDate(value: string | undefined) {
  return value === undefined || !Number.isNaN(Date.parse(value))
}

function validHttpUrl(value: string | undefined) {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function issue(
  issues: KnowledgeValidationIssue[],
  severity: KnowledgeValidationIssue['severity'],
  code: string,
  path: string,
  message: string,
) {
  issues.push({ severity, code, path, message })
}

function validateEvidence(
  evidence: unknown,
  path: string,
  sourceIds: Set<string>,
  issues: KnowledgeValidationIssue[],
) {
  if (!Array.isArray(evidence)) {
    issue(issues, 'error', 'EVIDENCE_INVALID', path, 'evidence 必须是数组')
    return
  }
  evidence.forEach((rawItem, index) => {
    const itemPath = `${path}[${index}]`
    if (!isRecord(rawItem)) {
      issue(issues, 'error', 'EVIDENCE_ITEM_INVALID', itemPath, '证据项必须是对象')
      return
    }
    const item = rawItem
    if (!isNonEmptyString(item.sourceId)) issue(issues, 'error', 'EVIDENCE_SOURCE_REQUIRED', `${itemPath}.sourceId`, '证据必须引用来源')
    else if (!sourceIds.has(item.sourceId)) issue(issues, 'error', 'EVIDENCE_SOURCE_UNKNOWN', `${itemPath}.sourceId`, `找不到来源 ${item.sourceId}`)
    if (typeof item.page === 'number' && (!Number.isInteger(item.page) || item.page < 1)) issue(issues, 'error', 'EVIDENCE_PAGE_INVALID', `${itemPath}.page`, '页码必须是正整数')
    if (item.verifiedAt !== undefined && typeof item.verifiedAt !== 'string') issue(issues, 'error', 'EVIDENCE_DATE_INVALID', `${itemPath}.verifiedAt`, 'verifiedAt 必须是有效日期')
    else if (!validIsoDate(item.verifiedAt)) issue(issues, 'error', 'EVIDENCE_DATE_INVALID', `${itemPath}.verifiedAt`, 'verifiedAt 必须是有效日期')
  })
}

function validateEntity(
  rawEntity: unknown,
  path: string,
  sourceIds: Set<string>,
  officialSourceIds: Set<string>,
  issues: KnowledgeValidationIssue[],
) {
  if (!isRecord(rawEntity)) {
    issue(issues, 'error', 'ENTITY_INVALID', path, '实体必须是对象')
    return
  }
  const entity = rawEntity
  if (entity.schemaVersion !== KNOWLEDGE_SCHEMA_VERSION) issue(issues, 'error', 'ENTITY_SCHEMA_UNSUPPORTED', `${path}.schemaVersion`, '实体 Schema 版本不受支持')
  if (!ID_PATTERN.test(String(entity.id ?? ''))) issue(issues, 'error', 'ENTITY_ID_INVALID', `${path}.id`, '实体 ID 只能使用小写字母、数字、点、冒号、下划线和连字符')
  for (const field of ['manufacturer', 'model', 'displayName'] as const) {
    if (!isNonEmptyString(entity[field])) issue(issues, 'error', 'ENTITY_FIELD_REQUIRED', `${path}.${field}`, `${field} 不能为空`)
  }
  const allowedKinds = new Set(['chip', 'module', 'board', 'component', 'sensor', 'display', 'actuator', 'communication', 'storage', 'power', 'driver'])
  const allowedStatuses = new Set(['draft', 'reviewed', 'verified', 'deprecated'])
  if (!allowedKinds.has(String(entity.kind))) issue(issues, 'error', 'ENTITY_KIND_INVALID', `${path}.kind`, '实体 kind 不受支持')
  if (!allowedStatuses.has(String(entity.reviewStatus))) issue(issues, 'error', 'ENTITY_REVIEW_STATUS_INVALID', `${path}.reviewStatus`, '实体 reviewStatus 不受支持')
  if (!Array.isArray(entity.aliases) || !Array.isArray(entity.tags)) issue(issues, 'error', 'ENTITY_INDEX_FIELDS_INVALID', path, 'aliases 和 tags 必须是数组')
  else if (![...entity.aliases, ...entity.tags].every(isNonEmptyString)) issue(issues, 'error', 'ENTITY_INDEX_VALUE_INVALID', path, 'aliases 和 tags 只能包含非空字符串')
  if (!isRecord(entity.facts)) issue(issues, 'error', 'ENTITY_FACTS_INVALID', `${path}.facts`, 'facts 必须是对象')
  if (!Array.isArray(entity.pins) || !Array.isArray(entity.interfaces) || !Array.isArray(entity.constraints) || !Array.isArray(entity.relations) || !Array.isArray(entity.drivers)) {
    issue(issues, 'error', 'ENTITY_COLLECTION_INVALID', path, 'pins、interfaces、constraints、relations 和 drivers 必须是数组')
    return
  }

  const sourceRefs = Array.isArray(entity.sourceRefs) ? entity.sourceRefs : []
  if (!Array.isArray(entity.sourceRefs)) issue(issues, 'error', 'ENTITY_SOURCES_INVALID', `${path}.sourceRefs`, 'sourceRefs 必须是数组')
  sourceRefs.forEach((sourceId, index) => {
    if (!sourceIds.has(sourceId)) issue(issues, 'error', 'ENTITY_SOURCE_UNKNOWN', `${path}.sourceRefs[${index}]`, `找不到来源 ${sourceId}`)
  })
  if (entity.reviewStatus === 'verified' && !sourceRefs.some((sourceId) => officialSourceIds.has(sourceId))) {
    issue(issues, 'error', 'VERIFIED_SOURCE_REQUIRED', `${path}.reviewStatus`, 'verified 实体必须至少引用一个官方来源')
  }

  Object.entries(isRecord(entity.facts) ? entity.facts : {}).forEach(([key, fact]) => {
    const factPath = `${path}.facts.${key}`
    if (!isNonEmptyString(key)) issue(issues, 'error', 'FACT_KEY_INVALID', factPath, '事实键不能为空')
    if (!isRecord(fact)) {
      issue(issues, 'error', 'FACT_INVALID', factPath, '事实必须包含 value 和 evidence 数组')
      return
    }
    if (!Object.hasOwn(fact, 'value') || !isKnowledgeJson(fact.value)) issue(issues, 'error', 'FACT_VALUE_INVALID', `${factPath}.value`, '事实值必须是可序列化 JSON')
    if (fact.critical && (!Array.isArray(fact.evidence) || fact.evidence.length === 0)) issue(issues, 'error', 'CRITICAL_FACT_EVIDENCE_REQUIRED', `${factPath}.evidence`, '关键事实必须有证据')
    if (entity.reviewStatus === 'verified' && fact.critical && Array.isArray(fact.evidence) && !fact.evidence.some((item) => isRecord(item) && typeof item.sourceId === 'string' && officialSourceIds.has(item.sourceId))) {
      issue(issues, 'error', 'VERIFIED_CRITICAL_FACT_OFFICIAL_EVIDENCE_REQUIRED', `${factPath}.evidence`, '已验证实体的关键事实必须直接引用官方来源')
    }
    validateEvidence(fact.evidence, `${factPath}.evidence`, sourceIds, issues)
  })

  const pinIds = new Set<string>()
  entity.pins.forEach((rawPin, index) => {
    const pinPath = `${path}.pins[${index}]`
    if (!isRecord(rawPin)) {
      issue(issues, 'error', 'PIN_INVALID', pinPath, '引脚必须是对象')
      return
    }
    const pin = rawPin
    if (!isNonEmptyString(pin.id)) issue(issues, 'error', 'PIN_ID_REQUIRED', `${pinPath}.id`, '引脚 ID 不能为空')
    else if (pinIds.has(pin.id)) issue(issues, 'error', 'PIN_ID_DUPLICATE', `${pinPath}.id`, `重复引脚 ${pin.id}`)
    if (typeof pin.id === 'string') pinIds.add(pin.id)
    if (!Array.isArray(pin.signals) || !Array.isArray(pin.evidence)) issue(issues, 'error', 'PIN_INVALID', pinPath, '引脚必须包含 signals 和 evidence 数组')
    else validateEvidence(pin.evidence, `${pinPath}.evidence`, sourceIds, issues)
    if (pin.inputOnly === true && pin.outputOnly === true) issue(issues, 'error', 'PIN_DIRECTION_CONFLICT', pinPath, '引脚不能同时标记为仅输入和仅输出')
  })

  entity.interfaces.forEach((rawItem, index) => {
    const itemPath = `${path}.interfaces[${index}]`
    if (!isRecord(rawItem)) {
      issue(issues, 'error', 'INTERFACE_INVALID', itemPath, '接口必须是对象')
      return
    }
    const item = rawItem
    if (!isNonEmptyString(item.type) || !isNonEmptyString(item.name)) issue(issues, 'error', 'INTERFACE_REQUIRED', itemPath, '接口 type 和 name 不能为空')
    if (item.defaultPins !== undefined && (!isRecord(item.defaultPins) || !Object.values(item.defaultPins).every(isNonEmptyString))) issue(issues, 'error', 'INTERFACE_PINS_INVALID', `${itemPath}.defaultPins`, '默认引脚必须是字符串映射')
    if (item.addresses !== undefined && (!Array.isArray(item.addresses) || !item.addresses.every(isNonEmptyString))) issue(issues, 'error', 'INTERFACE_ADDRESSES_INVALID', `${itemPath}.addresses`, '接口地址必须是字符串数组')
    if (!Array.isArray(item.evidence)) issue(issues, 'error', 'INTERFACE_EVIDENCE_INVALID', `${itemPath}.evidence`, '接口 evidence 必须是数组')
    else validateEvidence(item.evidence, `${itemPath}.evidence`, sourceIds, issues)
  })

  const constraintIds = new Set<string>()
  entity.constraints.forEach((rawConstraint, index) => {
    const itemPath = `${path}.constraints[${index}]`
    if (!isRecord(rawConstraint)) {
      issue(issues, 'error', 'CONSTRAINT_INVALID', itemPath, '约束必须是对象')
      return
    }
    const constraint = rawConstraint
    if (!isNonEmptyString(constraint.id)) issue(issues, 'error', 'CONSTRAINT_ID_REQUIRED', `${itemPath}.id`, '约束 ID 不能为空')
    else if (constraintIds.has(constraint.id)) issue(issues, 'error', 'CONSTRAINT_ID_DUPLICATE', `${itemPath}.id`, `重复约束 ${constraint.id}`)
    if (typeof constraint.id === 'string') constraintIds.add(constraint.id)
    if (!isNonEmptyString(constraint.description)) issue(issues, 'error', 'CONSTRAINT_DESCRIPTION_REQUIRED', `${itemPath}.description`, '约束说明不能为空')
    if (!isNonEmptyString(constraint.category)) issue(issues, 'error', 'CONSTRAINT_CATEGORY_REQUIRED', `${itemPath}.category`, '约束类别不能为空')
    if (!['info', 'warning', 'error'].includes(String(constraint.severity))) issue(issues, 'error', 'CONSTRAINT_SEVERITY_INVALID', `${itemPath}.severity`, '约束级别不受支持')
    validateEvidence(constraint.evidence, `${itemPath}.evidence`, sourceIds, issues)
  })

  entity.drivers.forEach((rawDriver, index) => {
    const itemPath = `${path}.drivers[${index}]`
    if (!isRecord(rawDriver)) {
      issue(issues, 'error', 'DRIVER_INVALID', itemPath, '驱动支持项必须是对象')
      return
    }
    if (!isNonEmptyString(rawDriver.framework)) issue(issues, 'error', 'DRIVER_FRAMEWORK_REQUIRED', `${itemPath}.framework`, '驱动框架不能为空')
    if (!['supported', 'experimental', 'deprecated'].includes(String(rawDriver.status))) issue(issues, 'error', 'DRIVER_STATUS_INVALID', `${itemPath}.status`, '驱动状态不受支持')
    if (rawDriver.sourceRefs !== undefined) {
      if (!Array.isArray(rawDriver.sourceRefs)) issue(issues, 'error', 'DRIVER_SOURCES_INVALID', `${itemPath}.sourceRefs`, '驱动来源必须是数组')
      else rawDriver.sourceRefs.forEach((sourceId, sourceIndex) => {
        if (!isNonEmptyString(sourceId) || !sourceIds.has(sourceId)) issue(issues, 'error', 'DRIVER_SOURCE_UNKNOWN', `${itemPath}.sourceRefs[${sourceIndex}]`, `找不到驱动来源 ${String(sourceId)}`)
      })
    }
  })
}

export function validateKnowledgePack(value: unknown): KnowledgeValidationResult {
  const issues: KnowledgeValidationIssue[] = []
  if (!isRecord(value)) return { valid: false, issues: [{ severity: 'error', code: 'PACK_INVALID', path: '$', message: '知识包必须是对象' }] }
  const pack = value as unknown as KnowledgePack
  if (pack.schemaVersion !== KNOWLEDGE_SCHEMA_VERSION) issue(issues, 'error', 'PACK_SCHEMA_UNSUPPORTED', '$.schemaVersion', `仅支持知识库 Schema v${KNOWLEDGE_SCHEMA_VERSION}`)
  if (!ID_PATTERN.test(String(pack.id ?? ''))) issue(issues, 'error', 'PACK_ID_INVALID', '$.id', '知识包 ID 格式无效')
  if (!isNonEmptyString(pack.name)) issue(issues, 'error', 'PACK_NAME_REQUIRED', '$.name', '知识包名称不能为空')
  if (!VERSION_PATTERN.test(String(pack.version ?? ''))) issue(issues, 'error', 'PACK_VERSION_INVALID', '$.version', '知识包版本必须使用 SemVer')
  if (pack.priority !== undefined && (!Number.isInteger(pack.priority) || pack.priority < -1000 || pack.priority > 1000)) issue(issues, 'error', 'PACK_PRIORITY_INVALID', '$.priority', 'priority 必须是 -1000 到 1000 的整数')
  if (pack.generatedAt !== undefined && typeof pack.generatedAt !== 'string') issue(issues, 'error', 'PACK_DATE_INVALID', '$.generatedAt', 'generatedAt 必须是有效日期')
  else if (!validIsoDate(pack.generatedAt)) issue(issues, 'error', 'PACK_DATE_INVALID', '$.generatedAt', 'generatedAt 必须是有效日期')
  if (!Array.isArray(pack.sources) || !Array.isArray(pack.entities)) {
    issue(issues, 'error', 'PACK_COLLECTION_INVALID', '$', 'sources 和 entities 必须是数组')
    return { valid: false, issues }
  }

  const sourceIds = new Set<string>()
  const officialSourceIds = new Set<string>()
  const allowedSourceTypes = new Set(['datasheet', 'reference-manual', 'errata', 'user-guide', 'schematic', 'application-note', 'official-documentation', 'official-repository', 'package-index', 'community', 'legacy'])
  pack.sources.forEach((rawSource, index) => {
    const path = `$.sources[${index}]`
    if (!isRecord(rawSource)) {
      issue(issues, 'error', 'SOURCE_INVALID', path, '来源必须是对象')
      return
    }
    const source = rawSource
    if (!ID_PATTERN.test(String(source.id ?? ''))) issue(issues, 'error', 'SOURCE_ID_INVALID', `${path}.id`, '来源 ID 格式无效')
    else if (sourceIds.has(source.id as string)) issue(issues, 'error', 'SOURCE_ID_DUPLICATE', `${path}.id`, `重复来源 ${source.id}`)
    if (typeof source.id === 'string') sourceIds.add(source.id)
    if (source.official === true && typeof source.id === 'string') officialSourceIds.add(source.id)
    if (typeof source.official !== 'boolean') issue(issues, 'error', 'SOURCE_OFFICIAL_INVALID', `${path}.official`, 'official 必须是布尔值')
    if (source.official === true && !isNonEmptyString(source.url)) issue(issues, 'error', 'OFFICIAL_SOURCE_URL_REQUIRED', `${path}.url`, '官方来源必须提供 URL')
    if (!allowedSourceTypes.has(String(source.type))) issue(issues, 'error', 'SOURCE_TYPE_INVALID', `${path}.type`, '来源类型不受支持')
    if (!isNonEmptyString(source.title) || !isNonEmptyString(source.owner)) issue(issues, 'error', 'SOURCE_FIELD_REQUIRED', path, '来源 title 和 owner 不能为空')
    if (source.url !== undefined && typeof source.url !== 'string') issue(issues, 'error', 'SOURCE_URL_INVALID', `${path}.url`, '来源 URL 必须使用 HTTP 或 HTTPS')
    else if (!validHttpUrl(source.url)) issue(issues, 'error', 'SOURCE_URL_INVALID', `${path}.url`, '来源 URL 必须使用 HTTP 或 HTTPS')
    if ((source.publishedAt !== undefined && typeof source.publishedAt !== 'string') || (source.retrievedAt !== undefined && typeof source.retrievedAt !== 'string')) issue(issues, 'error', 'SOURCE_DATE_INVALID', path, '来源日期格式无效')
    else if (!validIsoDate(source.publishedAt) || !validIsoDate(source.retrievedAt)) issue(issues, 'error', 'SOURCE_DATE_INVALID', path, '来源日期格式无效')
  })

  if (pack.dependencies !== undefined) {
    if (!Array.isArray(pack.dependencies)) issue(issues, 'error', 'PACK_DEPENDENCIES_INVALID', '$.dependencies', 'dependencies 必须是数组')
    else pack.dependencies.forEach((dependency, index) => {
      const path = `$.dependencies[${index}]`
      if (!isRecord(dependency) || !ID_PATTERN.test(String(dependency.packId ?? ''))) issue(issues, 'error', 'PACK_DEPENDENCY_ID_INVALID', `${path}.packId`, '依赖知识包 ID 格式无效')
      if (isRecord(dependency) && dependency.minimumVersion !== undefined && !VERSION_PATTERN.test(String(dependency.minimumVersion))) issue(issues, 'error', 'PACK_DEPENDENCY_VERSION_INVALID', `${path}.minimumVersion`, '依赖版本必须使用 SemVer')
    })
  }

  const entityIds = new Set<string>()
  pack.entities.forEach((entity, index) => {
    const path = `$.entities[${index}]`
    const entityId = isRecord(entity) && typeof entity.id === 'string' ? entity.id : ''
    if (entityId && entityIds.has(entityId)) issue(issues, 'error', 'ENTITY_ID_DUPLICATE', `${path}.id`, `重复实体 ${entityId}`)
    if (entityId) entityIds.add(entityId)
    validateEntity(entity, path, sourceIds, officialSourceIds, issues)
  })

  pack.entities.forEach((entity, entityIndex) => {
    if (!isRecord(entity) || !Array.isArray(entity.relations)) return
    entity.relations.forEach((relation, relationIndex) => {
      if (!isRecord(relation) || !isNonEmptyString(relation.targetId)) {
        issue(issues, 'error', 'RELATION_TARGET_INVALID', `$.entities[${entityIndex}].relations[${relationIndex}].targetId`, '关系目标不能为空')
      } else if (!entityIds.has(relation.targetId)) {
        issue(issues, 'warning', 'RELATION_TARGET_EXTERNAL', `$.entities[${entityIndex}].relations[${relationIndex}].targetId`, `关系目标 ${relation.targetId} 不在当前知识包中，将在安装时解析`)
      }
    })
  })

  return { valid: !issues.some((item) => item.severity === 'error'), issues }
}
