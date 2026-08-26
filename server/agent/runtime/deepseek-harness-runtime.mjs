import fs from 'node:fs'
import path from 'node:path'
import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client'
import { AgentError } from '../errors.mjs'

export class DeepSeekHarnessRuntime {
  constructor(options) {
    this.harnessRoot = options.harnessRoot
    this.configPath = options.configPath
    this.pluginPath = options.pluginPath
    this.sessionRoot = options.sessionRoot
    this.bridgeUrl = options.bridgeUrl
    this.bridgeToken = options.bridgeToken
    this.workspace = options.workspace
    this.active = new Set()
  }

  status() {
    const packagePath = path.join(this.harnessRoot, 'package.json')
    const sourceBin = path.join(this.harnessRoot, 'packages', 'examples', 'jsonrpc-demo', 'src', 'packaged-bin.ts')
    const tsxPath = path.join(this.harnessRoot, 'node_modules', 'tsx')
    const sourceAvailable = fs.existsSync(packagePath) && fs.existsSync(sourceBin)
    const dependenciesInstalled = fs.existsSync(tsxPath)
    const configAvailable = fs.existsSync(this.configPath) && fs.existsSync(this.pluginPath)
    return {
      id: 'deepseek-harness',
      label: 'DeepSeek Harness',
      ready: sourceAvailable && dependenciesInstalled && configAvailable,
      experimental: true,
      sourceAvailable,
      dependenciesInstalled,
      configAvailable,
      credentialConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
      acceptsTaskCredential: true,
      harnessRoot: this.harnessRoot,
      configPath: this.configPath,
      version: readVersion(packagePath),
      capabilities: ['agent-loop', 'cordis-plugins', 'session-events', 'subagents', 'metacore-tool-bridge'],
    }
  }

  async runTask(input, context) {
    const state = this.status()
    if (!state.ready) {
      throw new AgentError('HARNESS_RUNTIME_NOT_READY', 'DeepSeek Harness 源码或依赖尚未准备完成', { status: 503, details: state })
    }
    const goal = String(input?.goal || '').trim()
    if (!goal) throw new AgentError('AGENT_GOAL_REQUIRED', '请输入 Agent 任务目标', { status: 400 })
    const workspaceRoot = this.workspace()
    if (!workspaceRoot) throw new AgentError('WORKSPACE_REQUIRED', '请先授权一个本地工程目录', { status: 400 })

    const taskService = input?.service && typeof input.service === 'object' ? input.service : null
    if (taskService && !isHarnessCompatibleService(taskService)) {
      throw new AgentError('HARNESS_PROVIDER_UNSUPPORTED', 'DeepSeek Harness 接受官方 DeepSeek，或硅基流动中的 DeepSeek 模型，并且服务协议必须是 Chat Completions。其他模型请改用 MetaCore Internal Runtime。', { status: 400 })
    }
    if (taskService?.apiMode && taskService.apiMode !== 'chat-completions') {
      throw new AgentError('HARNESS_API_MODE_UNSUPPORTED', 'DeepSeek Harness 使用 Chat Completions 协议，当前服务协议不匹配', { status: 400 })
    }
    const apiKey = String(taskService?.apiKey || process.env.DEEPSEEK_API_KEY || '').trim()
    if (!apiKey) {
      throw new AgentError('HARNESS_CREDENTIAL_REQUIRED', '请先在“设置 -> AI 服务配置”中测试并启用官方 DeepSeek 或硅基流动 DeepSeek 模型，或启动本地服务前配置 DEEPSEEK_API_KEY', { status: 400 })
    }
    const baseURL = normalizeHarnessBaseURL(taskService?.baseURL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com')
    const model = String(input.model || taskService?.model || process.env.METACORE_HARNESS_MODEL || 'deepseek-v4-flash').trim()
    const reasoningModel = /(?:reasoner|reasoning|deepseek-r1|deepseek-v4)/i.test(model)
    const officialDeepSeek = !taskService || taskService.provider === 'deepseek'

    const sourceBin = path.join(this.harnessRoot, 'packages', 'examples', 'jsonrpc-demo', 'src', 'packaged-bin.ts')
    const harness = new DeepSeekHarness({
      launch: {
        command: process.execPath,
        args: ['--import', 'tsx/esm', sourceBin, this.configPath],
        cwd: this.harnessRoot,
        env: {
          ...process.env,
          DEEPSEEK_API_KEY: apiKey,
          DEEPSEEK_BASE_URL: baseURL,
          // SiliconFlow is OpenAI-compatible but does not guarantee support
          // for DeepSeek's provider-specific thinking request fields.
          DEEPSEEK_THINKING: officialDeepSeek ? (reasoningModel ? 'enabled' : 'disabled') : 'disabled',
          DEEPSEEK_REASONING_EFFORT: officialDeepSeek ? (reasoningModel ? 'high' : 'off') : 'off',
          DSH_CORDIS_CONFIG: this.configPath,
          DSH_CWD: workspaceRoot,
          DSH_SESSION_ROOT: this.sessionRoot,
          DSH_SYSTEM_PROMPT: process.env.METACORE_HARNESS_PERSONA || DEFAULT_PERSONA,
          METACORE_HARNESS_ROOT: this.harnessRoot,
          METACORE_HARNESS_PLUGIN: this.pluginPath,
          METACORE_BRIDGE_URL: this.bridgeUrl,
          METACORE_HARNESS_BRIDGE_TOKEN: this.bridgeToken,
          METACORE_PROJECT_ID: String(context.job.projectId || ''),
          METACORE_JOB_ID: String(context.job.id || ''),
          METACORE_SESSION_ID: String(context.job.sessionId || ''),
        },
        requestTimeoutMs: Number(process.env.METACORE_HARNESS_REQUEST_TIMEOUT_MS || 10 * 60 * 1000),
      },
      cwd: workspaceRoot,
      provider: String(input.provider || 'deepseek-official'),
      model,
      maxTokens: Number(input.maxTokens || taskService?.maxOutputTokens || process.env.METACORE_HARNESS_MAX_TOKENS || 8192),
    })
    this.active.add(harness)
    const onAbort = () => { void harness.close() }
    context.signal.addEventListener('abort', onAbort, { once: true })
    await context.emit('agent.status', { runtime: 'deepseek-harness', status: 'starting' })
    try {
      const result = await harness.run(goal, {
        sessionId: `metacore-${context.job.sessionId}`,
        onNotification: (notification) => { void this.#forwardNotification(notification, context) },
      })
      const terminalError = findHarnessTerminalError(result.events)
      if (terminalError) {
        throw new AgentError('HARNESS_PROVIDER_ERROR', terminalError, { status: 502, retryable: true })
      }
      if (!String(result.finalResponse || '').trim()) {
        throw new AgentError('HARNESS_EMPTY_RESPONSE', 'Harness 已结束，但模型没有返回可显示的文本。请更换为官方 DeepSeek 的 deepseek-chat，或降低任务复杂度后重试。', { status: 502, retryable: true })
      }
      await context.emit('agent.output', { runtime: 'deepseek-harness', text: result.finalResponse })
      return {
        runtime: 'deepseek-harness',
        provider: taskService?.provider || 'deepseek',
        model,
        harnessSessionId: result.sessionId,
        finalResponse: result.finalResponse,
        eventCount: result.events.length,
        notificationCount: result.notifications.length,
      }
    } catch (error) {
      if (context.signal.aborted) throw new DOMException('任务已取消', 'AbortError')
      if (error instanceof AgentError) throw error
      throw new AgentError('HARNESS_RUN_FAILED', error?.message || 'DeepSeek Harness 运行失败', { status: 502, cause: error, retryable: true })
    } finally {
      context.signal.removeEventListener('abort', onAbort)
      this.active.delete(harness)
      await harness.close()
    }
  }

  async close() {
    await Promise.allSettled([...this.active].map((harness) => harness.close()))
    this.active.clear()
  }

  async #forwardNotification(notification, context) {
    const method = String(notification?.method || 'runtime.notification')
    const params = notification?.params ?? {}
    if (method === 'session.status') {
      await context.emit('agent.status', { runtime: 'deepseek-harness', status: params.status, harnessSessionId: params.sessionId })
      return
    }
    if (method === 'subagent.started' || method === 'subagent.finished') {
      await context.emit(method, { runtime: 'deepseek-harness', ...params })
      return
    }
    if (method === 'session.event') {
      const event = params.event ?? {}
      await context.emit('agent.runtime-event', {
        runtime: 'deepseek-harness',
        harnessSessionId: params.sessionId,
        eventType: event.type,
        event,
      })
    }
  }
}

function readVersion(packagePath) {
  try { return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version || '' } catch { return '' }
}

function normalizeHarnessBaseURL(value) {
  let url
  try {
    url = new URL(String(value || '').trim())
  } catch {
    throw new AgentError('HARNESS_BASE_URL_INVALID', 'DeepSeek Base URL 不是有效网址', { status: 400 })
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AgentError('HARNESS_BASE_URL_INVALID', 'DeepSeek Base URL 仅支持 http:// 或 https://', { status: 400 })
  }
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1'
  url.pathname = url.pathname.replace(/\/(?:chat\/completions|responses|models)\/?$/i, '') || '/'
  return url.toString().replace(/\/+$/, '')
}

function isHarnessCompatibleService(service) {
  if (service?.apiMode && service.apiMode !== 'chat-completions') return false
  if (service?.provider === 'deepseek') return true
  return service?.provider === 'siliconflow' && /deepseek/i.test(String(service.model || ''))
}

function findHarnessTerminalError(events = []) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    const reason = event?.data?.reason
    const failure = event?.data?.chunk?.reason?.failure
    const message = reason?.error?.message || failure?.message
    if (reason?.kind === 'error' || failure?.message) return String(message || 'DeepSeek Harness 上游请求失败')
  }
  return ''
}

const DEFAULT_PERSONA = `You are the MetaCore embedded engineering agent. Work only through the provided MetaCore tools. Inspect evidence before making claims. Treat hardware parameters, GPIO assignments, firmware changes, and build results as engineering artifacts that require verification. Read-only tools may run directly. File changes and builds must be proposed for explicit user approval. Never claim that a proposed operation has executed until its tool result confirms execution.`
