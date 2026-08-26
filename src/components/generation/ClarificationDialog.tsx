import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Gauge,
  Loader2,
  MessageCircleQuestion,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import type { AITaskClarification } from '@/types/agent'
import type { HardwareModelSelection } from '@/types/project'
import { resumeGenerationWithClarification } from '@/services/ai/generationCoordinator'
import {
  candidateToClarificationAnswer,
  DEFAULT_SELECTION_PRIORITIES,
  requestHardwareCandidates,
  SELECTION_PRIORITY_META,
  selectionPriorityTotal,
  updateSelectionPriority,
  type HardwareCandidate,
  type HardwareCandidatePlan,
  type HardwareCandidateSet,
  type SelectionPriorityKey,
  type SelectionPriorities,
} from '@/services/ai/selectionAssistant'
import { cn } from '@/lib/utils'

interface Props {
  clarification: AITaskClarification
  open: boolean
  onClose: () => void
}

const priorityStyles: Record<SelectionPriorityKey, { bar: string; text: string; border: string; background: string; accent: string }> = {
  common: { bar: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-500/30', background: 'bg-cyan-500/5', accent: '#06b6d4' },
  optimal: { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/30', background: 'bg-emerald-500/5', accent: '#10b981' },
  value: { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/30', background: 'bg-amber-500/5', accent: '#f59e0b' },
  best: { bar: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-500/30', background: 'bg-rose-500/5', accent: '#f43f5e' },
}

const confidenceLabels: Record<HardwareCandidate['confidence'], string> = {
  high: '高可信',
  medium: '需复核',
  low: '低可信',
}

export default function ClarificationDialog({ clarification, open, onClose }: Props) {
  const [answers, setAnswers] = useState<string[]>([])
  const [priorities, setPriorities] = useState<SelectionPriorities>(DEFAULT_SELECTION_PRIORITIES)
  const [candidateSets, setCandidateSets] = useState<Record<number, HardwareCandidateSet>>({})
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Record<number, string>>({})
  const [selectionSources, setSelectionSources] = useState<Record<number, 'ai-candidate' | 'ai-auto'>>({})
  const [safetySummary, setSafetySummary] = useState('')
  const [candidateLoading, setCandidateLoading] = useState<'all' | number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const requestController = useRef<AbortController | null>(null)
  const total = useMemo(() => selectionPriorityTotal(priorities), [priorities])
  const remaining = 100 - total

  useEffect(() => {
    if (open) {
      setAnswers(clarification.questions.map(() => ''))
      setPriorities(DEFAULT_SELECTION_PRIORITIES)
      setCandidateSets({})
      setSelectedCandidateIds({})
      setSelectionSources({})
      setSafetySummary('')
      setCandidateLoading(null)
      setError('')
    } else {
      requestController.current?.abort()
    }
  }, [clarification, open])

  useEffect(() => () => requestController.current?.abort(), [])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting && candidateLoading === null) onClose()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [candidateLoading, onClose, open, submitting])

  if (!open) return null

  function setAnswer(index: number, value: string) {
    setAnswers((current) => current.map((answer, itemIndex) => itemIndex === index ? value : answer))
    setSelectedCandidateIds((current) => {
      if (!(index in current)) return current
      const next = { ...current }
      delete next[index]
      return next
    })
    setSelectionSources((current) => {
      if (!(index in current)) return current
      const next = { ...current }
      delete next[index]
      return next
    })
  }

  function resetPriorities() {
    setPriorities(DEFAULT_SELECTION_PRIORITIES)
    setAnswers((current) => current.map((answer, index) => selectedCandidateIds[index] ? '' : answer))
    setCandidateSets({})
    setSelectedCandidateIds({})
    setSelectionSources({})
    setSafetySummary('')
    setError('')
  }

  function handlePriorityChange(key: SelectionPriorityKey, requestedValue: number) {
    const next = updateSelectionPriority(priorities, key, requestedValue)
    if (next[key] === priorities[key]) return
    setPriorities(next)
    setAnswers((current) => current.map((answer, index) => selectedCandidateIds[index] ? '' : answer))
    setCandidateSets({})
    setSelectedCandidateIds({})
    setSelectionSources({})
    setSafetySummary('')
    setError('')
  }

  async function loadCandidates(indexes: number[]): Promise<HardwareCandidatePlan | null> {
    if (total !== 100) {
      setError(`请先分配完 100 点选型权重，当前还有 ${remaining} 点未分配。`)
      return null
    }
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    setCandidateLoading(indexes.length === clarification.questions.length ? 'all' : indexes[0])
    setError('')
    try {
      const plan = await requestHardwareCandidates(
        indexes.map((questionIndex) => ({
          questionIndex,
          question: clarification.questions[questionIndex],
          answer: answers[questionIndex],
        })),
        priorities,
        controller.signal,
      )
      setCandidateSets((current) => ({
        ...current,
        ...Object.fromEntries(plan.sets.map((set) => [set.questionIndex, set])),
      }))
      setSafetySummary(plan.safetySummary)
      return plan
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '无法获取 AI 候选方案')
      return null
    } finally {
      if (requestController.current === controller) {
        requestController.current = null
        setCandidateLoading(null)
      }
    }
  }

  function applyCandidate(set: HardwareCandidateSet, candidate: HardwareCandidate) {
    setAnswers((current) => current.map((answer, index) => index === set.questionIndex ? candidateToClarificationAnswer(set, candidate) : answer))
    setSelectedCandidateIds((current) => ({ ...current, [set.questionIndex]: candidate.id }))
    setSelectionSources((current) => ({ ...current, [set.questionIndex]: 'ai-candidate' }))
    setError('')
  }

  async function handleAutoSelect() {
    let availableSets = { ...candidateSets }
    const missingIndexes = clarification.questions.map((_, index) => index).filter((index) => !availableSets[index])
    if (missingIndexes.length) {
      const plan = await loadCandidates(missingIndexes)
      if (!plan) return
      availableSets = { ...availableSets, ...Object.fromEntries(plan.sets.map((set) => [set.questionIndex, set])) }
    }
    const nextAnswers = [...answers]
    const nextSelected = { ...selectedCandidateIds }
    for (const index of clarification.questions.map((_, itemIndex) => itemIndex)) {
      const set = availableSets[index]
      const candidate = set?.candidates.find((item) => item.id === set.recommendedId)
      if (!set || !candidate) continue
      nextAnswers[index] = candidateToClarificationAnswer(set, candidate)
      nextSelected[index] = candidate.id
    }
    setCandidateSets(availableSets)
    setAnswers(nextAnswers)
    setSelectedCandidateIds(nextSelected)
    setSelectionSources(Object.fromEntries(clarification.questions.map((_, index) => [index, 'ai-auto'])) as Record<number, 'ai-auto'>)
    setError('')
  }

  async function handleSubmit() {
    const normalized = answers.map((answer) => answer.trim())
    if (total !== 100) {
      setError(`四项选型权重合计必须是 100，当前为 ${total}。`)
      return
    }
    if (normalized.some((answer) => !answer)) {
      setError('还有问题没有回答。可以生成候选后手动选择，或点击“AI 自动选择”。')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const modelSelection: HardwareModelSelection = {
        items: clarification.questions.map((question, index) => {
          const set = candidateSets[index]
          const candidate = set?.candidates.find((item) => item.id === selectedCandidateIds[index])
          return {
            question,
            selectedModel: candidate?.model ?? '用户手动指定',
            selectedAnswer: normalized[index],
            selectedCategory: candidate?.category,
            rationale: candidate?.rationale,
            source: selectionSources[index] ?? 'user',
          }
        }),
        priorities,
        safetySummary: safetySummary || undefined,
        confirmedAt: Date.now(),
      }
      await resumeGenerationWithClarification(normalized, { selectionPriorities: priorities, candidateSafetySummary: safetySummary, modelSelection })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法继续生成')
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || candidateLoading !== null
  const allAnswered = answers.length === clarification.questions.length && answers.every((answer) => answer.trim())

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-2 backdrop-blur-[2px] sm:p-4" onClick={() => { if (!busy) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="clarification-dialog-title" onClick={(event) => event.stopPropagation()} className="flex max-h-[calc(100dvh-1rem)] w-full max-w-[1120px] flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-medium)] bg-[var(--surface-base)] shadow-2xl sm:max-h-[min(94dvh,900px)]">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-cyan-400/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300"><MessageCircleQuestion size={18} /></div>
            <div className="min-w-0">
              <h2 id="clarification-dialog-title" className="text-base font-semibold text-[var(--text-primary)]">确认工程参数与硬件选型</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">AI 已暂停生成以避免猜测硬件。你可以填写已知型号，也可以让 AI 按保守策略提供候选。</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="icon-button shrink-0 disabled:opacity-40" title="稍后回答" aria-label="稍后回答"><X size={17} /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-start gap-2 rounded-[var(--radius-control)] border border-cyan-400/25 bg-cyan-500/5 px-3 py-2.5 text-[11px] leading-5 text-[var(--text-secondary)]">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-cyan-600 dark:text-cyan-300" />
            <p><span className="font-semibold text-cyan-700 dark:text-cyan-300">稳定性优先：</span>电气安全、器件降额、资料完整性和可供应性是不可越过的门槛。权重只在通过安全门槛的候选中排序。</p>
          </div>

          <section className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]" aria-labelledby="selection-priority-title">
            <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-[var(--surface-selected)] text-[var(--accent-cyan)]"><SlidersHorizontal size={16} /></div>
                <div><h3 id="selection-priority-title" className="text-sm font-semibold text-[var(--text-primary)]">分配 AI 选型偏好</h3><p className="mt-0.5 text-[11px] leading-5 text-[var(--text-secondary)]">共 100 点。要提高一项，请先从其他项释放点数；提交前四项必须合计 100。</p></div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button type="button" onClick={() => { void loadCandidates(clarification.questions.map((_, index) => index)) }} disabled={busy || total !== 100} className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-medium)] bg-[var(--surface-base)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-45">
                  {candidateLoading === 'all' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-[var(--accent-cyan)]" />}一键生成全部候选
                </button>
                <button type="button" onClick={() => { void handleAutoSelect() }} disabled={busy || total !== 100} className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-45">
                  {candidateLoading !== null ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}AI 自动选择
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              <div className="mb-3 flex h-9 w-full overflow-hidden rounded-[6px] border border-[var(--border-subtle)] bg-[var(--surface-base)]" aria-label={`选型权重分布，已分配 ${total} 点`}>
                {SELECTION_PRIORITY_META.map((item) => priorities[item.key] > 0 && (
                  <div key={item.key} className={cn('flex h-full min-w-0 items-center justify-center overflow-hidden transition-[width] duration-200', priorityStyles[item.key].bar)} style={{ width: `${priorities[item.key]}%` }} title={`${item.label} ${priorities[item.key]}%`}>
                    {priorities[item.key] >= 12 && <span className="truncate px-1 text-[10px] font-semibold text-white">{item.shortLabel} {priorities[item.key]}</span>}
                  </div>
                ))}
                {remaining > 0 && <div className="flex h-full min-w-0 items-center justify-center bg-[var(--surface-base)] text-[10px] text-[var(--text-muted)]" style={{ width: `${remaining}%` }}>{remaining >= 10 ? `待分配 ${remaining}` : ''}</div>}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {SELECTION_PRIORITY_META.map((item) => {
                  const style = priorityStyles[item.key]
                  return (
                    <label key={item.key} className={cn('block rounded-[6px] border p-3', style.border, style.background)}>
                      <span className="flex items-center justify-between gap-3"><span className={cn('text-xs font-semibold', style.text)}>{item.label}</span><span className="w-11 text-right font-mono text-sm font-bold text-[var(--text-primary)]">{priorities[item.key]}</span></span>
                      <input type="range" min={0} max={100} step={1} value={priorities[item.key]} onChange={(event) => handlePriorityChange(item.key, Number(event.target.value))} className="mt-2 h-2 w-full cursor-pointer" style={{ accentColor: style.accent }} aria-label={`${item.label}权重`} />
                      <span className="mt-1.5 block text-[10px] leading-4 text-[var(--text-muted)]">{item.description}</span>
                    </label>
                  )
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3 text-[11px]">
                <span className={cn('inline-flex items-center gap-1.5 font-semibold', total === 100 ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300')}>
                  {total === 100 ? <CheckCircle2 size={13} /> : <Gauge size={13} />}{total === 100 ? '已完成 100 点分配' : `还有 ${remaining} 点可分配`}
                </span>
                <button type="button" onClick={resetPriorities} className="inline-flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]" title="恢复默认权重"><RotateCcw size={12} />默认 35 / 35 / 20 / 10</button>
              </div>
            </div>
          </section>

          {clarification.questions.map((question, index) => {
            const set = candidateSets[index]
            return (
              <section key={`${clarification.createdAt}-${index}`} className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 sm:p-4">
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
                  <label htmlFor={`clarification-${index}`} className="text-xs font-semibold leading-5 text-[var(--text-primary)]"><span className="mr-1.5 text-cyan-600 dark:text-cyan-300">{index + 1}.</span>{question}</label>
                  <button type="button" onClick={() => { void loadCandidates([index]) }} disabled={busy || total !== 100} className="inline-flex shrink-0 items-center gap-1 self-end rounded-[var(--radius-control)] border border-cyan-400/30 px-2.5 py-1.5 text-[10px] font-semibold text-cyan-700 transition-colors hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-45 dark:text-cyan-300 sm:self-start">
                    {candidateLoading === index ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}{set ? '重新生成候选' : '让 AI 给出候选'}
                  </button>
                </div>

                {set && (
                  <div className="mt-3">
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {set.candidates.map((candidate) => {
                        const meta = SELECTION_PRIORITY_META.find((item) => item.key === candidate.category)!
                        const style = priorityStyles[candidate.category]
                        const selected = selectedCandidateIds[index] === candidate.id
                        const recommended = set.recommendedId === candidate.id
                        return (
                          <button key={candidate.id} type="button" onClick={() => applyCandidate(set, candidate)} className={cn('flex min-h-44 flex-col rounded-[6px] border p-3 text-left transition-colors', selected ? `${style.border} ${style.background} shadow-[inset_0_0_0_1px_currentColor]` : 'border-[var(--border-subtle)] bg-[var(--surface-base)] hover:border-[var(--border-strong)]')} aria-pressed={selected}>
                            <span className="flex w-full items-center justify-between gap-2"><span className={cn('text-[10px] font-bold', style.text)}>{meta.label}</span><span className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]">{recommended && <Sparkles size={10} className="text-amber-500" />}{recommended ? 'AI 推荐' : confidenceLabels[candidate.confidence]}</span></span>
                            <span className="mt-2 text-xs font-semibold leading-5 text-[var(--text-primary)]">{candidate.model}</span>
                            <span className="mt-1 line-clamp-3 text-[10px] leading-4 text-[var(--text-secondary)]">{candidate.rationale}</span>
                            <span className="mt-auto pt-3 text-[9px] text-[var(--text-muted)]">{candidate.estimatedCost}</span>
                            <span className={cn('mt-2 inline-flex items-center gap-1 text-[10px] font-semibold', selected ? style.text : 'text-[var(--text-secondary)]')}>{selected ? <CheckCircle2 size={12} /> : <span className="h-3 w-3 rounded-full border border-[var(--border-strong)]" />}{selected ? '已选用' : '选择此项'}</span>
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-[var(--text-muted)]"><ShieldCheck size={12} className="mt-0.5 shrink-0 text-emerald-500" />{set.recommendationReason}</p>
                  </div>
                )}

                <textarea id={`clarification-${index}`} value={answers[index] ?? ''} onChange={(event) => setAnswer(index, event.target.value)} rows={set ? 4 : 3} placeholder="填写已确认的型号、电压、电流或其他限制，也可以从上方候选中选择" className="mt-3 min-h-20 w-full resize-y rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-xs leading-5 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-cyan-400/50" />
              </section>
            )
          })}

          {safetySummary && <p className="flex items-start gap-2 rounded-[var(--radius-control)] border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-[11px] leading-5 text-emerald-800 dark:text-emerald-200"><ShieldCheck size={14} className="mt-0.5 shrink-0" /><span><strong>选型安全摘要：</strong>{safetySummary}</span></p>}
          {error && <p className="flex items-start gap-2 rounded-[var(--radius-control)] border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-700 dark:text-red-300"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{error}</p>}
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-base)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[10px] text-[var(--text-muted)]">任务：{clarification.taskType} · 已确认 {answers.filter((answer) => answer.trim()).length}/{clarification.questions.length} · 权重 {total}/100</p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50">稍后回答</button>
            <button type="button" onClick={() => { void handleSubmit() }} disabled={busy || !allAnswered || total !== 100} className={cn('inline-flex min-w-44 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-cyan-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-45')}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}用所选型号生成方案
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
