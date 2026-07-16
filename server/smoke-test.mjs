import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const PORT = 3767
const API = `http://127.0.0.1:${PORT}/api`
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'metacore-local-test-'))
const configPath = path.join(tempRoot, 'server-config.json')
let server

async function request(route, init) {
  const res = await fetch(`${API}${route}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
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
  assert.match(report.markdown, /MetaCore AI 本地工程诊断报告/)
  assert.match(report.markdown, /PlatformIO/)

  const build = await request('/build/detect')
  assert.ok(build.profiles.some((item) => item.id === 'platformio'))

  console.log(JSON.stringify({
    ok: true,
    projectType: analysis.primaryProjectType,
    score: analysis.health.score,
    protocols: analysis.protocols.map((item) => item.label),
    backups: backups.backups.length,
  }, null, 2))
} finally {
  if (server && !server.killed) server.kill()
  await fs.rm(tempRoot, { recursive: true, force: true })
}
