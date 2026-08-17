import { APP_VERSION } from '@/config/app'
import { parseCodeFiles, parseFlowGraph, parseHardwareScheme } from '@/services/ai/validation'
import type { Project } from '@/types/project'
import type { ProjectFormat } from '@/types/hardware'

const ARCHIVE_KIND = 'metacore.project'
const ARCHIVE_SCHEMA_VERSION = 1
const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024
const PROJECT_FORMATS = new Set<ProjectFormat>(['espidf', 'arduino', 'platformio', 'cubeide'])

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

  return {
    id: requiredString(value.id, 'project.id', 160),
    name: requiredString(value.name, 'project.name', 300),
    requirement: typeof value.requirement === 'string' ? value.requirement.slice(0, 100_000) : '',
    target: requiredString(value.target, 'project.target', 160),
    format: formatValue as ProjectFormat,
    scheme,
    selectedDriverIds: optionalStringArray(value.selectedDriverIds, 'project.selectedDriverIds', 200),
    codeFiles,
    flowNodes,
    flowEdges,
    createdAt: timestamp(value.createdAt, 'project.createdAt'),
    updatedAt: timestamp(value.updatedAt, 'project.updatedAt'),
  }
}

export function createPortableProject(project: Project): PortableProjectArchive {
  return {
    kind: ARCHIVE_KIND,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    project: structuredClone(project),
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
