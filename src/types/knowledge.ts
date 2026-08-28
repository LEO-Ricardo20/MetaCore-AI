export const KNOWLEDGE_SCHEMA_VERSION = 1

export type KnowledgeJson =
  | null
  | string
  | number
  | boolean
  | KnowledgeJson[]
  | { [key: string]: KnowledgeJson }

export type KnowledgeEntityKind =
  | 'chip'
  | 'module'
  | 'board'
  | 'component'
  | 'sensor'
  | 'display'
  | 'actuator'
  | 'communication'
  | 'storage'
  | 'power'
  | 'driver'

export type KnowledgeReviewStatus = 'draft' | 'reviewed' | 'verified' | 'deprecated'
export type KnowledgeConfidence = 'low' | 'medium' | 'high'

export type KnowledgeSourceType =
  | 'datasheet'
  | 'reference-manual'
  | 'errata'
  | 'user-guide'
  | 'schematic'
  | 'application-note'
  | 'official-documentation'
  | 'official-repository'
  | 'package-index'
  | 'community'
  | 'legacy'

export interface KnowledgeSource {
  id: string
  type: KnowledgeSourceType
  title: string
  owner: string
  official: boolean
  url?: string
  revision?: string
  publishedAt?: string
  retrievedAt?: string
  checksum?: string
  licenseNote?: string
}

export interface KnowledgeEvidenceRef {
  sourceId: string
  page?: number | string
  section?: string
  excerpt?: string
  confidence?: KnowledgeConfidence
  verifiedAt?: string
}

export interface KnowledgeFact {
  value: KnowledgeJson
  unit?: string
  critical?: boolean
  evidence: KnowledgeEvidenceRef[]
}

export interface KnowledgePin {
  id: string
  aliases?: string[]
  signals: string[]
  inputOnly?: boolean
  outputOnly?: boolean
  notes?: string[]
  evidence: KnowledgeEvidenceRef[]
}

export interface KnowledgeInterface {
  type: string
  name: string
  defaultPins?: Record<string, string>
  addresses?: string[]
  notes?: string[]
  evidence: KnowledgeEvidenceRef[]
}

export type KnowledgeConstraintSeverity = 'info' | 'warning' | 'error'

export interface KnowledgeConstraint {
  id: string
  category: string
  severity: KnowledgeConstraintSeverity
  description: string
  evidence: KnowledgeEvidenceRef[]
}

export type KnowledgeRelationType =
  | 'contains'
  | 'based-on'
  | 'variant-of'
  | 'compatible-with'
  | 'requires'
  | 'supersedes'

export interface KnowledgeRelation {
  type: KnowledgeRelationType
  targetId: string
  notes?: string
}

export interface KnowledgeDriverSupport {
  framework: string
  package?: string
  version?: string
  status: 'supported' | 'experimental' | 'deprecated'
  sourceRefs?: string[]
}

export interface KnowledgeEntity {
  schemaVersion: number
  id: string
  kind: KnowledgeEntityKind
  manufacturer: string
  model: string
  displayName: string
  aliases: string[]
  package?: string
  category?: string
  tags: string[]
  facts: Record<string, KnowledgeFact>
  pins: KnowledgePin[]
  interfaces: KnowledgeInterface[]
  constraints: KnowledgeConstraint[]
  relations: KnowledgeRelation[]
  drivers: KnowledgeDriverSupport[]
  sourceRefs: string[]
  reviewStatus: KnowledgeReviewStatus
  revision?: string
  metadata?: Record<string, KnowledgeJson>
}

export interface KnowledgePackDependency {
  packId: string
  minimumVersion?: string
}

export interface KnowledgePack {
  schemaVersion: number
  id: string
  name: string
  version: string
  /** 同分搜索结果中的优先级；正式资料包应高于兼容历史包。 */
  priority?: number
  description?: string
  generatedAt?: string
  dependencies?: KnowledgePackDependency[]
  sources: KnowledgeSource[]
  entities: KnowledgeEntity[]
}

export type KnowledgeIssueSeverity = 'warning' | 'error'

export interface KnowledgeValidationIssue {
  severity: KnowledgeIssueSeverity
  code: string
  path: string
  message: string
}

export interface KnowledgeValidationResult {
  valid: boolean
  issues: KnowledgeValidationIssue[]
}

export interface KnowledgeQuery {
  text?: string
  ids?: string[]
  kinds?: KnowledgeEntityKind[]
  manufacturers?: string[]
  tags?: string[]
  reviewStatuses?: KnowledgeReviewStatus[]
  limit?: number
}

export interface KnowledgeSearchResult {
  entity: KnowledgeEntity
  packId: string
  packVersion: string
  score: number
  matchedBy: string[]
}

export interface KnowledgeEntitySnapshot {
  schemaVersion: number
  entityId: string
  entityRevision?: string
  packId: string
  packVersion: string
  sourceRevisions: Array<{ sourceId: string; revision?: string; checksum?: string }>
  capturedAt: string
}

export interface KnowledgeBaseStats {
  packs: number
  sources: number
  entities: number
  byKind: Partial<Record<KnowledgeEntityKind, number>>
  byReviewStatus: Partial<Record<KnowledgeReviewStatus, number>>
}
