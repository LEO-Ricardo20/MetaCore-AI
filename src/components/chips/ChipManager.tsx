/** 芯片管理页面 — 查看预置芯片、添加/编辑/删除自定义芯片 */

import { useState } from 'react'
import { useThemeStore } from '@/store/themeStore'
import { useChipStore } from '@/store/chipStore'
import { CHIP_SPECS } from '@/data/chipSpecs'
import { cn } from '@/lib/utils'
import type { ChipSpec } from '@/types/hardware'
import PdfParseMode from './PdfParseMode'
import AssistedMode from './AssistedMode'
import FormMode from './FormMode'
import {
  Cpu,
  FileUp,
  Wand2,
  PenLine,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'

/* ---------- 三种添加模式 ---------- */
type AddMode = 'pdf' | 'assisted' | 'form' | null

const MODES: { key: AddMode; label: string; desc: string; icon: typeof FileUp; color: string }[] = [
  { key: 'pdf',      label: 'AI 识图',  desc: '上传 PDF，AI 自动解析',         icon: FileUp,  color: 'cyan' },
  { key: 'assisted', label: 'AI 助填',  desc: '表单 + PDF 辅助预填',          icon: Wand2,   color: 'violet' },
  { key: 'form',     label: '自由配置', desc: '纯手动填写芯片参数',            icon: PenLine, color: 'amber' },
]

/* ---------- 颜色映射 ---------- */
const colorMap: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  cyan:   { bg: 'bg-cyan-500/10',   text: 'text-cyan-400',   border: 'border-cyan-500/30',   ring: 'ring-cyan-500/20' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', ring: 'ring-violet-500/20' },
  amber:  { bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/30',  ring: 'ring-amber-500/20' },
}

export default function ChipManager() {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const { customChips, removeChip } = useChipStore()

  const [mode, setMode] = useState<AddMode>(null)
  const [editingChip, setEditingChip] = useState<ChipSpec | null>(null)

  /* 关闭模式面板 */
  const closeMode = () => { setMode(null); setEditingChip(null) }

  /* 预置芯片列表 */
  const presetEntries = Object.values(CHIP_SPECS)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ---- 页头 ---- */}
        <div className="mb-8 slide-in-left">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              'w-6 h-6 rounded-lg flex items-center justify-center',
              isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'
            )}>
              <Cpu size={13} className={isDark ? 'text-indigo-400' : 'text-indigo-500'} />
            </div>
            <span className={cn(
              'text-xs font-medium tracking-wide uppercase',
              isDark ? 'text-indigo-400' : 'text-indigo-500'
            )}>
              Chip Library
            </span>
          </div>
          <h1 className={cn('text-2xl font-bold mb-1', isDark ? 'text-white' : 'text-slate-800')}>
            芯片管理
          </h1>
          <p className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
            查看预置芯片参数、添加自定义芯片数据，用于硬件方案生成时的引脚约束
          </p>
        </div>

        {/* ---- 模式选择卡片 ---- */}
        {!mode && !editingChip && (
          <div className="grid grid-cols-3 gap-4 mb-8 slide-in-left" style={{ animationDelay: '50ms' }}>
            {MODES.map(m => {
              const c = colorMap[m.color]
              const Icon = m.icon
              return (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={cn(
                    'glass-card p-5 flex flex-col items-start gap-3 text-left transition-all',
                    'hover:ring-2',
                    c.ring,
                  )}
                >
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', c.bg)}>
                    <Icon size={18} className={c.text} />
                  </div>
                  <div>
                    <p className={cn('text-sm font-semibold mb-0.5', isDark ? 'text-white' : 'text-slate-800')}>
                      {m.label}
                    </p>
                    <p className={cn('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                      {m.desc}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* ---- 模式面板 ---- */}
        {(mode || editingChip) && (
          <div className="mb-8 fade-in">
            {/* 面板标题栏 */}
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn('text-base font-bold', isDark ? 'text-white' : 'text-slate-800')}>
                {editingChip ? `编辑 — ${editingChip.name}` : MODES.find(m => m.key === mode)?.label}
              </h2>
              <button
                onClick={closeMode}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  isDark ? 'hover:bg-slate-700/60 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                )}
              >
                <X size={16} />
              </button>
            </div>

            {/* 各模式组件 */}
            {mode === 'pdf' && <PdfParseMode onDone={closeMode} />}
            {mode === 'assisted' && <AssistedMode onDone={closeMode} />}
            {mode === 'form' && !editingChip && <FormMode onDone={closeMode} />}
        {editingChip && <FormMode key={editingChip.name} onDone={closeMode} initialData={editingChip} />}
          </div>
        )}

        {/* ---- 预置芯片 ---- */}
        <section className="mb-8">
          <h2 className={cn('text-sm font-semibold mb-3 uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-slate-500')}>
            预置芯片
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {presetEntries.map(spec => (
              <ChipCard key={spec.name} spec={spec} isDark={isDark} readonly />
            ))}
          </div>
        </section>

        {/* ---- 自定义芯片 ---- */}
        <section>
          <h2 className={cn('text-sm font-semibold mb-3 uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-slate-500')}>
            自定义芯片
          </h2>
          {customChips.length === 0 ? (
            <div className={cn(
              'flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed text-center',
              isDark ? 'border-slate-700/50 text-slate-500' : 'border-slate-200 text-slate-400'
            )}>
              <Cpu size={28} className="mb-2 opacity-30" />
              <p className="text-sm">还没有自定义芯片</p>
              <p className="text-xs mt-1">选择上方的模式添加新芯片</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {customChips.map(spec => (
                <ChipCard
                  key={spec.name}
                  spec={spec}
                  isDark={isDark}
                  onEdit={() => { setEditingChip(spec); setMode(null) }}
                  onDelete={() => removeChip(spec.name)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

/* ========== 芯片展示卡片子组件 ========== */
interface ChipCardProps {
  spec: ChipSpec
  isDark: boolean
  readonly?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

function ChipCard({ spec, isDark, readonly, onEdit, onDelete }: ChipCardProps) {
  return (
    <div className={cn('glass-card p-4 flex flex-col gap-2 group relative')}>
      {/* 芯片名 */}
      <p className={cn('text-sm font-bold', isDark ? 'text-white' : 'text-slate-800')}>
        {spec.name}
      </p>
      {/* 参数 */}
      <div className="flex flex-col gap-1">
        <InfoRow label="架构" value={spec.arch} isDark={isDark} />
        <InfoRow label="主频" value={spec.clockSpeed} isDark={isDark} />
        <InfoRow label="GPIO" value={`${spec.gpios.length} 个`} isDark={isDark} />
      </div>
      {/* 操作按钮（自定义芯片） */}
      {!readonly && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'hover:bg-slate-700/60 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

/* 参数行 */
function InfoRow({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{label}</span>
      <span className={cn('font-medium', isDark ? 'text-slate-300' : 'text-slate-600')}>{value}</span>
    </div>
  )
}
