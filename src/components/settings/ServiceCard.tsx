import { useState } from 'react'
import { useAIConfigStore } from '@/store/aiConfigStore'
import { useThemeStore } from '@/store/themeStore'
import { testConnection, type AIConnectionResult } from '@/services/ai/client'
import { resolveAIAPIMode, type AIServiceConfig } from '@/types/ai'
import { Pencil, Trash2, CheckCircle2, XCircle, Loader2, Play, KeyRound } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  service: AIServiceConfig
  onEdit: () => void
}

export default function ServiceCard({ service, onEdit }: Props) {
  const { removeService, setActive, activeServiceId, updateService } = useAIConfigStore()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<AIConnectionResult | null>(null)
  const isActive = activeServiceId === service.id
  const needsKey = service.provider !== 'ollama' && service.provider !== 'mock'
  const hasCredential = !needsKey || Boolean(service.apiKey.trim())

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    const result = await testConnection(service)
    setTestResult(result)
    updateService(service.id, { enabled: result.ok })
    if (!result.ok && isActive) setActive(null)
    setTesting(false)
  }

  function handleUse() {
    if (!service.enabled || !hasCredential) return
    setActive(service.id)
  }

  function handleRemove() {
    if (!window.confirm(`确认删除 AI 服务“${service.name}”吗？`)) return
    removeService(service.id)
  }

  return (
    <div className={cn(
      'border rounded-lg overflow-hidden transition-colors',
      isActive
        ? isDark ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-indigo-300 bg-indigo-50/40'
        : isDark ? 'border-slate-700/60 bg-slate-900/45' : 'border-indigo-100 bg-white/75'
    )}>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 md:gap-5 p-3.5 sm:p-4">
        <div className="min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1.5">
            <span className={cn('text-sm font-semibold break-all', isDark ? 'text-white' : 'text-slate-800')}>
              {service.name}
            </span>
            {isActive && (
              <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-medium', isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700')}>
                使用中
              </span>
            )}
            {!isActive && service.enabled && (
              <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-medium', isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700')}>
                已验证
              </span>
            )}
            {!service.enabled && (
              <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-medium', isDark ? 'bg-slate-700/70 text-slate-400' : 'bg-slate-100 text-slate-500')}>
                未验证
              </span>
            )}
          </div>

          <div className={cn('text-[11px] sm:text-xs font-mono break-all leading-5', isDark ? 'text-slate-500' : 'text-slate-500')}>
            {service.baseURL}
          </div>
          <div className={cn('text-[11px] sm:text-xs mt-0.5 break-all', isDark ? 'text-slate-500' : 'text-slate-500')}>
            模型：{service.model}
          </div>
          <div className={cn('text-[11px] sm:text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-slate-500')}>
            协议：{resolveAIAPIMode(service) === 'responses' ? 'Responses API' : 'Chat Completions'}
          </div>
          <div className={cn('text-[11px] sm:text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-slate-500')}>
            超时：{Math.round((service.timeoutMs ?? 180_000) / 1_000)} 秒 · 最大输出：{service.maxOutputTokens ?? 8192} Token
          </div>
          <div className={cn('flex items-center gap-1.5 text-[11px] mt-1.5', hasCredential ? 'text-emerald-500' : isDark ? 'text-slate-600' : 'text-slate-400')}>
            <KeyRound size={11} />
            {service.provider === 'mock' ? '测试 Mock Provider，不需要 API Key' : service.provider === 'ollama' ? '本地 Ollama 不要求 API Key' : hasCredential ? '已配置 API Key' : '未配置 API Key'}
          </div>
        </div>

        <div className="flex items-center md:justify-end gap-1.5 flex-wrap md:flex-nowrap">
          <button
            onClick={handleTest}
            disabled={testing || !hasCredential}
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed',
              isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
            )}
          >
            {testing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {testing ? '测试中' : '测试'}
          </button>

          <button
            onClick={handleUse}
            disabled={isActive || !service.enabled || !hasCredential}
            title={!service.enabled ? '请先测试连接' : isActive ? '当前正在使用' : '设为当前服务'}
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-medium transition-colors disabled:cursor-not-allowed',
              isActive
                ? 'bg-indigo-600 text-white'
                : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-40'
            )}
          >
            {isActive ? '使用中' : '使用'}
          </button>

          <button
            onClick={onEdit}
            title="编辑服务"
            className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors', isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50')}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={handleRemove}
            title="删除服务"
            className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors', isDark ? 'text-slate-400 hover:text-red-400 hover:bg-red-950/30' : 'text-slate-500 hover:text-red-500 hover:bg-red-50')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {testResult && (
        <div className={cn(
          'flex items-start gap-2 px-4 py-2.5 border-t text-xs leading-5',
          testResult.ok
            ? isDark ? 'border-emerald-900/40 bg-emerald-950/20 text-emerald-300' : 'border-emerald-100 bg-emerald-50 text-emerald-700'
            : isDark ? 'border-red-900/40 bg-red-950/20 text-red-300' : 'border-red-100 bg-red-50 text-red-700'
        )}>
          {testResult.ok
            ? <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
            : <XCircle size={14} className="flex-shrink-0 mt-0.5" />}
          <span className="break-all">
            {testResult.ok ? `连接成功 · ${testResult.via === 'local-proxy' ? 'MetaCore 本地网关' : '浏览器直连'} · ${testResult.durationMs ?? 0} ms` : testResult.error}
          </span>
        </div>
      )}
    </div>
  )
}
