import { AgentError } from './errors.mjs'

export const DEFAULT_TOOL_POLICY = Object.freeze({
  read: true,
  write: false,
  build: false,
  export: false,
  requiresApproval: false,
})

export function assertToolPermission(tool, context = {}) {
  const permissions = { ...DEFAULT_TOOL_POLICY, ...(tool.permissions ?? {}) }
  if (permissions.write && !context.allowWrite) throw new AgentError('TOOL_WRITE_FORBIDDEN', '当前任务没有文件写入权限', { status: 403 })
  if (permissions.build && !context.allowBuild) throw new AgentError('TOOL_BUILD_FORBIDDEN', '当前任务没有构建权限', { status: 403 })
  if (permissions.export && !context.allowExport) throw new AgentError('TOOL_EXPORT_FORBIDDEN', '当前任务没有导出权限', { status: 403 })
  if (permissions.requiresApproval && !context.approved) throw new AgentError('TOOL_APPROVAL_REQUIRED', '该操作需要用户批准', { status: 428, details: { tool: tool.name } })
  return permissions
}

export function assertNotCancelled(signal) {
  if (signal?.aborted) throw new DOMException('任务已取消', 'AbortError')
}
