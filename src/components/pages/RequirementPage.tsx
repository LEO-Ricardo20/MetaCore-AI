/** 需求生成页 — 输入自然语言需求，AI 生成硬件方案（引脚/BOM/接线） */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { selectCurrentProject, useProjectStore } from '@/store/projectStore'
import { useChipStore } from '@/store/chipStore'
import { useThemeStore } from '@/store/themeStore'
import type { ChipTarget, ProjectFormat } from '@/types/hardware'
import PinTable from '@/components/requirement/PinTable'
import PinDiagram from '@/components/requirement/PinDiagram'
import BOMTable from '@/components/requirement/BOMTable'
import WiringTable from '@/components/requirement/WiringTable'
import { AlertCircle, ChevronRight, Cpu, Sparkles, MapPin, Table2, Settings2, Info, ChevronDown, Layers, Check, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DRIVER_TEMPLATES } from '@/data/driverTemplates'
import { startGeneration, cancelGeneration } from '@/services/ai/generationCoordinator'
import GenerationProgress from '@/components/generation/GenerationProgress'
import { useGenerationStore } from '@/store/generationStore'

const FORMATS: { value: ProjectFormat; label: string; desc: string }[] = [
  { value: 'espidf', label: 'ESP-IDF', desc: 'CMake' },
  { value: 'arduino', label: 'Arduino', desc: '.ino' },
  { value: 'platformio', label: 'PlatformIO', desc: 'ini' },
  { value: 'cubeide', label: 'STM32CubeIDE', desc: '.ioc' },
]

const EXAMPLES = [
  'AI 桌宠：OLED 显示表情 + 语音播放 + 温湿度检测',
  '智能门锁：指纹识别 + RFID + 蓝牙解锁',
  '气象站：多传感器采集 + MQTT 上报 + 墨水屏显示',
]

const DRIVER_COLOR_CLASSES: Record<string, { selected: string; icon: string }> = {
  I2C: { selected: 'bg-indigo-500/15 border-indigo-500/50 text-indigo-400', icon: 'text-indigo-400' },
  SPI: { selected: 'bg-violet-500/15 border-violet-500/50 text-violet-400', icon: 'text-violet-400' },
  GPIO: { selected: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400', icon: 'text-emerald-400' },
  UART: { selected: 'bg-cyan-500/15 border-cyan-500/50 text-cyan-400', icon: 'text-cyan-400' },
  default: { selected: 'bg-slate-500/15 border-slate-500/50 text-slate-300', icon: 'text-slate-300' },
}

export default function RequirementPage() {
  const navigate = useNavigate()
  const project = useProjectStore(selectCurrentProject)
  const { getAllChipNames } = useChipStore()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  // 合并预置 + 自定义芯片列表
  const allChips = getAllChipNames()

  const [req, setReq] = useState(project?.requirement ?? '')
  const [target, setTarget] = useState<ChipTarget>(project?.target ?? 'ESP32')
  const [format, setFormat] = useState<ProjectFormat>(project?.format ?? 'espidf')
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'diagram'>('diagram')
  const [driverPanelOpen, setDriverPanelOpen] = useState(false)
  const [pickedDriverIds, setPickedDriverIds] = useState<string[]>(project?.selectedDriverIds ?? [])
  const [generationMode, setGenerationMode] = useState<'scheme-only' | 'full-generation'>('scheme-only')
  const generation = useGenerationStore()
  const isGenerating = generation.status === 'running' && generation.projectId === project?.id

  function toggleDriver(id: string) {
    setPickedDriverIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  /** 按规范流程启动方案生成或完整流水线。任务由全局协调器持有，路由切换不会中断。 */
  async function handleGenerate(createMode: 'update-current' | 'new-version' = 'update-current') {
    if (isGenerating) { cancelGeneration(); return }
    setError('')
    try {
      await startGeneration({ requirement: req, target, format, selectedDriverIds: pickedDriverIds, mode: generationMode, createMode })
    } catch (error) {
      setError(String((error as { message?: string })?.message ?? error))
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* 页头 */}
        <div className="mb-8 slide-in-left">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Cpu size={13} className="text-indigo-400" />
            </div>
            <span className="text-xs text-indigo-400 font-medium tracking-wide uppercase">Hardware Architect</span>
          </div>
          <h1 className="mb-1 text-2xl font-bold text-[var(--text-primary)]">描述你的硬件需求</h1>
          <p className="text-sm text-[var(--text-secondary)]">AI 自动生成完整的硬件方案、引脚分配和采购清单</p>
        </div>

        {/* 输入卡片 */}
        <div className="glass rounded-2xl p-5 mb-4 slide-in-left" style={{ animationDelay: '50ms' }}>
          <textarea
            value={req}
            onChange={e => setReq(e.target.value)}
            placeholder="例如：做一个 AI 桌宠，需要 OLED 显示表情、播放声音、检测环境温湿度，通过 WiFi 连接服务器获取天气..."
            rows={5}
            className="w-full resize-none bg-transparent text-sm leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />

          {/* 示例 */}
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-800/60">
            <span className="text-xs text-slate-600 self-center">示例：</span>
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => setReq(ex)}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-400 hover:text-indigo-300 hover:bg-indigo-950/40 transition-all duration-200 border border-slate-700/40 hover:border-indigo-500/30"
              >
                {ex.split('：')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* 配置行 */}
        <div className="flex items-center gap-4 mb-4 flex-wrap slide-in-left" style={{ animationDelay: '100ms' }}>
          {/* 芯片选择 */}
          <div className="glass rounded-xl p-1 flex gap-1 flex-wrap">
            {allChips.map(c => (
              <button
                key={c}
                onClick={() => setTarget(c)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150',
                  target === c
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                )}
              >
                {c}
              </button>
            ))}
            <button
              onClick={() => navigate('/design/chips')}
              title="管理芯片"
              aria-label="管理芯片"
              className="text-xs px-2 py-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
            >
              <Settings2 size={13} />
            </button>
          </div>

          {/* 工程格式 */}
          <div className="glass rounded-xl p-1 flex gap-1">
            {FORMATS.map(f => (
              <button
                key={f.value}
                onClick={() => setFormat(f.value)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150 flex items-center gap-1.5',
                  format === f.value
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                )}
              >
                {f.label}
                <span className={cn('text-[10px]', format === f.value ? 'text-violet-300' : 'text-slate-600')}>{f.desc}</span>
              </button>
            ))}
          </div>

          {/* 驱动预选面板 */}
          <div className="mt-3">
            <button
              onClick={() => setDriverPanelOpen(v => !v)}
              className={cn(
                'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all duration-150',
                isDark
                  ? 'text-orange-400 hover:bg-orange-500/10'
                  : 'text-orange-600 hover:bg-orange-500/10'
              )}
            >
              <Layers size={13} />
              手动预选外设驱动
              {pickedDriverIds.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold">{pickedDriverIds.length}</span>
              )}
              {driverPanelOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            {driverPanelOpen && (
              <div className={cn(
                'mt-2 p-3 rounded-xl border flex flex-wrap gap-2',
                isDark ? 'bg-slate-800/50 border-slate-700/40' : 'bg-slate-50 border-slate-200'
              )}>
                {DRIVER_TEMPLATES.map(d => {
                  const picked = pickedDriverIds.includes(d.id)
                  const colors = DRIVER_COLOR_CLASSES[d.interface] ?? DRIVER_COLOR_CLASSES.default
                  return (
                    <button
                      key={d.id}
                      onClick={() => toggleDriver(d.id)}
                      className={cn(
                        'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all duration-150 font-medium',
                        picked
                          ? colors.selected
                          : isDark
                            ? 'bg-slate-700/40 border-slate-600/40 text-slate-400 hover:border-slate-500'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                      )}
                    >
                      {picked && <Check size={10} className={colors.icon} />}
                      {d.name}
                      <span className="text-[10px] opacity-60">{d.interface}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 生成模式：把系统执行顺序明确呈现给用户 */}
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-1" aria-label="生成模式">
            <button type="button" disabled={isGenerating} onClick={() => setGenerationMode('scheme-only')} className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition-colors', generationMode === 'scheme-only' ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]')}>
              仅生成方案
            </button>
            <button type="button" disabled={isGenerating} onClick={() => setGenerationMode('full-generation')} className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition-colors', generationMode === 'full-generation' ? 'bg-violet-600 text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]')}>
              完整生成
            </button>
          </div>

          {/* 生成按钮 */}
          <button
            onClick={() => handleGenerate()}
            disabled={!isGenerating && !req.trim()}
            className={cn(
              'ml-auto flex items-center gap-2 px-5 py-2 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0',
              isGenerating
                ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-500/20'
            )}
          >
            {isGenerating
              ? <><Square size={14} /> 取消任务</>
              : <><Sparkles size={15} /> {generationMode === 'full-generation' ? '开始完整生成' : '生成硬件方案'}</>
            }
          </button>
          {project && !isGenerating && (
            <button type="button" onClick={() => handleGenerate('new-version')} disabled={!req.trim()} className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]" title="保留当前项目并创建独立版本">
              另存为新版本
            </button>
          )}
        </div>

        {/* 加载动画 */}
        <div className="mb-4">
          <GenerationProgress projectId={project?.id} />
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm mb-4 p-3 bg-red-950/20 border border-red-900/40 rounded-xl fade-in">
            <AlertCircle size={15} className="flex-shrink-0" /> {error}
          </div>
        )}

        {/* 结果区 */}
        {project?.scheme && (
          <div className="flex flex-col gap-4 fade-in-up">
            {/* 精准度提示 */}
            <div className={cn(
              'flex items-start gap-2 px-4 py-2.5 rounded-xl text-[11px] leading-relaxed',
              isDark ? 'bg-indigo-500/5 text-indigo-400/70 border border-indigo-500/10' : 'bg-indigo-50 text-indigo-500/70 border border-indigo-200/50'
            )}>
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              <span>方案精准度与所选 AI 模型性能及芯片参数完整度直接相关。建议使用高性能模型，并在「芯片管理」中补充完善芯片技术规格。</span>
            </div>
            {/* 方案概述 */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-indigo-400" />
                <span className="text-xs font-medium text-indigo-400 uppercase tracking-wide">方案概述</span>
              </div>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{project.scheme.description}</p>
            </div>

            {/* 视图切换 */}
            <div className="flex w-fit items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-1">
              <button
                onClick={() => setViewMode('diagram')}
                className={cn(
                  'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all',
                  viewMode === 'diagram'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                <MapPin size={13} />
                引脚图
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all',
                  viewMode === 'table'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <Table2 size={13} />
                表格
              </button>
            </div>

            {/* 引脚视图 */}
            {viewMode === 'diagram' ? (
              <div className="glass-card p-5 flex flex-col items-center">
                <PinDiagram pins={project.scheme.pins} chipType={project.target} />
              </div>
            ) : (
              <PinTable pins={project.scheme.pins} />
            )}

            <BOMTable bom={project.scheme.bom} />
            {/* BOM 价格免责提示 */}
            <div className={cn(
              'flex items-start gap-2 px-4 py-2.5 rounded-xl text-[11px] leading-relaxed',
              isDark ? 'bg-amber-500/5 text-amber-400/70 border border-amber-500/10' : 'bg-amber-50 text-amber-600/70 border border-amber-200/50'
            )}>
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <span>以上 BOM 价格均为 AI 预估参考价，实际采购价格以供应商报价为准，仅供方案评估参考。</span>
            </div>
            <WiringTable wiring={project.scheme.wiring} />

            <div className="flex justify-end">
              <button
                onClick={() => navigate('/implementation/code')}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                生成工程代码 <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
