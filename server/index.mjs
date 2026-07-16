import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HOST = '127.0.0.1'
const PORT = Number(process.env.METACORE_LOCAL_PORT ?? 3766)
const MAX_READ_BYTES = 2 * 1024 * 1024
const MAX_BODY_BYTES = 3 * 1024 * 1024
const MAX_SEARCH_BYTES = 512 * 1024
const MAX_SCAN_FILES = 1800
const MAX_SCAN_DEPTH = 8
const MAX_BUILD_OUTPUT = 512 * 1024
const BUILD_TIMEOUT_MS = 120 * 1000

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = process.env.METACORE_LOCAL_CONFIG || path.join(__dirname, '.metacore-local.json')

let workspaceRoot = ''
const operationLog = []

const SKIP_DIRS = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.vite',
  '.cache',
  '.pio',
  '.metacore-backups',
  'coverage',
])

const TEXT_EXTS = new Set([
  '.c',
  '.cc',
  '.cpp',
  '.cxx',
  '.h',
  '.hh',
  '.hpp',
  '.ino',
  '.py',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.md',
  '.txt',
  '.ini',
  '.toml',
  '.yaml',
  '.yml',
  '.xml',
  '.html',
  '.css',
  '.scss',
  '.cmake',
  '.conf',
  '.config',
  '.ioc',
  '.ld',
  '.s',
  '.asm',
  '.bat',
  '.sh',
  '.ps1',
])

const IMPORTANT_NAMES = new Set([
  'platformio.ini',
  'sdkconfig',
  'sdkconfig.defaults',
  'CMakeLists.txt',
  'Makefile',
  'README.md',
  'readme.md',
  'package.json',
  'arduino.json',
])

const PERIPHERAL_PATTERNS = [
  { id: 'ssd1306', label: 'SSD1306 / OLED', regex: /\b(ssd1306|oled|adafruit_ssd1306|u8g2)\b/i },
  { id: 'dht', label: 'DHT 温湿度', regex: /\b(dht11|dht22|dhtesp|dht)\b/i },
  { id: 'aht20', label: 'AHT20 / AHTx0', regex: /\b(aht20|aht10|ahtx0)\b/i },
  { id: 'ws2812', label: 'WS2812 / NeoPixel', regex: /\b(ws2812|neopixel|fastled|adafruit_neopixel)\b/i },
  { id: 'hcsr04', label: 'HC-SR04 超声波', regex: /\b(hc-?sr04|ultrasonic|echo_pin|trig_pin)\b/i },
  { id: 'buzzer', label: '蜂鸣器', regex: /\b(buzzer|tone\(|ledcWriteTone|beep)\b/i },
  { id: 'servo', label: '舵机', regex: /\b(servo|pwmservo|ledcAttachPin)\b/i },
  { id: 'drv8833', label: 'DRV8833 / 电机驱动', regex: /\b(drv8833|motor|ain1|ain2|bin1|bin2)\b/i },
  { id: 'i2c', label: 'I2C 总线', regex: /\b(Wire\.begin|i2c|SDA|SCL)\b/i },
  { id: 'spi', label: 'SPI 总线', regex: /\b(SPI\.begin|MISO|MOSI|SCLK|SCK|CS)\b/i },
  { id: 'uart', label: 'UART 串口', regex: /\b(Serial[0-9]?\.begin|UART|TXD|RXD)\b/i },
]

const IOT_PROTOCOL_PATTERNS = [
  { id: 'wifi', label: 'Wi-Fi', regex: /\b(WiFi\.begin|esp_wifi|WIFI_STA|WIFI_AP)\b/i },
  { id: 'mqtt', label: 'MQTT', regex: /\b(mqtt|PubSubClient|esp_mqtt_client|AsyncMqttClient)\b/i },
  { id: 'http', label: 'HTTP / REST', regex: /\b(HTTPClient|WebServer|AsyncWebServer|esp_http_client|fetch\s*\()\b/i },
  { id: 'websocket', label: 'WebSocket', regex: /\b(websocket|WebSocketsClient|AsyncWebSocket)\b/i },
  { id: 'ble', label: 'Bluetooth LE', regex: /\b(BLEDevice|NimBLE|esp_ble|bluetooth)\b/i },
  { id: 'lorawan', label: 'LoRa / LoRaWAN', regex: /\b(lorawan|LoRa\.begin|RadioLib|LMIC)\b/i },
  { id: 'zigbee', label: 'Zigbee', regex: /\b(zigbee|esp_zb_|ZCL_)\b/i },
  { id: 'modbus', label: 'Modbus', regex: /\b(modbus|ModbusMaster|mbcontroller)\b/i },
  { id: 'coap', label: 'CoAP', regex: /\b(coap|CoAPClient)\b/i },
]

const BUILD_PROFILES = {
  platformio: {
    id: 'platformio',
    label: 'PlatformIO Build',
    command: 'pio',
    args: ['run'],
    marker: 'platformio.ini',
  },
  espidf: {
    id: 'espidf',
    label: 'ESP-IDF Build',
    command: 'idf.py',
    args: ['build'],
    marker: 'sdkconfig',
  },
  cmake: {
    id: 'cmake',
    label: 'CMake Build',
    command: 'cmake',
    args: ['--build', 'build'],
    marker: 'CMakeLists.txt',
  },
}

async function loadConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8')
    const cfg = JSON.parse(raw)
    if (typeof cfg.workspaceRoot === 'string') {
      workspaceRoot = cfg.workspaceRoot
    }
  } catch {
    workspaceRoot = ''
  }
}

async function saveConfig() {
  await fs.writeFile(CONFIG_PATH, JSON.stringify({ workspaceRoot }, null, 2), 'utf8')
}

function recordOperation(type, detail = {}, status = 'success') {
  operationLog.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    status,
    detail,
    createdAt: Date.now(),
  })
  if (operationLog.length > 120) operationLog.length = 120
}

async function commandAvailable(command) {
  const lookup = process.platform === 'win32' ? 'where.exe' : 'which'
  return new Promise((resolve) => {
    const child = spawn(lookup, [command], { windowsHide: true, stdio: 'ignore' })
    child.on('error', () => resolve(false))
    child.on('close', (code) => resolve(code === 0))
  })
}

async function getSystemInfo() {
  const tools = {}
  for (const command of ['node', 'npm', 'pio', 'idf.py', 'cmake', 'arduino-cli']) {
    tools[command] = await commandAvailable(command)
  }
  return {
    platform: process.platform,
    release: os.release(),
    arch: process.arch,
    hostname: os.hostname(),
    nodeVersion: process.version,
    cpuCount: os.cpus().length,
    memoryGB: Number((os.totalmem() / 1024 / 1024 / 1024).toFixed(1)),
    tools,
  }
}

function json(res, status, data, origin = '') {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...corsHeaders(origin),
  })
  res.end(body)
}

function corsHeaders(origin = '') {
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
  }
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

function isAllowedOrigin(origin = '') {
  if (!origin) return false
  try {
    const url = new URL(origin)
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  } catch {
    return false
  }
}

function ensureLocalOrigin(req) {
  const origin = req.headers.origin ?? ''
  if (!origin) return
  if (!isAllowedOrigin(origin)) {
    const err = new Error('拒绝非本机页面访问本地文件服务')
    err.status = 403
    throw err
  }
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      const err = new Error('请求体过大')
      err.status = 413
      throw err
    }
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function normalizeForCompare(p) {
  return process.platform === 'win32' ? p.toLowerCase() : p
}

function requireWorkspace() {
  if (!workspaceRoot) {
    const err = new Error('尚未设置本地工作区')
    err.status = 400
    throw err
  }
  return path.resolve(workspaceRoot)
}

function resolveInsideWorkspace(inputPath = '') {
  const root = requireWorkspace()
  const target = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(root, inputPath || '.')

  const rootCmp = normalizeForCompare(root)
  const targetCmp = normalizeForCompare(target)
  if (targetCmp !== rootCmp && !targetCmp.startsWith(rootCmp + path.sep)) {
    const err = new Error('禁止访问工作区外部路径')
    err.status = 403
    throw err
  }
  return target
}

function toRelative(target) {
  const root = requireWorkspace()
  const rel = path.relative(root, target)
  return rel ? rel.split(path.sep).join('/') : ''
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const name = path.basename(filePath)
  return TEXT_EXTS.has(ext) || IMPORTANT_NAMES.has(name)
}

function getLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const name = path.basename(filePath)
  if (['.c', '.h'].includes(ext)) return 'c'
  if (['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.ino'].includes(ext)) return 'cpp'
  if (['.ts', '.tsx'].includes(ext)) return 'typescript'
  if (['.js', '.jsx'].includes(ext)) return 'javascript'
  if (ext === '.json') return 'json'
  if (ext === '.md') return 'markdown'
  if (ext === '.ini') return 'ini'
  if (ext === '.py') return 'python'
  if (ext === '.html') return 'html'
  if (ext === '.css') return 'css'
  if (ext === '.xml' || ext === '.ioc') return 'xml'
  if (ext === '.cmake' || name === 'CMakeLists.txt') return 'cmake'
  return 'plaintext'
}

async function listDir(dir = '') {
  const target = resolveInsideWorkspace(dir)
  const stat = await fs.stat(target)
  if (!stat.isDirectory()) {
    const err = new Error('目标不是文件夹')
    err.status = 400
    throw err
  }

  const entries = await fs.readdir(target, { withFileTypes: true })
  const items = await Promise.all(entries.map(async (entry) => {
    const full = path.join(target, entry.name)
    const itemStat = await fs.stat(full)
    return {
      name: entry.name,
      path: toRelative(full),
      type: entry.isDirectory() ? 'directory' : 'file',
      size: itemStat.size,
      modifiedAt: itemStat.mtimeMs,
      readable: entry.isDirectory() || isTextFile(full),
    }
  }))

  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-Hans-CN')
  })

  return {
    root: requireWorkspace(),
    dir: toRelative(target),
    parent: toRelative(path.dirname(target)) === '..' ? '' : toRelative(path.dirname(target)),
    items,
  }
}

async function readFile(filePath = '') {
  const target = resolveInsideWorkspace(filePath)
  const stat = await fs.stat(target)
  if (!stat.isFile()) {
    const err = new Error('目标不是文件')
    err.status = 400
    throw err
  }
  if (!isTextFile(target)) {
    const err = new Error('当前只允许读取文本类文件')
    err.status = 415
    throw err
  }
  if (stat.size > MAX_READ_BYTES) {
    const err = new Error(`文件过大，当前限制 ${(MAX_READ_BYTES / 1024 / 1024).toFixed(0)}MB`)
    err.status = 413
    throw err
  }
  const content = await fs.readFile(target, 'utf8')
  return {
    path: toRelative(target),
    name: path.basename(target),
    size: stat.size,
    modifiedAt: stat.mtimeMs,
    language: getLanguage(target),
    content,
  }
}

function assertWritableTextPath(target) {
  const rel = toRelative(target)
  if (!rel || rel.startsWith('.metacore-backups/')) {
    const err = new Error('禁止修改工作区根目录或备份目录')
    err.status = 403
    throw err
  }
  if (!isTextFile(target)) {
    const err = new Error('当前只允许修改文本类文件')
    err.status = 415
    throw err
  }
}

async function createBackup(target, reason = 'manual-save') {
  const root = requireWorkspace()
  const rel = toRelative(target)
  const backupId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(16).slice(2, 8)}`
  const backupDir = path.join(root, '.metacore-backups', backupId)
  const backupTarget = path.join(backupDir, rel)
  const stat = await fs.stat(target)
  await fs.mkdir(path.dirname(backupTarget), { recursive: true })
  await fs.copyFile(target, backupTarget)
  await fs.writeFile(path.join(backupDir, 'metadata.json'), JSON.stringify({
    id: backupId,
    path: rel,
    reason,
    size: stat.size,
    modifiedAt: stat.mtimeMs,
    createdAt: Date.now(),
  }, null, 2), 'utf8')
  return { id: backupId, path: rel, createdAt: Date.now() }
}

async function writeFileSafely(filePath, content, expectedModifiedAt) {
  if (typeof content !== 'string') {
    const err = new Error('文件内容格式无效')
    err.status = 400
    throw err
  }
  if (Buffer.byteLength(content, 'utf8') > MAX_READ_BYTES) {
    const err = new Error(`保存内容过大，当前限制 ${(MAX_READ_BYTES / 1024 / 1024).toFixed(0)}MB`)
    err.status = 413
    throw err
  }

  const target = resolveInsideWorkspace(filePath)
  assertWritableTextPath(target)
  const stat = await fs.stat(target)
  if (!stat.isFile()) {
    const err = new Error('目标不是文件')
    err.status = 400
    throw err
  }
  if (expectedModifiedAt && Math.abs(stat.mtimeMs - Number(expectedModifiedAt)) > 1) {
    const err = new Error('文件已被其他程序修改，请重新加载后再保存')
    err.status = 409
    throw err
  }

  const backup = await createBackup(target)
  await fs.writeFile(target, content, 'utf8')
  const updated = await readFile(filePath)
  recordOperation('file.write', { path: updated.path, backupId: backup.id })
  return { file: updated, backup }
}

async function listBackups() {
  const root = requireWorkspace()
  const backupRoot = path.join(root, '.metacore-backups')
  let entries = []
  try {
    entries = await fs.readdir(backupRoot, { withFileTypes: true })
  } catch {
    return { backups: [] }
  }

  const backups = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      const raw = await fs.readFile(path.join(backupRoot, entry.name, 'metadata.json'), 'utf8')
      backups.push(JSON.parse(raw))
    } catch {
      continue
    }
  }
  backups.sort((a, b) => b.createdAt - a.createdAt)
  return { backups: backups.slice(0, 100) }
}

async function restoreBackup(backupId) {
  if (!/^[A-Za-z0-9-]+$/.test(String(backupId ?? ''))) {
    const err = new Error('备份编号无效')
    err.status = 400
    throw err
  }
  const root = requireWorkspace()
  const backupDir = path.join(root, '.metacore-backups', backupId)
  const metadata = JSON.parse(await fs.readFile(path.join(backupDir, 'metadata.json'), 'utf8'))
  const target = resolveInsideWorkspace(metadata.path)
  assertWritableTextPath(target)
  const source = path.resolve(backupDir, metadata.path)
  const backupCmp = normalizeForCompare(path.resolve(backupDir))
  const sourceCmp = normalizeForCompare(source)
  if (!sourceCmp.startsWith(backupCmp + path.sep)) {
    const err = new Error('备份文件路径无效')
    err.status = 403
    throw err
  }
  await createBackup(target, 'before-restore')
  await fs.copyFile(source, target)
  const file = await readFile(metadata.path)
  recordOperation('backup.restore', { backupId, path: metadata.path })
  return { file, restoredBackupId: backupId }
}

async function walk(dir, options = {}, state = { files: [], totalFiles: 0 }) {
  const depth = options.depth ?? 0
  if (depth > MAX_SCAN_DEPTH || state.files.length >= MAX_SCAN_FILES) return state

  let entries = []
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return state
  }

  for (const entry of entries) {
    if (state.files.length >= MAX_SCAN_FILES) break
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        await walk(full, { depth: depth + 1 }, state)
      }
      continue
    }
    state.totalFiles += 1
    if (isTextFile(full) || IMPORTANT_NAMES.has(entry.name)) {
      state.files.push(full)
    }
  }

  return state
}

async function searchFiles(query = '', maxResults = 60) {
  const q = String(query).trim().toLowerCase()
  if (!q) return { query, results: [] }

  const root = requireWorkspace()
  const state = await walk(root)
  const results = []

  for (const filePath of state.files) {
    if (results.length >= maxResults) break
    const rel = toRelative(filePath)
    const nameMatch = rel.toLowerCase().includes(q)
    let contentMatches = []

    try {
      const stat = await fs.stat(filePath)
      if (stat.size <= MAX_SEARCH_BYTES) {
        const text = await fs.readFile(filePath, 'utf8')
        const lines = text.split(/\r?\n/)
        contentMatches = lines
          .map((line, index) => ({ line, lineNumber: index + 1 }))
          .filter(({ line }) => line.toLowerCase().includes(q))
          .slice(0, 5)
      }
    } catch {
      contentMatches = []
    }

    if (nameMatch || contentMatches.length) {
      results.push({ path: rel, nameMatch, matches: contentMatches })
    }
  }

  return { query, results }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function detectProjectTypes(files, contentsByPath) {
  const names = files.map((f) => path.basename(f))
  const rels = files.map((f) => toRelative(f))
  const joined = rels.join('\n')
  const types = []

  if (names.includes('platformio.ini')) types.push('PlatformIO')
  if (names.includes('sdkconfig') || /(^|\/)main\/CMakeLists\.txt$/i.test(joined)) types.push('ESP-IDF')
  if (rels.some((f) => f.toLowerCase().endsWith('.ino'))) types.push('Arduino')
  if (rels.some((f) => f.toLowerCase().endsWith('.ioc'))) types.push('STM32CubeIDE')
  if (names.includes('CMakeLists.txt')) types.push('CMake C/C++')

  const platformio = [...contentsByPath.entries()].find(([file]) => path.basename(file) === 'platformio.ini')?.[1] ?? ''
  if (/framework\s*=\s*arduino/i.test(platformio) && !types.includes('Arduino')) types.push('Arduino')
  if (/framework\s*=\s*espidf/i.test(platformio) && !types.includes('ESP-IDF')) types.push('ESP-IDF')

  return unique(types)
}

function detectChips(text) {
  const chips = []
  const patterns = [
    ['ESP32-S3', /\b(esp32[-_]?s3|esp32s3)\b/i],
    ['ESP32-C3', /\b(esp32[-_]?c3|esp32c3)\b/i],
    ['ESP32', /\b(esp32(?:dev|doit)?|espressif32)\b/i],
    ['STM32F103', /\bstm32f103\b/i],
    ['STM32F4', /\bstm32f4\d*\b/i],
    ['STM32', /\bstm32[a-z0-9]*\b/i],
  ]
  for (const [name, regex] of patterns) {
    if (regex.test(text)) chips.push(name)
  }
  return unique(chips)
}

function detectPeripherals(fileTexts) {
  const results = []
  for (const pattern of PERIPHERAL_PATTERNS) {
    const matches = []
    for (const item of fileTexts) {
      if (pattern.regex.test(item.content)) {
        matches.push(item.path)
      }
    }
    if (matches.length) {
      results.push({
        id: pattern.id,
        label: pattern.label,
        files: unique(matches).slice(0, 8),
      })
    }
  }
  return results
}

function detectIoTProtocols(fileTexts) {
  const results = []
  for (const pattern of IOT_PROTOCOL_PATTERNS) {
    const files = fileTexts
      .filter((item) => pattern.regex.test(item.content))
      .map((item) => item.path)
    if (files.length) {
      results.push({ id: pattern.id, label: pattern.label, files: unique(files).slice(0, 8) })
    }
  }
  return results
}

function extractDependencies(fileTexts) {
  const deps = new Map()
  const add = (name, source, kind) => {
    const clean = String(name).trim()
    if (!clean || clean.startsWith('.')) return
    const key = `${kind}:${clean.toLowerCase()}`
    if (!deps.has(key)) deps.set(key, { name: clean, kind, files: [] })
    const item = deps.get(key)
    if (!item.files.includes(source)) item.files.push(source)
  }

  for (const file of fileTexts) {
    for (const match of file.content.matchAll(/^\s*#include\s*[<"]([^>"]+)[>"]/gm)) {
      add(match[1], file.path, 'include')
    }
    if (path.basename(file.path) === 'platformio.ini') {
      const libBlock = file.content.match(/lib_deps\s*=([\s\S]*?)(?:\n\s*[A-Za-z_][A-Za-z0-9_]*\s*=|\n\s*\[|$)/i)?.[1] ?? ''
      for (const line of libBlock.split(/\r?\n/)) {
        const value = line.trim().replace(/^[-;]\s*/, '')
        if (value && !value.startsWith(';')) add(value, file.path, 'platformio')
      }
    }
  }
  return [...deps.values()]
    .map((dep) => ({ ...dep, files: dep.files.slice(0, 8) }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 160)
}

function calculateStatistics(fileTexts) {
  const languages = new Map()
  let totalLines = 0
  let codeLines = 0
  let commentLines = 0
  let blankLines = 0

  for (const file of fileTexts) {
    const language = getLanguage(file.path)
    const lines = file.content.split(/\r?\n/)
    const item = languages.get(language) ?? { language, files: 0, lines: 0 }
    item.files += 1
    item.lines += lines.length
    languages.set(language, item)
    totalLines += lines.length

    let inBlockComment = false
    for (const raw of lines) {
      const line = raw.trim()
      if (!line) {
        blankLines += 1
        continue
      }
      if (inBlockComment) {
        commentLines += 1
        if (line.includes('*/')) inBlockComment = false
        continue
      }
      if (line.startsWith('/*')) {
        commentLines += 1
        if (!line.includes('*/')) inBlockComment = true
        continue
      }
      if (line.startsWith('//') || line.startsWith('# ') || line.startsWith(';')) {
        commentLines += 1
        continue
      }
      codeLines += 1
    }
  }

  return {
    totalLines,
    codeLines,
    commentLines,
    blankLines,
    commentRatio: codeLines ? Number((commentLines / codeLines).toFixed(2)) : 0,
    languages: [...languages.values()].sort((a, b) => b.lines - a.lines),
  }
}

async function detectBuildProfiles() {
  const root = requireWorkspace()
  const profiles = []
  for (const profile of Object.values(BUILD_PROFILES)) {
    let markerExists = false
    try {
      await fs.access(path.join(root, profile.marker))
      markerExists = true
    } catch {
      markerExists = false
    }
    if (!markerExists) continue
    profiles.push({
      id: profile.id,
      label: profile.label,
      command: [profile.command, ...profile.args].join(' '),
      available: await commandAvailable(profile.command),
    })
  }
  return { profiles }
}

async function runBuildProfile(profileId) {
  const profile = BUILD_PROFILES[profileId]
  if (!profile) {
    const err = new Error('不允许执行该构建命令')
    err.status = 403
    throw err
  }
  const root = requireWorkspace()
  try {
    await fs.access(path.join(root, profile.marker))
  } catch {
    const err = new Error(`当前工作区缺少 ${profile.marker}`)
    err.status = 400
    throw err
  }
  if (!(await commandAvailable(profile.command))) {
    const err = new Error(`未检测到本机工具：${profile.command}`)
    err.status = 400
    throw err
  }

  const startedAt = Date.now()
  return new Promise((resolve, reject) => {
    const child = spawn(profile.command, profile.args, {
      cwd: root,
      windowsHide: true,
      shell: false,
      env: process.env,
    })
    let stdout = ''
    let stderr = ''
    let outputBytes = 0
    let timedOut = false

    const append = (kind, chunk) => {
      if (outputBytes >= MAX_BUILD_OUTPUT) return
      const text = chunk.toString('utf8')
      outputBytes += Buffer.byteLength(text)
      if (kind === 'stdout') stdout += text
      else stderr += text
    }

    child.stdout.on('data', (chunk) => append('stdout', chunk))
    child.stderr.on('data', (chunk) => append('stderr', chunk))
    child.on('error', (error) => reject(error))

    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, BUILD_TIMEOUT_MS)

    child.on('close', (exitCode) => {
      clearTimeout(timer)
      const result = {
        profileId,
        command: [profile.command, ...profile.args].join(' '),
        exitCode: exitCode ?? -1,
        success: !timedOut && exitCode === 0,
        timedOut,
        durationMs: Date.now() - startedAt,
        stdout: stdout.slice(0, MAX_BUILD_OUTPUT),
        stderr: stderr.slice(0, MAX_BUILD_OUTPUT),
        truncated: outputBytes >= MAX_BUILD_OUTPUT,
      }
      recordOperation('build.run', {
        profileId,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
      }, result.success ? 'success' : 'failed')
      resolve(result)
    })
  })
}

function extractPins(fileTexts) {
  const pins = []
  const seen = new Set()
  const definitions = [
    /#define\s+([A-Z0-9_]*(?:PIN|GPIO|SDA|SCL|MOSI|MISO|SCK|CS|TX|RX|TRIG|ECHO)[A-Z0-9_]*)\s+(-?\d+)/i,
    /(?:const|constexpr|static|int|uint8_t|gpio_num_t)\s+([A-Za-z0-9_]*(?:Pin|PIN|GPIO|SDA|SCL|MOSI|MISO|SCK|CS|TX|RX|Trig|Echo)[A-Za-z0-9_]*)\s*=\s*(-?\d+)/i,
  ]
  const calls = [
    { regex: /\bpinMode\s*\(\s*(-?\d+)\s*,/i, name: 'pinMode' },
    { regex: /\bdigitalWrite\s*\(\s*(-?\d+)\s*,/i, name: 'digitalWrite' },
    { regex: /\banalogRead\s*\(\s*(-?\d+)\s*\)/i, name: 'analogRead' },
  ]

  for (const file of fileTexts) {
    const lines = file.content.split(/\r?\n/)
    lines.forEach((line, index) => {
      for (const regex of definitions) {
        const match = line.match(regex)
        if (!match) continue
        const pin = Number(match[2])
        if (!Number.isFinite(pin) || pin < 0) continue
        const key = `${file.path}:${index}:${match[1]}:${pin}`
        if (!seen.has(key)) {
          seen.add(key)
          pins.push({ name: match[1], pin, path: file.path, line: index + 1, source: line.trim().slice(0, 160) })
        }
      }

      const wire = line.match(/\bWire\.begin\s*\(\s*(-?\d+)\s*,\s*(-?\d+)/i)
      if (wire) {
        [
          ['I2C_SDA', Number(wire[1])],
          ['I2C_SCL', Number(wire[2])],
        ].forEach(([name, pin]) => {
          if (!Number.isFinite(pin) || pin < 0) return
          const key = `${file.path}:${index}:${name}:${pin}`
          if (!seen.has(key)) {
            seen.add(key)
            pins.push({ name, pin, path: file.path, line: index + 1, source: line.trim().slice(0, 160) })
          }
        })
      }

      for (const call of calls) {
        const match = line.match(call.regex)
        if (!match) continue
        const pin = Number(match[1])
        if (!Number.isFinite(pin) || pin < 0) continue
        const key = `${file.path}:${index}:${call.name}:${pin}`
        if (!seen.has(key)) {
          seen.add(key)
          pins.push({ name: call.name, pin, path: file.path, line: index + 1, source: line.trim().slice(0, 160) })
        }
      }
    })
  }

  return pins.slice(0, 240)
}

function detectSecurityFindings(fileTexts) {
  const findings = []
  const patterns = [
    { id: 'wifi-password', severity: 'warning', regex: /\b(?:wifi_?)?(?:password|passwd|pwd)\b\s*(?:=|:)\s*["']([^"']{4,})["']/i, message: '检测到疑似硬编码 Wi-Fi 密码' },
    { id: 'api-key', severity: 'error', regex: /\b(?:api[_-]?key|access[_-]?token|secret[_-]?key)\b\s*(?:=|:)\s*["']([^"']{8,})["']/i, message: '检测到疑似硬编码 API Key 或访问令牌' },
    { id: 'mqtt-plain', severity: 'info', regex: /\bmqtt:\/\//i, message: '检测到明文 MQTT 连接，部署时建议评估 TLS' },
    { id: 'http-plain', severity: 'info', regex: /\bhttp:\/\/(?!127\.0\.0\.1|localhost)/i, message: '检测到明文 HTTP 外部连接，建议评估 HTTPS' },
  ]

  for (const file of fileTexts) {
    const lines = file.content.split(/\r?\n/)
    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        if (!pattern.regex.test(line)) continue
        if (/example|your_|changeme|xxxx|placeholder/i.test(line)) continue
        findings.push({
          id: pattern.id,
          severity: pattern.severity,
          message: pattern.message,
          path: file.path,
          line: index + 1,
        })
      }
    })
  }
  return findings.slice(0, 60)
}

function buildIssues({ primaryProjectType, chips, pins, scannedLimitHit, protocols, statistics, securityFindings }) {
  const issues = []
  if (!primaryProjectType) {
    issues.push({ severity: 'warning', message: '未识别出明确的嵌入式工程类型，可检查是否缺少 platformio.ini、CMakeLists.txt、.ino 或 .ioc 文件。' })
  }
  if (!chips.length) {
    issues.push({ severity: 'info', message: '未从工程中识别出明确芯片型号。' })
  }
  if (scannedLimitHit) {
    issues.push({ severity: 'warning', message: `扫描达到 ${MAX_SCAN_FILES} 个文本文件上限，结果可能不完整。` })
  }
  if (!protocols.length) {
    issues.push({ severity: 'info', category: 'connectivity', message: '未识别到 Wi-Fi、MQTT、BLE、LoRa 等物联网通信协议线索。' })
  }
  if (statistics.codeLines > 200 && statistics.commentRatio < 0.08) {
    issues.push({ severity: 'warning', category: 'maintainability', message: '代码注释比例偏低，建议补充关键模块、通信流程和异常处理说明。' })
  }
  for (const finding of securityFindings) {
    issues.push({
      severity: finding.severity,
      category: 'security',
      message: `${finding.message}：${finding.path}:${finding.line}`,
      path: finding.path,
      line: finding.line,
    })
  }

  const byPin = new Map()
  for (const item of pins) {
    if (!byPin.has(item.pin)) byPin.set(item.pin, [])
    byPin.get(item.pin).push(item)
  }
  for (const [pin, refs] of byPin.entries()) {
    const uniqueNames = unique(refs.map((r) => r.name))
    if (uniqueNames.length >= 3) {
      issues.push({
        severity: 'warning',
        category: 'hardware',
        message: `GPIO ${pin} 被多个名称引用：${uniqueNames.slice(0, 6).join('、')}，建议确认是否为真实复用或命名重复。`,
      })
    }
  }

  const chipText = chips.join(' ')
  if (/ESP32/.test(chipText)) {
    const bootPins = new Set([0, 2, 12, 15])
    for (const item of pins) {
      if (bootPins.has(item.pin)) {
        issues.push({
          severity: 'warning',
          category: 'hardware',
          message: `检测到 ESP32 启动相关 GPIO ${item.pin}：${item.name}，用于外设前建议确认上拉/下拉和启动电平。`,
        })
      }
    }
  }

  return issues.slice(0, 40)
}

function calculateHealthScore(issues, analysis) {
  let score = 100
  for (const issue of issues) {
    score -= issue.severity === 'error' ? 15 : issue.severity === 'warning' ? 7 : 2
  }
  if (!analysis.primaryProjectType) score -= 8
  if (!analysis.chips.length) score -= 5
  if (!analysis.keyFiles.length) score -= 5
  score = Math.max(0, Math.min(100, score))

  const dimensions = {
    structure: Math.max(0, 100 - (!analysis.primaryProjectType ? 35 : 0) - (!analysis.keyFiles.length ? 20 : 0)),
    hardware: Math.max(0, 100 - issues.filter((i) => i.category === 'hardware').length * 12),
    security: Math.max(0, 100 - issues.filter((i) => i.category === 'security').reduce((sum, i) => sum + (i.severity === 'error' ? 25 : 12), 0)),
    maintainability: Math.max(0, 100 - issues.filter((i) => i.category === 'maintainability').length * 18),
    connectivity: analysis.protocols.length ? 100 : 55,
  }
  return { score, dimensions }
}

function buildRecommendations(analysis, issues) {
  const recommendations = []
  if (!analysis.primaryProjectType) recommendations.push({ priority: 'high', title: '补全工程入口配置', detail: '增加 platformio.ini、CMakeLists.txt、.ino 或 .ioc 等明确的工程描述文件。' })
  if (!analysis.chips.length) recommendations.push({ priority: 'high', title: '明确目标芯片', detail: '在工程配置或 README 中记录具体芯片型号、主频、Flash 和引脚约束。' })
  if (!analysis.protocols.length) recommendations.push({ priority: 'medium', title: '补充物联网通信层', detail: '根据课题选择 MQTT、HTTP、BLE、LoRaWAN 等协议，并设计断线重连与数据上报策略。' })
  if (analysis.statistics.codeLines > 200 && analysis.statistics.commentRatio < 0.08) {
    recommendations.push({ priority: 'medium', title: '完善代码可维护性', detail: '为初始化流程、传感器采集、通信状态机和异常恢复补充注释与模块说明。' })
  }
  if (issues.some((i) => i.category === 'security')) {
    recommendations.push({ priority: 'high', title: '移除硬编码凭据', detail: '将 Wi-Fi 密码、API Key 和 Token 移出源码，改用本地配置、环境变量或设备配网流程。' })
  }
  if (analysis.pins.length) recommendations.push({ priority: 'low', title: '固化引脚资源表', detail: '将扫描到的 GPIO 与芯片限制表对照，形成论文中的硬件资源分配表。' })
  if (!recommendations.length) recommendations.push({ priority: 'low', title: '保持工程基线', detail: '当前未发现明显结构问题，建议继续补充自动化构建和硬件在环测试记录。' })
  return recommendations.slice(0, 12)
}

async function analyzeWorkspace() {
  const root = requireWorkspace()
  const scan = await walk(root)
  const fileTexts = []
  const contentsByPath = new Map()

  for (const filePath of scan.files) {
    let stat
    try {
      stat = await fs.stat(filePath)
      if (stat.size > MAX_SEARCH_BYTES) continue
      const content = await fs.readFile(filePath, 'utf8')
      const rel = toRelative(filePath)
      fileTexts.push({ path: rel, content })
      contentsByPath.set(filePath, content)
    } catch {
      continue
    }
  }

  const allText = fileTexts.map((item) => `${item.path}\n${item.content}`).join('\n')
  const projectTypes = detectProjectTypes(scan.files, contentsByPath)
  const chips = detectChips(allText)
  const peripherals = detectPeripherals(fileTexts)
  const protocols = detectIoTProtocols(fileTexts)
  const dependencies = extractDependencies(fileTexts)
  const statistics = calculateStatistics(fileTexts)
  const pins = extractPins(fileTexts)
  const securityFindings = detectSecurityFindings(fileTexts)
  const build = await detectBuildProfiles()
  const keyFiles = scan.files
    .filter((filePath) => IMPORTANT_NAMES.has(path.basename(filePath)) || /\.(ino|ioc)$/i.test(filePath))
    .map((filePath) => toRelative(filePath))
    .slice(0, 80)

  const analysis = {
    workspaceRoot: root,
    scannedAt: Date.now(),
    totalFiles: scan.totalFiles,
    analyzedFiles: fileTexts.length,
    scannedLimitHit: scan.files.length >= MAX_SCAN_FILES,
    projectTypes,
    primaryProjectType: projectTypes[0] ?? '',
    chips,
    peripherals,
    protocols,
    dependencies,
    statistics,
    pins,
    securityFindings,
    buildProfiles: build.profiles,
    keyFiles,
  }

  const issues = buildIssues(analysis)
  const health = calculateHealthScore(issues, analysis)
  const recommendations = buildRecommendations(analysis, issues)
  recordOperation('workspace.analyze', {
    totalFiles: analysis.totalFiles,
    analyzedFiles: analysis.analyzedFiles,
    score: health.score,
  })

  return {
    ...analysis,
    issues,
    health,
    recommendations,
  }
}

function generateMarkdownReport(analysis) {
  const lines = [
    '# MetaCore AI 本地工程诊断报告',
    '',
    `- 工作区：${analysis.workspaceRoot}`,
    `- 扫描时间：${new Date(analysis.scannedAt).toLocaleString('zh-CN')}`,
    `- 工程类型：${analysis.projectTypes.join(' / ') || '未识别'}`,
    `- 芯片：${analysis.chips.join(' / ') || '未识别'}`,
    `- 健康评分：${analysis.health.score}/100`,
    `- 文件统计：共 ${analysis.totalFiles} 个文件，分析 ${analysis.analyzedFiles} 个文本文件`,
    `- 代码规模：${analysis.statistics.totalLines} 行，其中代码 ${analysis.statistics.codeLines} 行、注释 ${analysis.statistics.commentLines} 行`,
    '',
    '## 物联网能力',
    '',
    ...(analysis.protocols.length ? analysis.protocols.map((item) => `- ${item.label}：${item.files.join('、')}`) : ['- 未识别到通信协议']),
    '',
    '## 外设与总线',
    '',
    ...(analysis.peripherals.length ? analysis.peripherals.map((item) => `- ${item.label}：${item.files.join('、')}`) : ['- 未识别到外设线索']),
    '',
    '## 引脚资源',
    '',
    '| 名称 | GPIO | 文件 | 行号 |',
    '|---|---:|---|---:|',
    ...analysis.pins.slice(0, 80).map((pin) => `| ${pin.name} | ${pin.pin} | ${pin.path} | ${pin.line} |`),
    '',
    '## 风险与问题',
    '',
    ...(analysis.issues.length ? analysis.issues.map((issue) => `- [${issue.severity.toUpperCase()}] ${issue.message}`) : ['- 未发现明显风险']),
    '',
    '## 改进建议',
    '',
    ...analysis.recommendations.map((item) => `- [${item.priority.toUpperCase()}] **${item.title}**：${item.detail}`),
    '',
    '## 依赖摘要',
    '',
    ...analysis.dependencies.slice(0, 80).map((dep) => `- ${dep.name}（${dep.kind}）`),
    '',
    '> 本报告由 MetaCore AI 本地工程分析模块生成，自动判断结果应结合芯片数据手册与实物测试复核。',
  ]
  return lines.join('\n')
}

async function setWorkspace(root) {
  if (!root || typeof root !== 'string') {
    const err = new Error('工作区路径不能为空')
    err.status = 400
    throw err
  }
  const resolved = path.resolve(root)
  const stat = await fs.stat(resolved)
  if (!stat.isDirectory()) {
    const err = new Error('工作区必须是文件夹')
    err.status = 400
    throw err
  }
  workspaceRoot = resolved
  await saveConfig()
  recordOperation('workspace.set', { workspaceRoot })
  return { workspaceRoot }
}

async function route(req, res) {
  const origin = req.headers.origin ?? ''
  ensureLocalOrigin(req)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin))
    res.end()
    return
  }

  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`)
  if (req.method === 'GET' && url.pathname === '/api/health') {
    json(res, 200, { ok: true, service: 'metacore-local', workspaceRoot, port: PORT }, origin)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/system/info') {
    json(res, 200, await getSystemInfo(), origin)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/logs') {
    json(res, 200, { logs: operationLog }, origin)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/workspace/current') {
    json(res, 200, { workspaceRoot }, origin)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/workspace/set') {
    const body = await readBody(req)
    json(res, 200, await setWorkspace(body.root), origin)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/files/list') {
    json(res, 200, await listDir(url.searchParams.get('dir') ?? ''), origin)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/files/read') {
    json(res, 200, await readFile(url.searchParams.get('path') ?? ''), origin)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/files/write') {
    const body = await readBody(req)
    json(res, 200, await writeFileSafely(body.path, body.content, body.expectedModifiedAt), origin)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/files/search') {
    const body = await readBody(req)
    json(res, 200, await searchFiles(body.query, body.maxResults), origin)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/analyze') {
    json(res, 200, await analyzeWorkspace(), origin)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/backups/list') {
    json(res, 200, await listBackups(), origin)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/backups/restore') {
    const body = await readBody(req)
    json(res, 200, await restoreBackup(body.backupId), origin)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/build/detect') {
    json(res, 200, await detectBuildProfiles(), origin)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/build/run') {
    const body = await readBody(req)
    json(res, 200, await runBuildProfile(body.profileId), origin)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/report') {
    const analysis = await analyzeWorkspace()
    json(res, 200, { analysis, markdown: generateMarkdownReport(analysis) }, origin)
    return
  }

  json(res, 404, { error: '接口不存在' }, origin)
}

await loadConfig()

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    const origin = req.headers.origin ?? ''
    const status = err.status || 500
    json(res, status, { error: err.message || '本地服务异常' }, origin)
  })
})

server.listen(PORT, HOST, () => {
  console.log(`MetaCore local server listening at http://${HOST}:${PORT}`)
  if (workspaceRoot) {
    console.log(`Workspace: ${workspaceRoot}`)
  }
})
