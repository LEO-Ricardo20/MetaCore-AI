import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const HOST = '127.0.0.1'
export const PORT = Number(process.env.METACORE_LOCAL_PORT ?? 3766)

export const LIMITS = Object.freeze({
  readBytes: 2 * 1024 * 1024,
  bodyBytes: 3 * 1024 * 1024,
  searchBytes: 512 * 1024,
  scanFiles: 1800,
  scanDepth: 8,
  buildOutputBytes: 512 * 1024,
  // First-time PlatformIO/ESP-IDF toolchain installation can take several
  // minutes on Windows. Keep the limit bounded and configurable instead of
  // silently waiting forever.
  buildTimeoutMs: Math.max(30 * 1000, Math.min(10 * 60 * 1000, Number(process.env.METACORE_BUILD_TIMEOUT_MS ?? 5 * 60 * 1000))),
})

const serverDir = path.dirname(fileURLToPath(import.meta.url))

export const CONFIG_PATH = process.env.METACORE_LOCAL_CONFIG
  || path.join(serverDir, '.metacore-local.json')

export const PACKAGE_META = JSON.parse(
  await fs.readFile(path.join(serverDir, '..', 'package.json'), 'utf8'),
)
