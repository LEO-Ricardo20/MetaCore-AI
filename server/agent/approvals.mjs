import crypto from 'node:crypto'
import { AgentError } from './errors.mjs'
import { redactSensitive } from './sessions.mjs'

export class ApprovalStore {
  constructor({ eventBus, sessions } = {}) {
    this.eventBus = eventBus
    this.sessions = sessions
    this.items = new Map()
  }

  async create(input) {
    const approval = {
      id: crypto.randomUUID(),
      projectId: String(input.projectId || ''),
      sessionId: String(input.sessionId || ''),
      jobId: String(input.jobId || ''),
      runtime: String(input.runtime || 'deepseek-harness'),
      toolName: String(input.toolName || ''),
      kind: String(input.kind || 'action'),
      title: String(input.title || 'Agent 请求执行操作'),
      reason: String(input.reason || ''),
      risk: String(input.risk || 'medium'),
      args: redactSensitive(input.args ?? {}),
      preview: redactSensitive(input.preview ?? null),
      status: 'pending',
      createdAt: Date.now(),
    }
    this.items.set(approval.id, approval)
    await this.#emit(approval, 'approval.requested', {
      approvalId: approval.id,
      toolName: approval.toolName,
      kind: approval.kind,
      title: approval.title,
      risk: approval.risk,
    })
    return this.#public(approval)
  }

  get(id) {
    const approval = this.items.get(id)
    return approval ? this.#public(approval) : null
  }

  list({ projectId, status } = {}) {
    return [...this.items.values()]
      .filter((item) => projectId === undefined || item.projectId === String(projectId))
      .filter((item) => status === undefined || item.status === String(status))
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((item) => this.#public(item))
  }

  async decide(id, decision, execute) {
    const approval = this.items.get(id)
    if (!approval) throw new AgentError('APPROVAL_NOT_FOUND', '审批项不存在', { status: 404 })
    if (approval.status !== 'pending') throw new AgentError('APPROVAL_ALREADY_DECIDED', '审批项已经处理', { status: 409 })
    if (!['approved', 'rejected'].includes(decision)) throw new AgentError('APPROVAL_DECISION_INVALID', '审批决定无效', { status: 400 })

    approval.status = decision
    approval.decidedAt = Date.now()
    await this.#emit(approval, `approval.${decision}`, {
      approvalId: approval.id,
      toolName: approval.toolName,
    })
    if (decision === 'rejected') return this.#public(approval)

    try {
      approval.result = redactSensitive(await execute(approval))
      approval.status = 'executed'
      approval.executedAt = Date.now()
      await this.#emit(approval, 'approval.executed', {
        approvalId: approval.id,
        toolName: approval.toolName,
      })
    } catch (error) {
      approval.status = 'failed'
      approval.error = error?.message || '批准后的操作执行失败'
      approval.failedAt = Date.now()
      await this.#emit(approval, 'approval.failed', {
        approvalId: approval.id,
        toolName: approval.toolName,
        message: approval.error,
      })
      throw error
    }
    return this.#public(approval)
  }

  async #emit(approval, type, data) {
    const event = this.eventBus?.emit(type, data, {
      jobId: approval.jobId || undefined,
      sessionId: approval.sessionId || undefined,
    })
    if (event && approval.sessionId) await this.sessions?.append(approval.sessionId, event)
  }

  #public(approval) {
    return structuredClone(approval)
  }
}
