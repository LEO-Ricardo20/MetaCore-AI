import { AgentError } from '../errors.mjs'

export class InternalAgentRuntime {
  constructor({ aiProvider }) {
    this.aiProvider = aiProvider
  }

  status() {
    return {
      id: 'internal',
      label: 'MetaCore Internal',
      ready: true,
      experimental: false,
      capabilities: ['single-turn-ai', 'metacore-jobs', 'metacore-tools'],
    }
  }

  async runTask(input, context) {
    if (!input?.service || !Array.isArray(input.service ? input.messages : null) && !input.goal) {
      throw new AgentError('INTERNAL_RUNTIME_INPUT_REQUIRED', 'Internal Runtime 需要 AI 服务配置和任务目标', { status: 400 })
    }
    const messages = Array.isArray(input.messages) && input.messages.length
      ? input.messages
      : [
          { role: 'system', content: 'You are MetaCore Studio, an embedded hardware and firmware engineering assistant. Return concrete, verifiable engineering guidance.' },
          { role: 'user', content: String(input.goal || '') },
        ]
    await context.emit('agent.status', { runtime: 'internal', status: 'running' })
    const result = await this.aiProvider.call(input.service, messages, input.temperature, { signal: context.signal, taskType: 'agent-task' })
    await context.emit('agent.output', { runtime: 'internal', text: result.content || '' })
    await context.emit('agent.status', { runtime: 'internal', status: 'idle' })
    return { runtime: 'internal', finalResponse: result.content || '', providerResult: result }
  }
}
