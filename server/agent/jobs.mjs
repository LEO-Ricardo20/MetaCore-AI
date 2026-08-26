import crypto from 'node:crypto'
import { AgentError, normalizeAgentError } from './errors.mjs'

export class JobManager {
  constructor({ eventBus, sessions, executors = {}, concurrency = 2 } = {}) {
    this.eventBus = eventBus
    this.sessions = sessions
    this.executors = executors
    this.concurrency = concurrency
    this.activeCount = 0
    this.queue = []
    this.jobs = new Map()
  }

  register(stage, executor) { this.executors[stage] = executor }

  async create({ projectId, stage, sessionId, payload = {} }) {
    if (!this.executors[stage]) throw new AgentError('JOB_STAGE_UNSUPPORTED', `不支持的任务阶段：${stage}`, { status: 400 })
    const normalizedProjectId = String(projectId || '')
    const activeDuplicate = [...this.jobs.values()].find((candidate) => (
      candidate.projectId === normalizedProjectId
      && candidate.stage === stage
      && ['waiting', 'running'].includes(candidate.status)
    ))
    if (activeDuplicate) {
      throw new AgentError('JOB_ALREADY_RUNNING', `该项目的 ${stage} 任务已经在运行`, {
        status: 409,
        details: { jobId: activeDuplicate.id, stage },
      })
    }
    const job = { id: crypto.randomUUID(), projectId: normalizedProjectId, stage, status: 'waiting', createdAt: Date.now(), progress: 0, currentAction: '等待执行', retryCount: 0, sessionId: String(sessionId || ''), payload }
    this.jobs.set(job.id, job)
    this.queue.push(job.id)
    await this.sessions?.append(sessionId, this.eventBus.emit('stage.started', { stage, status: 'waiting' }, { jobId: job.id, sessionId }))
    this.#drain()
    return this.#public(job)
  }

  get(id) { const job = this.jobs.get(id); return job ? this.#public(job) : null }

  list({ projectId, sessionId, status } = {}) {
    return [...this.jobs.values()]
      .filter((job) => projectId === undefined || job.projectId === String(projectId))
      .filter((job) => sessionId === undefined || job.sessionId === String(sessionId))
      .filter((job) => status === undefined || job.status === String(status))
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((job) => this.#public(job))
  }

  events(id, afterId = 0) { return this.eventBus.getEvents(`job:${id}`, afterId) }

  async cancel(id) {
    const job = this.jobs.get(id)
    if (!job) throw new AgentError('JOB_NOT_FOUND', '任务不存在', { status: 404 })
    if (['succeeded', 'failed', 'cancelled'].includes(job.status)) return this.#public(job)
    job.cancelRequested = true
    job.controller?.abort()
    if (job.status === 'waiting') {
      job.status = 'cancelled'; job.finishedAt = Date.now(); job.currentAction = '已取消'; job.errorCode = 'JOB_CANCELLED'; job.errorMessage = '任务已取消'; job.retryable = false
      await this.#persistEvent(job, 'job.cancelled', { stage: job.stage })
      this.#drain()
    }
    return this.#public(job)
  }

  async retry(id) {
    const job = this.jobs.get(id)
    if (!job) throw new AgentError('JOB_NOT_FOUND', '任务不存在', { status: 404 })
    if (!['failed', 'cancelled'].includes(job.status)) throw new AgentError('JOB_NOT_RETRYABLE', '当前任务尚未失败，不能重试', { status: 409 })
    job.status = 'waiting'; job.progress = 0; job.currentAction = '等待重试'; job.errorCode = undefined; job.errorMessage = undefined; job.finishedAt = undefined; job.startedAt = undefined; job.durationMs = undefined; job.result = undefined; job.retryCount += 1; job.cancelRequested = false
    await this.#persistEvent(job, 'stage.started', { stage: job.stage, status: 'waiting', retryCount: job.retryCount })
    this.queue.push(job.id); this.#drain()
    return this.#public(job)
  }

  #drain() {
    while (this.activeCount < this.concurrency && this.queue.length) {
      const id = this.queue.shift()
      const job = this.jobs.get(id)
      if (!job || job.status !== 'waiting') continue
      this.#run(job).catch(() => {})
    }
  }

  async #run(job) {
    this.activeCount += 1
    job.status = 'running'; job.startedAt = Date.now(); job.currentAction = '正在执行'; job.controller = new AbortController()
    await this.#persistEvent(job, 'stage.started', { stage: job.stage, status: 'running' })
    try {
      const result = await this.executors[job.stage](job.payload, {
        signal: job.controller.signal,
        job: this.#public(job),
        emit: (type, data) => this.#persistEvent(job, type, data),
        progress: async (progress, currentAction) => {
          if (job.controller.signal.aborted) throw new DOMException('任务已取消', 'AbortError')
          job.progress = Math.max(0, Math.min(100, Number(progress) || 0)); job.currentAction = currentAction || job.currentAction
          await this.#persistEvent(job, 'stage.progress', { stage: job.stage, progress: job.progress, currentAction: job.currentAction })
        },
      })
      if (job.controller.signal.aborted || job.cancelRequested) throw new DOMException('任务已取消', 'AbortError')
      job.status = 'succeeded'; job.progress = 100; job.currentAction = '已完成'; job.result = result; job.finishedAt = Date.now(); job.durationMs = job.finishedAt - job.startedAt
      await this.#persistEvent(job, 'stage.completed', { stage: job.stage, result, durationMs: job.durationMs })
    } catch (error) {
      const normalized = normalizeAgentError(error, 'JOB_EXECUTION_FAILED')
      const cancelled = normalized.code === 'JOB_CANCELLED' || job.cancelRequested || job.controller.signal.aborted
      job.status = cancelled ? 'cancelled' : 'failed'; job.currentAction = cancelled ? '已取消' : '执行失败'; job.errorCode = cancelled ? 'JOB_CANCELLED' : normalized.code; job.errorMessage = cancelled ? '任务已取消' : normalized.message; job.retryable = cancelled ? false : normalized.retryable; job.finishedAt = Date.now(); job.durationMs = job.finishedAt - job.startedAt
      await this.#persistEvent(job, cancelled ? 'job.cancelled' : 'stage.failed', { stage: job.stage, code: job.errorCode, message: job.errorMessage })
    } finally {
      this.activeCount -= 1
      delete job.controller
      this.#drain()
    }
  }

  async #persistEvent(job, type, data) {
    const event = this.eventBus.emit(type, data, { jobId: job.id, sessionId: job.sessionId })
    await this.sessions?.append(job.sessionId, event)
  }

  #public(job) {
    const safe = { ...job }
    delete safe.controller
    delete safe.cancelRequested
    delete safe.payload
    return structuredClone(safe)
  }
}
