/** AI API 客户端 — 统一调用 OpenAI 兼容协议的 AI 服务 */

import type { AIServiceConfig } from '@/types/ai'

/** 聊天消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** AI 调用选项 */
export interface CallAIOptions {
  /** 温度参数，越低越确定性（默认 0.3） */
  temperature?: number
  /** 流式输出回调 */
  onChunk?: (text: string) => void
}

/**
 * 调用 AI 服务（支持流式 & 非流式）
 *
 * - OpenAI 服务商：使用 Responses API（/v1/responses）
 * - 其他服务商：使用 Chat Completions API（/chat/completions）
 *
 * @param service  - AI 服务配置
 * @param messages - 聊天消息列表
 * @param options  - 调用选项，也可直接传入 onChunk 回调函数（向后兼容）
 */
export async function callAI(
  service: AIServiceConfig,
  messages: ChatMessage[],
  options?: CallAIOptions | ((text: string) => void)
): Promise<string> {
  const opts: CallAIOptions = typeof options === 'function'
    ? { onChunk: options }
    : (options ?? {})

  return service.provider === 'openai'
    ? callAIResponses(service, messages, opts)
    : callAIChatCompletions(service, messages, opts)
}

/** Chat Completions 协议（DeepSeek / Qwen / SiliconFlow / Ollama / custom） */
async function callAIChatCompletions(
  service: AIServiceConfig,
  messages: ChatMessage[],
  opts: CallAIOptions
): Promise<string> {
  const temperature = opts.temperature ?? 0.3
  const onChunk = opts.onChunk

  const res = await fetch(`${service.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${service.apiKey}`
    },
    body: JSON.stringify({
      model: service.model,
      messages,
      stream: !!onChunk,
      temperature
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`AI请求失败 (${res.status}): ${err}`)
  }

  if (!onChunk) {
    const data = await res.json()
    return data.choices[0].message.content as string
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value)
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') break
      try {
        const json = JSON.parse(data)
        const text = json.choices?.[0]?.delta?.content ?? ''
        if (text) { full += text; onChunk(text) }
      } catch { /* skip */ }
    }
  }
  return full
}

/** Responses API 协议（仅 OpenAI） */
async function callAIResponses(
  service: AIServiceConfig,
  messages: ChatMessage[],
  opts: CallAIOptions
): Promise<string> {
  const temperature = opts.temperature ?? 0.3
  const onChunk = opts.onChunk

  // system 消息提取为顶层 instructions，其余作为 input
  const systemMsg = messages.find(m => m.role === 'system')
  const inputMessages = messages.filter(m => m.role !== 'system')
  const input = inputMessages.length === 1 && inputMessages[0].role === 'user'
    ? inputMessages[0].content
    : inputMessages.map(m => ({ role: m.role, content: m.content }))

  const body: Record<string, unknown> = {
    model: service.model,
    input,
    stream: !!onChunk,
    temperature,
  }
  if (systemMsg) body.instructions = systemMsg.content

  const res = await fetch(`${service.baseURL}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${service.apiKey}`
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`AI请求失败 (${res.status}): ${err}`)
  }

  if (!onChunk) {
    const data = await res.json()
    return data.output_text as string
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value)
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') break
      try {
        const json = JSON.parse(data)
        if (json.type === 'response.output_text.delta') {
          const text = json.delta ?? ''
          if (text) { full += text; onChunk(text) }
        }
      } catch { /* skip */ }
    }
  }
  return full
}

/**
 * 测试 AI 服务连通性
 *
 * 向服务发送一条简单消息，若返回正常则视为连通。
 *
 * @param service - AI 服务配置
 * @returns 连通返回 true，否则 false
 */
export async function testConnection(service: AIServiceConfig): Promise<boolean> {
  try {
    await callAI(service, [{ role: 'user', content: 'hi' }])
    return true
  } catch {
    return false
  }
}
