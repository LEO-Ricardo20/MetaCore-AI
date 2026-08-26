export type AIProvider = 'openai' | 'deepseek' | 'qwen' | 'siliconflow' | 'ollama' | 'custom' | 'mock'
export type AIAPIMode = 'responses' | 'chat-completions'

export interface AIServiceConfig {
  id: string
  name: string
  provider: AIProvider
  apiKey: string
  baseURL: string
  model: string
  apiMode?: AIAPIMode
  enabled: boolean
  mockDelayMs?: number
  mockFailOnce?: boolean
  timeoutMs?: number
  maxOutputTokens?: number
  stream?: boolean
  structuredOutput?: boolean
}

export function resolveAIAPIMode(service: Pick<AIServiceConfig, 'provider' | 'baseURL' | 'apiMode'>): AIAPIMode {
  if (service.apiMode) return service.apiMode
  if (service.provider === 'openai') return 'responses'
  try {
    if (service.provider === 'custom' && new URL(service.baseURL).hostname.endsWith('autobits.cc')) return 'responses'
  } catch {
    // Invalid URLs are reported by the settings form and request layer.
  }
  return 'chat-completions'
}

export function isDeepSeekHarnessCompatible(service: AIServiceConfig | null | undefined): service is AIServiceConfig {
  if (!service || resolveAIAPIMode(service) !== 'chat-completions') return false
  if (service.provider === 'deepseek') return true
  return service.provider === 'siliconflow' && /deepseek/i.test(service.model)
}

export const DEFAULT_SERVICES: Omit<AIServiceConfig, 'id' | 'apiKey'>[] = [
  { name: 'DeepSeek', provider: 'deepseek', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiMode: 'chat-completions', enabled: false, timeoutMs: 180_000, maxOutputTokens: 8192 },
  { name: '硅基流动', provider: 'siliconflow', baseURL: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V4-Flash', apiMode: 'chat-completions', enabled: false, timeoutMs: 180_000, maxOutputTokens: 8192 },
  { name: '通义千问', provider: 'qwen', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', apiMode: 'chat-completions', enabled: false, timeoutMs: 180_000, maxOutputTokens: 8192 },
  { name: 'OpenAI', provider: 'openai', baseURL: 'https://api.openai.com/v1', model: 'gpt-4o', apiMode: 'responses', enabled: false, timeoutMs: 180_000, maxOutputTokens: 8192 },
  { name: 'Ollama (本地)', provider: 'ollama', baseURL: 'http://127.0.0.1:11434/v1', model: 'llama3', apiMode: 'chat-completions', enabled: false, timeoutMs: 180_000, maxOutputTokens: 8192 },
  { name: 'MetaCore Mock（测试）', provider: 'mock', baseURL: 'http://127.0.0.1:3766/mock', model: 'metacore-deterministic', apiMode: 'chat-completions', enabled: false, mockDelayMs: 250 },
]
