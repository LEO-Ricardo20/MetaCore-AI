import { useState } from 'react'
import { useAIConfigStore } from '@/store/aiConfigStore'
import { useThemeStore } from '@/store/themeStore'
import { fetchAIModels } from '@/services/ai/client'
import { resolveAIAPIMode, type AIAPIMode, type AIServiceConfig, type AIProvider } from '@/types/ai'
import { AlertCircle, Eye, EyeOff, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  initial?: AIServiceConfig
  onClose: () => void
}

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'siliconflow', label: '硅基流动' },
  { value: 'qwen', label: '通义千问' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'ollama', label: 'Ollama (本地)' },
  { value: 'mock', label: 'MetaCore Mock（测试）' },
  { value: 'custom', label: '自定义 OpenAI 兼容服务' },
]

const DEFAULTS: Record<AIProvider, { baseURL: string; model: string; apiMode: AIAPIMode }> = {
  deepseek: { baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiMode: 'chat-completions' },
  siliconflow: { baseURL: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3', apiMode: 'chat-completions' },
  qwen: { baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', apiMode: 'chat-completions' },
  openai: { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o', apiMode: 'responses' },
  ollama: { baseURL: 'http://127.0.0.1:11434/v1', model: 'llama3', apiMode: 'chat-completions' },
  mock: { baseURL: 'http://127.0.0.1:3766/mock', model: 'metacore-deterministic', apiMode: 'chat-completions' },
  custom: { baseURL: '', model: '', apiMode: 'chat-completions' },
}

export default function AIServiceForm({ initial, onClose }: Props) {
  const { addService, updateService, setActive, activeServiceId } = useAIConfigStore()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const [form, setForm] = useState({
    name: initial?.name ?? '',
    provider: initial?.provider ?? 'deepseek' as AIProvider,
    apiKey: initial?.apiKey ?? '',
    baseURL: initial?.baseURL ?? DEFAULTS.deepseek.baseURL,
    model: initial?.model ?? DEFAULTS.deepseek.model,
    apiMode: initial ? resolveAIAPIMode(initial) : DEFAULTS.deepseek.apiMode,
  })
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelOptions, setModelOptions] = useState<string[]>([])
  const [modelStatus, setModelStatus] = useState('')

  const needsKey = form.provider !== 'ollama' && form.provider !== 'mock'

  function handleProviderChange(provider: AIProvider) {
    const label = PROVIDERS.find((item) => item.value === provider)?.label ?? ''
    setError('')
    setModelOptions([])
    setModelStatus('')
    setForm((current) => ({
      ...current,
      provider,
      ...DEFAULTS[provider],
      apiKey: provider === 'ollama' || provider === 'mock' ? '' : current.apiKey,
      name: initial ? current.name : label,
    }))
  }

  async function handleLoadModels() {
    const baseURL = form.baseURL.trim().replace(/\/+$/, '')
    const apiKey = form.apiKey.trim()
    setError('')
    setModelStatus('')

    if (!baseURL) {
      setError('请先填写 Base URL。')
      return
    }
    if (needsKey && !apiKey) {
      setError('请先填写 API Key，再读取模型列表。')
      return
    }
    try {
      const url = new URL(baseURL)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    } catch {
      setError('Base URL 必须是有效的 http:// 或 https:// 地址。')
      return
    }

    setLoadingModels(true)
    try {
      const models = await fetchAIModels({
        id: initial?.id ?? 'model-discovery',
        name: form.name.trim() || '模型发现',
        provider: form.provider,
        apiKey,
        baseURL,
        model: form.model.trim(),
        apiMode: form.apiMode,
        enabled: false,
      })
      setModelOptions(models)
      setModelStatus(`已读取 ${models.length} 个模型，请从输入框建议中选择。`)
      if (!form.model.trim() && models.length === 1) {
        setForm((current) => ({ ...current, model: models[0] }))
      }
    } catch (loadError: any) {
      setError(loadError?.message ?? '读取模型列表失败。')
    } finally {
      setLoadingModels(false)
    }
  }

  function handleSave() {
    const name = form.name.trim()
    const model = form.model.trim()
    const apiKey = form.apiKey.trim()
    const rawBaseURL = form.baseURL.trim().replace(/\/+$/, '')

    if (!name || !rawBaseURL || !model) {
      setError('名称、Base URL 和模型不能为空。')
      return
    }
    if (needsKey && !apiKey) {
      setError('该服务需要 API Key。Ollama 本地服务可以不填写。')
      return
    }
    try {
      const url = new URL(rawBaseURL)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    } catch {
      setError('Base URL 必须是有效的 http:// 或 https:// 地址。')
      return
    }

    const connectionChanged = Boolean(initial && (
      initial.provider !== form.provider
      || initial.apiKey !== apiKey
      || initial.baseURL.replace(/\/+$/, '') !== rawBaseURL
      || initial.model !== model
      || resolveAIAPIMode(initial) !== form.apiMode
    ))
    const payload = {
      name,
      provider: form.provider,
      apiKey,
      baseURL: rawBaseURL,
      model,
      apiMode: form.apiMode,
      enabled: initial ? (connectionChanged ? false : initial.enabled) : false,
    }

    if (initial) {
      updateService(initial.id, payload)
      if (connectionChanged && activeServiceId === initial.id) setActive(null)
    } else {
      addService(payload)
    }
    onClose()
  }

  const inputClass = cn(
    'w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors',
    isDark
      ? 'bg-slate-900/70 border border-slate-700 text-white placeholder:text-slate-600 focus:border-indigo-500'
      : 'bg-white border border-indigo-100 text-slate-800 placeholder:text-slate-400 focus:border-indigo-400'
  )

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
      <div className={cn(
        'w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg p-5 sm:p-6 shadow-2xl fade-in-up',
        isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-indigo-100'
      )}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className={cn('text-base font-bold', isDark ? 'text-white' : 'text-slate-800')}>
              {initial ? '编辑 AI 服务' : '添加 AI 服务'}
            </h2>
            <p className={cn('text-xs mt-1', isDark ? 'text-slate-500' : 'text-slate-400')}>保存后请在服务卡片中测试连接。</p>
          </div>
          <button onClick={onClose} title="关闭" className={cn('w-8 h-8 rounded-lg flex items-center justify-center', isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100')}>
            <X size={17} />
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          <Field label="服务商" isDark={isDark}>
            <select value={form.provider} onChange={(event) => handleProviderChange(event.target.value as AIProvider)} className={inputClass}>
              {PROVIDERS.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}
            </select>
          </Field>

          <Field label="显示名称" isDark={isDark}>
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="例如：DeepSeek 主服务" className={inputClass} />
          </Field>

          <Field label={`API Key${needsKey ? '' : '（可选）'}`} isDark={isDark}>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(event) => {
                  setModelOptions([])
                  setModelStatus('')
                  setForm((current) => ({ ...current, apiKey: event.target.value }))
                }}
                placeholder={needsKey ? '填写服务商 API Key' : 'Ollama 默认不需要 API Key'}
                className={cn(inputClass, 'pr-10')}
              />
              <button type="button" onClick={() => setShowKey((value) => !value)} title={showKey ? '隐藏 API Key' : '显示 API Key'} className={cn('absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center', isDark ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100')}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>

          <Field label="Base URL" isDark={isDark}>
            <input value={form.baseURL} onChange={(event) => {
              const baseURL = event.target.value
              setModelOptions([])
              setModelStatus('')
              setForm((current) => ({
                ...current,
                baseURL,
                apiMode: current.provider === 'custom' && /(^|\.)autobits\.cc(?=[:/]|$)/i.test(baseURL)
                  ? 'responses'
                  : current.apiMode,
              }))
            }} placeholder="https://api.example.com/v1" className={inputClass} />
            {form.provider === 'custom' && <Hint isDark={isDark}>自定义服务需要兼容所选 OpenAI API 协议，Base URL 通常以 /v1 结尾。</Hint>}
            {form.provider === 'ollama' && <Hint isDark={isDark}>默认地址为 http://127.0.0.1:11434/v1，请先运行 ollama serve。</Hint>}
            {form.provider === 'mock' && <Hint isDark={isDark}>仅用于本地 E2E 和流程验收，不代表真实模型能力。</Hint>}
          </Field>

          {form.provider === 'custom' && (
            <Field label="API 协议" isDark={isDark}>
              <select value={form.apiMode} onChange={(event) => setForm((current) => ({ ...current, apiMode: event.target.value as AIAPIMode }))} className={inputClass}>
                <option value="responses">Responses API（CCH / Codex / GPT-5.5）</option>
                <option value="chat-completions">Chat Completions（传统 OpenAI 兼容）</option>
              </select>
              <Hint isDark={isDark}>CCH 官方文档要求 Codex 使用 Responses API；其他中转平台请以其文档为准。</Hint>
            </Field>
          )}

          <Field label="模型" isDark={isDark}>
            <div className="flex items-stretch gap-2">
              <input
                list="metacore-studio-model-options"
                value={form.model}
                onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
                placeholder="模型标识"
                className={cn(inputClass, 'min-w-0')}
              />
              <button
                type="button"
                onClick={handleLoadModels}
                disabled={loadingModels}
                className={cn(
                  'h-[42px] flex-shrink-0 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50',
                  isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                )}
              >
                <RefreshCw size={13} className={loadingModels ? 'animate-spin' : ''} />
                {loadingModels ? '读取中' : '读取模型'}
              </button>
            </div>
            <datalist id="metacore-studio-model-options">
              {modelOptions.map((model) => <option key={model} value={model} />)}
            </datalist>
            {modelStatus && <Hint isDark={isDark}>{modelStatus}</Hint>}
          </Field>
        </div>

        {error && (
          <div className={cn('flex items-start gap-2 mt-4 px-3 py-2.5 rounded-lg text-xs leading-5', isDark ? 'bg-red-950/30 text-red-300 border border-red-900/40' : 'bg-red-50 text-red-700 border border-red-100')}>
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className={cn('h-9 px-4 text-sm rounded-lg transition-colors', isDark ? 'text-slate-300 bg-slate-800 hover:bg-slate-700' : 'text-slate-600 bg-slate-100 hover:bg-slate-200')}>取消</button>
          <button onClick={handleSave} className="btn-primary h-9 rounded-[var(--radius-control)] px-5 text-sm text-white">保存配置</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, isDark }: { label: string; children: React.ReactNode; isDark: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={cn('text-xs font-medium', isDark ? 'text-slate-400' : 'text-slate-600')}>{label}</span>
      {children}
    </label>
  )
}

function Hint({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return <span className={cn('text-[11px] leading-5', isDark ? 'text-slate-600' : 'text-slate-400')}>{children}</span>
}
