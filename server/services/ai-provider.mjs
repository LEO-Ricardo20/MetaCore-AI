function normalizeAIBaseURL(value) {
  let url
  try {
    url = new URL(String(value ?? '').trim())
  } catch {
    const error = new Error('AI Base URL 必须是有效的网址')
    error.status = 400
    throw error
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    const error = new Error('AI Base URL 仅支持 http:// 或 https://')
    error.status = 400
    throw error
  }
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1'
  return url.toString().replace(/\/+$/, '')
}

function extractProviderError(raw, status) {
  try {
    const data = JSON.parse(raw)
    return data.error?.message || data.message || data.error || `HTTP ${status}`
  } catch {
    return raw.trim().slice(0, 500) || `HTTP ${status}`
  }
}

function extractOpenAIResponseText(data) {
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text
  for (const output of data.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  return ''
}

function resolveAIAPIMode(service) {
  if (service.apiMode === 'responses' || service.apiMode === 'chat-completions') return service.apiMode
  if (service.provider === 'openai') return 'responses'
  try {
    if (service.provider === 'custom' && new URL(service.baseURL).hostname.endsWith('autobits.cc')) return 'responses'
  } catch {
    // URL validation reports the actionable error later.
  }
  return 'chat-completions'
}

function validateService(service) {
  if (!service || typeof service !== 'object' || !service.provider) {
    const error = new Error('AI 服务配置无效')
    error.status = 400
    throw error
  }
  if (service.provider !== 'ollama' && !service.apiKey) {
    const error = new Error('该 AI 服务需要 API Key')
    error.status = 400
    throw error
  }
}

/**
 * Existing OpenAI-compatible transport. Future supplier integrations can
 * implement the same call/listModels contract without changing HTTP routes.
 */
export function createOpenAICompatibleAdapter({ recordOperation = () => {} } = {}) {
  return {
    async call(service, messages, temperature = 0.3) {
      validateService(service)
      if (!Array.isArray(messages) || !messages.length) {
        const error = new Error('AI 消息不能为空')
        error.status = 400
        throw error
      }
      if (!service.model) {
        const error = new Error('AI 模型不能为空')
        error.status = 400
        throw error
      }

      const baseURL = normalizeAIBaseURL(service.baseURL)
      const headers = { 'Content-Type': 'application/json' }
      if (service.apiKey) headers.Authorization = `Bearer ${service.apiKey}`

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 90 * 1000)
      const apiMode = resolveAIAPIMode(service)
      let endpoint
      let body

      if (apiMode === 'responses') {
        const systemMessage = messages.find((message) => message.role === 'system')
        const inputMessages = messages.filter((message) => message.role !== 'system')
        endpoint = `${baseURL}/responses`
        body = {
          model: service.model,
          input: inputMessages.length === 1 && inputMessages[0].role === 'user'
            ? inputMessages[0].content
            : inputMessages,
        }
        if (systemMessage) body.instructions = systemMessage.content
      } else {
        endpoint = `${baseURL}/chat/completions`
        body = { model: service.model, messages, stream: false, temperature }
      }

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        const raw = await response.text()
        if (!response.ok) {
          const error = new Error(extractProviderError(raw, response.status))
          error.status = response.status
          throw error
        }

        const data = JSON.parse(raw)
        const content = apiMode === 'responses'
          ? extractOpenAIResponseText(data)
          : data.choices?.[0]?.message?.content
        if (typeof content !== 'string' || !content) {
          const error = new Error('AI 服务返回成功，但没有可读取的文本内容')
          error.status = 502
          throw error
        }
        recordOperation('ai.call', {
          provider: service.provider,
          model: service.model,
          apiMode,
          host: new URL(baseURL).host,
        })
        return { content }
      } catch (cause) {
        if (cause.name === 'AbortError') {
          const error = new Error('AI 服务请求超时（90 秒）')
          error.status = 504
          throw error
        }
        if (cause instanceof TypeError && cause.message === 'fetch failed') {
          const error = new Error(`无法连接 AI 服务（${new URL(baseURL).host}）。请检查 Base URL、网络代理，或确认本地模型服务已经启动。`)
          error.status = 502
          throw error
        }
        throw cause
      } finally {
        clearTimeout(timeout)
      }
    },

    async listModels(service) {
      validateService(service)
      const baseURL = normalizeAIBaseURL(service.baseURL)
      const headers = { Accept: 'application/json' }
      if (service.apiKey) headers.Authorization = `Bearer ${service.apiKey}`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30 * 1000)

      try {
        const response = await fetch(`${baseURL}/models`, { headers, signal: controller.signal })
        const raw = await response.text()
        if (!response.ok) {
          const error = new Error(extractProviderError(raw, response.status))
          error.status = response.status
          throw error
        }

        const data = JSON.parse(raw)
        const source = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : []
        const models = [...new Set(source
          .map((item) => typeof item === 'string' ? item : item?.id ?? item?.name)
          .filter((item) => typeof item === 'string' && item.trim())
          .map((item) => item.trim()))]
          .sort((left, right) => left.localeCompare(right))
          .slice(0, 2000)

        if (!models.length) {
          const error = new Error('服务商返回了模型列表，但没有可用的模型标识')
          error.status = 502
          throw error
        }

        recordOperation('ai.models', {
          provider: service.provider,
          host: new URL(baseURL).host,
          count: models.length,
        })
        return { models }
      } catch (cause) {
        if (cause.name === 'AbortError') {
          const error = new Error('读取 AI 模型列表超时（30 秒）')
          error.status = 504
          throw error
        }
        if (cause instanceof TypeError && cause.message === 'fetch failed') {
          const error = new Error(`无法连接 AI 服务（${new URL(baseURL).host}）。请检查 Base URL、网络代理，或确认本地模型服务已经启动。`)
          error.status = 502
          throw error
        }
        throw cause
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}
