const MAX_EVENTS_PER_CHANNEL = 2_000

export class AgentEventBus {
  #sequence = 0
  #events = new Map()
  #listeners = new Map()

  emit(type, data = {}, meta = {}) {
    const event = {
      id: ++this.#sequence,
      type,
      timestamp: Date.now(),
      requestId: meta.requestId,
      jobId: meta.jobId,
      sessionId: meta.sessionId,
      data,
    }
    const channels = new Set(['global', meta.jobId && `job:${meta.jobId}`, meta.sessionId && `session:${meta.sessionId}`].filter(Boolean))
    for (const channel of channels) {
      const events = this.#events.get(channel) ?? []
      events.push(event)
      if (events.length > MAX_EVENTS_PER_CHANNEL) events.splice(0, events.length - MAX_EVENTS_PER_CHANNEL)
      this.#events.set(channel, events)
      for (const listener of this.#listeners.get(channel) ?? []) listener(event)
    }
    return event
  }

  getEvents(channel, afterId = 0) {
    return (this.#events.get(channel) ?? []).filter((event) => event.id > Number(afterId || 0))
  }

  subscribe(channel, listener) {
    const listeners = this.#listeners.get(channel) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(channel, listeners)
    return () => {
      listeners.delete(listener)
      if (!listeners.size) this.#listeners.delete(channel)
    }
  }
}
