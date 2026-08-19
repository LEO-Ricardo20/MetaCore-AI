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
  let text = ''
  for (const output of data.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') text += content.text
    }
  }
  return text
}

function extractChatResponseText(message) {
  if (typeof message?.content === 'string') return message.content
  if (Array.isArray(message?.content)) return message.content.map((part) => typeof part === 'string' ? part : part?.text ?? part?.content ?? '').filter(Boolean).join('')
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
  if (service.provider !== 'ollama' && service.provider !== 'mock' && !service.apiKey) {
    const error = new Error('该 AI 服务需要 API Key')
    error.status = 400
    throw error
  }
}

const mockFailures = new Set()

function mockContract(taskType) {
  const base = { schemaVersion: '1.0', taskType, status: 'ok', assumptions: ['使用确定性 Mock Provider，仅用于本地流程验收'], openQuestions: [], risks: [], evidence: [{ source: 'MetaCore deterministic fixture', file: 'mock://fixture', line: 1, excerpt: '本地测试数据，不代表真实硬件测量结果' }], validationHints: [] }
  if (taskType === 'hardware-scheme') return { ...base, data: {
    description: 'ESP32 环境监测节点通过 I2C 连接 DHT20 温湿度传感器和 SSD1306 OLED，使用 Wi-Fi 接入网络并通过 MQTT 上报数据；主循环包含采集、校验、重试和显示步骤。',
    pins: [
      { pinNumber: 'GPIO21', pinName: 'SDA', function: 'I2C 数据线', connectedTo: 'DHT20 + SSD1306', voltage: '3V3' },
      { pinNumber: 'GPIO22', pinName: 'SCL', function: 'I2C 时钟线', connectedTo: 'DHT20 + SSD1306', voltage: '3V3' },
      { pinNumber: 'GPIO2', pinName: 'STATUS_LED', function: '状态指示', connectedTo: '板载 LED', voltage: '3V3' },
    ],
    bom: [
      { name: 'ESP32 DevKit', model: 'ESP32-WROOM-32', quantity: 1, unitPrice: 8.5 },
      { name: '温湿度传感器', model: 'DHT20', quantity: 1, unitPrice: 3.2 },
      { name: 'OLED 显示屏', model: 'SSD1306 128x64 I2C', quantity: 1, unitPrice: 4.8 },
    ],
    wiring: [
      { from: 'ESP32 GPIO21 (SDA)', to: 'DHT20 SDA + SSD1306 SDA', wireColor: '绿', note: 'I2C 数据线' },
      { from: 'ESP32 GPIO22 (SCL)', to: 'DHT20 SCL + SSD1306 SCL', wireColor: '黄', note: 'I2C 时钟线' },
      { from: '3V3', to: 'DHT20 VCC + SSD1306 VCC', wireColor: '红', note: '3.3V 供电' },
      { from: 'GND', to: 'DHT20 GND + SSD1306 GND', wireColor: '黑', note: '公共地' },
    ],
  } }
  if (taskType === 'firmware-generation') return { ...base, data: { files: [
    { path: 'src/main.c', language: 'c', content: '#include "drivers/dht20.h"\n#include "drivers/ssd1306.h"\n#include "mqtt_client.h"\n#define SDA_GPIO 21\n#define SCL_GPIO 22\n#define STATUS_LED_GPIO 2\nvoid app_main(void) { i2c_init(SDA_GPIO, SCL_GPIO); dht20_init(); ssd1306_init(); wifi_connect(); mqtt_connect(); while (1) { if (dht20_read_retry()) { mqtt_publish(); ssd1306_show(); } else { led_set(STATUS_LED_GPIO, 1); } delay_ms(5000); } }\n' },
    { path: 'src/drivers/dht20.h', language: 'h', content: '#pragma once\nint dht20_init(void);\nint dht20_read_retry(void);\n' },
    { path: 'src/drivers/ssd1306.h', language: 'h', content: '#pragma once\nint ssd1306_init(void);\nint ssd1306_show(void);\n' },
    { path: 'platformio.ini', language: 'ini', content: '[env:esp32dev]\nplatform = espressif32\nframework = espidf\nboard = esp32dev\n' },
  ] } }
  if (taskType === 'code-consistency') return { ...base, data: { consistent: true, score: 100, issues: [] } }
  if (taskType === 'flow-graph') return { ...base, data: { nodes: [
    { id: 'init', label: '初始化 I2C / OLED / DHT20', codeFileRef: 'src/main.c', codeLine: 7, functionName: 'app_main', evidence: 'i2c_init + dht20_init + ssd1306_init', codeSnippet: 'i2c_init(SDA_GPIO, SCL_GPIO);', nodeStyle: 'init', position: { x: 120, y: 80 } },
    { id: 'connect', label: '连接 Wi-Fi 与 MQTT', codeFileRef: 'src/main.c', codeLine: 7, functionName: 'app_main', evidence: 'wifi_connect + mqtt_connect', nodeStyle: 'comm', position: { x: 420, y: 80 } },
    { id: 'read', label: '读取温湿度并重试', codeFileRef: 'src/main.c', codeLine: 7, functionName: 'app_main', evidence: 'dht20_read_retry', nodeStyle: 'sensor', position: { x: 120, y: 260 } },
    { id: 'publish', label: 'MQTT 上报并更新 OLED', codeFileRef: 'src/main.c', codeLine: 7, functionName: 'app_main', evidence: 'mqtt_publish + ssd1306_show', nodeStyle: 'display', position: { x: 420, y: 260 } },
    { id: 'error', label: '读取失败，点亮状态灯', codeFileRef: 'src/main.c', codeLine: 7, functionName: 'app_main', evidence: 'led_set', nodeStyle: 'error', position: { x: 700, y: 260 } },
  ], edges: [
    { id: 'e1', source: 'init', target: 'connect' }, { id: 'e2', source: 'connect', target: 'read' }, { id: 'e3', source: 'read', target: 'publish', label: '成功' }, { id: 'e4', source: 'read', target: 'error', label: '失败' }, { id: 'e5', source: 'publish', target: 'read', label: '下一周期' },
  ] } }
  return { ...base, data: {} }
}

async function callMock(service, messages, options = {}) {
  const startedAt = Date.now()
  const delayMs = Math.max(0, Math.min(30_000, Number(service.mockDelayMs ?? 250)))
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, delayMs)
    const abort = () => { clearTimeout(timer); reject(Object.assign(new Error('AI 请求已取消'), { name: 'AbortError', code: 'AI_CANCELLED' })) }
    options.signal?.addEventListener('abort', abort, { once: true })
  })
  const taskType = typeof options.taskType === 'string' && options.taskType.trim()
    ? options.taskType.trim()
    : 'hardware-scheme'
  const failureKey = `${service.id ?? service.model}:${taskType}`
  if (service.mockFailOnce && !mockFailures.has(failureKey)) {
    mockFailures.add(failureKey)
    const error = new Error('Mock Provider 人为失败（可重试）')
    error.status = 503; error.code = 'MOCK_FAIL_ONCE'; error.retryable = true
    throw error
  }
  const content = JSON.stringify(mockContract(taskType))
  return { content, model: service.model, provider: 'mock', apiMode: 'chat-completions', durationMs: Date.now() - startedAt, usage: { input: 0, output: content.length, total: content.length }, contextLength: messages.reduce((sum, message) => sum + String(message.content ?? '').length, 0), mock: true }
}

/**
 * Existing OpenAI-compatible transport. Future supplier integrations can
 * implement the same call/listModels contract without changing HTTP routes.
 */
export function createOpenAICompatibleAdapter({ recordOperation = () => {} } = {}) {
  return {
    async call(service, messages, temperature = 0.3, options = {}) {
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
      if (service.provider === 'mock') return callMock(service, messages, options)

      const baseURL = normalizeAIBaseURL(service.baseURL)
      const headers = { 'Content-Type': 'application/json' }
      if (service.apiKey) headers.Authorization = `Bearer ${service.apiKey}`

      const controller = new AbortController()
      let timedOut = false
      const abortFromCaller = () => controller.abort()
      options.signal?.addEventListener('abort', abortFromCaller, { once: true })
      const timeout = setTimeout(() => { timedOut = true; controller.abort() }, Math.max(5_000, Math.min(180_000, Number(service.timeoutMs ?? 90_000))))
      const startedAt = Date.now()
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
          ...(service.maxOutputTokens ? { max_output_tokens: service.maxOutputTokens } : {}),
        }
        if (systemMessage) body.instructions = systemMessage.content
      } else {
        endpoint = `${baseURL}/chat/completions`
        body = { model: service.model, messages, stream: false, temperature, ...(service.maxOutputTokens ? { max_tokens: service.maxOutputTokens } : {}) }
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
          : extractChatResponseText(data.choices?.[0]?.message)
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
        const inputTokens = Number(data.usage?.input_tokens ?? data.usage?.prompt_tokens ?? 0)
        const outputTokens = Number(data.usage?.output_tokens ?? data.usage?.completion_tokens ?? 0)
        return {
          content,
          model: service.model,
          provider: service.provider,
          apiMode,
          durationMs: Date.now() - startedAt,
          usage: { input: inputTokens, output: outputTokens, total: Number(data.usage?.total_tokens ?? inputTokens + outputTokens) },
          contextLength: messages.reduce((sum, message) => sum + String(message.content ?? '').length, 0),
        }
      } catch (cause) {
        if (cause.name === 'AbortError') {
          const error = new Error(timedOut ? 'AI 服务请求超时（90 秒）' : 'AI 请求已取消')
          error.status = timedOut ? 504 : 409
          error.code = timedOut ? 'AI_TIMEOUT' : 'AI_CANCELLED'
          error.retryable = timedOut
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
        options.signal?.removeEventListener('abort', abortFromCaller)
      }
    },

    async listModels(service) {
      validateService(service)
      if (service.provider === 'mock') return { models: [service.model || 'metacore-deterministic'] }
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
