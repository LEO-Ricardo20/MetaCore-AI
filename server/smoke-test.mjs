import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const PORT = 3767
const API = `http://127.0.0.1:${PORT}/api`
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'metacore-local-test-'))
const externalRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'metacore-local-external-'))
const configPath = path.join(tempRoot, 'server-config.json')
let server
let mockAIProvider
const mockAIRequests = []

async function requestRaw(route, init) {
  const res = await fetch(`${API}${route}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const data = await res.json()
  return { res, data }
}

async function request(route, init) {
  const { res, data } = await requestRaw(route, init)
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

async function startMockAIProvider() {
  mockAIProvider = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const raw = Buffer.concat(chunks).toString('utf8')
    const body = raw ? JSON.parse(raw) : null
    mockAIRequests.push({ method: req.method, url: req.url, authorization: req.headers.authorization, body })

    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ data: [{ id: 'gpt-test' }, { id: 'gpt-test-pro' }] }))
      return
    }

    if (req.url?.includes('/rate-limit/')) {
      res.writeHead(429, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'Request was rejected due to rate limiting. Details: System is too busy now.' } }))
      return
    }

    if (req.url?.includes('/unavailable/')) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'No available providers' } }))
      return
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    if (req.url === '/v1/responses') {
      res.end(JSON.stringify({ output_text: 'OPENAI_OK' }))
      return
    }
    res.end(JSON.stringify({ choices: [{ message: { content: 'CHAT_OK' } }] }))
  })

  await new Promise((resolve, reject) => {
    mockAIProvider.once('error', reject)
    mockAIProvider.listen(0, '127.0.0.1', resolve)
  })
  return mockAIProvider.address().port
}

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const health = await request('/health')
      if (health.ok) return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  throw new Error('本地服务启动超时')
}

try {
  const mockAIPort = await startMockAIProvider()
  await fs.mkdir(path.join(tempRoot, 'src'), { recursive: true })
  await fs.writeFile(path.join(tempRoot, 'platformio.ini'), [
    '[env:esp32dev]',
    'platform = espressif32',
    'board = esp32dev',
    'framework = arduino',
    'lib_deps =',
    '  knolleary/PubSubClient',
  ].join('\n'), 'utf8')
  await fs.writeFile(path.join(tempRoot, 'src', 'main.cpp'), [
    '#include <Arduino.h>',
    '#include <WiFi.h>',
    '#include <PubSubClient.h>',
    '#define OLED_SDA 21',
    '#define OLED_SCL 22',
    'void setup() { WiFi.begin("demo", "changeme"); Wire.begin(21, 22); }',
    'void loop() {}',
  ].join('\n'), 'utf8')
  await fs.writeFile(path.join(externalRoot, 'secret.txt'), 'WORKSPACE_ESCAPE', 'utf8')
  let externalLinkCreated = false
  try {
    await fs.symlink(externalRoot, path.join(tempRoot, 'external-link'), process.platform === 'win32' ? 'junction' : 'dir')
    externalLinkCreated = true
  } catch (error) {
    if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) throw error
  }

  server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      METACORE_LOCAL_PORT: String(PORT),
      METACORE_LOCAL_CONFIG: configPath,
    },
    windowsHide: true,
    stdio: 'ignore',
  })

  await waitForServer()
  await request('/workspace/set', { method: 'POST', body: JSON.stringify({ root: tempRoot }) })

  const listing = await request('/files/list')
  assert.ok(listing.items.some((item) => item.name === 'platformio.ini'))
  if (externalLinkCreated) {
    assert.ok(!listing.items.some((item) => item.name === 'external-link'))
    const escapedRead = await requestRaw('/files/read?path=external-link%2Fsecret.txt')
    assert.equal(escapedRead.res.status, 403)
    assert.match(escapedRead.data.error, /工作区外部路径/)
  }

  const analysis = await request('/analyze', { method: 'POST' })
  assert.equal(analysis.primaryProjectType, 'PlatformIO')
  assert.ok(analysis.chips.includes('ESP32'))
  assert.ok(analysis.protocols.some((item) => item.id === 'wifi'))
  assert.ok(analysis.protocols.some((item) => item.id === 'mqtt'))
  assert.ok(analysis.dependencies.some((item) => item.name.includes('PubSubClient')))
  assert.equal(typeof analysis.health.score, 'number')

  const file = await request('/files/read?path=src%2Fmain.cpp')
  const write = await request('/files/write', {
    method: 'POST',
    body: JSON.stringify({
      path: file.path,
      content: `${file.content}\n// smoke test`,
      expectedModifiedAt: file.modifiedAt,
    }),
  })
  assert.ok(write.backup.id)

  const backups = await request('/backups/list')
  assert.ok(backups.backups.length >= 1)

  const report = await request('/report', { method: 'POST' })
  assert.match(report.markdown, /MetaCore Studio 本地工程诊断报告/)
  assert.match(report.markdown, /PlatformIO/)

  const build = await request('/build/detect')
  assert.ok(build.profiles.some((item) => item.id === 'platformio'))

  const missingKey = await requestRaw('/ai/call', {
    method: 'POST',
    body: JSON.stringify({
      service: { provider: 'deepseek', apiKey: '', baseURL: `http://127.0.0.1:${mockAIPort}/v1`, model: 'deepseek-chat' },
      messages: [{ role: 'user', content: 'test' }],
    }),
  })
  assert.equal(missingKey.res.status, 400)
  assert.match(missingKey.data.error, /API Key/)

  const chatAI = await request('/ai/call', {
    method: 'POST',
    body: JSON.stringify({
      service: { provider: 'deepseek', apiKey: 'smoke-key', baseURL: `http://127.0.0.1:${mockAIPort}/v1`, model: 'deepseek-chat' },
      messages: [{ role: 'user', content: 'test chat completions' }],
      temperature: 0,
    }),
  })
  assert.equal(chatAI.content, 'CHAT_OK')

  const responsesAI = await request('/ai/call', {
    method: 'POST',
    body: JSON.stringify({
      service: { provider: 'openai', apiKey: 'smoke-key', baseURL: `http://127.0.0.1:${mockAIPort}/v1`, model: 'gpt-test' },
      messages: [{ role: 'user', content: 'test responses' }],
      temperature: 0,
    }),
  })
  assert.equal(responsesAI.content, 'OPENAI_OK')

  const customResponsesAI = await request('/ai/call', {
    method: 'POST',
    body: JSON.stringify({
      service: { provider: 'custom', apiKey: 'smoke-key', baseURL: `http://127.0.0.1:${mockAIPort}/v1`, model: 'gpt-test', apiMode: 'responses' },
      messages: [{ role: 'user', content: 'test custom responses' }],
    }),
  })
  assert.equal(customResponsesAI.content, 'OPENAI_OK')

  const models = await request('/ai/models', {
    method: 'POST',
    body: JSON.stringify({
      service: { provider: 'custom', apiKey: 'smoke-key', baseURL: `http://127.0.0.1:${mockAIPort}/v1`, model: '' },
    }),
  })
  assert.deepEqual(models.models, ['gpt-test', 'gpt-test-pro'])

  const rateLimit = await requestRaw('/ai/call', {
    method: 'POST',
    body: JSON.stringify({
      service: { provider: 'custom', apiKey: 'smoke-key', baseURL: `http://127.0.0.1:${mockAIPort}/rate-limit`, model: 'busy-model' },
      messages: [{ role: 'user', content: 'test rate limit' }],
    }),
  })
  assert.equal(rateLimit.res.status, 429)
  assert.match(rateLimit.data.error, /429|rate limiting/)

  const unavailable = await requestRaw('/ai/call', {
    method: 'POST',
    body: JSON.stringify({
      service: { provider: 'custom', apiKey: 'smoke-key', baseURL: `http://127.0.0.1:${mockAIPort}/unavailable`, model: 'gpt-test' },
      messages: [{ role: 'user', content: 'test unavailable provider' }],
    }),
  })
  assert.equal(unavailable.res.status, 503)
  assert.equal(unavailable.data.error, 'No available providers')
  assert.deepEqual(mockAIRequests.map((item) => item.url), [
    '/v1/chat/completions',
    '/v1/responses',
    '/v1/responses',
    '/v1/models',
    '/rate-limit/chat/completions',
    '/unavailable/chat/completions',
  ])
  assert.ok(mockAIRequests.every((item) => item.authorization === 'Bearer smoke-key'))

  console.log(JSON.stringify({
    ok: true,
    projectType: analysis.primaryProjectType,
    score: analysis.health.score,
    protocols: analysis.protocols.map((item) => item.label),
    backups: backups.backups.length,
    aiProxyRequests: mockAIRequests.length,
  }, null, 2))
} finally {
  if (server && !server.killed) server.kill()
  if (mockAIProvider?.listening) await new Promise((resolve) => mockAIProvider.close(resolve))
  await fs.rm(tempRoot, { recursive: true, force: true })
  await fs.rm(externalRoot, { recursive: true, force: true })
}
