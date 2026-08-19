import { AgentError } from './errors.mjs'

export class PluginRegistry {
  #plugins = new Map()

  register(plugin) {
    const required = ['id', 'version', 'provides', 'requires', 'tools', 'permissions', 'lifecycleHooks']
    for (const field of required) {
      if (plugin?.[field] === undefined) throw new AgentError('PLUGIN_MANIFEST_INVALID', `插件缺少字段：${field}`, { status: 400 })
    }
    if (this.#plugins.has(plugin.id)) throw new AgentError('PLUGIN_ALREADY_REGISTERED', `插件已注册：${plugin.id}`, { status: 409 })
    const manifest = Object.freeze({ ...plugin, provides: [...plugin.provides], requires: [...plugin.requires], tools: [...plugin.tools], lifecycleHooks: [...plugin.lifecycleHooks] })
    this.#plugins.set(plugin.id, manifest)
    return manifest
  }

  get(id) { return this.#plugins.get(id) ?? null }
  list() { return [...this.#plugins.values()] }
}

export function createDefaultPluginRegistry() {
  const registry = new PluginRegistry()
  registry.register({
    id: 'metacore.internal',
    version: '1.0.0',
    provides: ['ai', 'workspace', 'hardware-analysis', 'firmware-generation', 'build', 'backup', 'export'],
    requires: [],
    tools: ['inspect_project', 'read_file', 'search_files', 'propose_hardware_scheme', 'validate_pin_assignment', 'generate_firmware', 'validate_code_consistency', 'generate_flow', 'run_local_analysis', 'run_build', 'write_file', 'create_backup', 'restore_backup', 'export_project'],
    permissions: { read: true, write: true, build: true, export: true, requiresApproval: true },
    lifecycleHooks: ['session.created', 'stage.started', 'stage.completed', 'stage.failed'],
  })
  return registry
}
