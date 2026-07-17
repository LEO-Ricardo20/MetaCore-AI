/** AI API 客户端：优先使用 localhost 代理，代理不可用时回退浏览器直连。 */

import { resolveAIAPIMode, type AIServiceConfig } from '@/types/ai'

const LOCAL_AI_API = 'http://127.0.0.1:3766/api/ai'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CallAIOptions {
  temperature?: number
  onChunk?: (text: string) => void
}

export interface AIConnectionResult {
  ok: boolean
  via?: 'local-proxy' | 'direct'
  error?: string
}

class LocalProxyUnavailableError extends Error {}

function normalizeBaseURL(value: string) {
  return value.trim().replace(/\/+$/, '')
}

function providerError(raw: string, status: number) {
  try {
    const data = JSON.parse(raw)
    return data.error?.message || data.message || data.error || `HTTP ${status}`
  } catch {
    return raw.trim().slice(0, 500) || `HTTP ${status}`
  }
}

function requestError(raw: string, status: number, prefix = 'AI 请求失败') {
  const message = providerError(raw, status)
  if (status === 429 || /\b429\b|rate limit|rate limiting|too busy/i.test(message)) {
    return new Error(`AI 服务商当前限流或系统繁忙（429）。请稍后重试，检查配额/QPS，或更换模型。原始提示：${message}`)
  }
  if (status === 503 && /no available providers/i.test(message)) {
    return new Error(`中转平台当前没有可用的上游通道（503）。请读取并更换模型，或在中转平台检查渠道状态。原始提示：${message}`)
  }
  return new Error(`${prefix} (${status})：${message}`)
}

function authHeaders(service: AIServiceConfig) {
  return {
    'Content-Type': 'application/json',
    ...(service.apiKey ? { Authorization: `Bearer ${service.apiKey}` } : {}),
  }
}

async function callThroughLocalProxy(
  service: AIServiceConfig,
  messages: ChatMessage[],
  opts: CallAIOptions,
) {
  let response: Response
  try {
    response = await fetch(`${LOCAL_AI_API}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service,
        messages,
        temperature: opts.temperature ?? 0.3,
      }),
    })
  } catch {
    throw new LocalProxyUnavailableError('本地 AI 代理未启动')
  }

  const raw = await response.text()
  if (response.status === 404) throw new LocalProxyUnavailableError('本地 AI 代理版本过旧')
  if (!response.ok) {
    throw requestError(raw, response.status, 'AI 服务请求失败')
  }

  const data = JSON.parse(raw)
  if (typeof data.content !== 'string' || !data.content) {
    throw new Error('本地 AI 代理没有返回文本内容')
  }
  opts.onChunk?.(data.content)
  return data.content as string
}

export async function fetchAIModels(service: AIServiceConfig): Promise<string[]> {
  let response: Response
  try {
    response = await fetch(`${LOCAL_AI_API}/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service }),
    })
  } catch {
    throw new Error('本地 AI 代理未启动，无法读取服务商模型列表。请先运行 npm run dev:server。')
  }

  const raw = await response.text()
  if (!response.ok) throw requestError(raw, response.status, '读取模型列表失败')

  const data = JSON.parse(raw)
  if (!Array.isArray(data.models) || !data.models.length) {
    throw new Error('服务商没有返回可用模型')
  }
  return data.models.filter((model: unknown): model is string => typeof model === 'string')
}

async function callDirect(
  service: AIServiceConfig,
  messages: ChatMessage[],
  opts: CallAIOptions,
) {
  return resolveAIAPIMode(service) === 'responses'
    ? callAIResponsesDirect(service, messages, opts)
    : callAIChatCompletionsDirect(service, messages, opts)
}

async function invokeAI(
  service: AIServiceConfig,
  messages: ChatMessage[],
  opts: CallAIOptions,
): Promise<{ content: string; via: 'local-proxy' | 'direct' }> {
  try {
    const content = await callThroughLocalProxy(service, messages, opts)
    return { content, via: 'local-proxy' }
  } catch (error) {
    if (!(error instanceof LocalProxyUnavailableError)) throw error
  }

  try {
    const content = await callDirect(service, messages, opts)
    return { content, via: 'direct' }
  } catch (error: any) {
    if (error instanceof TypeError || error?.message === 'Failed to fetch') {
      throw new Error('浏览器直连 AI 服务失败。请启动 npm run dev:server 使用本地代理，或检查服务商是否允许浏览器跨域访问。')
    }
    throw error
  }
}

export async function callAI(
  service: AIServiceConfig,
  messages: ChatMessage[],
  options?: CallAIOptions | ((text: string) => void),
): Promise<string> {
  const opts: CallAIOptions = typeof options === 'function' ? { onChunk: options } : (options ?? {})
  const result = await invokeAI(service, messages, opts)
  return result.content
}

async function callAIChatCompletionsDirect(
  service: AIServiceConfig,
  messages: ChatMessage[],
  opts: CallAIOptions,
): Promise<string> {
  const onChunk = opts.onChunk
  const response = await fetch(`${normalizeBaseURL(service.baseURL)}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(service),
    body: JSON.stringify({
      model: service.model,
      messages,
      stream: Boolean(onChunk),
      temperature: opts.temperature ?? 0.3,
    }),
  })

  if (!response.ok) {
    const raw = await response.text()
    throw requestError(raw, response.status)
  }

  if (!onChunk) {
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') throw new Error('AI 服务没有返回文本内容')
    return content
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('AI 服务没有返回可读取的数据流')
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (!raw || raw === '[DONE]') continue
      try {
        const data = JSON.parse(raw)
        const text = data.choices?.[0]?.delta?.content ?? ''
        if (text) {
          full += text
          onChunk(text)
        }
      } catch {
        // Ignore malformed event fragments from third-party compatible services.
      }
    }
  }
  return full
}

async function callAIResponsesDirect(
  service: AIServiceConfig,
  messages: ChatMessage[],
  opts: CallAIOptions,
): Promise<string> {
  const onChunk = opts.onChunk
  const systemMessage = messages.find((message) => message.role === 'system')
  const inputMessages = messages.filter((message) => message.role !== 'system')
  const body: Record<string, unknown> = {
    model: service.model,
    input: inputMessages.length === 1 && inputMessages[0].role === 'user'
      ? inputMessages[0].content
      : inputMessages,
    stream: Boolean(onChunk),
  }
  if (systemMessage) body.instructions = systemMessage.content

  const response = await fetch(`${normalizeBaseURL(service.baseURL)}/responses`, {
    method: 'POST',
    headers: authHeaders(service),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const raw = await response.text()
    throw requestError(raw, response.status)
  }

  if (!onChunk) {
    const data = await response.json()
    const content = extractResponsesText(data)
    if (!content) throw new Error('OpenAI Responses API 没有返回文本内容')
    return content
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('OpenAI 没有返回可读取的数据流')
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (!raw || raw === '[DONE]') continue
      try {
        const data = JSON.parse(raw)
        if (data.type === 'response.output_text.delta' && data.delta) {
          full += data.delta
          onChunk(data.delta)
        }
      } catch {
        // Ignore malformed event fragments.
      }
    }
  }
  return full
}

function extractResponsesText(data: any) {
  if (typeof data.output_text === 'string') return data.output_text
  for (const output of data.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  return ''
}

export async function testConnection(service: AIServiceConfig): Promise<AIConnectionResult> {
  try {
    const result = await invokeAI(service, [{ role: 'user', content: 'Reply with OK only.' }], { temperature: 0 })
    return { ok: true, via: result.via }
  } catch (error: any) {
    const message = error?.message ?? '未知连接错误'
    if (/no available providers|没有可用的上游通道/i.test(message)) {
      try {
        const models = await fetchAIModels(service)
        const modelAvailable = models.includes(service.model)
        const diagnosis = modelAvailable
          ? `模型列表包含“${service.model}”，但平台当前没有健康的上游通道。请更换模型、稍后重试，或把 cch_session_id 提交给中转平台客服。`
          : `模型列表不包含“${service.model}”。请编辑服务，点击“读取模型”，并选择平台实际返回的模型。`
        return { ok: false, error: `${message} ${diagnosis}` }
      } catch (modelError: any) {
        return { ok: false, error: `${message} 模型列表诊断失败：${modelError?.message ?? '未知错误'}` }
      }
    }
    return { ok: false, error: message }
  }
}
