import { AgentError } from '../errors.mjs'

export class AgentRuntimeManager {
  constructor({ selected = 'deepseek-harness', runtimes = [] } = {}) {
    this.selected = selected
    this.runtimes = new Map(runtimes.map((runtime) => [runtime.status().id, runtime]))
  }

  status() {
    return {
      selected: this.selected,
      runtimes: [...this.runtimes.values()].map((runtime) => runtime.status()),
    }
  }

  async runTask(input, context) {
    const runtimeId = String(input?.runtime || this.selected)
    const runtime = this.runtimes.get(runtimeId)
    if (!runtime) throw new AgentError('AGENT_RUNTIME_UNKNOWN', `未知 Agent Runtime：${runtimeId}`, { status: 400 })
    return runtime.runTask(input, context)
  }

  async close() {
    await Promise.allSettled([...this.runtimes.values()].map((runtime) => runtime.close?.()))
  }
}
