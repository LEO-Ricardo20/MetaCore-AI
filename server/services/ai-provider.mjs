const MIN_AI_TIMEOUT_MS = 5_000
const DEFAULT_AI_TIMEOUT_MS = Math.max(
  MIN_AI_TIMEOUT_MS,
  Math.min(10 * 60 * 1000, Number(process.env.METACORE_AI_TIMEOUT_MS || 180_000)),
)
const MAX_AI_TIMEOUT_MS = 10 * 60 * 1000

function resolveAITimeoutMs(service) {
  const requested = Number(service?.timeoutMs)
  if (!Number.isFinite(requested) || requested <= 0) return DEFAULT_AI_TIMEOUT_MS
  return Math.max(MIN_AI_TIMEOUT_MS, Math.min(MAX_AI_TIMEOUT_MS, requested))
}

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
  // Users commonly paste the full endpoint from provider documentation. The
  // adapter owns the endpoint suffix, so remove it before appending one.
  url.pathname = url.pathname.replace(/\/(?:chat\/completions|responses|models)\/?$/i, '') || '/'
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

function explainProviderError(message, status, service) {
  const detail = String(message || `HTTP ${status}`).trim()
  if (status === 401 || status === 403) {
    return `AI API Key 无效或无权限（${service.provider}/${service.model}）。请重新填写服务商 API Key，并确认账户有余额或调用权限。原始提示：${detail}`
  }
  if (status === 404) {
    return `AI 接口或模型不存在（${service.provider}/${service.model}）。请检查 Base URL 是否只填写到 /v1（不要粘贴完整 /chat/completions），并点击“读取模型”选择平台实际返回的模型。原始提示：${detail}`
  }
  if (status === 400) {
    return `AI 请求参数被服务商拒绝（${service.provider}/${service.model}）。请确认 API 协议、模型名称和请求能力匹配。推理模型通常不支持 temperature 等采样参数。原始提示：${detail}`
  }
  return detail
}

function providerErrorCode(status) {
  if (status === 401 || status === 403) return 'AI_AUTH_FAILED'
  if (status === 404) return 'AI_ENDPOINT_OR_MODEL_NOT_FOUND'
  if (status === 408 || status === 504) return 'AI_TIMEOUT'
  if (status === 429) return 'AI_RATE_LIMITED'
  if (status >= 500) return 'AI_PROVIDER_UNAVAILABLE'
  return `AI_HTTP_${status}`
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
  if (typeof message?.text === 'string') return message.text
  return ''
}

function responseShape(data, apiMode) {
  if (apiMode === 'responses') {
    return {
      keys: Object.keys(data ?? {}).slice(0, 20),
      outputCount: Array.isArray(data?.output) ? data.output.length : 0,
      outputTextChars: typeof data?.output_text === 'string' ? data.output_text.length : 0,
      outputTypes: Array.isArray(data?.output) ? data.output.slice(0, 6).map((item) => item?.type ?? typeof item) : [],
    }
  }
  const choice = Array.isArray(data?.choices) ? data.choices[0] : undefined
  const message = choice?.message
  return {
    keys: Object.keys(data ?? {}).slice(0, 20),
    choiceCount: Array.isArray(data?.choices) ? data.choices.length : 0,
    finishReason: choice?.finish_reason ?? null,
    messageKeys: message && typeof message === 'object' ? Object.keys(message).slice(0, 20) : [],
    contentType: Array.isArray(message?.content) ? 'array' : typeof message?.content,
    contentChars: typeof message?.content === 'string' ? message.content.length : Array.isArray(message?.content) ? message.content.length : 0,
    reasoningChars: typeof message?.reasoning_content === 'string' ? message.reasoning_content.length : 0,
    textChars: typeof message?.text === 'string' ? message.text.length : 0,
  }
}

function resolveTaskModel(service, taskType) {
  const structuredTask = ['hardware-scheme', 'hardware-candidates', 'model-selection', 'firmware-generation', 'code-consistency', 'flow-graph'].includes(String(taskType))
  // DeepSeek V4 Flash can spend the entire output budget on reasoning for a
  // large JSON contract and finish with an empty `content`. The stable chat
  // model uses the same credential and endpoint but reliably completes these
  // bounded structured tasks.
  if (structuredTask && service.provider === 'deepseek' && /deepseek-v4-flash/i.test(String(service.model))) {
    return 'deepseek-chat'
  }
  return service.model
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

function mockEsp32Context(messages) {
  const prompt = messages.map((message) => String(message?.content ?? '')).join('\n')
  const board = prompt.match(/PlatformIO board：([^\n]+)/)?.[1]?.trim() ?? 'esp32dev'
  const idfTarget = prompt.match(/ESP-IDF target:\s*([a-z0-9]+)/i)?.[1]?.trim() ?? 'esp32'
  const framework = prompt.match(/工程：platformio\s*\/\s*(arduino|espidf)/i)?.[1]?.toLowerCase() ?? 'espidf'
  const module = prompt.match(/- 模组：([^\n]+)/)?.[1]?.trim() ?? 'ESP32-WROOM-32'
  const i2c = idfTarget === 'esp32' ? [21, 22] : idfTarget === 'esp32c6' ? [6, 7] : [8, 9]
  const arduino = framework === 'arduino' || /void\s+setup\s*\(/.test(prompt) || prompt.includes('src/main.cpp')
  return { board, idfTarget, framework, module, arduino, sda: i2c[0], scl: i2c[1] }
}

function mockContract(taskType, messages = []) {
  const esp32 = mockEsp32Context(messages)
  const base = { schemaVersion: '1.0', taskType, status: 'ok', assumptions: ['使用确定性 Mock Provider，仅用于本地流程验收'], openQuestions: [], risks: [], evidence: [{ source: 'MetaCore deterministic fixture', file: 'mock://fixture', line: 1, excerpt: '本地测试数据，不代表真实硬件测量结果' }], validationHints: [] }
  if (taskType === 'hardware-scheme') return { ...base, data: {
    description: 'ESP32 环境监测节点通过 I2C 连接 DHT20 温湿度传感器和 SSD1306 OLED，使用 Wi-Fi 接入网络并通过 MQTT 上报数据；主循环包含采集、校验、重试和显示步骤。',
    pins: [
      { pinNumber: `GPIO${esp32.sda}`, pinName: 'SDA', function: 'I2C 数据线', connectedTo: 'DHT20 + SSD1306', voltage: '3V3' },
      { pinNumber: `GPIO${esp32.scl}`, pinName: 'SCL', function: 'I2C 时钟线', connectedTo: 'DHT20 + SSD1306', voltage: '3V3' },
    ],
    bom: [
      { name: 'ESP32 开发板', model: esp32.module, quantity: 1, unitPrice: 8.5 },
      { name: '温湿度传感器', model: 'DHT20', quantity: 1, unitPrice: 3.2 },
      { name: 'OLED 显示屏', model: 'SSD1306 128x64 I2C', quantity: 1, unitPrice: 4.8 },
    ],
    wiring: [
      { from: `ESP32 GPIO${esp32.sda} (SDA)`, to: 'DHT20 SDA + SSD1306 SDA', wireColor: '绿', note: 'I2C 数据线' },
      { from: `ESP32 GPIO${esp32.scl} (SCL)`, to: 'DHT20 SCL + SSD1306 SCL', wireColor: '黄', note: 'I2C 时钟线' },
      { from: '3V3', to: 'DHT20 VCC + SSD1306 VCC', wireColor: '红', note: '3.3V 供电' },
      { from: 'GND', to: 'DHT20 GND + SSD1306 GND', wireColor: '黑', note: '公共地' },
    ],
  } }
  if (taskType === 'hardware-candidates') {
    const prompt = messages.map((message) => String(message?.content ?? '')).join('\n')
    const questions = [...prompt.matchAll(/^问题\s+(\d+)：(.+)$/gm)].map((match) => ({ questionIndex: Number(match[1]), question: match[2].trim() }))
    const sourceQuestions = questions.length ? questions : [{ questionIndex: 0, question: '请确认具体型号' }]
    const labels = {
      common: ['成熟通用方案', '量产资料完整，常见应用验证充分'],
      optimal: ['需求匹配方案', '接口和功能与当前项目匹配'],
      value: ['稳健性价比方案', '在保留安全余量的前提下优化成本'],
      best: ['高余量方案', '优先品质、性能余量和扩展能力'],
    }
    return { ...base, data: {
      sets: sourceQuestions.map(({ questionIndex, question }) => ({
        questionIndex,
        question,
        candidates: Object.entries(labels).map(([category, [model, rationale]]) => ({
          id: `q${questionIndex}-${category}`,
          category,
          model,
          answer: `${model}；具体电压、电流和封装在原理图冻结前按数据手册复核`,
          rationale,
          confidence: 'medium',
          estimatedCost: '待供应商报价',
          safetyNotes: ['保留电气和热设计余量', '采购前复核官方数据手册'],
          risks: ['Mock 候选仅用于界面和流程验收，不代表真实器件选型'],
        })),
        recommendedId: `q${questionIndex}-common`,
        recommendationReason: '在确定性测试中优先成熟通用方案，真实项目必须重新核对数据手册。',
      })),
      safetySummary: '候选已按保守原则排序；供电、保护、温升、封装和采购状态仍需在冻结方案前人工复核。',
    } }
  }
  if (taskType === 'model-selection') {
    const candidates = [
      ['common', '成熟通用方案', 88],
      ['optimal', '需求匹配方案', 86],
      ['value', '稳健性价比方案', 82],
      ['best', '高余量方案', 84],
    ].map(([category, model, score], index) => ({
      id: `mock-model-${index}`,
      category,
      model,
      maker: 'MetaCore deterministic fixture',
      interface: '待按数据手册复核',
      evidence: ['Mock 固定性证据，不代表真实器件参数'],
      strengths: ['用于验证四类候选界面和权重流程'],
      tradeoffs: ['真实方案必须重新核对型号、电气和供应'],
      riskNotes: ['Mock 结果不得用于直接采购或上板'],
      estimatedCost: '待供应商报价',
      availability: '待复核',
      score,
      recommended: category === 'common',
    }))
    return { ...base, data: {
      candidates,
      selectedCandidateId: 'mock-model-0',
      selectionReason: '固定性测试优先成熟通用候选，真实项目必须根据数据手册和电气约束复核。',
      safetyGate: ['电压/电流/温升需根据真实型号复核', '需保留保护、限流和散热余量'],
    } }
  }
  if (taskType === 'firmware-generation') {
    const main = esp32.arduino
      ? { path: 'src/main.cpp', language: 'cpp', content: `#include <Arduino.h>\n#include <Wire.h>\n#include "drivers/dht20.h"\n#include "drivers/ssd1306.h"\n#include "connectivity.h"\n#define SDA_GPIO ${esp32.sda}\n#define SCL_GPIO ${esp32.scl}\nvoid setup() { Serial.begin(115200); Wire.begin(SDA_GPIO, SCL_GPIO); dht20_init(); ssd1306_init(); wifi_connect(); mqtt_connect(); }\nvoid loop() { if (dht20_read_retry()) { mqtt_publish(); ssd1306_show(); } else { Serial.println("sensor error"); } delay(5000); }\n` }
      : { path: 'src/main.c', language: 'c', content: `#include "freertos/FreeRTOS.h"\n#include "freertos/task.h"\n#include "drivers/dht20.h"\n#include "drivers/ssd1306.h"\n#define SDA_GPIO ${esp32.sda}\n#define SCL_GPIO ${esp32.scl}\nvoid app_main(void) { dht20_init(); ssd1306_init(); while (1) { if (dht20_read_retry()) { ssd1306_show(); } vTaskDelay(pdMS_TO_TICKS(5000)); } }\n` }
    return { ...base, data: { files: [
      main,
      { path: 'src/drivers/dht20.h', language: 'h', content: '#pragma once\nstatic inline int dht20_init(void) { return 0; }\nstatic inline int dht20_read_retry(void) { return 1; }\n' },
      { path: 'src/drivers/ssd1306.h', language: 'h', content: '#pragma once\nstatic inline int ssd1306_init(void) { return 0; }\nstatic inline int ssd1306_show(void) { return 0; }\n' },
      ...(esp32.arduino ? [{ path: 'src/connectivity.h', language: 'h', content: '#pragma once\nstatic inline void wifi_connect(void) {}\nstatic inline void mqtt_connect(void) {}\nstatic inline void mqtt_publish(void) {}\n' }] : []),
      { path: 'platformio.ini', language: 'ini', content: `[env:${esp32.board}]\nplatform = espressif32\nframework = ${esp32.framework}\nboard = ${esp32.board}\nmonitor_speed = 115200\n` },
    ] } }
  }
  if (taskType === 'code-consistency') return { ...base, data: { consistent: true, score: 100, issues: [] } }
  if (taskType === 'flow-graph') return { ...base, data: { nodes: [
    { id: 'init', label: '初始化 I2C / OLED / DHT20', codeFileRef: esp32.arduino ? 'src/main.cpp' : 'src/main.c', codeLine: 8, functionName: esp32.arduino ? 'setup' : 'app_main', evidence: 'dht20_init + ssd1306_init', codeSnippet: 'dht20_init(); ssd1306_init();', nodeStyle: 'init', position: { x: 120, y: 80 } },
    { id: 'connect', label: '连接 Wi-Fi 与 MQTT', codeFileRef: esp32.arduino ? 'src/main.cpp' : 'src/main.c', codeLine: 8, functionName: esp32.arduino ? 'setup' : 'app_main', evidence: 'wifi_connect + mqtt_connect', nodeStyle: 'comm', position: { x: 420, y: 80 } },
    { id: 'read', label: '读取温湿度并重试', codeFileRef: esp32.arduino ? 'src/main.cpp' : 'src/main.c', codeLine: 9, functionName: esp32.arduino ? 'loop' : 'app_main', evidence: 'dht20_read_retry', nodeStyle: 'sensor', position: { x: 120, y: 260 } },
    { id: 'publish', label: 'MQTT 上报并更新 OLED', codeFileRef: esp32.arduino ? 'src/main.cpp' : 'src/main.c', codeLine: 9, functionName: esp32.arduino ? 'loop' : 'app_main', evidence: 'mqtt_publish + ssd1306_show', nodeStyle: 'display', position: { x: 420, y: 260 } },
    { id: 'error', label: '读取失败并记录错误', codeFileRef: esp32.arduino ? 'src/main.cpp' : 'src/main.c', codeLine: 9, functionName: esp32.arduino ? 'loop' : 'app_main', evidence: 'sensor error branch', nodeStyle: 'error', position: { x: 700, y: 260 } },
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
  const content = JSON.stringify(mockContract(taskType, messages))
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
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
      if (service.apiKey) headers.Authorization = `Bearer ${service.apiKey}`

      const controller = new AbortController()
      let timedOut = false
      const abortFromCaller = () => controller.abort()
      options.signal?.addEventListener('abort', abortFromCaller, { once: true })
      const timeoutMs = resolveAITimeoutMs(service)
      const timeout = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
      const startedAt = Date.now()
      const apiMode = resolveAIAPIMode(service)
      const requestModel = resolveTaskModel(service, options.taskType)
      let endpoint
      let body

      if (apiMode === 'responses') {
        const systemMessage = messages.find((message) => message.role === 'system')
        const inputMessages = messages.filter((message) => message.role !== 'system')
        endpoint = `${baseURL}/responses`
        body = {
          model: requestModel,
          input: inputMessages.length === 1 && inputMessages[0].role === 'user'
            ? inputMessages[0].content
            : inputMessages,
          ...(service.maxOutputTokens ? { max_output_tokens: service.maxOutputTokens } : {}),
        }
        if (systemMessage) body.instructions = systemMessage.content
      } else {
        endpoint = `${baseURL}/chat/completions`
        const isReasoningModel = /(?:reasoner|reasoning|deepseek-r1)/i.test(service.model)
        body = {
          model: requestModel,
          messages,
          stream: false,
          // DeepSeek reasoning routes reject sampling controls. Do not send
          // temperature for those models; normal chat models still receive it.
          ...(!isReasoningModel ? { temperature } : {}),
          ...(service.maxOutputTokens ? { max_tokens: service.maxOutputTokens } : {}),
        }
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
          const error = new Error(explainProviderError(extractProviderError(raw, response.status), response.status, service))
          error.status = response.status
          error.code = providerErrorCode(response.status)
          error.retryable = response.status === 429 || response.status >= 500
          throw error
        }

        const data = JSON.parse(raw)
        const content = apiMode === 'responses'
          ? extractOpenAIResponseText(data)
          : extractChatResponseText(data.choices?.[0]?.message)
        if (typeof content !== 'string' || !content) {
          const shape = responseShape(data, apiMode)
          recordOperation('ai.empty_response', {
            provider: service.provider,
            model: service.model,
            apiMode,
            host: new URL(baseURL).host,
            shape,
          }, 'failed')
          const error = new Error(`AI 服务返回成功，但没有可读取的文本内容（响应结构：${JSON.stringify(shape)}）`)
          error.status = 502
          throw error
        }
        recordOperation('ai.call', {
          provider: service.provider,
          model: requestModel,
          configuredModel: service.model !== requestModel ? service.model : undefined,
          apiMode,
          host: new URL(baseURL).host,
        })
        const inputTokens = Number(data.usage?.input_tokens ?? data.usage?.prompt_tokens ?? 0)
        const outputTokens = Number(data.usage?.output_tokens ?? data.usage?.completion_tokens ?? 0)
        return {
          content,
          model: requestModel,
          provider: service.provider,
          apiMode,
          durationMs: Date.now() - startedAt,
          usage: { input: inputTokens, output: outputTokens, total: Number(data.usage?.total_tokens ?? inputTokens + outputTokens) },
          contextLength: messages.reduce((sum, message) => sum + String(message.content ?? '').length, 0),
        }
      } catch (cause) {
        if (cause.name === 'AbortError') {
          const host = (() => { try { return new URL(baseURL).host } catch { return '未知服务' } })()
          const error = new Error(timedOut
            ? `AI 服务请求超时（${Math.round(timeoutMs / 1_000)} 秒）：${service.provider}/${service.model} @ ${host}。请先测试连接；若连接成功但生成仍慢，可降低任务规模、关闭高推理强度或把超时调大。`
            : 'AI 请求已取消')
          error.status = timedOut ? 504 : 409
          error.code = timedOut ? 'AI_TIMEOUT' : 'AI_CANCELLED'
          error.retryable = timedOut
          throw error
        }
        if (cause instanceof TypeError && cause.message === 'fetch failed') {
          const error = new Error(`无法连接 AI 服务（${new URL(baseURL).host}）。请检查 Base URL、网络代理，或确认本地模型服务已经启动。`)
          error.status = 502
          error.code = 'AI_CONNECTION_FAILED'
          error.retryable = true
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
