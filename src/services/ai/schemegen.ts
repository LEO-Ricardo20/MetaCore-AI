import type { AIServiceConfig } from '@/types/ai'
import type { ChipSpec, ChipTarget } from '@/types/hardware'
import type { HardwareScheme } from '@/types/project'
import type { CallAIOptions } from './client'
import { buildSchemePrompt } from './prompts'
import { parseHardwareScheme } from './validation'
import { callTaskContract } from './contracts'

export async function runSchemegen(
  service: AIServiceConfig,
  requirement: string,
  target: ChipTarget,
  chipSpec?: ChipSpec,
  options: Pick<CallAIOptions, 'signal'> = {},
): Promise<HardwareScheme> {
  const prompt = buildSchemePrompt(requirement, target, chipSpec)
  const result = await callTaskContract(service, 'hardware-scheme', [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.user },
  ], parseHardwareScheme, { temperature: 0.2, signal: options.signal })
  return result.contract.data
}
