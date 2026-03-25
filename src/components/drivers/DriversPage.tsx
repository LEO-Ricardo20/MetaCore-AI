/** 外设驱动库浏览页 — 展示所有 DRIVER_TEMPLATES 驱动模板 */
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { DRIVER_TEMPLATES, type DriverTemplate } from '@/data/driverTemplates'

type InterfaceFilter = 'all' | 'I2C' | 'SPI' | 'GPIO' | 'UART'

const INTERFACE_COLORS: Record<string, string> = {
  I2C: 'indigo',
  SPI: 'violet',
  GPIO: 'emerald',
  UART: 'cyan',
}

export default function DriversPage() {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [filter, setFilter] = useState<InterfaceFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 筛选驱动
  const filtered = filter === 'all'
    ? DRIVER_TEMPLATES
    : DRIVER_TEMPLATES.filter(d => d.interface === filter)

  // 统计各接口数量
  const counts = {
    all: DRIVER_TEMPLATES.length,
    I2C: DRIVER_TEMPLATES.filter(d => d.interface === 'I2C').length,
    SPI: DRIVER_TEMPLATES.filter(d => d.interface === 'SPI').length,
    GPIO: DRIVER_TEMPLATES.filter(d => d.interface === 'GPIO').length,
    UART: DRIVER_TEMPLATES.filter(d => d.interface === 'UART').length,
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* 页头 */}
        <div className="flex items-center justify-between fade-in-up">
          <div>
            <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-slate-800')}>
              外设驱动库
            </h1>
            <p className={cn('text-sm mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
              已验证的外设驱动模板，支持 ESP-IDF / Arduino / PlatformIO
            </p>
          </div>
          <div className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-semibold',
            isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
          )}>
            {DRIVER_TEMPLATES.length} 个驱动
          </div>
        </div>

        {/* 接口筛选 Tab */}
        <div className="flex items-center gap-2 fade-in-up" style={{ animationDelay: '50ms' }}>
          {(['all', 'I2C', 'SPI', 'GPIO', 'UART'] as const).map(key => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                filter === key
                  ? isDark
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : isDark
                    ? 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              )}
            >
              {key === 'all' ? '全部' : key}
              <span className={cn(
                'ml-1.5 text-xs',
                filter === key
                  ? isDark ? 'text-indigo-400' : 'text-indigo-600'
                  : isDark ? 'text-slate-600' : 'text-slate-400'
              )}>
                ({counts[key]})
              </span>
            </button>
          ))}
        </div>

        {/* 驱动卡片网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 fade-in-up" style={{ animationDelay: '100ms' }}>
          {filtered.map(driver => (
            <DriverCard
              key={driver.id}
              driver={driver}
              isDark={isDark}
              expanded={expandedId === driver.id}
              onToggle={() => setExpandedId(expandedId === driver.id ? null : driver.id)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className={cn(
            'text-center py-12 text-sm',
            isDark ? 'text-slate-500' : 'text-slate-400'
          )}>
            暂无该接口类型的驱动
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 驱动卡片组件
// ─────────────────────────────────────────────────────────────────────────────

interface DriverCardProps {
  driver: DriverTemplate
  isDark: boolean
  expanded: boolean
  onToggle: () => void
}

function DriverCard({ driver, isDark, expanded, onToggle }: DriverCardProps) {
  const interfaceColor = INTERFACE_COLORS[driver.interface] || 'slate'
  const supportedFormats = Object.keys(driver.templates) as Array<'espidf' | 'arduino' | 'platformio'>

  return (
    <div className={cn(
      'glass-card p-4 flex flex-col gap-3 transition-all duration-200',
      isDark ? '' : 'bg-white/80 border-slate-200/60',
      expanded && 'ring-2 ring-indigo-500/30'
    )}>
      {/* 标题行 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className={cn('text-sm font-semibold truncate', isDark ? 'text-white' : 'text-slate-800')}>
            {driver.name}
          </h3>
          <div className={cn('text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
            ID: {driver.id}
          </div>
        </div>
        <span className={cn(
          'px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0',
          isDark
            ? `bg-${interfaceColor}-500/10 text-${interfaceColor}-400 border border-${interfaceColor}-500/20`
            : `bg-${interfaceColor}-50 text-${interfaceColor}-600 border border-${interfaceColor}-200`
        )}>
          {driver.interface}
        </span>
      </div>

      {/* 关键词 tags */}
      <div className="flex flex-wrap gap-1.5">
        {driver.matchKeywords.slice(0, 5).map((kw, i) => (
          <span
            key={i}
            className={cn(
              'px-2 py-0.5 rounded text-[10px]',
              isDark ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-100 text-slate-600'
            )}
          >
            {kw}
          </span>
        ))}
        {driver.matchKeywords.length > 5 && (
          <span className={cn('text-[10px]', isDark ? 'text-slate-600' : 'text-slate-400')}>
            +{driver.matchKeywords.length - 5}
          </span>
        )}
      </div>

      {/* 支持格式 */}
      <div className="flex items-center gap-2">
        <span className={cn('text-[10px]', isDark ? 'text-slate-500' : 'text-slate-400')}>
          支持:
        </span>
        {supportedFormats.map(fmt => (
          <span
            key={fmt}
            className={cn(
              'px-1.5 py-0.5 rounded text-[9px] font-mono',
              isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
            )}
          >
            {fmt}
          </span>
        ))}
      </div>

      {/* 展开/收起按钮 */}
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center justify-center gap-1 py-1.5 rounded text-xs font-medium transition-colors',
          isDark
            ? 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        )}
      >
        {expanded ? (
          <>
            <ChevronUp size={14} />
            收起 API 说明
          </>
        ) : (
          <>
            <ChevronDown size={14} />
            查看 API 说明
          </>
        )}
      </button>

      {/* API 文档（展开时显示） */}
      {expanded && (
        <div className={cn(
          'mt-2 p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap border',
          isDark
            ? 'bg-slate-900/50 text-slate-300 border-slate-700/50'
            : 'bg-slate-50 text-slate-700 border-slate-200'
        )}>
          {driver.apiDoc}
        </div>
      )}
    </div>
  )
}
