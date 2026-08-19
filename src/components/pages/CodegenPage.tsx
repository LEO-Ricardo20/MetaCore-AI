/** 代码生成页 — 基于硬件方案生成模块化工程代码，支持自检验证 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { selectCurrentProject, useProjectStore } from '@/store/projectStore'
import { useThemeStore } from '@/store/themeStore'
import { startGeneration, cancelGeneration } from '@/services/ai/generationCoordinator'
import GenerationProgress from '@/components/generation/GenerationProgress'
import { useGenerationStore } from '@/store/generationStore'
import FileTree from '@/components/codegen/FileTree'
import CodePreview from '@/components/codegen/CodePreview'
import ExportButtons from '@/components/codegen/ExportButtons'
import { Code2, AlertCircle, AlertTriangle, Sparkles, Cpu, Square } from 'lucide-react'
import { matchDriverTemplates, DRIVER_TEMPLATES } from '@/data/driverTemplates'
import { cn } from '@/lib/utils'

export default function CodegenPage() {
  const navigate = useNavigate()
  const project = useProjectStore(selectCurrentProject)
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const generation = useGenerationStore()
  const isGeneratingCode = generation.status === 'running' && generation.projectId === project?.id && (generation.mode === 'code-only' || generation.mode === 'full-generation')

  async function handleGenerate() {
    if (!project) { navigate('/design/requirements'); return }
    if (!project.scheme) { navigate('/design/requirements'); return }
    if (isGeneratingCode) { cancelGeneration(); return }
    setError('')
    setWarning('')
    try {
      await startGeneration({ mode: 'code-only', projectId: project.id })
    } catch (e: any) {
      setError(String(e?.message ?? e))
    }
  }

  if (!project) {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center h-full gap-4',
        isDark ? 'text-slate-400' : 'text-slate-500'
      )}>
        <div className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center',
          isDark ? 'bg-slate-800/80' : 'bg-indigo-50'
        )}>
          <Code2 size={28} className={isDark ? 'opacity-30' : 'opacity-40'} />
        </div>
        <p className="text-sm">请先完成需求并生成硬件方案</p>
        <button
          onClick={() => navigate('/design/requirements')}
          className="text-sm text-indigo-400 hover:text-indigo-300 font-medium hover:underline"
        >
          前往需求页 →
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶栏 */}
      <div className={cn(
        'flex items-center justify-between px-5 py-3 border-b transition-colors duration-300',
        isDark ? 'border-slate-700/50 bg-slate-900/50' : 'border-indigo-100/50 bg-white/50'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center',
            isDark ? 'bg-violet-500/15' : 'bg-violet-50'
          )}>
            <Code2 size={15} className={isDark ? 'text-violet-400' : 'text-violet-500'} />
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-slate-800')}>
              {project.name}
            </span>
            <span className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
              {project.target} · {project.format}
            </span>
            {project.scheme && (() => {
              const autoMatched = matchDriverTemplates(project.scheme!)
              const manualSelected = DRIVER_TEMPLATES.filter(d =>
                (project.selectedDriverIds ?? []).includes(d.id)
              )
              const matched = [...new Map(
                [...autoMatched, ...manualSelected].map(d => [d.id, d])
              ).values()]
              return matched.length > 0 ? (
                <span className={cn(
                  'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border font-medium',
                  isDark
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                )}>
                  <Cpu size={9} />
                  {matched.map(d => {
                    const labels: Record<string, string> = {
                      ssd1306: 'SSD1306', dht: 'DHT',
                      aht20: 'AHT20', ws2812: 'WS2812',
                      hcsr04: 'HC-SR04', buzzer: '蜂鸣器',
                      servo: '舵机', drv8833: 'DRV8833',
                    }
                    return labels[d.id] ?? d.id
                  }).join(' · ')} 驱动已注入
                </span>
              ) : null
            })()}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <div className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg',
              isDark ? 'bg-red-950/30 text-red-400 border border-red-900/30' : 'bg-red-50 text-red-600 border border-red-200'
            )}>
              <AlertCircle size={13} /> {error}
            </div>
          )}
          {warning && (
            <div className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg max-w-md',
              isDark ? 'bg-amber-950/30 text-amber-400 border border-amber-900/30' : 'bg-amber-50 text-amber-600 border border-amber-200'
            )}>
              <AlertTriangle size={13} className="flex-shrink-0" />
              <span className="truncate" title={warning}>AI 自检发现潜在问题</span>
            </div>
          )}
          {!project.scheme ? (
            <button type="button" onClick={() => navigate('/design/requirements')} className="btn-primary flex items-center gap-2 rounded-[var(--radius-control)] px-4 py-1.5 text-sm font-medium text-white">
              <Sparkles size={14} /> 去生成方案
            </button>
          ) : project.codeFiles.length === 0 ? (
            <button
              onClick={handleGenerate}
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-xl transition-all',
                isGeneratingCode
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'btn-primary text-white hover:-translate-y-0.5 active:translate-y-0'
              )}
            >
              {isGeneratingCode ? <Square size={13} /> : <Sparkles size={14} />}
              {isGeneratingCode ? '取消生成' : '生成代码'}
            </button>
          ) : (
            <ExportButtons />
          )}
        </div>
      </div>

      <div className="px-5 pt-4"><GenerationProgress projectId={project.id} /></div>

      {/* 主体 */}
      {!isGeneratingCode && project.codeFiles.length > 0 && (
        <div className="flex flex-1 overflow-hidden">
          <FileTree />
          <CodePreview />
        </div>
      )}

      {!isGeneratingCode && project.scheme && project.codeFiles.length === 0 && (
        <div className={cn(
          'flex flex-col items-center justify-center flex-1 gap-3',
          isDark ? 'text-slate-500' : 'text-slate-400'
        )}>
          <div className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center',
            isDark ? 'bg-slate-800/60' : 'bg-indigo-50'
          )}>
            <Code2 size={28} className={isDark ? 'text-slate-600' : 'text-indigo-300'} />
          </div>
          <p className="text-sm">完成硬件方案后，点击上方「生成代码」开始构建工程</p>
        </div>
      )}
    </div>
  )
}
