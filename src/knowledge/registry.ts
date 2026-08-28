import {
  KNOWLEDGE_SCHEMA_VERSION,
  type KnowledgeBaseStats,
  type KnowledgeEntity,
  type KnowledgeEntityKind,
  type KnowledgeEntitySnapshot,
  type KnowledgePack,
  type KnowledgeQuery,
  type KnowledgeReviewStatus,
  type KnowledgeSearchResult,
  type KnowledgeSource,
  type KnowledgeValidationIssue,
  type KnowledgeValidationResult,
} from '@/types/knowledge'
import { validateKnowledgePack } from './schema'

interface IndexedEntity {
  entity: KnowledgeEntity
  packId: string
  packVersion: string
  packPriority: number
  normalized: {
    id: string
    model: string
    displayName: string
    manufacturer: string
    aliases: string[]
    tags: string[]
    all: string
  }
}

interface KnowledgeIndexes {
  entities: Map<string, IndexedEntity>
  sources: Map<string, KnowledgeSource>
}

export interface InstallKnowledgePackOptions {
  replace?: boolean
}

export function normalizeKnowledgeTerm(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/[_\s]+/g, '-').replace(/-+/g, '-')
}

function compactKnowledgeTerm(value: string) {
  return normalizeKnowledgeTerm(value).replace(/[\s._:/-]+/g, '')
}

function compareVersions(left: string, right: string) {
  const parse = (value: string) => {
    const [core, prerelease] = value.split('-', 2)
    return { core: core.split('.').map((item) => Number(item)), prerelease: prerelease?.split('.') ?? [] }
  }
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 3; index += 1) {
    if (a.core[index] !== b.core[index]) return a.core[index] > b.core[index] ? 1 : -1
  }
  if (!a.prerelease.length && !b.prerelease.length) return 0
  if (!a.prerelease.length) return 1
  if (!b.prerelease.length) return -1
  const length = Math.max(a.prerelease.length, b.prerelease.length)
  for (let index = 0; index < length; index += 1) {
    const leftPart = a.prerelease[index]
    const rightPart = b.prerelease[index]
    if (leftPart === undefined) return -1
    if (rightPart === undefined) return 1
    if (leftPart === rightPart) continue
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null
    if (leftNumber !== null && rightNumber !== null) return leftNumber > rightNumber ? 1 : -1
    if (leftNumber !== null) return -1
    if (rightNumber !== null) return 1
    return leftPart > rightPart ? 1 : -1
  }
  return 0
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item))
  return value
}

function clonePack(pack: KnowledgePack) {
  return deepFreeze(structuredClone(pack))
}

function packIssue(code: string, path: string, message: string, severity: KnowledgeValidationIssue['severity'] = 'error'): KnowledgeValidationIssue {
  return { severity, code, path, message }
}

function indexEntity(entity: KnowledgeEntity, pack: KnowledgePack): IndexedEntity {
  const aliases = entity.aliases.map(normalizeKnowledgeTerm)
  const tags = entity.tags.map(normalizeKnowledgeTerm)
  const normalized = {
    id: normalizeKnowledgeTerm(entity.id),
    model: normalizeKnowledgeTerm(entity.model),
    displayName: normalizeKnowledgeTerm(entity.displayName),
    manufacturer: normalizeKnowledgeTerm(entity.manufacturer),
    aliases,
    tags,
    all: '',
  }
  normalized.all = [normalized.id, normalized.model, normalized.displayName, normalized.manufacturer, ...aliases, ...tags].join(' ')
  return { entity, packId: pack.id, packVersion: pack.version, packPriority: pack.priority ?? 0, normalized }
}

function buildIndexes(packs: Map<string, KnowledgePack>): { indexes: KnowledgeIndexes; issues: KnowledgeValidationIssue[] } {
  const issues: KnowledgeValidationIssue[] = []
  const entities = new Map<string, IndexedEntity>()
  const sources = new Map<string, KnowledgeSource>()

  for (const pack of packs.values()) {
    for (const dependency of pack.dependencies ?? []) {
      const installed = packs.get(dependency.packId)
      if (!installed) {
        issues.push(packIssue('PACK_DEPENDENCY_MISSING', `packs.${pack.id}.dependencies`, `缺少依赖知识包 ${dependency.packId}`))
      } else if (dependency.minimumVersion && compareVersions(installed.version, dependency.minimumVersion) < 0) {
        issues.push(packIssue('PACK_DEPENDENCY_VERSION', `packs.${pack.id}.dependencies`, `${dependency.packId} 需要至少 ${dependency.minimumVersion}，当前为 ${installed.version}`))
      }
    }

    for (const source of pack.sources) {
      const existing = sources.get(source.id)
      if (existing && JSON.stringify(existing) !== JSON.stringify(source)) {
        issues.push(packIssue('SOURCE_CONFLICT', `packs.${pack.id}.sources.${source.id}`, `来源 ${source.id} 与已安装定义冲突`))
      } else if (!existing) {
        sources.set(source.id, source)
      }
    }

    for (const entity of pack.entities) {
      const existing = entities.get(entity.id)
      if (existing) {
        issues.push(packIssue('ENTITY_CONFLICT', `packs.${pack.id}.entities.${entity.id}`, `实体 ${entity.id} 已由 ${existing.packId} 提供`))
      } else {
        entities.set(entity.id, indexEntity(entity, pack))
      }
    }
  }

  for (const indexed of entities.values()) {
    for (const relation of indexed.entity.relations) {
      if (!entities.has(relation.targetId)) {
        issues.push(packIssue('RELATION_TARGET_UNRESOLVED', `entities.${indexed.entity.id}.relations`, `关系目标 ${relation.targetId} 尚未安装`, 'warning'))
      }
    }
  }

  return { indexes: { entities, sources }, issues }
}

function matchesFilter<T extends string>(value: T, filter: T[] | undefined, normalize = false) {
  if (!filter?.length) return true
  return normalize
    ? filter.some((item) => normalizeKnowledgeTerm(item) === normalizeKnowledgeTerm(value))
    : filter.includes(value)
}

function scoreEntity(indexed: IndexedEntity, text: string) {
  const query = normalizeKnowledgeTerm(text)
  if (!query) return { score: 1, matchedBy: [] as string[] }
  const compact = compactKnowledgeTerm(text)
  const matchedBy: string[] = []
  let score = 0

  if (indexed.normalized.id === query) { score = Math.max(score, 120); matchedBy.push('id') }
  if (indexed.normalized.model === query) { score = Math.max(score, 115); matchedBy.push('model') }
  if (indexed.normalized.displayName === query) { score = Math.max(score, 110); matchedBy.push('displayName') }
  if (indexed.normalized.aliases.includes(query)) { score = Math.max(score, 105); matchedBy.push('alias') }
  if ([indexed.normalized.id, indexed.normalized.model, indexed.normalized.displayName, ...indexed.normalized.aliases].some((item) => compactKnowledgeTerm(item) === compact)) {
    score = Math.max(score, 100)
    matchedBy.push('normalized')
  }
  if (indexed.normalized.all.includes(query)) { score = Math.max(score, 60); matchedBy.push('contains') }

  const tokens = query.split('-').filter(Boolean)
  const tokenMatches = tokens.filter((token) => indexed.normalized.all.includes(token)).length
  if (tokenMatches) {
    score = Math.max(score, Math.round(20 * tokenMatches / tokens.length))
    matchedBy.push('tokens')
  }
  return { score, matchedBy: [...new Set(matchedBy)] }
}

function referencedSourceIds(entity: KnowledgeEntity) {
  const ids = new Set(entity.sourceRefs)
  const addEvidence = (evidence: Array<{ sourceId: string }>) => evidence.forEach((item) => ids.add(item.sourceId))
  Object.values(entity.facts).forEach((fact) => addEvidence(fact.evidence))
  entity.pins.forEach((pin) => addEvidence(pin.evidence))
  entity.interfaces.forEach((item) => addEvidence(item.evidence))
  entity.constraints.forEach((constraint) => addEvidence(constraint.evidence))
  entity.drivers.forEach((driver) => driver.sourceRefs?.forEach((sourceId) => ids.add(sourceId)))
  return [...ids]
}

export class LocalKnowledgeBase {
  private packs = new Map<string, KnowledgePack>()
  private indexes: KnowledgeIndexes = { entities: new Map(), sources: new Map() }

  installPack(pack: KnowledgePack, options: InstallKnowledgePackOptions = {}): KnowledgeValidationResult {
    const validation = validateKnowledgePack(pack)
    if (!validation.valid) return validation
    if (this.packs.has(pack.id) && !options.replace) {
      return { valid: false, issues: [...validation.issues, packIssue('PACK_ALREADY_INSTALLED', `packs.${pack.id}`, `知识包 ${pack.id} 已安装`)] }
    }

    const nextPacks = new Map(this.packs)
    nextPacks.set(pack.id, clonePack(pack))
    const rebuilt = buildIndexes(nextPacks)
    const issues = [...validation.issues, ...rebuilt.issues]
    if (issues.some((item) => item.severity === 'error')) return { valid: false, issues }
    this.packs = nextPacks
    this.indexes = rebuilt.indexes
    return { valid: true, issues }
  }

  removePack(packId: string) {
    if (!this.packs.has(packId)) return false
    const nextPacks = new Map(this.packs)
    nextPacks.delete(packId)
    const rebuilt = buildIndexes(nextPacks)
    if (rebuilt.issues.some((item) => item.severity === 'error')) return false
    this.packs = nextPacks
    this.indexes = rebuilt.indexes
    return true
  }

  getPack(packId: string) {
    return this.packs.get(packId) ?? null
  }

  listPacks() {
    return [...this.packs.values()]
  }

  getEntity(entityId: string) {
    return this.indexes.entities.get(entityId)?.entity ?? null
  }

  getSource(sourceId: string) {
    return this.indexes.sources.get(sourceId) ?? null
  }

  search(query: string | KnowledgeQuery = {}): KnowledgeSearchResult[] {
    const options = typeof query === 'string' ? { text: query } : query
    const idFilter = options.ids?.map(normalizeKnowledgeTerm)
    const manufacturerFilter = options.manufacturers?.map(normalizeKnowledgeTerm)
    const tagFilter = options.tags?.map(normalizeKnowledgeTerm)
    const results: KnowledgeSearchResult[] = []

    for (const indexed of this.indexes.entities.values()) {
      if (idFilter?.length && !idFilter.includes(indexed.normalized.id)) continue
      if (!matchesFilter(indexed.entity.kind, options.kinds)) continue
      if (!matchesFilter(indexed.entity.reviewStatus, options.reviewStatuses)) continue
      if (manufacturerFilter?.length && !manufacturerFilter.includes(indexed.normalized.manufacturer)) continue
      if (tagFilter?.length && !tagFilter.every((tag) => indexed.normalized.tags.includes(tag))) continue
      const scored = scoreEntity(indexed, options.text ?? '')
      if (options.text && scored.score === 0) continue
      results.push({ entity: indexed.entity, packId: indexed.packId, packVersion: indexed.packVersion, ...scored })
    }

    return results
      .sort((left, right) => right.score - left.score || (this.indexes.entities.get(right.entity.id)?.packPriority ?? 0) - (this.indexes.entities.get(left.entity.id)?.packPriority ?? 0) || left.entity.displayName.localeCompare(right.entity.displayName, 'zh-CN'))
      .slice(0, Math.max(1, Math.min(options.limit ?? 50, 200)))
  }

  resolve(term: string, options: Omit<KnowledgeQuery, 'text' | 'limit'> = {}) {
    const result = this.search({ ...options, text: term, limit: 1 })[0]
    return result && result.score >= 100 ? result : null
  }

  createSnapshot(entityId: string, capturedAt = new Date().toISOString()): KnowledgeEntitySnapshot | null {
    const indexed = this.indexes.entities.get(entityId)
    if (!indexed) return null
    const sourceRevisions = referencedSourceIds(indexed.entity).map((sourceId) => {
      const source = this.indexes.sources.get(sourceId)
      return { sourceId, revision: source?.revision, checksum: source?.checksum }
    })
    return {
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      entityId,
      entityRevision: indexed.entity.revision,
      packId: indexed.packId,
      packVersion: indexed.packVersion,
      sourceRevisions,
      capturedAt,
    }
  }

  stats(): KnowledgeBaseStats {
    const byKind: Partial<Record<KnowledgeEntityKind, number>> = {}
    const byReviewStatus: Partial<Record<KnowledgeReviewStatus, number>> = {}
    for (const { entity } of this.indexes.entities.values()) {
      byKind[entity.kind] = (byKind[entity.kind] ?? 0) + 1
      byReviewStatus[entity.reviewStatus] = (byReviewStatus[entity.reviewStatus] ?? 0) + 1
    }
    return { packs: this.packs.size, sources: this.indexes.sources.size, entities: this.indexes.entities.size, byKind, byReviewStatus }
  }
}

export function createLocalKnowledgeBase() {
  return new LocalKnowledgeBase()
}
