import { AgentError, normalizeAgentError } from './errors.mjs'
import { assertNotCancelled, assertToolPermission } from './policy.mjs'

export class ToolRegistry {
  #tools = new Map()
  constructor(eventBus) { this.eventBus = eventBus }

  register(tool) {
    if (!tool?.name || typeof tool.execute !== 'function') throw new AgentError('TOOL_DEFINITION_INVALID', '工具定义无效', { status: 400 })
    this.#tools.set(tool.name, tool)
    return tool
  }

  list() {
    return [...this.#tools.values()].map((registered) => {
      const tool = { ...registered }
      delete tool.execute
      return tool
    })
  }

  async execute(name, args, context = {}) {
    const tool = this.#tools.get(name)
    if (!tool) throw new AgentError('TOOL_NOT_FOUND', `工具不存在：${name}`, { status: 404 })
    const meta = { requestId: context.requestId, jobId: context.jobId, sessionId: context.sessionId }
    this.eventBus.emit('tool.before', { tool: name, args: tool.redactArgs?.(args) ?? args }, meta)
    try {
      assertNotCancelled(context.signal)
      if (tool.validate) await tool.validate(args)
      const permissions = assertToolPermission(tool, context)
      if (permissions.requiresApproval) this.eventBus.emit('tool.approval-required', { tool: name }, meta)
      if (tool.checkWorkspace) await tool.checkWorkspace(args, context)
      assertNotCancelled(context.signal)
      this.eventBus.emit('tool.executing', { tool: name }, meta)
      const startedAt = Date.now()
      const value = await tool.execute(args, context)
      assertNotCancelled(context.signal)
      const result = tool.normalizeResult ? tool.normalizeResult(value) : value
      this.eventBus.emit('tool.completed', { tool: name, durationMs: Date.now() - startedAt, result }, meta)
      return result
    } catch (error) {
      const normalized = normalizeAgentError(error, 'TOOL_EXECUTION_FAILED')
      this.eventBus.emit('tool.failed', { tool: name, code: normalized.code, message: normalized.message }, meta)
      throw normalized
    }
  }
}
