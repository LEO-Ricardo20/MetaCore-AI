/** 代码生成页 — 基于硬件方案生成模块化工程代码，支持自检验证 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '@/store/projectStore'
import { useAIConfigStore } from '@/store/aiConfigStore'
import { useChipStore } from '@/store/chipStore'
import { useThemeStore } from '@/store/themeStore'
import { callAI } from '@/services/ai/client'
import { buildCodegenPrompt, buildVerifyPrompt } from '@/services/ai/prompts'
import { parseJSON } from '@/lib/utils'
import type { CodeFile } from '@/types/project'
import FileTree from '@/components/codegen/FileTree'
import CodePreview from '@/components/codegen/CodePreview'
import ExportButtons from '@/components/codegen/ExportButtons'
import { Loader2, Code2, AlertCircle, AlertTriangle, Sparkles, Cpu } from 'lucide-react'
import { matchDriverTemplates, DRIVER_TEMPLATES } from '@/data/driverTemplates'
import { cn } from '@/lib/utils'

export default function CodegenPage() {
  const navigate = useNavigate()
  const { project, setCodeFiles, setGenerating, isGeneratingCode } = useProjectStore()
  const { getActive } = useAIConfigStore()
  const { getSpec } = useChipStore()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  /** 生成代码 + 后台自检一致性 */
  async function handleGenerate() {
    if (!project?.scheme) return
    const svc = getActive()
    if (!svc) { setError('请先在设置页配置并选择 AI 服务'); return }
    setError('')
    setWarning('')
    setGenerating('code', true)
    try {
      // 第 1 步：生成代码（低温度保证确定性）
      const chipSpec = getSpec(project.target) ?? undefined
      const prompt = buildCodegenPrompt(project.scheme, project.target, project.format, chipSpec)
      const raw = await callAI(svc, [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ], { temperature: 0.15 })
      const result = parseJSON<{ files: CodeFile[] }>(raw)
      if (!result?.files?.length) throw new Error('AI 返回格式解析失败，请重试')
      setCodeFiles(result.files)

      // 第 2 步：后台自检（不阻塞 UI）
      try {
        const verifyRaw = await callAI(svc, [
          { role: 'user', content: buildVerifyPrompt(project.scheme, result.files) }
        ], { temperature: 0.1 })
        const verification = parseJSON<{ consistent: boolean; issues: string[] }>(verifyRaw)
        if (verification && !verification.consistent && verification.issues.length > 0) {
          setWarning(`AI 自检发现 ${verification.issues.length} 个潜在问题：\n${verification.issues.join('\n')}`)
        }
      } catch { /* 验证失败不影响主流程 */ }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGenerating('code', false)
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
        <p className="text-sm">请先在需求页生成硬件方案</p>
        <button
          onClick={() => navigate('/requirement')}
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
          {project.codeFiles.length === 0 ? (
            <button
              onClick={handleGenerate}
              disabled={isGeneratingCode}
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-xl transition-all',
                isGeneratingCode
                  ? isDark ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 active:translate-y-0'
              )}
            >
              {isGeneratingCode ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {isGeneratingCode ? 'AI 生成中...' : '生成代码'}
            </button>
          ) : (
            <ExportButtons />
          )}
        </div>
      </div>

      {/* 加载 */}
      {isGeneratingCode && (
        <div className={cn(
          'flex flex-col items-center justify-center py-12 gap-4',
          isDark ? 'text-slate-400' : 'text-slate-500'
        )}>
          <Loader2 size={28} className="animate-spin text-indigo-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-indigo-400 mb-1">AI 正在生成模块化代码</p>
            <p className="text-xs">解析硬件方案，构建模块化工程...</p>
          </div>
          <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full progress-bar" />
          </div>
        </div>
      )}

      {/* 主体 */}
      {!isGeneratingCode && project.codeFiles.length > 0 && (
        <div className="flex flex-1 overflow-hidden">
          <FileTree />
          <CodePreview />
        </div>
      )}

      {!isGeneratingCode && project.codeFiles.length === 0 && (
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
          <p className="text-sm">点击上方「生成代码」开始构建工程</p>
        </div>
      )}
    </div>
  )
}
