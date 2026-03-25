/** 代码生成服务 — 供 CodegenPage 和一键式流水线共用 */
import type { AIServiceConfig } from '@/types/ai'
import type { ChipSpec } from '@/types/hardware'
import type { Project, CodeFile } from '@/types/project'
import { callAI } from './client'
import { buildCodegenPrompt, buildVerifyPrompt } from './prompts'
import { parseJSON } from '@/lib/utils'

export interface CodegenResult {
  files: CodeFile[]
  warning?: string
}

export async function runCodegen(
  svc: AIServiceConfig,
  project: Project,
  chipSpec?: ChipSpec
): Promise<CodegenResult> {
  const prompt = buildCodegenPrompt(project.scheme!, project.target, project.format, chipSpec)
  const raw = await callAI(svc, [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.user }
  ], { temperature: 0.15 })
  const result = parseJSON<{ files: CodeFile[] }>(raw)
  if (!result?.files?.length) throw new Error('AI 返回格式解析失败，请重试')

  // 后台自检（不抛出，仅返回 warning）
  let warning: string | undefined
  try {
    const verifyRaw = await callAI(svc, [
      { role: 'user', content: buildVerifyPrompt(project.scheme!, result.files) }
    ], { temperature: 0.1 })
    const v = parseJSON<{ consistent: boolean; issues: string[] }>(verifyRaw)
    if (v && !v.consistent && v.issues.length > 0) {
      warning = `AI 自检发现 ${v.issues.length} 个潜在问题：\n${v.issues.join('\n')}`
    }
  } catch { /* 验证失败不影响主流程 */ }

  return { files: result.files, warning }
}
