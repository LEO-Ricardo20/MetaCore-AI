export class AgentError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause })
    this.name = 'AgentError'
    this.code = code
    this.status = options.status ?? 500
    this.retryable = Boolean(options.retryable)
    this.details = options.details
  }
}

export function normalizeAgentError(error, fallbackCode = 'AGENT_INTERNAL_ERROR') {
  if (error instanceof AgentError) return error
  if (error?.name === 'AbortError') return new AgentError('JOB_CANCELLED', '任务已取消', { status: 409 })
  return new AgentError(fallbackCode, error?.message || 'Agent 运行失败', { cause: error, retryable: false })
}

export function errorPayload(error, requestId) {
  const normalized = normalizeAgentError(error)
  return {
    code: normalized.code,
    message: normalized.message,
    retryable: normalized.retryable,
    requestId,
    details: normalized.details,
  }
}
