import { useEffect, useState } from 'react'
import { useAIConfigStore } from '@/store/aiConfigStore'
import { useThemeStore } from '@/store/themeStore'
import ServiceCard from '@/components/settings/ServiceCard'
import AIServiceForm from '@/components/settings/AIServiceForm'
import { isDeepSeekHarnessCompatible, type AIServiceConfig } from '@/types/ai'
import { Plus, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAgentRuntimeStatus } from '@/services/local/localClient'
import type { AgentRuntimeStatus } from '@/types/agent'

export default function SettingsPage() {
  const { services, getActive, getStructuredGenerationService } = useAIConfigStore()
  const activeService = getActive()
  const structuredGenerationService = getStructuredGenerationService()
  const configuredOfficialDeepSeek = services.find((service) => service.provider === 'deepseek' && service.enabled && Boolean(service.apiKey.trim()))
  const harnessService = configuredOfficialDeepSeek && isDeepSeekHarnessCompatible(configuredOfficialDeepSeek)
    ? configuredOfficialDeepSeek
    : isDeepSeekHarnessCompatible(activeService) ? activeService : null
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const [editing, setEditing] = useState<AIServiceConfig | null>(null)
  const [adding, setAdding] = useState(false)
  const [runtimeStatus, setRuntimeStatus] = useState<AgentRuntimeStatus | null>(null)
  const [runtimeError, setRuntimeError] = useState('')

  useEffect(() => {
    let alive = true
    getAgentRuntimeStatus().then((status) => alive && setRuntimeStatus(status)).catch((reason) => alive && setRuntimeError(reason instanceof Error ? reason.message : '本地服务未连接'))
    return () => { alive = false }
  }, [])

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {/* 页头 */}
        <div className="mb-5 slide-in-left">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              'w-6 h-6 rounded-lg flex items-center justify-center',
              isDark ? 'bg-slate-500/20' : 'bg-indigo-100'
            )}>
              <Settings size={13} className={isDark ? 'text-slate-400' : 'text-indigo-500'} />
            </div>
            <span className={cn(
              'text-xs font-medium tracking-wide uppercase',
              isDark ? 'text-slate-400' : 'text-indigo-500'
            )}>
              Configuration
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className={cn('text-xl sm:text-2xl font-bold mb-1', isDark ? 'text-white' : 'text-slate-800')}>AI 服务配置</h1>
              <p className={cn('text-xs sm:text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
                所有 AI 请求统一通过 MetaCore 本地网关发送；测试成功后再设为“使用中”。
              </p>
            </div>
            <button
              onClick={() => setAdding(true)}
              className="btn-primary inline-flex h-9 flex-shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-medium text-white"
            >
              <Plus size={15} /> 添加服务
            </button>
          </div>
        </div>

        <section className={cn('mb-5 border px-4 py-3', isDark ? 'border-slate-700/60 bg-slate-900/45' : 'border-indigo-100 bg-white/75')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><div className={cn('text-[10px] font-semibold uppercase', isDark ? 'text-slate-500' : 'text-slate-400')}>普通问答 / Agent</div><div className={cn('mt-1 text-xs font-medium', activeService ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : 'text-amber-500')}>{activeService ? `${activeService.name} · ${activeService.model}` : '尚未选择已验证的服务'}</div></div>
            <div><div className={cn('text-[10px] font-semibold uppercase', isDark ? 'text-slate-500' : 'text-slate-400')}>设计 / 代码 / 流程生成</div><div className={cn('mt-1 text-xs font-medium', structuredGenerationService ? (isDark ? 'text-cyan-300' : 'text-cyan-700') : 'text-amber-500')}>{structuredGenerationService ? `${structuredGenerationService.name} · ${structuredGenerationService.model}` : '尚未找到 DeepSeek 结构化服务'}</div></div>
            <div><div className={cn('text-[10px] font-semibold uppercase', isDark ? 'text-slate-500' : 'text-slate-400')}>DeepSeek Harness Agent</div><div className={cn('mt-1 text-xs font-medium', harnessService || runtimeStatus?.runtimes.find((item) => item.id === 'deepseek-harness')?.credentialConfigured ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : 'text-amber-500')}>{harnessService ? `复用当前 ${harnessService.name} · ${harnessService.model}` : runtimeStatus?.runtimes.find((item) => item.id === 'deepseek-harness')?.credentialConfigured ? '使用服务端 DEEPSEEK_API_KEY' : '需要启用官方 DeepSeek 或硅基流动 DeepSeek 模型'}</div></div>
          </div>
        </section>

        {/* 服务列表 */}
        <div className="flex flex-col gap-2.5 pb-6">
          {services.map((svc) => (
            <ServiceCard key={svc.id} service={svc} onEdit={() => setEditing(svc)} />
          ))}
        </div>

        <section className={cn('mb-6 rounded-xl border p-4', isDark ? 'border-cyan-500/20 bg-cyan-950/10' : 'border-cyan-100 bg-cyan-50/50')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-slate-800')}>Agent Runtime</h2>
              <p className={cn('mt-1 text-xs leading-5', isDark ? 'text-slate-400' : 'text-slate-500')}>任务抽屉默认使用 DeepSeek Harness；官方 DeepSeek 或硅基流动 DeepSeek 模型会自动提供 Key、Base URL 和模型。</p>
            </div>
            {runtimeStatus && <span className={cn('rounded-full border px-2 py-1 text-[10px]', runtimeStatus.selected === 'deepseek-harness' ? (isDark ? 'border-cyan-400/30 text-cyan-300' : 'border-cyan-200 text-cyan-700') : (isDark ? 'border-slate-600 text-slate-300' : 'border-slate-200 text-slate-600'))}>默认 · {runtimeStatus.selected}</span>}
          </div>
          {runtimeError ? <p className="mt-3 text-xs text-amber-500">{runtimeError}</p> : runtimeStatus ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{runtimeStatus.runtimes.map((runtime) => <div key={runtime.id} className={cn('rounded-lg border p-3', isDark ? 'border-slate-700/60 bg-slate-950/30' : 'border-cyan-100 bg-white/70')}><div className="flex items-center justify-between gap-2"><span className={cn('text-xs font-semibold', isDark ? 'text-slate-200' : 'text-slate-700')}>{runtime.label}</span><span className={cn('text-[10px]', runtime.ready ? 'text-emerald-500' : 'text-amber-500')}>{runtime.ready ? '可用' : '未就绪'}</span></div><div className={cn('mt-2 space-y-1 text-[10px]', isDark ? 'text-slate-500' : 'text-slate-400')}><div>版本：{runtime.version || '内置'}</div>{runtime.id === 'deepseek-harness' && <><div>源码：{runtime.sourceAvailable ? '已找到' : '缺失'}</div><div>依赖：{runtime.dependenciesInstalled ? '已安装' : '未安装'}</div><div>凭据：{harnessService ? `设置页 ${harnessService.name}` : runtime.credentialConfigured ? '服务端环境变量' : '未配置'}</div></>}</div></div>)}</div> : <p className={cn('mt-3 text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>正在读取 Runtime 状态...</p>}
        </section>

        {services.length === 0 && (
          <div className={cn(
            'flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed',
            isDark ? 'border-slate-700/50 text-slate-500' : 'border-indigo-200/50 text-slate-400'
          )}>
            <Settings size={32} className="mb-3 opacity-30" />
            <p className="text-sm">还没有配置任何 AI 服务</p>
            <p className="text-xs mt-1">点击上方「添加服务」开始配置</p>
          </div>
        )}

        {(editing || adding) && (
          <AIServiceForm
            initial={editing ?? undefined}
            onClose={() => { setEditing(null); setAdding(false) }}
          />
        )}
      </div>
    </div>
  )
}
