import { useState } from 'react'
import { useAIConfigStore } from '@/store/aiConfigStore'
import { useThemeStore } from '@/store/themeStore'
import ServiceCard from '@/components/settings/ServiceCard'
import AIServiceForm from '@/components/settings/AIServiceForm'
import type { AIServiceConfig } from '@/types/ai'
import { Plus, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const { services } = useAIConfigStore()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const [editing, setEditing] = useState<AIServiceConfig | null>(null)
  const [adding, setAdding] = useState(false)

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
                测试连接成功后再启用服务。本地运行推荐同时启动 localhost 工程服务，以避免浏览器跨域限制。
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

        {/* 服务列表 */}
        <div className="flex flex-col gap-2.5 pb-6">
          {services.map((svc) => (
            <ServiceCard key={svc.id} service={svc} onEdit={() => setEditing(svc)} />
          ))}
        </div>

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
