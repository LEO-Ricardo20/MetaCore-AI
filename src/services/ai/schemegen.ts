import type { AIServiceConfig } from '@/types/ai'
import type { ChipSpec, ChipTarget } from '@/types/hardware'
import type { HardwareScheme } from '@/types/project'
import { callAI, type CallAIOptions } from './client'
import { buildSchemePrompt } from './prompts'
import { parseHardwareScheme } from './validation'

export async function runSchemegen(
  service: AIServiceConfig,
  requirement: string,
  target: ChipTarget,
  chipSpec?: ChipSpec,
  options: Pick<CallAIOptions, 'signal'> = {},
): Promise<HardwareScheme> {
  const prompt = buildSchemePrompt(requirement, target, chipSpec)
  const raw = await callAI(service, [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.user },
  ], { temperature: 0.2, signal: options.signal })
  return parseHardwareScheme(raw)
}
