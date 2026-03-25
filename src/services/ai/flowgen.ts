/** 流程图生成服务 — 供 FlowPage 和一键式流水线共用 */
import type { AIServiceConfig } from '@/types/ai'
import type { CodeFile, FlowNode, FlowEdge } from '@/types/project'
import { callAI } from './client'
import { buildFlowPrompt } from './prompts'
import { parseJSON } from '@/lib/utils'

export interface FlowgenResult {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export async function runFlowgen(
  svc: AIServiceConfig,
  codeFiles: CodeFile[]
): Promise<FlowgenResult> {
  const files = codeFiles.map(f => ({ path: f.path, content: f.content }))
  const prompt = buildFlowPrompt(files)
  const raw = await callAI(svc, [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.user }
  ], { temperature: 0.2 })
  const result = parseJSON<{ nodes: FlowNode[]; edges: FlowEdge[] }>(raw)
  if (!result?.nodes?.length) throw new Error('AI 返回格式解析失败，请重试')
  return { nodes: result.nodes, edges: result.edges }
}
