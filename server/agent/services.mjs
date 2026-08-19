import { AgentError } from './errors.mjs'

export class ServiceRegistry {
  #definitions = new Map()
  #providers = new Map()

  define(definition) {
    if (!definition?.id || typeof definition.id !== 'string') throw new AgentError('SERVICE_DEFINITION_INVALID', '服务定义缺少 id', { status: 400 })
    this.#definitions.set(definition.id, Object.freeze({ ...definition }))
    return definition
  }

  provide(serviceId, providerId, provider) {
    if (!this.#definitions.has(serviceId)) throw new AgentError('SERVICE_NOT_DEFINED', `服务未定义：${serviceId}`, { status: 400 })
    if (!providerId || typeof provider !== 'object') throw new AgentError('SERVICE_PROVIDER_INVALID', '服务 Provider 无效', { status: 400 })
    this.#providers.set(`${serviceId}:${providerId}`, provider)
    return provider
  }

  get(serviceId, providerId = 'default') {
    const provider = this.#providers.get(`${serviceId}:${providerId}`)
    if (!provider) throw new AgentError('SERVICE_PROVIDER_NOT_FOUND', `服务 Provider 不存在：${serviceId}/${providerId}`, { status: 404 })
    return provider
  }

  list() {
    return [...this.#definitions.values()].map((definition) => ({
      ...definition,
      providers: [...this.#providers.keys()].filter((key) => key.startsWith(`${definition.id}:`)).map((key) => key.slice(definition.id.length + 1)),
    }))
  }
}
