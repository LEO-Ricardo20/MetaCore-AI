import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const port = 9223
const profile = path.join(process.env.TEMP || process.env.TMP || root, `metacore-e2e-${crypto.randomUUID()}`)
const artifacts = path.join(root, 'artifacts', 'e2e')
const errors = []
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
  let sequence = 0
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const resolver = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) resolver.reject(new Error(message.error.message))
      else resolver.resolve(message.result)
    }
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
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails?.text ?? '浏览器运行时异常')
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text)
  })
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) {
      const details = result.exceptionDetails
      const description = details.exception?.description ?? details.exception?.value ?? details.text ?? 'Chrome Runtime.evaluate failed'
      throw new Error(`Chrome Runtime.evaluate failed: ${description}`)
    }
    return result.result?.value
  }
  async function waitForText(text, timeoutMs = 15_000) {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      const present = await evaluate(`document.body?.innerText?.includes(${JSON.stringify(text)})`)
      if (present) return
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    throw new Error(`页面未出现文本：${text}`)
  }
  async function waitForExpression(expression, timeoutMs = 15_000) {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      if (await evaluate(expression)) return
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    throw new Error(`浏览器条件等待超时：${expression}`)
  }
  async function reload() {
    await send('Page.reload', { ignoreCache: true })
    // Give Chrome a short window to detach the old document before the next
    // Runtime.evaluate poll starts against the new document.
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return { send, evaluate, waitForText, waitForExpression, reload, close: () => socket.close() }
}

async function clickText(cdp, text) {
  const clicked = await cdp.evaluate(`(() => { const element = [...document.querySelectorAll('button')].find((item) => item.innerText.includes(${JSON.stringify(text)}) && !item.disabled); if (!element) return false; element.click(); return true; })()`)
  if (!clicked) throw new Error(`没有找到可点击按钮：${text}`)
}

async function clickExactText(cdp, text) {
  const clicked = await cdp.evaluate(`(() => { const element = [...document.querySelectorAll('button')].find((item) => item.innerText.trim() === ${JSON.stringify(text)} && !item.disabled); if (!element) return false; element.click(); return true; })()`)
  if (!clicked) throw new Error(`没有找到可点击按钮：${text}`)
}

async function clickTitle(cdp, title) {
  const clicked = await cdp.evaluate(`(() => { const element = [...document.querySelectorAll('button')].find((item) => item.title === ${JSON.stringify(title)} && !item.disabled); if (!element) return false; element.click(); return true; })()`)
  if (!clicked) throw new Error(`没有找到可点击按钮：${title}`)
}

async function clickVisibleTitle(cdp, title) {
  const clicked = await cdp.evaluate(`(() => { const element = [...document.querySelectorAll('button')].find((item) => { const rect = item.getBoundingClientRect(); return item.title === ${JSON.stringify(title)} && !item.disabled && rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight; }); if (!element) return false; element.click(); return true; })()`)
  if (!clicked) throw new Error(`没有找到视口内可点击按钮：${title}`)
}

async function assertMenuInsideViewport(cdp, label) {
  await cdp.waitForExpression("Boolean(document.querySelector('[role=menu]'))", 5_000)
  const bounds = await cdp.evaluate(`(() => { const menu = document.querySelector('[role=menu]'); if (!menu) return null; const rect = menu.getBoundingClientRect(); return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight }; })()`)
  if (!bounds || bounds.left < 0 || bounds.top < 0 || bounds.right > bounds.viewportWidth || bounds.bottom > bounds.viewportHeight) {
    throw new Error(`${label}待处理菜单超出视口：${JSON.stringify(bounds)}`)
  }
}

async function setRequirement(cdp, value) {
  return cdp.evaluate(`(() => { const element = document.querySelector('textarea'); if (!element) return false; const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(element, ${JSON.stringify(value)}); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`)
}

async function selectValue(cdp, selector, value) {
  const changed = await cdp.evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!(element instanceof HTMLSelectElement)) return false; const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter.call(element, ${JSON.stringify(value)}); element.dispatchEvent(new Event('change', { bubbles: true })); return element.value === ${JSON.stringify(value)}; })()`)
  if (!changed) throw new Error(`无法设置选择项：${selector} = ${value}`)
}

async function screenshot(cdp, name) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png' })
  await fs.mkdir(artifacts, { recursive: true })
  await fs.writeFile(path.join(artifacts, name), Buffer.from(result.data, 'base64'))
}

try {
  await waitFor('http://127.0.0.1:3766/api/health')
  browser = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1440,900', 'http://127.0.0.1:5173/#/design/requirements'], { windowsHide: true, stdio: 'ignore' })
  const cdp = await createCDP()
  await cdp.waitForExpression("location.origin === 'http://127.0.0.1:5173'", 15_000)
  await cdp.evaluate(`localStorage.removeItem('metacore-projects'); localStorage.setItem('metacore-theme', JSON.stringify({ state: { theme: 'light' }, version: 0 })); localStorage.setItem('metacore-ai-config', JSON.stringify({ state: { services: [{ id: 'e2e-mock', name: 'MetaCore Mock（测试）', provider: 'mock', apiKey: '', baseURL: 'http://127.0.0.1:3766/mock', model: 'metacore-deterministic', apiMode: 'chat-completions', enabled: true, mockDelayMs: 2500 }], activeServiceId: 'e2e-mock' }, version: 0 })); 'storage-ready'`)
  await cdp.reload()
  await cdp.waitForText('描述你的硬件需求')
  await cdp.waitForText('ESP32 开发板配置')
  await screenshot(cdp, 'esp32-config-light.png')
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await new Promise((resolve) => setTimeout(resolve, 350))
  await cdp.waitForExpression(`(() => { const sidebar = document.querySelector('aside'); return !sidebar || sidebar.getBoundingClientRect().right <= 1; })()`, 3_000)
  await cdp.evaluate(`(() => { const heading = [...document.querySelectorAll('h3')].find((item) => item.textContent?.includes('ESP32 开发板配置')); heading?.closest('section')?.scrollIntoView({ block: 'start' }); })()`)
  await new Promise((resolve) => setTimeout(resolve, 150))
  const configOverflow = await cdp.evaluate('document.documentElement.scrollWidth > window.innerWidth')
  if (configOverflow) throw new Error('ESP32 配置向导在移动端产生横向溢出')
  await screenshot(cdp, 'esp32-config-mobile.png')
  await cdp.send('Emulation.clearDeviceMetricsOverride')
  await cdp.evaluate('window.scrollTo(0, 0)')
  await setRequirement(cdp, 'Wi-Fi MQTT 环境监测，DHT20 温湿度传感器，SSD1306 OLED，I2C，总线和错误重试')
  await clickText(cdp, '生成硬件方案')
  await cdp.waitForText('取消任务', 5_000)
  await clickText(cdp, '取消任务')
  await cdp.waitForText('生成任务已取消', 5_000)
  const cancelledProject = await cdp.evaluate(`(() => { const state = JSON.parse(localStorage.getItem('metacore-projects') || '{}').state; return state?.projects?.find((item) => item.id === state.currentProjectId) ?? state?.projects?.[0]; })()`)
  if (!cancelledProject?.id) throw new Error('取消验收没有生成项目状态')
  await cdp.waitForExpression(`fetch('http://127.0.0.1:3766/api/jobs?projectId=${encodeURIComponent(cancelledProject.id)}').then((response) => response.json()).then((payload) => payload.jobs?.some((job) => job.stage === 'scheme-generation' && job.status === 'cancelled'))`, 5_000)
  await clickTitle(cdp, '重试生成')
  await cdp.waitForExpression(`(() => { try { const state = JSON.parse(localStorage.getItem('metacore-projects') || '{}').state; const project = state?.projects?.find((item) => item.id === state.currentProjectId); return Boolean(project?.scheme); } catch { return false; } })()`, 10_000)
  const retryJobs = await cdp.evaluate(`fetch('http://127.0.0.1:3766/api/jobs?projectId=${encodeURIComponent(cancelledProject.id)}').then((response) => response.json())`)
  if (!retryJobs.jobs?.some((job) => job.stage === 'scheme-generation' && job.status === 'cancelled')) throw new Error('取消 Job 没有保持 cancelled 状态')
  if (!retryJobs.jobs?.some((job) => job.stage === 'scheme-generation' && job.status === 'succeeded')) throw new Error('重试没有创建成功的方案 Job')

  await cdp.evaluate(`(() => { const config = JSON.parse(localStorage.getItem('metacore-ai-config') || '{}'); config.state.services[0].mockDelayMs = 450; localStorage.setItem('metacore-ai-config', JSON.stringify(config)); localStorage.removeItem('metacore-projects'); location.hash = '#/design/requirements'; })()`)
  await cdp.reload()
  await cdp.waitForText('描述你的硬件需求')
  await cdp.waitForExpression(`Boolean(document.querySelector('select[aria-label="ESP32 开发板"] option[value="esp32-c3-devkitm-1"]'))`, 5_000)
  await selectValue(cdp, 'select[aria-label="ESP32 开发板"]', 'esp32-c3-devkitm-1')
  await clickText(cdp, 'PlatformIO')
  await cdp.waitForText('ESP32-C3-MINI-1')
  await setRequirement(cdp, 'Wi-Fi MQTT 环境监测，DHT20 温湿度传感器，SSD1306 OLED，I2C，总线和错误重试')
  await clickText(cdp, '完整生成')
  await clickText(cdp, '开始完整生成')
  await new Promise((resolve) => setTimeout(resolve, 200))
  await cdp.evaluate("location.hash = '#/implementation/code'")
  await cdp.waitForText('可以切换到其他页面，任务会在后台继续。', 5_000)
  await new Promise((resolve) => setTimeout(resolve, 250))
  await screenshot(cdp, 'generation-running.png')
  try {
    await cdp.waitForExpression(`(() => { try { const state = JSON.parse(localStorage.getItem('metacore-projects') || '{}').state; const project = state?.projects?.find((item) => item.id === state.currentProjectId) ?? state?.projects?.[0]; return Boolean(project?.scheme && project.codeFiles?.length && project.flowNodes?.length); } catch { return false; } })()`, 20_000)
  } catch (error) {
    const debugState = await cdp.evaluate(`({ body: document.body?.innerText ?? '', projects: localStorage.getItem('metacore-projects') })`)
    throw new Error(`${error instanceof Error ? error.message : String(error)}\ndebug=${JSON.stringify(debugState).slice(-12000)}`, { cause: error })
  }
  await new Promise((resolve) => setTimeout(resolve, 1_500))
  const projectState = await cdp.evaluate("JSON.parse(localStorage.getItem('metacore-projects') || '{}')")
  const project = projectState.state?.projects?.[0]
  if (!project?.scheme || !project.codeFiles?.length || !project.flowNodes?.length) {
    const jobsSnapshot = project?.id
      ? await cdp.evaluate(`fetch('http://127.0.0.1:3766/api/jobs?projectId=${encodeURIComponent(project.id)}').then((response) => response.json())`)
      : null
    const bodyText = await cdp.evaluate('document.body?.innerText ?? ""')
    throw new Error(`完整生成未写入方案、代码和流程图产物\nproject=${JSON.stringify({ id: project?.id, hasScheme: Boolean(project?.scheme), codeFiles: project?.codeFiles?.length ?? 0, flowNodes: project?.flowNodes?.length ?? 0 })}\njobs=${JSON.stringify(jobsSnapshot)}\nbody=${bodyText.slice(-3000)}`)
  }
  if (project.esp32?.boardId !== 'esp32-c3-devkitm-1' || project.esp32?.platformioBoard !== 'esp32-c3-devkitm-1') {
    throw new Error(`完整生成没有保留 ESP32-C3 board profile：${JSON.stringify(project.esp32)}`)
  }
  const platformioFile = project.codeFiles.find((file) => file.path === 'platformio.ini')
  if (!platformioFile?.content.includes('board = esp32-c3-devkitm-1') || platformioFile.content.includes('board = esp32dev')) {
    throw new Error(`PlatformIO board 配置不正确：${platformioFile?.content ?? 'missing'}`)
  }
  const mainFile = project.codeFiles.find((file) => file.path === 'src/main.cpp')
  if (!mainFile?.content.includes('void setup()') || !mainFile.content.includes('void loop()')) {
    throw new Error(`PlatformIO Arduino 入口文件不正确：${mainFile?.content ?? 'missing src/main.cpp'}`)
  }
  if (project.flowNodes.some((node) => node.codeFileRef && node.codeFileRef !== 'src/main.cpp')) {
    throw new Error(`流程图证据没有指向生成的 Arduino 入口：${JSON.stringify(project.flowNodes)}`)
  }
  await cdp.evaluate("location.hash = '#/design/scheme'")
  await cdp.waitForText('硬件方案')
  await screenshot(cdp, 'scheme.png')
  await cdp.evaluate("location.hash = '#/design/pins'")
  await cdp.waitForText('引脚分配')
  await cdp.evaluate(`(() => { const stored = JSON.parse(localStorage.getItem('metacore-projects') || '{}'); const active = stored.state?.projects?.find((item) => item.id === stored.state.currentProjectId) ?? stored.state?.projects?.[0]; if (!active?.artifacts?.flow) return false; active.artifacts.flow.status = 'stale'; active.artifacts.flow.staleReason = 'E2E 视口适配检查'; localStorage.setItem('metacore-projects', JSON.stringify(stored)); location.hash = '#/verification/consistency'; return true; })()`)
  await cdp.reload()
  await cdp.waitForText('代码与硬件方案一致性')
  await clickText(cdp, '运行一致性检查')
  await cdp.waitForExpression(`(() => {
    const stored = JSON.parse(localStorage.getItem('metacore-projects') || '{}')
    const active = stored.state?.projects?.find((item) => item.id === stored.state.currentProjectId) ?? stored.state?.projects?.[0]
    const status = active?.verification?.consistency?.status
    return Boolean(status && status !== 'idle' && status !== 'running' && ['valid', 'invalid'].includes(active?.artifacts?.consistencyReport?.status))
  })()`)
  await screenshot(cdp, 'verification.png')
  await clickVisibleTitle(cdp, '查看待处理事项')
  await assertMenuInsideViewport(cdp, '桌面端')
  await screenshot(cdp, 'pending-issues-desktop.png')
  await cdp.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await clickVisibleTitle(cdp, '查看待处理事项')
  await assertMenuInsideViewport(cdp, '移动端')
  await screenshot(cdp, 'pending-issues-mobile.png')
  await cdp.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
  await cdp.send('Emulation.clearDeviceMetricsOverride')
  const githubLink = await cdp.evaluate(`(() => { const link = [...document.querySelectorAll('a')].find((item) => item.textContent?.includes('GitHub')); return link ? { href: link.href, target: link.target, visible: link.getBoundingClientRect().height > 0 } : null; })()`)
  if (!githubLink?.visible || githubLink.href !== 'https://github.com/LEO-Ricardo20/MetaCore-Studio' || githubLink.target !== '_blank') {
    throw new Error(`GitHub 入口配置不正确：${JSON.stringify(githubLink)}`)
  }
  await cdp.evaluate("location.hash = '#/projects'")
  await cdp.waitForText('项目管理')
  await screenshot(cdp, 'projects-primary-actions-light.png')
  await cdp.evaluate(`localStorage.setItem('metacore-theme', JSON.stringify({ state: { theme: 'dark' }, version: 0 })); location.hash = '#/workspace'`)
  await cdp.reload()
  await cdp.waitForText('项目研发状态')
  await screenshot(cdp, 'workspace-dark.png')
  await cdp.evaluate("location.hash = '#/design/scheme'")
  await cdp.waitForText('硬件方案')
  await screenshot(cdp, 'scheme-dark.png')
  await cdp.evaluate("location.hash = '#/implementation/code'")
  await cdp.waitForText('固件工程')
  await screenshot(cdp, 'implementation-dark.png')
  await cdp.evaluate("location.hash = '#/verification/consistency'")
  await cdp.waitForText('代码与硬件方案一致性')
  await screenshot(cdp, 'verification-dark.png')
  await cdp.evaluate("location.hash = '#/help'")
  await cdp.waitForText('使用教程 & 更新日志')
  await clickExactText(cdp, '更新日志')
  await cdp.waitForText('按版本查看功能')
  await screenshot(cdp, 'changelog-dark.png')
  const jobs = await cdp.evaluate(`fetch('http://127.0.0.1:3766/api/jobs?projectId=${encodeURIComponent(project.id)}').then((response) => response.json())`)
  if (!jobs.jobs?.some((job) => job.stage === 'scheme-generation' && job.status === 'succeeded')) throw new Error('方案 Job 未成功完成')
  if (!jobs.jobs?.some((job) => job.stage === 'scheme-validation' && job.status === 'succeeded')) throw new Error('引脚校验 Job 未成功完成')
  if (!jobs.jobs?.some((job) => job.stage === 'code-generation' && job.status === 'succeeded')) throw new Error('代码 Job 未成功完成')
  if (!jobs.jobs?.some((job) => job.stage === 'flow-generation' && job.status === 'succeeded')) throw new Error('流程 Job 未成功完成')
  if (errors.length) throw new Error(`浏览器控制台错误：${errors.map((error) => JSON.stringify(error)).join(' | ')}`)
  console.log(JSON.stringify({ ok: true, projectId: project.id, files: project.codeFiles.length, flowNodes: project.flowNodes.length, jobs: jobs.jobs.map((job) => ({ stage: job.stage, status: job.status, durationMs: job.durationMs })) }, null, 2))
  cdp.close()
} catch (error) {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
} finally {
  browser?.kill()
}
