import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const workspace = path.join(root, 'examples', 'esp32-smart-environment')
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const port = 9224
const profile = path.join(process.env.TEMP || process.env.TMP || root, `metacore-real-${crypto.randomUUID()}`)
const screenshotPath = path.join(root, 'artifacts', 'e2e', 'real-project.png')
let browser

async function waitFor(url, timeoutMs = 15_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch { /* wait */ }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error(`等待超时：${url}`)
}

async function createCDP() {
  let tab
  const started = Date.now()
  while (!tab && Date.now() - started < 15_000) {
    const tabs = await (await waitFor(`http://127.0.0.1:${port}/json/list`)).json()
    tab = tabs.find((item) => item.type === 'page' && item.url?.includes('127.0.0.1:5173'))
    if (!tab) await new Promise((resolve) => setTimeout(resolve, 150))
  }
  if (!tab?.webSocketDebuggerUrl) throw new Error('Chrome 没有可用页面调试连接')
  const socket = new WebSocket(tab.webSocketDebuggerUrl)
  const pending = new Map()
  const errors = []
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
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails?.text ?? 'runtime exception')
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text)
  })
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Chrome evaluate failed')
    return result.result?.value
  }
  async function waitText(value, timeoutMs = 15_000) {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      if (await evaluate(`document.body?.innerText?.includes(${JSON.stringify(value)})`)) return
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    throw new Error(`页面未出现文本：${value}`)
  }
  async function waitExpression(expression, timeoutMs = 15_000) {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      if (await evaluate(expression)) return
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    throw new Error(`浏览器条件等待超时：${expression}`)
  }
  return { send, evaluate, waitText, waitExpression, errors, close: () => socket.close() }
}

async function clickText(cdp, value) {
  const target = await cdp.evaluate(`(() => { const button = [...document.querySelectorAll('button')].find((item) => item.innerText.includes(${JSON.stringify(value)}) && !item.disabled); if (!button) return null; const rect = button.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`)
  if (!target) {
    const buttons = await cdp.evaluate('JSON.stringify([...document.querySelectorAll("button")].map((item) => ({ text: item.innerText, disabled: item.disabled })))')
    const body = await cdp.evaluate('document.body?.innerText ?? ""')
    throw new Error(`没有找到按钮：${value}，当前按钮：${buttons}\nbody=${body.slice(-6000)}`)
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: target.x, y: target.y })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 })
}

async function clickLastExactText(cdp, value) {
  const target = await cdp.evaluate(`(() => { const buttons = [...document.querySelectorAll('button')].filter((item) => item.innerText.trim() === ${JSON.stringify(value)} && !item.disabled); const button = buttons.at(-1); if (!button) return null; const rect = button.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`)
  if (!target) throw new Error(`没有找到可点击按钮：${value}`)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 })
}

async function clickTitle(cdp, value) {
  const target = await cdp.evaluate(`(() => { const button = [...document.querySelectorAll('button')].find((item) => item.title === ${JSON.stringify(value)} && !item.disabled); if (!button) return null; const rect = button.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`)
  if (!target) throw new Error(`没有找到可点击按钮：${value}`)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 })
}

try {
  await waitFor('http://127.0.0.1:3766/api/health')
  await fetch('http://127.0.0.1:3766/api/workspace/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root: workspace }),
  })
  browser = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1440,900', 'http://127.0.0.1:5173/#/verification/local'], { windowsHide: true, stdio: 'ignore' })
  const cdp = await createCDP()
  await cdp.waitExpression("location.origin === 'http://127.0.0.1:5173'", 10_000)
  const projectId = `real-${crypto.randomUUID()}`
  await cdp.evaluate(`localStorage.setItem('metacore-projects', JSON.stringify({ state: { projects: [{ schemaVersion: 2, id: ${JSON.stringify(projectId)}, name: 'ESP32 Smart Environment', requirement: '真实本地工程分析', target: 'ESP32', format: 'platformio', selectedDriverIds: [], codeFiles: [], flowNodes: [], flowEdges: [], currentStage: 'verification', artifacts: Object.fromEntries(['requirements','scheme','pinMap','bom','wiring','code','flow','localAnalysis','consistencyReport','buildResult','releaseReport'].map((key) => [key, { status: 'missing', version: 0 }])), runs: [], versions: [], validation: { status: 'unchecked', issueCount: 0, blockingCount: 0 }, createdAt: Date.now(), updatedAt: Date.now() }], currentProjectId: ${JSON.stringify(projectId)} }, version: 2 }))`)
  await cdp.evaluate(`localStorage.setItem('metacore-theme', JSON.stringify({ state: { theme: 'light' }, version: 0 })); location.hash = '#/verification/local'`)
  await cdp.send('Page.reload', { ignoreCache: true })
  try {
    await cdp.waitText('本地工程')
  } catch (error) {
    const body = await cdp.evaluate('document.body?.innerText ?? ""')
    const probes = await cdp.evaluate(`Promise.all(['/api/health','/api/system/info','/api/workspace/current','/api/files/list?dir=','/api/backups/list'].map((path) => fetch('http://127.0.0.1:3766' + path).then(async (response) => ({ path, status: response.status, body: await response.text() })).catch((cause) => ({ path, error: String(cause) }))))`)
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nbody=${body.slice(-5000)}\nprobes=${JSON.stringify(probes)}`, { cause: error })
  }
  await cdp.waitExpression(`[...document.querySelectorAll('button')].some((item) => item.innerText.includes('扫描') && !item.disabled)`, 15_000)
  const currentWorkspace = await cdp.evaluate(`fetch('http://127.0.0.1:3766/api/workspace/current').then((response) => response.json())`)
  if (currentWorkspace.workspaceRoot !== workspace) throw new Error(`前端读取到的工作区不正确：${currentWorkspace.workspaceRoot}`)
  const analysisProbe = await cdp.evaluate(`fetch('http://127.0.0.1:3766/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(async (response) => ({ status: response.status, body: await response.text() }))`)
  if (analysisProbe.status !== 200) throw new Error(`浏览器调用真实分析接口失败：${JSON.stringify(analysisProbe)}`)
  const noBodyProbe = await cdp.evaluate(`Promise.race([fetch('http://127.0.0.1:3766/api/analyze', { method: 'POST' }).then(async (response) => ({ status: response.status, body: (await response.text()).slice(0, 200) })), new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 5_000))])`)
  if (noBodyProbe.timeout || noBodyProbe.status !== 200) throw new Error(`浏览器无请求体分析接口失败：${JSON.stringify(noBodyProbe)}`)
  await cdp.evaluate(`(() => { window.__metacoreFetches = []; const originalFetch = window.fetch.bind(window); window.fetch = (...args) => { const url = String(args[0]); window.__metacoreFetches.push({ url, startedAt: Date.now() }); return originalFetch(...args).then(async (response) => { const entry = window.__metacoreFetches.findLast((item) => item.url === url && item.status == null); if (entry) { entry.status = response.status; entry.body = (await response.clone().text()).slice(0, 4000); } return response; }).catch((error) => { window.__metacoreFetches.push({ url, error: String(error) }); throw error; }); }; })()`)
  const scanButton = await cdp.evaluate(`(() => { const button = [...document.querySelectorAll('button')].find((item) => item.innerText.includes('扫描')); if (!button) return null; const rect = button.getBoundingClientRect(); return { html: button.outerHTML, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }; })()`)
  if (!scanButton?.rect?.width) throw new Error(`扫描按钮不可见：${JSON.stringify(scanButton)}`)
  console.log(`scanButton=${JSON.stringify(scanButton)}`)
  await clickText(cdp, '扫描')
  await cdp.waitExpression(`document.body?.innerText?.includes('PlatformIO') && [...document.querySelectorAll('button')].some((item) => item.innerText === '总览')`, 15_000)
  let body = await cdp.evaluate('document.body?.innerText ?? ""')
  for (const expected of ['PlatformIO', 'ESP32', 'Wi-Fi', 'MQTT']) {
    if (!body.includes(expected)) {
      const fetches = await cdp.evaluate('JSON.stringify(window.__metacoreFetches ?? [])')
      throw new Error(`真实工程页面缺少识别结果：${expected}\nfetches=${fetches}\nconsole=${JSON.stringify(cdp.errors)}\nbody=${body.slice(-9000)}`)
    }
  }
  await clickText(cdp, '硬件')
  await cdp.waitText('SSD1306 / OLED', 5_000)
  body = await cdp.evaluate('document.body?.innerText ?? ""')
  for (const expected of ['SSD1306', 'DHT', 'I2C', 'UART', 'DHT_PIN', 'OLED_SDA', 'OLED_SCL']) {
    if (!body.includes(expected)) throw new Error(`真实工程硬件页缺少识别结果：${expected}\nbody=${body.slice(-9000)}`)
  }
  await clickLastExactText(cdp, '构建')
  await cdp.waitText('可用构建', 5_000)
  await cdp.evaluate('window.confirm = () => true')
  await clickTitle(cdp, '执行白名单构建命令')
  await cdp.waitExpression(`document.body?.innerText?.includes('构建成功') && document.body?.innerText?.includes('[SUCCESS]')`, 60_000)
  const buildRequest = await cdp.evaluate(`(window.__metacoreFetches ?? []).findLast((item) => item.url.includes('/api/build/run'))`)
  if (buildRequest?.status !== 200 || !buildRequest?.body?.includes('"success":true')) {
    throw new Error(`浏览器构建请求没有成功：${JSON.stringify(buildRequest)}`)
  }
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true })
  await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'))
  console.log(JSON.stringify({ ok: true, workspace, screenshot: screenshotPath, checks: ['PlatformIO', 'ESP32', 'Wi-Fi', 'MQTT', 'SSD1306', 'DHT', 'I2C', 'PlatformIO build SUCCESS'] }, null, 2))
  cdp.close()
} catch (error) {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
} finally {
  browser?.kill()
}
