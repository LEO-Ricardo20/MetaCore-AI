import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bot, Check, CircleDot, Clock3, FileDiff, Loader2, Play, RefreshCw, ShieldCheck, Square, Terminal, X } from 'lucide-react'
import { selectCurrentProject, useProjectStore } from '@/store/projectStore'
import { useAIConfigStore } from '@/store/aiConfigStore'
import { cn } from '@/lib/utils'
import { cancelAgentJob, createAgentTask, decideAgentApproval, getAgentJob, getAgentRuntimeStatus, listAgentApprovals, retryAgentJob, subscribeAgentEvents } from '@/services/local/localClient'
import type { AgentApproval, AgentEvent, AgentJob, AgentRuntimeId, AgentRuntimeStatus } from '@/types/agent'
import { isDeepSeekHarnessCompatible } from '@/types/ai'

interface Props {
  open: boolean
  onClose: () => void
  initialGoal?: string
}

const starterGoals = [
  '检查当前工程的硬件方案、GPIO 分配和固件代码是否一致',
  '运行一次受控构建，分析失败原因并提出最小修改方案',
  '分析这个嵌入式工程的风险、依赖和下一步验证动作',
]

export default function AgentTaskDrawer({ open, onClose, initialGoal = '' }: Props) {
  const project = useProjectStore(selectCurrentProject)
  const { getActive, services } = useAIConfigStore()
  const activeService = getActive()
  const [goal, setGoal] = useState('')
  const [runtime, setRuntime] = useState<AgentRuntimeId>('deepseek-harness')
  const [runtimeStatus, setRuntimeStatus] = useState<AgentRuntimeStatus | null>(null)
  const [job, setJob] = useState<AgentJob | null>(null)
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [approvals, setApprovals] = useState<AgentApproval[]>([])
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const projectId = project?.id

  const selectedRuntime = useMemo(() => runtimeStatus?.runtimes.find((item) => item.id === runtime), [runtimeStatus, runtime])
  const configuredOfficialDeepSeek = services.find((service) => service.provider === 'deepseek' && service.enabled && Boolean(service.apiKey.trim()))
  const harnessService = configuredOfficialDeepSeek && isDeepSeekHarnessCompatible(configuredOfficialDeepSeek)
    ? configuredOfficialDeepSeek
    : isDeepSeekHarnessCompatible(activeService) ? activeService : null
  const harnessCredentialReady = runtime !== 'deepseek-harness'
    || Boolean(selectedRuntime?.credentialConfigured)
    || Boolean(harnessService)
  const canRun = Boolean(selectedRuntime?.ready) && harnessCredentialReady
  const pendingApprovals = approvals.filter((item) => item.status === 'pending')

  async function refreshApprovals() {
    try { setApprovals((await listAgentApprovals(projectId)).approvals) } catch { /* the drawer keeps the last known approval state */ }
  }

  useEffect(() => {
    if (open && initialGoal.trim()) setGoal(initialGoal.trim())
  }, [initialGoal, open])

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading('runtime')
    Promise.all([
      getAgentRuntimeStatus(),
      listAgentApprovals(projectId),
    ]).then(([status, approvalResult]) => {
      if (!alive) return
      setRuntimeStatus(status)
      setApprovals(approvalResult.approvals)
      if (!status.runtimes.some((item) => item.id === runtime && item.ready)) {
        const ready = status.runtimes.find((item) => item.ready)
        if (ready?.id === 'internal' || ready?.id === 'deepseek-harness') setRuntime(ready.id)
      }
    }).catch((reason) => alive && setError(reason instanceof Error ? reason.message : '无法读取 Agent Runtime 状态')).finally(() => alive && setLoading(''))
    return () => { alive = false }
  }, [open, projectId, runtime])

  useEffect(() => {
    if (!job?.id) return
    const unsubscribe = subscribeAgentEvents('jobs', job.id, (event) => {
      setEvents((current) => [...current.slice(-79), event])
      void getAgentJob(job.id).then(setJob).catch(() => {})
      if (event.type.startsWith('approval.')) {
        void listAgentApprovals(projectId).then((result) => setApprovals(result.approvals)).catch(() => {})
      }
    })
    const timer = window.setInterval(() => { void getAgentJob(job.id).then(setJob).catch(() => {}) }, 1500)
    return () => { unsubscribe(); window.clearInterval(timer) }
  }, [job?.id, projectId])

  async function handleRun() {
    const normalized = goal.trim()
    if (!normalized) return
    setLoading('run')
    setError('')
    setEvents([])
    try {
      const created = await createAgentTask({
        projectId: projectId || 'workspace',
        goal: normalized,
        runtime,
        service: activeService ?? undefined,
        model: runtime === 'deepseek-harness' ? harnessService?.model : undefined,
      })
      setJob(created)
      setGoal('')
      await refreshApprovals()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法启动 Agent 任务')
    } finally {
      setLoading('')
    }
  }

  async function handleDecision(approval: AgentApproval, decision: 'approve' | 'reject') {
    setLoading(`approval:${approval.id}`)
    setError('')
    try {
      await decideAgentApproval(approval.id, decision)
      await refreshApprovals()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '审批操作失败')
    } finally {
      setLoading('')
    }
  }

  if (!open) return null
  return (
    <>
      <button type="button" aria-label="关闭 Agent 任务抽屉" className="fixed inset-0 z-[70] bg-black/45" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-[80] flex w-[min(94vw,480px)] flex-col border-l border-[var(--border-medium)] bg-[var(--surface-base)] shadow-2xl" aria-label="Agent 任务抽屉">
        <header className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2"><Bot size={17} className="text-cyan-300" /><div className="min-w-0"><h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">Agent 工程任务</h2><p className="truncate text-[10px] text-[var(--text-muted)]">Harness 驱动的可验证执行轨迹</p></div></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭 Agent 任务抽屉" title="关闭"><X size={17} /></button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <section className="surface-panel p-3">
            <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Runtime</span><button type="button" className="icon-button h-7 w-7" onClick={() => { setLoading('runtime'); getAgentRuntimeStatus().then(setRuntimeStatus).catch((reason) => setError(reason.message)).finally(() => setLoading('')) }} title="刷新运行时状态" aria-label="刷新运行时状态"><RefreshCw size={13} className={loading === 'runtime' ? 'animate-spin' : ''} /></button></div>
            <div className="flex items-center gap-2">
              <select value={runtime} onChange={(event) => setRuntime(event.target.value as AgentRuntimeId)} className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-2 text-xs text-[var(--text-primary)]">
                {(runtimeStatus?.runtimes ?? [{ id: 'deepseek-harness', label: 'DeepSeek Harness', ready: false, experimental: true, capabilities: [] }, { id: 'internal', label: 'MetaCore Internal', ready: true, experimental: false, capabilities: [] }]).map((item) => <option key={item.id} value={item.id}>{item.label}{item.experimental ? ' · 实验性' : ''}</option>)}
              </select>
              <RuntimeDot ready={Boolean(selectedRuntime?.ready) && harnessCredentialReady} />
            </div>
            {selectedRuntime && <p className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">{!selectedRuntime.ready ? (selectedRuntime.id === 'deepseek-harness' ? 'Harness 源码、依赖或配置未就绪' : '不可用') : selectedRuntime.id === 'deepseek-harness' ? (harnessCredentialReady ? `将使用 ${harnessService ? `设置页 ${harnessService.name} · ${harnessService.model}` : 'DEEPSEEK_API_KEY'}` : '请启用官方 DeepSeek，或硅基流动中的 DeepSeek 模型') : `将使用设置页当前 AI 服务${activeService ? ` · ${activeService.model}` : '（尚未选择）'}`}</p>}
          </section>

          <section className="command-composer rounded-[var(--radius-panel)] p-3">
            <label htmlFor="agent-task-goal" className="mb-2 block text-xs font-semibold text-[var(--text-primary)]">告诉 Agent 你要完成什么</label>
            <textarea id="agent-task-goal" value={goal} onChange={(event) => setGoal(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void handleRun() }} rows={4} placeholder="例如：检查当前 ESP32-C3 工程的 GPIO、依赖和构建问题，并给出最小修复方案" className="w-full resize-y rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-xs leading-5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" />
            <div className="mt-2 flex flex-wrap gap-1.5">{starterGoals.map((item) => <button key={item} type="button" onClick={() => setGoal(item)} className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-[10px] text-[var(--text-secondary)] hover:border-cyan-400/50 hover:text-cyan-200">{item.slice(0, 18)}...</button>)}</div>
            <button type="button" disabled={loading === 'run' || !goal.trim() || !canRun || (runtime === 'internal' && !activeService)} onClick={() => void handleRun()} className="btn-primary mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{loading === 'run' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}启动 Agent 任务</button>
          </section>

          {error && <div className="flex items-start gap-2 rounded-[var(--radius-control)] border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{error}</div>}

          {pendingApprovals.length > 0 && <section className="space-y-2"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300"><ShieldCheck size={13} />等待批准 · {pendingApprovals.length}</div>{pendingApprovals.map((approval) => <ApprovalCard key={approval.id} approval={approval} busy={loading === `approval:${approval.id}`} onDecision={handleDecision} />)}</section>}

          {job && <section className="surface-panel p-3"><div className="mb-3 flex items-start justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">当前任务</div><div className="mt-1 text-xs font-medium text-[var(--text-primary)]">{job.currentAction}</div></div><div className="flex items-center gap-2"><JobStatus status={job.status} />{['waiting', 'running'].includes(job.status) && <button type="button" onClick={() => { setLoading('cancel'); void cancelAgentJob(job.id).then(setJob).catch((reason) => setError(reason instanceof Error ? reason.message : '取消任务失败')).finally(() => setLoading('')) }} disabled={loading === 'cancel'} className="icon-button h-7 w-7 text-red-300" title="取消任务" aria-label="取消任务">{loading === 'cancel' ? <Loader2 size={13} className="animate-spin" /> : <Square size={11} />}</button>}{['failed', 'cancelled'].includes(job.status) && <button type="button" onClick={() => { setLoading('retry'); void retryAgentJob(job.id).then(setJob).catch((reason) => setError(reason instanceof Error ? reason.message : '重试任务失败')).finally(() => setLoading('')) }} disabled={loading === 'retry'} className="icon-button h-7 w-7" title="重试任务" aria-label="重试任务">{loading === 'retry' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}</button>}</div></div><div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]"><div className="h-full bg-cyan-400 transition-all" style={{ width: `${job.progress}%` }} /></div>{job.errorMessage && <p className="mb-2 text-xs text-red-300">{job.errorMessage}</p>}{job.status === 'succeeded' && typeof (job.result as { finalResponse?: unknown } | undefined)?.finalResponse === 'string' && <div className="mb-3 whitespace-pre-wrap rounded border border-emerald-400/20 bg-emerald-500/5 p-2 text-[11px] leading-5 text-[var(--text-secondary)]">{(job.result as { finalResponse: string }).finalResponse}</div>}<div className="space-y-1.5">{events.slice(-20).reverse().map((event) => <EventRow key={`${event.id}-${event.type}`} event={event} />)}</div></section>}
        </div>
      </aside>
    </>
  )
}

function ApprovalCard({ approval, busy, onDecision }: { approval: AgentApproval; busy: boolean; onDecision: (approval: AgentApproval, decision: 'approve' | 'reject') => void }) {
  const preview = approval.preview
  const isDiff = approval.kind === 'file-diff' && preview && typeof preview.oldText === 'string' && typeof preview.newText === 'string'
  return <div className="rounded-[var(--radius-control)] border border-amber-400/30 bg-amber-500/10 p-3"><div className="flex items-start gap-2"><FileDiff size={15} className="mt-0.5 shrink-0 text-amber-300" /><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-[var(--text-primary)]">{approval.title}</div><p className="mt-1 text-[11px] leading-4 text-[var(--text-secondary)]">{approval.reason || 'Agent 请求执行高风险操作'}</p>{isDiff && <div className="mt-2 overflow-hidden rounded border border-[var(--border-subtle)] bg-black/25"><div className="border-b border-[var(--border-subtle)] px-2 py-1 text-[10px] font-mono text-cyan-200">{String(preview.path)}</div><pre className="max-h-36 overflow-auto whitespace-pre-wrap px-2 py-2 text-[10px] leading-4 text-[var(--text-secondary)]"><span className="text-red-300">- {String(preview.oldText).split('\n').slice(0, 8).join('\n- ')}</span>{'\n'}<span className="text-emerald-300">+ {String(preview.newText).split('\n').slice(0, 8).join('\n+ ')}</span></pre></div>}{approval.kind === 'build' && <div className="mt-2 flex items-center gap-2 text-[10px] text-cyan-200"><Terminal size={12} />{String(preview?.command || approval.args.profileId)}</div>}<div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => onDecision(approval, 'approve')} className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"><Check size={13} />批准并执行</button><button type="button" disabled={busy} onClick={() => onDecision(approval, 'reject')} className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)] hover:text-red-200 disabled:opacity-50"><X size={13} />拒绝</button></div></div></div></div>
}

function EventRow({ event }: { event: AgentEvent }) {
  const data = event.data && typeof event.data === 'object' ? event.data as Record<string, unknown> : {}
  const label = event.type === 'agent.runtime-event' ? String(data.eventType || event.type) : event.type
  const detail = data.status ? String(data.status) : data.tool ? String(data.tool) : data.text ? String(data.text).slice(0, 120) : ''
  return <div className="flex items-start gap-2 text-[10px] leading-4"><CircleDot size={11} className="mt-0.5 shrink-0 text-cyan-300" /><span className="text-[var(--text-muted)]">{label}</span>{detail && <span className="truncate text-[var(--text-secondary)]">{detail}</span>}</div>
}

function JobStatus({ status }: { status: AgentJob['status'] }) {
  const tone = status === 'succeeded' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : status === 'failed' ? 'text-red-300 bg-red-500/10 border-red-500/30' : status === 'cancelled' ? 'text-slate-300 bg-slate-500/10 border-slate-500/30' : 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30'
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px]', tone)}>{status === 'running' ? <Loader2 size={11} className="animate-spin" /> : status === 'succeeded' ? <Check size={11} /> : status === 'waiting' ? <Clock3 size={11} /> : <Square size={9} />}{status}</span>
}

function RuntimeDot({ ready }: { ready: boolean }) { return <span className={cn('h-2 w-2 shrink-0 rounded-full', ready ? 'bg-emerald-400' : 'bg-amber-400')} title={ready ? 'Runtime 可用' : 'Runtime 未就绪'} /> }
