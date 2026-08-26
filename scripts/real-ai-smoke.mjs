import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const chromeProfile = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Default')
const appOrigin = 'http://127.0.0.1:5173'
const apiOrigin = 'http://127.0.0.1:3766'
const storageOrigins = [appOrigin, 'http://localhost:5173', 'http://31.57.10.232']
const port = 9225
const temporaryProfile = await fs.mkdtemp(path.join(os.tmpdir(), 'metacore-real-ai-'))
let browser

function redact(message) {
  return String(message || '')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-***')
    .replace(/\bBearer\s+\S+/gi, 'Bearer ***')
    .slice(0, 800)
}

async function waitFor(url, timeoutMs = 20_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch { /* wait for local service or Chrome CDP */ }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`等待超时：${url}`)
}

async function copyChromeStorage() {
  const source = path.join(chromeProfile, 'Local Storage', 'leveldb')
  const target = path.join(temporaryProfile, 'Default', 'Local Storage', 'leveldb')
  await fs.mkdir(target, { recursive: true })
  await fs.cp(source, target, {
    recursive: true,
    force: true,
    filter: (entry) => !['LOCK', 'LOG', 'LOG.old'].includes(path.basename(entry)),
  })
}

async function createCDP() {
  const tabs = await (await waitFor(`http://127.0.0.1:${port}/json/list`)).json()
  const tab = tabs.find((item) => item.type === 'page')
  if (!tab?.webSocketDebuggerUrl) throw new Error('Chrome 没有可用页面调试连接')
  const socket = new WebSocket(tab.webSocketDebuggerUrl)
  const pending = new Map()
  let sequence = 0
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (!message.id || !pending.has(message.id)) return
    const resolver = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) resolver.reject(new Error(message.error.message))
    else resolver.resolve(message.result)
  }
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  await send('Runtime.enable')
  await send('Page.enable')
  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || 'Chrome evaluate failed')
    return response.result?.value
  }
  async function navigate(url) {
    await send('Page.navigate', { url })
    const started = Date.now()
    while (Date.now() - started < 20_000) {
      if (await evaluate(`location.origin === ${JSON.stringify(new URL(url).origin)} && document.readyState === 'complete'`)) return
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    throw new Error(`页面加载超时：${url}`)
  }
  return { evaluate, navigate, close: () => socket.close() }
}

function configuredServices(value) {
  try {
    const parsed = JSON.parse(value || '{}')
    const services = Array.isArray(parsed?.state?.services) ? parsed.state.services : []
    return services.filter((service) => (
      ['siliconflow', 'deepseek'].includes(service?.provider)
      && typeof service.apiKey === 'string'
      && service.apiKey.trim()
      && typeof service.baseURL === 'string'
      && typeof service.model === 'string'
    ))
  } catch {
    return []
  }
}

async function readBrowserServices(cdp) {
  const discovered = new Map()
  for (const origin of storageOrigins) {
    try {
      await cdp.navigate(`${origin}/#/settings`)
      const stored = await cdp.evaluate(`localStorage.getItem('metacore-ai-config')`)
      for (const service of configuredServices(stored)) {
        const key = `${service.provider}:${service.baseURL}:${service.model}`
        if (!discovered.has(key)) discovered.set(key, { ...service, sourceOrigin: origin })
      }
    } catch {
      // One unavailable historical origin should not hide usable local data.
    }
  }
  return [...discovered.values()].sort((left, right) => {
    const priority = { siliconflow: 0, deepseek: 1 }
    return priority[left.provider] - priority[right.provider]
  })
}

async function testAIService(cdp, service) {
  const started = Date.now()
  const requestBody = {
    service: { ...service, timeoutMs: 60_000, maxOutputTokens: 128 },
    messages: [{ role: 'user', content: 'Reply with exactly METACORE_OK and nothing else.' }],
    temperature: 0,
  }
  const result = await cdp.evaluate(`(async () => {
    try {
      const response = await fetch(${JSON.stringify(`${apiOrigin}/api/ai/call`)}, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(${JSON.stringify(requestBody)}),
      })
      const payload = await response.json().catch(() => ({}))
      return {
        ok: response.ok,
        status: response.status,
        content: typeof payload.content === 'string' ? payload.content : '',
        error: payload.message || payload.error || '',
      }
    } catch (error) {
      return { ok: false, status: 0, content: '', error: error instanceof Error ? error.message : String(error) }
    }
  })()`)
  if (!result?.ok) throw new Error(result?.error || `HTTP ${result?.status || 0}`)
  if (!String(result.content || '').trim()) throw new Error('AI 服务没有返回文本')
  return { durationMs: Date.now() - started, responseChars: result.content.length }
}

function harnessCompatible(service) {
  return service.provider === 'deepseek'
    || (service.provider === 'siliconflow' && /deepseek/i.test(service.model))
}

async function runHarness(service, projectId) {
  const created = await fetch(`${apiOrigin}/api/agent/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      runtime: 'deepseek-harness',
      model: service.model,
      maxTokens: Math.min(4096, Number(service.maxOutputTokens || 4096)),
      service: { ...service, enabled: true, apiMode: 'chat-completions' },
      goal: '只读检查当前工程。必须调用 inspect_project 获取证据；不要修改文件，不要请求构建。最后用简短中文列出工程类型、芯片、外设、协议和两个风险。',
    }),
  })
  const createdPayload = await created.json().catch(() => ({}))
  if (!created.ok) throw new Error(createdPayload.message || createdPayload.error || `创建 Harness 任务失败 (${created.status})`)

  const started = Date.now()
  while (Date.now() - started < 8 * 60_000) {
    const response = await fetch(`${apiOrigin}/api/jobs/${encodeURIComponent(createdPayload.id)}`)
    const job = await response.json()
    if (job.status === 'succeeded') {
      if (!job.result?.finalResponse) throw new Error('Harness 任务成功但没有最终答复')
      return {
        durationMs: Date.now() - started,
        eventCount: job.result.eventCount,
        notificationCount: job.result.notificationCount,
        responseChars: job.result.finalResponse.length,
      }
    }
    if (['failed', 'cancelled'].includes(job.status)) {
      throw new Error(job.error?.message || job.error || `Harness 任务状态：${job.status}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  throw new Error('Harness 真实任务等待超过 8 分钟')
}

async function runStructuredGeneration(service, projectId) {
  const sessionResponse = await fetch(`${apiOrigin}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, metadata: { source: 'real-ai-structured-smoke' } }),
  })
  const session = await sessionResponse.json().catch(() => ({}))
  if (!sessionResponse.ok) throw new Error(session.message || session.error || `创建结构化任务会话失败 (${sessionResponse.status})`)
  const created = await fetch(`${apiOrigin}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      sessionId: session.id,
      stage: 'scheme-generation',
      payload: {
        service: { ...service, enabled: true, apiMode: 'chat-completions' },
        taskType: 'hardware-scheme',
        temperature: 0.2,
        messages: [
          { role: 'system', content: '最终只输出一个 JSON 对象，字段为 schemaVersion、taskType、status、assumptions、openQuestions、risks、evidence、data、validationHints。不要输出 Markdown。' },
          { role: 'user', content: '请为一个 STM32F103C8T6 深海设备控制器生成硬件方案 JSON。需求：水下 2000 米作业，包含深度传感器、漏水检测、电机驱动、电磁阀、CAN 通信和 12V 电源。引脚分配必须避免冲突，并给出 BOM、接线和风险。' },
        ],
      },
    }),
  })
  const createdPayload = await created.json().catch(() => ({}))
  if (!created.ok) throw new Error(createdPayload.message || createdPayload.error || `创建结构化任务失败 (${created.status})`)
  const started = Date.now()
  while (Date.now() - started < 8 * 60_000) {
    const response = await fetch(`${apiOrigin}/api/jobs/${encodeURIComponent(createdPayload.id)}`)
    const job = await response.json()
    if (job.status === 'succeeded') {
      const content = String(job.result?.content || '')
      if (!content) throw new Error('结构化任务成功但没有文本')
      return { durationMs: Date.now() - started, model: job.result?.model, responseChars: content.length }
    }
    if (['failed', 'cancelled'].includes(job.status)) throw new Error(job.error?.message || job.errorMessage || `结构化任务状态：${job.status}`)
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  throw new Error('结构化任务等待超过 8 分钟')
}

try {
  await waitFor(`${apiOrigin}/api/health`)
  await waitFor(appOrigin)
  await copyChromeStorage()
  browser = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${temporaryProfile}`,
    '--profile-directory=Default',
    `${appOrigin}/#/settings`,
  ], { windowsHide: true, stdio: 'ignore' })
  const cdp = await createCDP()
  const services = await readBrowserServices(cdp)
  if (!services.length) throw new Error('Chrome 中没有找到已填写 API Key 的硅基流动或 DeepSeek 配置')
  await cdp.navigate(`${appOrigin}/#/settings`)

  const results = []
  const working = []
  for (const service of services) {
    try {
      const result = await testAIService(cdp, service)
      results.push({ provider: service.provider, model: service.model, ok: true, ...result })
      working.push(service)
    } catch (error) {
      results.push({ provider: service.provider, model: service.model, ok: false, error: redact(error?.message) })
    }
  }
  if (!working.length) throw new Error(`配置存在，但真实调用均失败：${JSON.stringify(results)}`)

  const workspace = path.resolve('examples', 'esp32-smart-environment')
  const workspaceResponse = await fetch(`${apiOrigin}/api/workspace/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root: workspace }),
  })
  if (!workspaceResponse.ok) throw new Error(`无法设置真实工程 (${workspaceResponse.status})`)

  // The official endpoint is the reference route for Harness tool-calling;
  // SiliconFlow remains tested above and is used for ordinary AI requests.
  const harnessService = working.find((service) => harnessCompatible(service) && service.provider === 'deepseek')
    || working.find(harnessCompatible)
  if (!harnessService) throw new Error('可用 AI 服务中没有 DeepSeek Harness 兼容模型')
  const projectId = `real-ai-${crypto.randomUUID()}`
  const structuredService = working.find((service) => service.provider === 'deepseek') || working.find(harnessCompatible)
  if (!structuredService) throw new Error('可用 AI 服务中没有可用于结构化生成的 DeepSeek 服务')
  const structuredGeneration = await runStructuredGeneration(structuredService, projectId)
  const harness = await runHarness(harnessService, projectId)

  console.log(JSON.stringify({
    ok: true,
    credentialSource: 'isolated Chrome profile copy',
    services: results,
    selectedAI: { provider: working[0].provider, model: working[0].model },
    selectedHarness: { provider: harnessService.provider, model: harnessService.model },
    structuredGeneration,
    workspace,
    harness,
  }, null, 2))
  cdp.close()
} catch (error) {
  console.error(redact(error instanceof Error ? error.stack : error))
  process.exitCode = 1
} finally {
  if (browser && !browser.killed) {
    browser.kill()
    await Promise.race([once(browser, 'exit'), new Promise((resolve) => setTimeout(resolve, 2_000))])
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await fs.rm(temporaryProfile, { recursive: true, force: true })
      break
    } catch (error) {
      if (error?.code !== 'EBUSY' || attempt === 7) break
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
}
