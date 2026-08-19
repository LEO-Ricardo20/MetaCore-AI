/** AI API 客户端：优先使用 localhost 代理，代理不可用时回退浏览器直连。 */

import { resolveAIAPIMode, type AIServiceConfig } from '@/types/ai'

const LOCAL_AI_API = 'http://127.0.0.1:3766/api/ai'
const LOCAL_PROXY_TIMEOUT_MS = 95_000
const DIRECT_REQUEST_TIMEOUT_MS = 90_000
const MODEL_LIST_TIMEOUT_MS = 35_000

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CallAIOptions {
  temperature?: number
  onChunk?: (text: string) => void
  signal?: AbortSignal
  timeoutMs?: number
  retries?: number
}

export interface AIConnectionResult {
  ok: boolean
  via?: 'local-proxy' | 'direct'
  error?: string
}

class LocalProxyUnavailableError extends Error {}

class AIRequestError extends Error {
  constructor(message: string, readonly status?: number, readonly retryable = false) {
    super(message)
    this.name = 'AIRequestError'
  }
}

export class AIRequestCancelledError extends Error {
  constructor() {
    super('AI 请求已取消')
    this.name = 'AIRequestCancelledError'
  }
}

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
    return new AIRequestError(`AI 服务商当前限流或系统繁忙（429）。请稍后重试，检查配额/QPS，或更换模型。原始提示：${message}`, status, true)
  }
  if (status === 503 && /no available providers/i.test(message)) {
    return new AIRequestError(`中转平台当前没有可用的上游通道（503）。请读取并更换模型，或在中转平台检查渠道状态。原始提示：${message}`, status, true)
  }
  return new AIRequestError(`${prefix} (${status})：${message}`, status, [502, 503, 504].includes(status))
}

function extractChatContent(message: any) {
  if (typeof message?.content === 'string') return message.content
  if (Array.isArray(message?.content)) return message.content.map((part: any) => typeof part === 'string' ? part : part?.text ?? part?.content ?? '').filter(Boolean).join('')
  return ''
}

async function withRequestTimeout<T>(
  timeoutMs: number,
  externalSignal: AbortSignal | undefined,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (externalSignal?.aborted) throw new AIRequestCancelledError()
  const controller = new AbortController()
  let timedOut = false
  const abortFromCaller = () => controller.abort()
  externalSignal?.addEventListener('abort', abortFromCaller, { once: true })
  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    return await operation(controller.signal)
  } catch (error) {
    if (externalSignal?.aborted) throw new AIRequestCancelledError()
    if (timedOut || controller.signal.aborted) {
      throw new AIRequestError(`AI 请求超时（${Math.round(timeoutMs / 1_000)} 秒）`, 504, true)
    }
    throw error
  } finally {
    window.clearTimeout(timer)
    externalSignal?.removeEventListener('abort', abortFromCaller)
  }
}

async function retryDelay(attempt: number, signal?: AbortSignal) {
  const delayMs = Math.min(2_000, 500 * (2 ** attempt))
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AIRequestCancelledError())
      return
    }
    const onAbort = () => {
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(new AIRequestCancelledError())
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, delayMs)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
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
  try {
    return await withRequestTimeout(opts.timeoutMs ?? service.timeoutMs ?? LOCAL_PROXY_TIMEOUT_MS, opts.signal, async (signal) => {
      const response = await fetch(`${LOCAL_AI_API}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service,
          messages,
          temperature: opts.temperature ?? 0.3,
        }),
        signal,
      })

      const raw = await response.text()
      if (response.status === 404) throw new LocalProxyUnavailableError('本地 AI 代理版本过旧')
      if (!response.ok) throw requestError(raw, response.status, 'AI 服务请求失败')

      const data = JSON.parse(raw)
      if (typeof data.content !== 'string' || !data.content) {
        throw new AIRequestError('本地 AI 代理没有返回文本内容', 502)
      }
      opts.onChunk?.(data.content)
      return data.content as string
    })
  } catch (error) {
    if (error instanceof AIRequestError || error instanceof AIRequestCancelledError || error instanceof LocalProxyUnavailableError) throw error
    if (!(error instanceof TypeError)) throw error
    throw new LocalProxyUnavailableError('本地 AI 代理未启动')
  }
}

export async function fetchAIModels(service: AIServiceConfig): Promise<string[]> {
  if (service.provider === 'mock') return [service.model || 'metacore-deterministic']
  try {
    return await withRequestTimeout(MODEL_LIST_TIMEOUT_MS, undefined, async (signal) => {
      const response = await fetch(`${LOCAL_AI_API}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service }),
        signal,
      })
      const raw = await response.text()
      if (!response.ok) throw requestError(raw, response.status, '读取模型列表失败')

      const data = JSON.parse(raw)
      if (!Array.isArray(data.models) || !data.models.length) {
        throw new AIRequestError('服务商没有返回可用模型', 502)
      }
      return data.models.filter((model: unknown): model is string => typeof model === 'string')
    })
  } catch (error) {
    if (error instanceof AIRequestError) throw error
    if (error instanceof TypeError) {
      throw new Error('本地 AI 代理未启动，无法读取服务商模型列表。请先运行 npm run dev:server。', { cause: error })
    }
    throw error
  }
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
      throw new AIRequestError('浏览器直连 AI 服务失败。请启动 npm run dev:server 使用本地代理，或检查服务商是否允许浏览器跨域访问。', 502, true)
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
  const retries = opts.onChunk ? 0 : Math.max(0, Math.min(2, opts.retries ?? 1))
  for (let attempt = 0; ; attempt += 1) {
    try {
      const result = await invokeAI(service, messages, opts)
      return result.content
    } catch (error) {
      if (!(error instanceof AIRequestError) || !error.retryable || attempt >= retries) throw error
      await retryDelay(attempt, opts.signal)
    }
  }
}

async function callAIChatCompletionsDirect(
  service: AIServiceConfig,
  messages: ChatMessage[],
  opts: CallAIOptions,
): Promise<string> {
  return withRequestTimeout(opts.timeoutMs ?? service.timeoutMs ?? DIRECT_REQUEST_TIMEOUT_MS, opts.signal, async (signal) => {
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
      signal,
    })

    if (!response.ok) {
      const raw = await response.text()
      throw requestError(raw, response.status)
    }

    if (!onChunk) {
      const data = await response.json()
      const content = extractChatContent(data.choices?.[0]?.message)
      if (typeof content !== 'string' || !content) throw new AIRequestError('AI 服务没有返回文本内容', 502)
      return content
    }

    return readSSEText(response, onChunk, (data) => data.choices?.[0]?.delta?.content)
  })
}

async function callAIResponsesDirect(
  service: AIServiceConfig,
  messages: ChatMessage[],
  opts: CallAIOptions,
): Promise<string> {
  return withRequestTimeout(opts.timeoutMs ?? service.timeoutMs ?? DIRECT_REQUEST_TIMEOUT_MS, opts.signal, async (signal) => {
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
      signal,
    })

    if (!response.ok) {
      const raw = await response.text()
      throw requestError(raw, response.status)
    }

    if (!onChunk) {
      const data = await response.json()
      const content = extractResponsesText(data)
      if (!content) throw new AIRequestError('OpenAI Responses API 没有返回文本内容', 502)
      return content
    }

    return readSSEText(response, onChunk, (data) => (
      data.type === 'response.output_text.delta' ? data.delta : ''
    ))
  })
}

async function readSSEText(
  response: Response,
  onChunk: (text: string) => void,
  extractDelta: (data: any) => unknown,
) {
  const reader = response.body?.getReader()
  if (!reader) throw new AIRequestError('AI 服务没有返回可读取的数据流', 502)
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  const processLine = (line: string) => {
    const normalized = line.trimEnd()
    if (!normalized.startsWith('data:')) return
    const raw = normalized.slice(5).trim()
    if (!raw || raw === '[DONE]') return
    try {
      const delta = extractDelta(JSON.parse(raw))
      if (typeof delta === 'string' && delta) {
        full += delta
        onChunk(delta)
      }
    } catch {
      // Compatible providers occasionally emit non-JSON keepalive events.
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    lines.forEach(processLine)
  }
  buffer += decoder.decode()
  if (buffer) buffer.split(/\r?\n/).forEach(processLine)
  if (!full) throw new AIRequestError('AI 数据流结束，但没有返回文本内容', 502)
  return full
}

function extractResponsesText(data: any) {
  if (typeof data.output_text === 'string') return data.output_text
  let text = ''
  for (const output of data.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') text += content.text
    }
  }
  return text
}

export async function testConnection(service: AIServiceConfig): Promise<AIConnectionResult> {
  if (service.provider === 'mock') {
    try {
      const result = await callThroughLocalProxy(service, [{ role: 'user', content: 'Reply with OK only.' }], { temperature: 0, timeoutMs: 5_000 })
      return { ok: Boolean(result), via: 'local-proxy' }
    } catch (error: any) {
      return { ok: false, error: error?.message ?? 'Mock Provider 连接失败，请启动本地服务' }
    }
  }
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
