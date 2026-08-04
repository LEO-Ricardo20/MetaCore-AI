/** 流程图页 — 自动分析代码执行流程，生成可交互的可视化节点图 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { selectCurrentProject, useProjectStore } from '@/store/projectStore'
import { useAIConfigStore } from '@/store/aiConfigStore'
import { useThemeStore } from '@/store/themeStore'
import { runFlowgen } from '@/services/ai/flowgen'
import FlowCanvas from '@/components/flow/FlowCanvas'
import AIChatPanel from '@/components/flow/AIChatPanel'
import { Loader2, GitBranch, AlertCircle, MessageSquare, Sparkles, Info, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function FlowPage() {
  const navigate = useNavigate()
  const project = useProjectStore(selectCurrentProject)
  const { setFlowData, setGenerating, isGeneratingFlow } = useProjectStore()
  const { getActive } = useAIConfigStore()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const [error, setError] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const generationController = useRef<AbortController | null>(null)

  useEffect(() => () => generationController.current?.abort(), [])

  async function handleGenerate() {
    if (!project?.codeFiles.length) return
    const svc = getActive()
    if (!svc) { setError('请先在设置页配置并选择 AI 服务'); return }
    setError('')
    setGenerating('flow', true)
    const controller = new AbortController()
    generationController.current?.abort()
    generationController.current = controller
    try {
      const result = await runFlowgen(svc, project.codeFiles, { signal: controller.signal })
      setFlowData(result.nodes, result.edges)
    } catch (e: any) {
      setError(e.message)
    } finally {
      if (generationController.current === controller) generationController.current = null
      setGenerating('flow', false)
    }
  }

  function handleCancelGeneration() {
    generationController.current?.abort()
  }

  if (!project?.codeFiles.length) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full gap-4', isDark ? 'text-slate-400' : 'text-slate-500')}>
        <div className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center',
          isDark ? 'bg-slate-800/80' : 'bg-indigo-50'
        )}>
          <GitBranch size={28} className={isDark ? 'opacity-30' : 'opacity-40'} />
        </div>
        <p className="text-sm">请先在工程页生成代码</p>
        <button
          onClick={() => navigate('/codegen')}
          className="text-sm text-indigo-400 hover:text-indigo-300 font-medium hover:underline"
        >
          前往工程页 →
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶栏 */}
      <div className={cn(
        'flex items-center justify-between px-5 py-3 border-b',
        isDark ? 'border-slate-700/50 bg-slate-900/50' : 'border-indigo-100 bg-white/50'
      )}>
        {/* 左侧：标题 */}
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center',
            isDark ? 'bg-fuchsia-500/15' : 'bg-fuchsia-50'
          )}>
            <GitBranch size={16} className={isDark ? 'text-fuchsia-400' : 'text-fuchsia-500'} />
          </div>
          <div>
            <h2 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-slate-800')}>代码执行流程图</h2>
            <p className={cn('text-[10px]', isDark ? 'text-slate-500' : 'text-slate-400')}>
              {project.flowNodes.length > 0
                ? `${project.flowNodes.length} 个节点 · ${project.flowEdges.length} 条连接`
                : '分析代码逻辑，可视化执行流程'
              }
            </p>
          </div>
        </div>

        {/* 右侧：操作 */}
        <div className="flex items-center gap-3">
          {error && (
            <div className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg',
              isDark ? 'bg-red-950/30 text-red-400 border border-red-900/30' : 'bg-red-50 text-red-600 border border-red-200'
            )}>
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {project.flowNodes.length > 0 && (
            <div className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg',
              isDark ? 'bg-green-950/30 text-green-400 border border-green-900/30' : 'bg-green-50 text-green-600 border border-green-200'
            )}>
              <Sparkles size={12} />
              已生成
            </div>
          )}

          <button
            onClick={() => setChatOpen(o => !o)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-xl transition-all',
              chatOpen
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg shadow-indigo-500/20'
                : isDark
                  ? 'bg-slate-700/80 text-slate-200 hover:bg-slate-600/80'
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200'
            )}
          >
            <MessageSquare size={14} />
            AI 问答
          </button>

          {project.flowNodes.length === 0 && (
            <button
              onClick={isGeneratingFlow ? handleCancelGeneration : handleGenerate}
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-xl transition-all',
                isGeneratingFlow
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 active:translate-y-0'
              )}
            >
              {isGeneratingFlow ? <Square size={13} /> : <Sparkles size={14} />}
              {isGeneratingFlow ? '取消分析' : '生成流程图'}
            </button>
          )}
        </div>
      </div>

      {/* 加载状态 */}
      {isGeneratingFlow && (
        <div className={cn(
          'flex flex-col items-center justify-center py-12 gap-4',
          isDark ? 'text-slate-400' : 'text-slate-500'
        )}>
          <div className="relative">
            <Loader2 size={32} className="animate-spin text-indigo-400" />
            <div className="absolute inset-0 blur-xl bg-indigo-500/20 rounded-full" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-indigo-400 mb-1">AI 正在分析代码逻辑</p>
            <p className="text-xs text-slate-500">解析模块结构，构建执行流程...</p>
          </div>
          <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full progress-bar" />
          </div>
        </div>
      )}

      {/* 主体 */}
      <div className="flex flex-1 overflow-hidden">
        {isGeneratingFlow ? null : project.flowNodes.length > 0 ? (
          <FlowCanvas />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className={cn(
              'w-20 h-20 rounded-2xl flex items-center justify-center',
              isDark ? 'bg-slate-800/60' : 'bg-indigo-50'
            )}>
              <GitBranch size={36} className={isDark ? 'text-slate-600' : 'text-indigo-300'} />
            </div>
            <div className="text-center">
              <p className={cn('text-sm font-medium mb-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
                点击上方「生成流程图」
              </p>
              <p className={cn('text-xs', isDark ? 'text-slate-600' : 'text-slate-400')}>
                AI 将分析代码生成可视化执行流程
              </p>
            </div>

            {/* 提示信息 */}
            <div className={cn(
              'flex items-start gap-2 p-3 rounded-xl max-w-sm text-xs',
              isDark ? 'bg-indigo-950/20 border border-indigo-900/20' : 'bg-indigo-50/80 border border-indigo-200/50'
            )}>
              <Info size={14} className="text-indigo-400 mt-0.5 flex-shrink-0" />
              <p className={cn('leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-500')}>
                流程图节点按功能分类（初始化/传感器/通信/显示/错误处理），点击节点展开查看关联代码片段。右侧可打开 AI 问答。
              </p>
            </div>
          </div>
        )}
        {chatOpen && <AIChatPanel onClose={() => setChatOpen(false)} />}
      </div>
    </div>
  )
}
