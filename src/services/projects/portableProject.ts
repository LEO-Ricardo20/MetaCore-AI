import { APP_VERSION } from '@/config/app'
import { parseCodeFiles, parseFlowGraph, parseHardwareScheme } from '@/services/ai/validation'
import { normalizeProject } from './projectLifecycle'
import { ARTIFACT_KEYS, PIPELINE_STAGES } from './projectLifecycle'
import type { ArtifactStatus, Project, ProjectStage, StageRunStatus } from '@/types/project'
import type { ProjectFormat } from '@/types/hardware'
import type { Esp32ProjectConfig } from '@/types/esp32'
import { getEsp32Profile, normalizeEsp32ProjectConfig } from '@/services/esp32/esp32Config'

const ARCHIVE_KIND = 'metacore.project'
const ARCHIVE_SCHEMA_VERSION = 1
const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024
const PROJECT_FORMATS = new Set<ProjectFormat>(['espidf', 'arduino', 'platformio', 'cubeide'])
const PROJECT_STAGES = new Set<ProjectStage>(['draft', 'requirements-ready', 'planning', 'design-review', 'implementation', 'verification', 'ready-to-export', 'failed', 'cancelled'])
const ARTIFACT_STATUSES = new Set<ArtifactStatus>(['missing', 'generating', 'fresh', 'stale', 'validating', 'valid', 'invalid'])
const RUN_STATUSES = new Set<StageRunStatus>(['idle', 'waiting', 'running', 'succeeded', 'failed', 'cancelled', 'skipped'])

export interface PortableProjectArchive {
  kind: typeof ARCHIVE_KIND
  schemaVersion: typeof ARCHIVE_SCHEMA_VERSION
  appVersion: string
  exportedAt: string
  project: Project
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string, maxLength: number) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`项目文件缺少有效字段：${field}`)
  if (value.length > maxLength) throw new Error(`项目文件字段过长：${field}`)
  return value.trim()
}

function optionalStringArray(value: unknown, field: string, maxItems: number) {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error(`项目文件字段必须是数组：${field}`)
  return value.slice(0, maxItems).map((item, index) => requiredString(item, `${field}[${index}]`, 160))
}

function timestamp(value: unknown, field: string) {
  const result = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(result) || result <= 0) throw new Error(`项目文件时间字段无效：${field}`)
  return result
}

function parseEsp32Config(value: unknown, target: string): Esp32ProjectConfig | undefined {
  if (value === undefined) return normalizeEsp32ProjectConfig(undefined, target)
  if (!isRecord(value)) throw new Error('项目文件字段必须是对象：project.esp32')
  const optionalString = (candidate: unknown, fallback: string, field: string) => candidate === undefined
    ? fallback
    : requiredString(candidate, field, 300)
  const boardId = requiredString(value.boardId, 'project.esp32.boardId', 160)
  if (!getEsp32Profile(boardId)) throw new Error(`项目文件包含未知 ESP32 开发板：${boardId}`)
  const normalized = normalizeEsp32ProjectConfig({ boardId }, target)
  if (!normalized) return undefined
  return normalizeEsp32ProjectConfig({
    ...normalized,
    family: optionalString(value.family, normalized.family, 'project.esp32.family') as Esp32ProjectConfig['family'],
    module: optionalString(value.module, normalized.module, 'project.esp32.module'),
    platformioBoard: optionalString(value.platformioBoard, normalized.platformioBoard, 'project.esp32.platformioBoard'),
    platformioFramework: optionalString(value.platformioFramework, normalized.platformioFramework, 'project.esp32.platformioFramework') as Esp32ProjectConfig['platformioFramework'],
    idfTarget: optionalString(value.idfTarget, normalized.idfTarget, 'project.esp32.idfTarget') as Esp32ProjectConfig['idfTarget'],
    arduinoBoard: value.arduinoBoard === undefined ? normalized.arduinoBoard : requiredString(value.arduinoBoard, 'project.esp32.arduinoBoard', 300),
    flashSize: optionalString(value.flashSize, normalized.flashSize, 'project.esp32.flashSize'),
    flashMode: optionalString(value.flashMode, normalized.flashMode, 'project.esp32.flashMode') as Esp32ProjectConfig['flashMode'],
    psramSize: optionalString(value.psramSize, normalized.psramSize, 'project.esp32.psramSize'),
    usbMode: optionalString(value.usbMode, normalized.usbMode, 'project.esp32.usbMode'),
    uploadSpeed: Number.isFinite(Number(value.uploadSpeed)) ? Number(value.uploadSpeed) : normalized.uploadSpeed,
    monitorSpeed: Number.isFinite(Number(value.monitorSpeed)) ? Number(value.monitorSpeed) : normalized.monitorSpeed,
    partitionScheme: optionalString(value.partitionScheme, normalized.partitionScheme, 'project.esp32.partitionScheme'),
  }, target)
}

function normalizeValidationError(error: unknown, section: string): never {
  const message = error instanceof Error
    ? error.message
      .replaceAll('AI 返回了', '数据包含')
      .replaceAll('AI 返回的', '数据中的')
      .replaceAll('AI 返回', '数据')
    : String(error)
  throw new Error(`项目文件中的${section}无效：${message}`)
}

function parseProject(value: unknown): Project {
  if (!isRecord(value)) throw new Error('项目文件缺少 project 对象')

  const formatValue = requiredString(value.format, 'project.format', 40)
  if (!PROJECT_FORMATS.has(formatValue as ProjectFormat)) {
    throw new Error(`项目文件包含不支持的工程格式：${formatValue}`)
  }

  let scheme: Project['scheme']
  if (value.scheme !== undefined && value.scheme !== null) {
    try {
      scheme = parseHardwareScheme(JSON.stringify(value.scheme))
    } catch (error) {
      normalizeValidationError(error, '硬件方案')
    }
  }

  if (!Array.isArray(value.codeFiles)) throw new Error('项目文件缺少 project.codeFiles 数组')
  let codeFiles: Project['codeFiles'] = []
  if (value.codeFiles.length) {
    try {
      codeFiles = parseCodeFiles(JSON.stringify({ files: value.codeFiles }))
    } catch (error) {
      normalizeValidationError(error, '代码文件')
    }
  }

  if (!Array.isArray(value.flowNodes) || !Array.isArray(value.flowEdges)) {
    throw new Error('项目文件缺少流程图节点或连线数组')
  }
  let flowNodes: Project['flowNodes'] = []
  let flowEdges: Project['flowEdges'] = []
  if (value.flowNodes.length) {
    try {
      const graph = parseFlowGraph(JSON.stringify({ nodes: value.flowNodes, edges: value.flowEdges }))
      flowNodes = graph.nodes
      flowEdges = graph.edges
    } catch (error) {
      normalizeValidationError(error, '流程图')
    }
  } else if (value.flowEdges.length) {
    throw new Error('项目文件包含连线，但没有流程图节点')
  }

  const target = requiredString(value.target, 'project.target', 160)
  const normalized = normalizeProject({
    id: requiredString(value.id, 'project.id', 160),
    name: requiredString(value.name, 'project.name', 300),
    requirement: typeof value.requirement === 'string' ? value.requirement.slice(0, 100_000) : '',
    target,
    format: formatValue as ProjectFormat,
    esp32: parseEsp32Config(value.esp32, target),
    scheme,
    selectedDriverIds: optionalStringArray(value.selectedDriverIds, 'project.selectedDriverIds', 200),
    codeFiles,
    flowNodes,
    flowEdges,
    createdAt: timestamp(value.createdAt, 'project.createdAt'),
    updatedAt: timestamp(value.updatedAt, 'project.updatedAt'),
  })
  if (typeof value.currentStage === 'string' && PROJECT_STAGES.has(value.currentStage as ProjectStage)) normalized.currentStage = value.currentStage as ProjectStage
  if (isRecord(value.artifacts)) {
    for (const key of ARTIFACT_KEYS) {
      const candidate = value.artifacts[key]
      if (!isRecord(candidate) || typeof candidate.status !== 'string' || !ARTIFACT_STATUSES.has(candidate.status as ArtifactStatus)) continue
      normalized.artifacts[key] = {
        status: candidate.status as ArtifactStatus,
        version: Math.max(0, Math.round(Number(candidate.version) || 0)),
        updatedAt: Number.isFinite(Number(candidate.updatedAt)) ? Number(candidate.updatedAt) : undefined,
        staleReason: typeof candidate.staleReason === 'string' ? candidate.staleReason.slice(0, 200) : undefined,
        sourceVersion: Number.isFinite(Number(candidate.sourceVersion)) ? Number(candidate.sourceVersion) : undefined,
      }
    }
  }
  if (Array.isArray(value.versions)) {
    normalized.versions = value.versions.slice(0, 200).filter(isRecord).map((item, index) => ({
      id: requiredString(item.id, `project.versions[${index}].id`, 160),
      label: requiredString(item.label, `project.versions[${index}].label`, 300),
      createdAt: timestamp(item.createdAt, `project.versions[${index}].createdAt`),
      sourceProjectId: requiredString(item.sourceProjectId, `project.versions[${index}].sourceProjectId`, 160),
      schemeVersion: Math.max(0, Math.round(Number(item.schemeVersion) || 0)),
      codeVersion: Math.max(0, Math.round(Number(item.codeVersion) || 0)),
    }))
  }
  if (Array.isArray(value.runs)) {
    normalized.runs = value.runs.slice(-50).filter(isRecord).map((run, runIndex) => ({
      id: requiredString(run.id, `project.runs[${runIndex}].id`, 160),
      status: typeof run.status === 'string' && RUN_STATUSES.has(run.status as StageRunStatus) ? run.status as StageRunStatus : 'failed',
      createdAt: timestamp(run.createdAt, `project.runs[${runIndex}].createdAt`),
      startedAt: Number.isFinite(Number(run.startedAt)) ? Number(run.startedAt) : undefined,
      finishedAt: Number.isFinite(Number(run.finishedAt)) ? Number(run.finishedAt) : undefined,
      currentStage: typeof run.currentStage === 'string' && PIPELINE_STAGES.includes(run.currentStage as never) ? run.currentStage as Project['runs'][number]['currentStage'] : undefined,
      stages: Array.isArray(run.stages) ? run.stages.slice(0, 20).filter(isRecord).map((stage) => ({
        id: typeof stage.id === 'string' && PIPELINE_STAGES.includes(stage.id as never) ? stage.id as Project['runs'][number]['stages'][number]['id'] : 'requirements',
        status: typeof stage.status === 'string' && RUN_STATUSES.has(stage.status as StageRunStatus) ? stage.status as StageRunStatus : 'failed',
        progress: Math.max(0, Math.min(100, Number(stage.progress) || 0)),
        currentAction: typeof stage.currentAction === 'string' ? stage.currentAction.slice(0, 500) : '',
        retryCount: Math.max(0, Math.round(Number(stage.retryCount) || 0)),
        startedAt: Number.isFinite(Number(stage.startedAt)) ? Number(stage.startedAt) : undefined,
        finishedAt: Number.isFinite(Number(stage.finishedAt)) ? Number(stage.finishedAt) : undefined,
        model: typeof stage.model === 'string' ? stage.model.slice(0, 300) : undefined,
        provider: typeof stage.provider === 'string' ? stage.provider.slice(0, 160) : undefined,
        promptVersion: typeof stage.promptVersion === 'string' ? stage.promptVersion.slice(0, 100) : undefined,
        errorCode: typeof stage.errorCode === 'string' ? stage.errorCode.slice(0, 120) : undefined,
        errorMessage: typeof stage.errorMessage === 'string' ? stage.errorMessage.slice(0, 2_000) : undefined,
      })) : [],
    }))
  }
  if (isRecord(value.validation)) {
    const allowed = new Set(['unchecked', 'running', 'warning', 'error', 'passed', 'stale'])
    normalized.validation = {
      status: allowed.has(String(value.validation.status)) ? value.validation.status as Project['validation']['status'] : 'unchecked',
      issueCount: Math.max(0, Math.round(Number(value.validation.issueCount) || 0)),
      blockingCount: Math.max(0, Math.round(Number(value.validation.blockingCount) || 0)),
      updatedAt: Number.isFinite(Number(value.validation.updatedAt)) ? Number(value.validation.updatedAt) : undefined,
    }
  }
  return normalized
}

export function createPortableProject(project: Project): PortableProjectArchive {
  const portableProject = structuredClone(project)
  delete portableProject.lastSessionId
  portableProject.runs = portableProject.runs.map((run) => ({
    ...run,
    sessionId: undefined,
    stages: run.stages.map((stage) => ({
      ...stage,
      rawResponse: undefined,
      structuredResult: undefined,
      validationResult: undefined,
    })),
  }))
  return {
    kind: ARCHIVE_KIND,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    project: portableProject,
  }
}

export function serializePortableProject(project: Project) {
  return JSON.stringify(createPortableProject(project), null, 2)
}

export function parsePortableProject(text: string): Project {
  if (new TextEncoder().encode(text).byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error('项目文件超过 10MB 导入限制')
  }

  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('项目文件不是有效的 JSON')
  }
  if (!isRecord(value)) throw new Error('项目文件必须是 JSON 对象')
  if (value.kind !== ARCHIVE_KIND) throw new Error('这不是 MetaCore Studio 项目文件')
  if (value.schemaVersion !== ARCHIVE_SCHEMA_VERSION) {
    throw new Error(`不支持的项目文件版本：${String(value.schemaVersion)}`)
  }
  return parseProject(value.project)
}

export function portableProjectFilename(project: Project) {
  const safeName = project.name
    .trim()
    .replace(/[<>:"/\\|?*]/g, '_')
    .split('')
    .map((character) => character.charCodeAt(0) < 32 ? '_' : character)
    .join('')
    .slice(0, 80) || 'metacore-project'
  return `${safeName}.metacore.json`
}
