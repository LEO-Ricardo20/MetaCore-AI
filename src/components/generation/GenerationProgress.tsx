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
    <section className={cn('trajectory-panel surface-panel fade-in', compact ? 'p-3' : 'p-5')} aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border', running ? 'border-[var(--border-medium)] bg-[var(--surface-selected)] text-[var(--accent-cyan)]' : state.status === 'failed' ? 'border-red-500/25 bg-red-500/10 text-red-500' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500')}>
            {running ? <Loader2 size={16} className="animate-spin" /> : state.status === 'failed' ? <AlertCircle size={16} /> : <Check size={16} />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-[var(--text-primary)]">{running ? labels[state.stage] : state.message}</p>{running && <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-[9px] text-[var(--text-muted)]">RUNNING · {elapsed}s</span>}</div>
            <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{state.message}</p>
          </div>
        </div>
        {running && <button type="button" onClick={cancelGeneration} className="icon-button shrink-0 border border-red-500/20 bg-red-500/5 text-red-500" title="取消生成" aria-label="取消生成"><Square size={14} /></button>}
        {!running && (state.status === 'failed' || state.status === 'cancelled') && <button type="button" onClick={retryGeneration} className="icon-button shrink-0 text-indigo-600 dark:text-indigo-300" title="重试生成" aria-label="重试生成"><RotateCcw size={14} /></button>}
      </div>

      <div className="mt-4 grid grid-cols-5 gap-1">
        {order.map((step, index) => {
          const done = !running && state.status === 'succeeded' ? true : activeIndex > index
          const current = running && state.stage === step
          return <div key={step} className="min-w-0">
            <div className={cn('h-1 rounded-full transition-colors', done ? 'bg-emerald-500' : current ? 'progress-bar' : 'bg-[var(--border-subtle)]')} />
            {!compact && <p className={cn('mt-1.5 truncate text-[10px]', current ? 'text-[var(--accent-cyan)]' : done ? 'text-emerald-600 dark:text-emerald-300' : 'text-[var(--text-muted)]')}>{labels[step]}</p>}
          </div>
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
        <p className="text-[11px] text-[var(--text-muted)]">{running ? '可以切换到其他页面，任务会在后台继续。' : '运行轨迹已写入当前项目。'}</p>
        {(state.sessionId || state.jobId) && <p className="truncate font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Session {state.sessionId?.slice(0, 8) ?? '—'} · Job {state.jobId?.slice(0, 8) ?? 'completed'}</p>}
      </div>
      {state.warning && <p className="mt-3 whitespace-pre-line text-xs text-amber-600">{state.warning}</p>}
      {state.error && state.status === 'failed' && <p className="mt-3 whitespace-pre-line text-xs text-red-600">{state.error}</p>}
    </section>
  )
}
