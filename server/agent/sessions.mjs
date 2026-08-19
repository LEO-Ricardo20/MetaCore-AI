import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

const SECRET_KEY = /(authorization|api[-_]?key|access[-_]?token|secret|password|passwd|private[-_]?key|token)/i

export function redactSensitive(value) {
  if (Array.isArray(value)) return value.map(redactSensitive)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET_KEY.test(key) ? '[REDACTED]' : redactSensitive(item)]))
  if (typeof value === 'string') return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [REDACTED]')
    .replace(/(?:sk|key|token|secret)[-_]?[A-Za-z0-9]{8,}/gi, '[REDACTED]')
  return value
}

function defaultRoot() {
  return process.env.METACORE_SESSION_ROOT
    || (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'MetaCore Studio', 'sessions') : path.join(os.homedir(), '.metacore-studio', 'sessions'))
}

export class SessionStore {
  constructor(root = defaultRoot(), eventBus) { this.root = root; this.eventBus = eventBus; this.sessions = new Map() }

  async init() { await fs.mkdir(this.root, { recursive: true }) }

  async create(projectId, metadata = {}) {
    await this.init()
    const session = { id: crypto.randomUUID(), projectId: String(projectId || ''), status: 'active', createdAt: Date.now(), updatedAt: Date.now(), lastEventId: 0, jobIds: [], metadata: redactSensitive(metadata) }
    this.sessions.set(session.id, session)
    await this.#persist(session)
    const event = this.eventBus?.emit('session.created', { projectId: session.projectId }, { sessionId: session.id })
    if (event) await this.append(session.id, event)
    return session
  }

  async get(id) {
    if (this.sessions.has(id)) return this.sessions.get(id)
    try {
      const session = JSON.parse(await fs.readFile(path.join(this.root, `${id}.json`), 'utf8'))
      this.sessions.set(id, session)
      return session
    } catch { return null }
  }

  async list({ projectId, status } = {}) {
    await this.init()
    const sessions = new Map(this.sessions)
    try {
      const entries = await fs.readdir(this.root, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue
        const id = entry.name.slice(0, -5)
        if (sessions.has(id)) continue
        try {
          const session = JSON.parse(await fs.readFile(path.join(this.root, entry.name), 'utf8'))
          this.sessions.set(session.id, session)
          sessions.set(session.id, session)
        } catch { /* ignore malformed historical sessions */ }
      }
    } catch { /* root is created by init */ }
    return [...sessions.values()]
      .filter((session) => projectId === undefined || session.projectId === String(projectId))
      .filter((session) => status === undefined || session.status === String(status))
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((session) => structuredClone(session))
  }

  async append(sessionId, event) {
    const session = await this.get(sessionId)
    if (!session) return
    session.lastEventId = Math.max(session.lastEventId, Number(event.id || 0))
    session.updatedAt = Date.now()
    if (event.jobId && !session.jobIds.includes(event.jobId)) session.jobIds.push(event.jobId)
    const safe = redactSensitive(event)
    await fs.appendFile(path.join(this.root, `${sessionId}.jsonl`), `${JSON.stringify(safe)}\n`, 'utf8')
    await this.#persist(session)
  }

  async update(id, updates) {
    const session = await this.get(id)
    if (!session) return null
    Object.assign(session, redactSensitive(updates), { updatedAt: Date.now() })
    await this.#persist(session)
    return session
  }

  async cleanup(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    await this.init()
    const entries = await fs.readdir(this.root, { withFileTypes: true })
    const cutoff = Date.now() - maxAgeMs
    for (const entry of entries) {
      if (!entry.name.endsWith('.json')) continue
      try {
        const session = JSON.parse(await fs.readFile(path.join(this.root, entry.name), 'utf8'))
        if (session.updatedAt < cutoff) {
          await fs.rm(path.join(this.root, entry.name), { force: true })
          await fs.rm(path.join(this.root, entry.name.replace(/\.json$/, '.jsonl')), { force: true })
        }
      } catch { /* ignore corrupted historical sessions */ }
    }
  }

  async #persist(session) { await fs.writeFile(path.join(this.root, `${session.id}.json`), JSON.stringify(redactSensitive(session), null, 2), 'utf8') }
}
