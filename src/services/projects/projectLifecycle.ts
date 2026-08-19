import {
  PROJECT_SCHEMA_VERSION,
  type ArtifactKey,
  type ArtifactState,
  type PipelineStage,
  type PipelineStageState,
  type Project,
  type ProjectArtifacts,
  type ProjectRun,
  type ProjectStage,
  type ProjectValidationSummary,
  type StageRunStatus,
} from '@/types/project'

export const PIPELINE_STAGES: PipelineStage[] = [
  'requirements',
  'clarification',
  'scheme-generation',
  'scheme-validation',
  'code-generation',
  'code-validation',
  'flow-generation',
  'local-analysis',
  'build',
  'release-check',
]

export const ARTIFACT_KEYS: ArtifactKey[] = [
  'requirements',
  'scheme',
  'pinMap',
  'bom',
  'wiring',
  'code',
  'flow',
  'localAnalysis',
  'consistencyReport',
  'buildResult',
  'releaseReport',
]

const STALE_DEPENDENCIES: Record<'requirements' | 'target' | 'format' | 'scheme' | 'pinMap' | 'code' | 'localFiles', ArtifactKey[]> = {
  requirements: ['scheme', 'pinMap', 'bom', 'wiring', 'code', 'flow', 'localAnalysis', 'consistencyReport', 'buildResult', 'releaseReport'],
  target: ['scheme', 'pinMap', 'bom', 'wiring', 'code', 'flow', 'localAnalysis', 'consistencyReport', 'buildResult', 'releaseReport'],
  format: ['code', 'flow', 'consistencyReport', 'buildResult', 'releaseReport'],
  scheme: ['code', 'flow', 'consistencyReport', 'buildResult', 'releaseReport'],
  pinMap: ['code', 'flow', 'consistencyReport', 'buildResult', 'releaseReport'],
  code: ['flow', 'consistencyReport', 'buildResult', 'releaseReport'],
  localFiles: ['localAnalysis', 'buildResult', 'releaseReport'],
}

function artifact(status: ArtifactState['status'], version = 0, updatedAt?: number): ArtifactState {
  return { status, version, updatedAt }
}

export function createProjectArtifacts(source?: Partial<Project>): ProjectArtifacts {
  const now = source?.updatedAt
  return {
    requirements: artifact(source?.requirement ? 'fresh' : 'missing', source?.requirement ? 1 : 0, now),
    scheme: artifact(source?.scheme ? 'fresh' : 'missing', source?.scheme ? 1 : 0, now),
    pinMap: artifact(source?.scheme?.pins?.length ? 'fresh' : 'missing', source?.scheme?.pins?.length ? 1 : 0, now),
    bom: artifact(source?.scheme?.bom?.length ? 'fresh' : 'missing', source?.scheme?.bom?.length ? 1 : 0, now),
    wiring: artifact(source?.scheme?.wiring?.length ? 'fresh' : 'missing', source?.scheme?.wiring?.length ? 1 : 0, now),
    code: artifact(source?.codeFiles?.length ? 'fresh' : 'missing', source?.codeFiles?.length ? 1 : 0, now),
    flow: artifact(source?.flowNodes?.length ? 'fresh' : 'missing', source?.flowNodes?.length ? 1 : 0, now),
    localAnalysis: artifact('missing'),
    consistencyReport: artifact('missing'),
    buildResult: artifact('missing'),
    releaseReport: artifact('missing'),
  }
}

export function inferProjectStage(project: Partial<Project>): ProjectStage {
  if (project.currentStage) return project.currentStage
  if (project.codeFiles?.length && project.flowNodes?.length) return 'verification'
  if (project.codeFiles?.length) return 'implementation'
  if (project.scheme) return 'design-review'
  if (project.requirement) return 'requirements-ready'
  return 'draft'
}

export function normalizeProject(project: Project | (Partial<Project> & Pick<Project, 'id' | 'name' | 'target' | 'format' | 'createdAt' | 'updatedAt'>)): Project {
  const base = project as Project
  const generated = createProjectArtifacts(base)
  const existing = base.artifacts ?? generated
  const artifacts = Object.fromEntries(ARTIFACT_KEYS.map((key) => [key, { ...generated[key], ...existing[key] }])) as ProjectArtifacts

  return {
    ...base,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    requirement: typeof base.requirement === 'string' ? base.requirement : '',
    selectedDriverIds: base.selectedDriverIds ?? [],
    codeFiles: base.codeFiles ?? [],
    flowNodes: base.flowNodes ?? [],
    flowEdges: base.flowEdges ?? [],
    currentStage: inferProjectStage(base),
    artifacts,
    runs: Array.isArray(base.runs) ? base.runs : [],
    versions: Array.isArray(base.versions) ? base.versions : [],
    validation: base.validation ?? { status: 'unchecked', issueCount: 0, blockingCount: 0 },
  }
}

export function markArtifactsStale(
  artifacts: ProjectArtifacts,
  reason: keyof typeof STALE_DEPENDENCIES,
  now = Date.now(),
): ProjectArtifacts {
  const stale = new Set(STALE_DEPENDENCIES[reason])
  return Object.fromEntries(ARTIFACT_KEYS.map((key) => {
    const current = artifacts[key]
    if (!stale.has(key) || current.status === 'missing') return [key, current]
    return [key, { ...current, status: 'stale', staleReason: reason, updatedAt: now }]
  })) as ProjectArtifacts
}

export function updateArtifact(
  artifacts: ProjectArtifacts,
  key: ArtifactKey,
  status: ArtifactState['status'],
  now = Date.now(),
): ProjectArtifacts {
  const current = artifacts[key]
  const isNewVersion = status === 'fresh' || status === 'valid'
  return {
    ...artifacts,
    [key]: {
      ...current,
      status,
      version: isNewVersion ? current.version + 1 : current.version,
      updatedAt: now,
      staleReason: status === 'stale' ? current.staleReason : undefined,
    },
  }
}

export function createPipelineStage(id: PipelineStage, status: StageRunStatus = 'waiting'): PipelineStageState {
  return { id, status, progress: 0, currentAction: '', retryCount: 0 }
}

export function createProjectRun(id: string, fromStage: PipelineStage = 'requirements', now = Date.now()): ProjectRun {
  const startIndex = PIPELINE_STAGES.indexOf(fromStage)
  return {
    id,
    status: 'waiting',
    createdAt: now,
    currentStage: fromStage,
    stages: PIPELINE_STAGES.map((stage, index) => createPipelineStage(stage, index < startIndex ? 'skipped' : 'waiting')),
  }
}

export function validationFromArtifacts(artifacts: ProjectArtifacts): ProjectValidationSummary {
  if (artifacts.consistencyReport.status === 'stale' || artifacts.releaseReport.status === 'stale') {
    return { status: 'stale', issueCount: 0, blockingCount: 0, updatedAt: Date.now() }
  }
  return { status: 'unchecked', issueCount: 0, blockingCount: 0 }
}
