import { AlertCircle, Check, Loader2, RotateCcw, Square } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cancelGeneration, retryGeneration } from '@/services/ai/generationCoordinator'
import { useGenerationStore, type GenerationStage } from '@/store/generationStore'
import { cn } from '@/lib/utils'

const labels: Record<GenerationStage, string> = {
  preparing: '准备任务',
  scheme: '生成硬件方案',
  'scheme-validation': '校验硬件约束',
  code: '生成工程代码',
  'code-validation': '校验代码一致性',
  flow: '生成执行流程',
}

const order: GenerationStage[] = ['scheme', 'scheme-validation', 'code', 'code-validation', 'flow']

export default function GenerationProgress({ projectId, compact = false }: { projectId?: string | null; compact?: boolean }) {
  const state = useGenerationStore()
  const running = state.status === 'running'
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!running || !state.startedAt) { setElapsed(0); return }
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - state.startedAt!) / 1000)))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [running, state.startedAt])
  if (state.status === 'idle' || (projectId && state.projectId !== projectId)) return null
  const activeIndex = order.indexOf(state.stage)

  return (
    <section className={cn('surface-panel fade-in', compact ? 'p-3' : 'p-5')} aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', running ? 'bg-indigo-500/15 text-indigo-400' : state.status === 'failed' ? 'bg-red-500/15 text-red-500' : 'bg-emerald-500/15 text-emerald-500')}>
            {running ? <Loader2 size={16} className="animate-spin" /> : state.status === 'failed' ? <AlertCircle size={16} /> : <Check size={16} />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{running ? labels[state.stage] : state.message}</p>
            <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{state.message}{running ? ` · 已等待 ${elapsed}s` : ''}</p>
          </div>
        </div>
        {running && <button type="button" onClick={cancelGeneration} className="icon-button shrink-0 text-red-500" title="取消生成" aria-label="取消生成"><Square size={14} /></button>}
        {!running && (state.status === 'failed' || state.status === 'cancelled') && <button type="button" onClick={retryGeneration} className="icon-button shrink-0 text-indigo-600 dark:text-indigo-300" title="重试生成" aria-label="重试生成"><RotateCcw size={14} /></button>}
      </div>

      <div className="mt-4 grid grid-cols-5 gap-1">
        {order.map((step, index) => {
          const done = !running && state.status === 'succeeded' ? true : activeIndex > index
          const current = running && state.stage === step
          return <div key={step} className="min-w-0">
            <div className={cn('h-1.5 rounded-full transition-colors', done ? 'bg-emerald-500' : current ? 'bg-indigo-500 progress-bar' : 'bg-[var(--border-subtle)]')} />
            {!compact && <p className={cn('mt-1 truncate text-[10px]', current ? 'text-indigo-500' : done ? 'text-emerald-600' : 'text-[var(--text-muted)]')}>{labels[step]}</p>}
          </div>
        })}
      </div>
      {running && <p className="mt-3 text-[11px] text-[var(--text-muted)]">可以切换到其他页面，任务会在后台继续。</p>}
      {(state.sessionId || state.jobId) && <p className="mt-2 truncate font-mono text-[10px] text-[var(--text-muted)]">Session {state.sessionId?.slice(0, 8) ?? '—'} · Job {state.jobId?.slice(0, 8) ?? '已完成'}</p>}
      {state.warning && <p className="mt-3 whitespace-pre-line text-xs text-amber-600">{state.warning}</p>}
      {state.error && state.status === 'failed' && <p className="mt-3 whitespace-pre-line text-xs text-red-600">{state.error}</p>}
    </section>
  )
}
