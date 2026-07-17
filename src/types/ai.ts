export type AIProvider = 'openai' | 'deepseek' | 'qwen' | 'siliconflow' | 'ollama' | 'custom'
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

export const DEFAULT_SERVICES: Omit<AIServiceConfig, 'id' | 'apiKey'>[] = [
  { name: 'DeepSeek', provider: 'deepseek', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiMode: 'chat-completions', enabled: false },
  { name: '硅基流动', provider: 'siliconflow', baseURL: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3', apiMode: 'chat-completions', enabled: false },
  { name: '通义千问', provider: 'qwen', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', apiMode: 'chat-completions', enabled: false },
  { name: 'OpenAI', provider: 'openai', baseURL: 'https://api.openai.com/v1', model: 'gpt-4o', apiMode: 'responses', enabled: false },
  { name: 'Ollama (本地)', provider: 'ollama', baseURL: 'http://127.0.0.1:11434/v1', model: 'llama3', apiMode: 'chat-completions', enabled: false },
]
