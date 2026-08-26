import { parseJSON } from '@/lib/utils'
import type { ChipSpec, PeripheralBus } from '@/types/hardware'
import type { CodeFile, FlowEdge, FlowNode, HardwareScheme } from '@/types/project'

const CODE_LANGUAGES = new Set<CodeFile['language']>(['c', 'h', 'cpp', 'cmake', 'ini', 'makefile', 'other'])
const BUS_TYPES = new Set<PeripheralBus['type']>(['I2C', 'SPI', 'UART', 'I2S', 'CAN', 'SDIO', 'USB', 'ADC', 'DAC', 'PWM'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string, maxLength = 20_000) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`AI 返回缺少有效字段：${field}`)
  return value.trim().slice(0, maxLength)
}

function optionalString(value: unknown, maxLength = 2_000) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : undefined
}

function finiteNumber(value: unknown, field: string) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) throw new Error(`AI 返回的 ${field} 必须是数字`)
  return number
}

function arrayField(value: unknown, field: string, maxItems: number) {
  if (!Array.isArray(value)) throw new Error(`AI 返回缺少数组字段：${field}`)
  return value.slice(0, maxItems)
}

function objectField(value: unknown, field: string) {
  if (!isRecord(value)) throw new Error(`AI 返回缺少对象字段：${field}`)
  return value
}

function parseAIJSON(text: string, label: string) {
  const value = parseJSON<unknown>(text)
  if (!isRecord(value)) throw new Error(`${label}不是有效的 JSON 对象，请重试`)
  return value
}

function scalarText(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}

function flattenPinMapping(value: unknown, path: string[] = [], output: Array<{ key: string; group: string; pin: string }> = []) {
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) flattenPinMapping(child, [...path, key], output)
    return output
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => flattenPinMapping(child, [...path, String(index + 1)], output))
    return output
  }
  const pin = scalarText(value)
  if (pin && path.length) output.push({ key: path[path.length - 1], group: path.slice(0, -1).join(' / '), pin })
  return output
}

function normalizeHardwareSchemeData(data: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...data }
  if (!Array.isArray(normalized.pins) && isRecord(normalized.pinMapping)) {
    normalized.pins = flattenPinMapping(normalized.pinMapping).map(({ key, group, pin }) => ({
      pinNumber: pin,
      pinName: key,
      function: group || key,
      connectedTo: group || key,
      voltage: /12v|5v|3v3|vdd|gnd/i.test(`${key} ${pin}`) ? pin : '3.3V',
    }))
  }
  if (Array.isArray(normalized.bom)) {
    normalized.bom = normalized.bom.map((item) => isRecord(item) ? {
      ...item,
      model: item.model ?? item.package ?? item.partNumber ?? item.name,
      unitPrice: Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : 0,
    } : item)
  }
  if (isRecord(normalized.wiring)) {
    normalized.wiring = Object.entries(normalized.wiring).map(([from, value]) => ({
      from,
      to: scalarText(value) || JSON.stringify(value),
      note: '由 AI 返回的分组接线说明，生成后请按原理图复核。',
    }))
  }
  normalized.description = normalized.description ?? normalized.summary ?? normalized.overview ?? normalized.architecture ?? '硬件方案已生成，详细架构见引脚分配、BOM 和接线数据。'
  return normalized
}

function normalizeGeneratedPath(value: unknown) {
  const raw = requiredString(value, 'files[].path', 260).replace(/\\/g, '/')
  const parts = raw.split('/').filter((part) => part && part !== '.')
  if (
    raw.startsWith('/')
    || /^[A-Za-z]:/.test(raw)
    || raw.includes('\0')
    || !parts.length
    || parts.some((part) => part === '..')
  ) {
    throw new Error(`AI 返回了不安全的工程文件路径：${raw}`)
  }
  return parts.join('/')
}

export function parseHardwareScheme(text: string): HardwareScheme {
  const data = normalizeHardwareSchemeData(parseAIJSON(text, '硬件方案'))
  const pins = arrayField(data.pins, 'pins', 160).map((value, index) => {
    const item = objectField(value, `pins[${index}]`)
    return {
      pinNumber: requiredString(item.pinNumber, `pins[${index}].pinNumber`, 80),
      pinName: requiredString(item.pinName, `pins[${index}].pinName`, 120),
      function: requiredString(item.function, `pins[${index}].function`, 500),
      connectedTo: requiredString(item.connectedTo, `pins[${index}].connectedTo`, 500),
      voltage: requiredString(item.voltage, `pins[${index}].voltage`, 80),
    }
  })
  const bom = arrayField(data.bom, 'bom', 200).map((value, index) => {
    const item = objectField(value, `bom[${index}]`)
    return {
      name: requiredString(item.name, `bom[${index}].name`, 300),
      model: requiredString(item.model, `bom[${index}].model`, 300),
      quantity: Math.max(1, Math.round(finiteNumber(item.quantity, `bom[${index}].quantity`))),
      unitPrice: Math.max(0, finiteNumber(item.unitPrice, `bom[${index}].unitPrice`)),
      purchaseLink: optionalString(item.purchaseLink, 1_000),
    }
  })
  const wiring = arrayField(data.wiring, 'wiring', 240).map((value, index) => {
    const item = objectField(value, `wiring[${index}]`)
    return {
      from: requiredString(item.from, `wiring[${index}].from`, 500),
      to: requiredString(item.to, `wiring[${index}].to`, 500),
      wireColor: optionalString(item.wireColor, 100),
      note: optionalString(item.note, 1_000),
    }
  })

  return {
    description: requiredString(data.description, 'description'),
    pins,
    bom,
    wiring,
  }
}

export function parseCodeFiles(text: string): CodeFile[] {
  const data = parseAIJSON(text, '代码生成结果')
  const rawFiles = arrayField(data.files, 'files', 120)
  if (!rawFiles.length) throw new Error('AI 没有返回任何工程文件')

  let totalBytes = 0
  const seen = new Set<string>()
  return rawFiles.map((value, index) => {
    const item = objectField(value, `files[${index}]`)
    const path = normalizeGeneratedPath(item.path)
    if (seen.has(path.toLowerCase())) throw new Error(`AI 返回了重复的工程文件路径：${path}`)
    seen.add(path.toLowerCase())

    const content = typeof item.content === 'string' ? item.content : ''
    if (!content.trim()) throw new Error(`AI 返回的工程文件为空：${path}`)
    totalBytes += new TextEncoder().encode(content).byteLength
    if (totalBytes > 4 * 1024 * 1024) throw new Error('AI 返回的工程代码超过 4MB 安全限制')

    const language = typeof item.language === 'string' && CODE_LANGUAGES.has(item.language as CodeFile['language'])
      ? item.language as CodeFile['language']
      : 'other'
    return { path, content, language }
  })
}

export function parseFlowGraph(text: string): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const data = parseAIJSON(text, '流程图结果')
  const ids = new Set<string>()
  const nodes = arrayField(data.nodes, 'nodes', 300).map((value, index) => {
    const item = objectField(value, `nodes[${index}]`)
    const id = requiredString(item.id, `nodes[${index}].id`, 120)
    if (ids.has(id)) throw new Error(`AI 返回了重复的流程图节点：${id}`)
    ids.add(id)
    const position = objectField(item.position, `nodes[${index}].position`)
    return {
      id,
      label: requiredString(item.label, `nodes[${index}].label`, 300),
      codeFileRef: optionalString(item.codeFileRef, 500),
      codeLine: item.codeLine === undefined ? undefined : Math.max(1, Math.round(finiteNumber(item.codeLine, `nodes[${index}].codeLine`))),
      functionName: optionalString(item.functionName, 300),
      evidence: optionalString(item.evidence, 2_000),
      codeSnippet: optionalString(item.codeSnippet, 4_000),
      nodeStyle: optionalString(item.nodeStyle, 80),
      type: optionalString(item.type, 80),
      position: {
        x: finiteNumber(position.x, `nodes[${index}].position.x`),
        y: finiteNumber(position.y, `nodes[${index}].position.y`),
      },
    }
  })
  if (!nodes.length) throw new Error('AI 没有返回任何流程图节点')

  const edgeIds = new Set<string>()
  const edges = arrayField(data.edges, 'edges', 500).map((value, index) => {
    const item = objectField(value, `edges[${index}]`)
    const id = requiredString(item.id, `edges[${index}].id`, 120)
    const source = requiredString(item.source, `edges[${index}].source`, 120)
    const target = requiredString(item.target, `edges[${index}].target`, 120)
    if (edgeIds.has(id)) throw new Error(`AI 返回了重复的流程图连线：${id}`)
    if (!ids.has(source) || !ids.has(target)) throw new Error(`流程图连线 ${id} 引用了不存在的节点`)
    edgeIds.add(id)
    return { id, source, target, label: optionalString(item.label, 300) }
  })
  return { nodes, edges }
}

export interface VerificationIssue {
  severity: 'info' | 'warning' | 'error'
  category: string
  message: string
  evidence?: string
  file?: string
  line?: number
  expected?: string
  actual?: string
  fixSuggestion?: string
}

export function parseVerification(text: string): { consistent: boolean; score: number; issues: VerificationIssue[] } {
  const data = parseAIJSON(text, '代码自检结果')
  if (typeof data.consistent !== 'boolean') throw new Error('AI 自检结果缺少 consistent 字段')
  const issues = arrayField(data.issues, 'issues', 100).map((value, index): VerificationIssue | null => {
    if (typeof value === 'string' && value.trim()) return { severity: 'warning', category: 'consistency', message: value.trim().slice(0, 2_000) }
    if (!isRecord(value)) return null
    const severity = ['info', 'warning', 'error'].includes(String(value.severity)) ? value.severity as VerificationIssue['severity'] : 'warning'
    const message = requiredString(value.message, `issues[${index}].message`, 2_000)
    return {
      severity,
      category: optionalString(value.category, 120) ?? 'consistency',
      message,
      evidence: optionalString(value.evidence, 4_000),
      file: optionalString(value.file, 500),
      line: value.line === undefined ? undefined : Math.max(1, Math.round(finiteNumber(value.line, `issues[${index}].line`))),
      expected: optionalString(value.expected, 2_000),
      actual: optionalString(value.actual, 2_000),
      fixSuggestion: optionalString(value.fixSuggestion, 4_000),
    }
  }).filter((issue): issue is VerificationIssue => Boolean(issue))
  return {
    consistent: data.consistent,
    score: Math.max(0, Math.min(100, data.score === undefined ? (data.consistent ? 100 : Math.max(0, 100 - issues.length * 10)) : finiteNumber(data.score, 'score'))),
    issues,
  }
}

export function parseChipSpec(text: string): ChipSpec {
  const data = parseAIJSON(text, '芯片参数')
  const gpios = arrayField(data.gpios, 'gpios', 600).map((value, index) => {
    const item = objectField(value, `gpios[${index}]`)
    return {
      pin: requiredString(item.pin, `gpios[${index}].pin`, 80),
      altFunctions: arrayField(item.altFunctions, `gpios[${index}].altFunctions`, 80)
        .filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
        .map((entry) => entry.trim().slice(0, 200)),
      inputOnly: typeof item.inputOnly === 'boolean' ? item.inputOnly : undefined,
      notes: optionalString(item.notes, 1_000),
    }
  })
  const peripherals = arrayField(data.peripherals, 'peripherals', 120).map((value, index) => {
    const item = objectField(value, `peripherals[${index}]`)
    const type = requiredString(item.type, `peripherals[${index}].type`, 20).toUpperCase()
    if (!BUS_TYPES.has(type as PeripheralBus['type'])) throw new Error(`不支持的外设总线类型：${type}`)
    const defaultPinsValue = objectField(item.defaultPins, `peripherals[${index}].defaultPins`)
    const defaultPins = Object.fromEntries(Object.entries(defaultPinsValue)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, value]) => [key.slice(0, 80), value.trim().slice(0, 80)]))
    return {
      name: requiredString(item.name, `peripherals[${index}].name`, 120),
      type: type as PeripheralBus['type'],
      defaultPins,
    }
  })
  const stringArray = (value: unknown, field: string) => arrayField(value, field, 300)
    .filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    .map((entry) => entry.trim().slice(0, 1_000))

  return {
    name: requiredString(data.name, 'name', 120),
    fullName: requiredString(data.fullName, 'fullName', 300),
    arch: requiredString(data.arch, 'arch', 300),
    flash: requiredString(data.flash, 'flash', 120),
    sram: requiredString(data.sram, 'sram', 120),
    clockSpeed: requiredString(data.clockSpeed, 'clockSpeed', 120),
    voltage: requiredString(data.voltage, 'voltage', 120),
    gpios,
    peripherals,
    bootPins: stringArray(data.bootPins, 'bootPins'),
    restrictions: stringArray(data.restrictions, 'restrictions'),
  }
}
