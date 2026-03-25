import type { ChipTarget, ProjectFormat, PinAssignment, BOMItem, WiringEntry } from './hardware'

export interface HardwareScheme {
  description: string
  pins: PinAssignment[]
  bom: BOMItem[]
  wiring: WiringEntry[]
}

export interface CodeFile {
  path: string
  content: string
  language: 'c' | 'h' | 'cpp' | 'cmake' | 'ini' | 'makefile' | 'other'
}

/** 流程图节点 */
export interface FlowNode {
  id: string
  label: string
  codeFileRef?: string
  codeSnippet?: string
  /** 节点分类样式（如 init/sensor/comm/display/error/logic） */
  nodeStyle?: string
  position: { x: number; y: number }
  type?: string
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface Project {
  id: string
  name: string
  requirement: string
  target: ChipTarget
  format: ProjectFormat
  scheme?: HardwareScheme
  selectedDriverIds?: string[]
  codeFiles: CodeFile[]
  flowNodes: FlowNode[]
  flowEdges: FlowEdge[]
  createdAt: number
  updatedAt: number
}
