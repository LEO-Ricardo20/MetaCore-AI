/** 流程图生成服务 — 供 FlowPage 和一键式流水线共用 */
import type { AIServiceConfig } from '@/types/ai'
import type { CodeFile, FlowNode, FlowEdge } from '@/types/project'
import { callAI, type CallAIOptions } from './client'
import { buildFlowPrompt } from './prompts'
import { parseFlowGraph } from './validation'

export interface FlowgenResult {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export async function runFlowgen(
  svc: AIServiceConfig,
  codeFiles: CodeFile[],
  options: Pick<CallAIOptions, 'signal'> = {},
): Promise<FlowgenResult> {
  const files = codeFiles.map(f => ({ path: f.path, content: f.content }))
  const prompt = buildFlowPrompt(files)
  const raw = await callAI(svc, [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.user }
  ], { temperature: 0.2, signal: options.signal })
  return parseFlowGraph(raw)
}
