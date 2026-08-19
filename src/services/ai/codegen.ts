/** 代码生成服务 — 供 CodegenPage 和一键式流水线共用 */
import type { AIServiceConfig } from '@/types/ai'
import type { ChipSpec } from '@/types/hardware'
import type { Project, CodeFile } from '@/types/project'
import { AIRequestCancelledError, type CallAIOptions } from './client'
import { buildCodegenPrompt, buildVerifyPrompt } from './prompts'
import { parseCodeFiles, parseVerification } from './validation'
import { callTaskContract } from './contracts'

export interface CodegenResult {
  files: CodeFile[]
  warning?: string
}

export async function runCodegen(
  svc: AIServiceConfig,
  project: Project,
  chipSpec?: ChipSpec,
  options: Pick<CallAIOptions, 'signal'> = {},
): Promise<CodegenResult> {
  if (!project.scheme) throw new Error('请先生成硬件方案')
  const prompt = buildCodegenPrompt(project.scheme!, project.target, project.format, chipSpec)
  const result = await callTaskContract(svc, 'firmware-generation', [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.user }
  ], parseCodeFiles, { temperature: 0.15, signal: options.signal })
  const files = result.contract.data

  // 后台自检（不抛出，仅返回 warning）
  let warning: string | undefined
  try {
    const verifyResult = await callTaskContract(svc, 'code-consistency', [
      { role: 'user', content: buildVerifyPrompt(project.scheme, files) }
    ], parseVerification, { temperature: 0.1, signal: options.signal })
    const v = verifyResult.contract.data
    if (!v.consistent && v.issues.length > 0) {
      warning = `AI 自检发现 ${v.issues.length} 个潜在问题：\n${v.issues.map((issue) => issue.message).join('\n')}`
    }
  } catch (error) {
    if (error instanceof AIRequestCancelledError) throw error
    // Verification failure does not discard successfully generated files.
  }

  return { files, warning }
}
