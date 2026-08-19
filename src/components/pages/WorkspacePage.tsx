import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, Cpu, FolderOpen, HardDrive, Play, Plus, RefreshCw, ShieldAlert, Sparkles, Wrench, XCircle } from 'lucide-react'
import { selectCurrentProject, useProjectStore } from '@/store/projectStore'
import { useAIConfigStore } from '@/store/aiConfigStore'
import { checkLocalHealth } from '@/services/local/localClient'
import type { ProjectStage, ArtifactStatus } from '@/types/project'
import { cn } from '@/lib/utils'

const stageLabels: Record<ProjectStage, string> = {
  draft: '草稿',
  'requirements-ready': '需求就绪',
  planning: '规划中',
  'design-review': '设计审查',
  implementation: '实现中',
  verification: '验证中',
  'ready-to-export': '可发布',
  failed: '失败',
  cancelled: '已取消',
}

const artifactLabels: Record<string, string> = {
  scheme: '方案',
  code: '代码',
  flow: '流程',
  consistencyReport: '一致性',
  localAnalysis: '本地分析',
  buildResult: '构建',
}

const statusTone: Record<ArtifactStatus, string> = {
  missing: 'text-slate-500 bg-slate-500/10 border-slate-700/40',
  generating: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  fresh: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  stale: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  validating: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30',
  valid: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  invalid: 'text-red-300 bg-red-500/10 border-red-500/30',
}

function statusIcon(status: ArtifactStatus) {
  if (status === 'invalid') return XCircle
  if (status === 'stale') return AlertTriangle
  if (status === 'fresh' || status === 'valid') return CheckCircle2
  if (status === 'generating' || status === 'validating') return RefreshCw
  return CircleDashed
}

export default function WorkspacePage() {
  const navigate = useNavigate()
  const current = useProjectStore(selectCurrentProject)
  const projects = useProjectStore((state) => state.projects)
  const loadProject = useProjectStore((state) => state.loadProject)
  const activeAI = useAIConfigStore((state) => state.getActive())
  const [localOnline, setLocalOnline] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    checkLocalHealth().then(() => alive && setLocalOnline(true)).catch(() => alive && setLocalOnline(false))
    return () => { alive = false }
  }, [])

  const unresolved = current
    ? Object.values(current.artifacts).filter((artifact) => artifact.status === 'invalid' || artifact.status === 'stale').length
    : 0
  const recentProjects = [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1440px] px-5 py-6 lg:px-8 lg:py-8">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-400">
              <Activity size={14} /> 工作台
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">项目研发状态</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">从当前项目继续需求、设计、固件实现和发布验证。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/design/requirements" className="btn-primary inline-flex items-center gap-2 rounded-[var(--radius-control)] px-3.5 py-2 text-sm font-medium text-white" aria-label="从需求开始">
              <Plus size={15} /> 从需求开始
            </Link>
            <Link to="/projects" className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 py-2 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)]" aria-label="打开项目列表">
              <FolderOpen size={15} /> 项目
            </Link>
          </div>
        </header>

        {!current ? (
          <EmptyWorkspace onNavigate={(path) => navigate(path)} />
        ) : (
          <>
            <section className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.8fr)]">
              <div className="surface-panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2 text-xs text-cyan-300"><Cpu size={14} /> 当前项目</div>
                    <h2 className="truncate text-xl font-semibold text-[var(--text-primary)]">{current.name}</h2>
                    <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{current.target} · {current.format} · 更新于 {new Date(current.updatedAt).toLocaleString('zh-CN')}</p>
                  </div>
                  <span className="status-badge border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"><Activity size={12} /> {stageLabels[current.currentStage]}</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {Object.entries(current.artifacts)
                    .filter(([key]) => key in artifactLabels)
                    .map(([key, artifact]) => {
                      const Icon = statusIcon(artifact.status)
                      return <span key={key} className={cn('status-badge border', statusTone[artifact.status])} title={artifact.staleReason ? `过期原因：${artifact.staleReason}` : undefined}><Icon size={12} className={artifact.status === 'generating' || artifact.status === 'validating' ? 'animate-spin' : ''} />{artifactLabels[key]} · {artifact.status}</span>
                    })}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link to="/design" className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"><Wrench size={14} /> 继续设计</Link>
                  <Link to="/implementation" className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--border-strong)]"><CodeIcon /> 查看实现</Link>
                  <Link to="/verification" className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--border-strong)]"><ShieldAlert size={14} /> 发布前检查</Link>
                </div>
              </div>
              <div className="surface-panel p-5">
                <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-[var(--text-primary)]">连接状态</h2><Activity size={15} className="text-cyan-400" /></div>
                <div className="space-y-3">
                  <ConnectionRow label="AI 服务" value={activeAI ? `${activeAI.name} · ${activeAI.model}` : '未配置'} online={Boolean(activeAI)} />
                  <ConnectionRow label="localhost 服务" value={localOnline === null ? '检查中' : localOnline ? '127.0.0.1:3766 在线' : '离线'} online={localOnline === true} pending={localOnline === null} />
                  <ConnectionRow label="未解决问题" value={`${unresolved} 个过期或无效产物`} online={unresolved === 0} warning={unresolved > 0} />
                </div>
              </div>
            </section>

            <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Metric label="需求与方案" value={current.artifacts.scheme.status === 'fresh' || current.artifacts.scheme.status === 'valid' ? '已生成' : '待处理'} detail={current.artifacts.scheme.status} icon={Sparkles} />
              <Metric label="固件实现" value={`${current.codeFiles.length} 个文件`} detail={current.artifacts.code.status} icon={Cpu} />
              <Metric label="质量门禁" value={current.validation.status === 'unchecked' ? '未验证' : current.validation.status} detail={`${current.validation.issueCount} 个问题`} icon={ShieldAlert} />
              <Metric label="下一步" value={nextAction(current.currentStage)} detail="建议动作" icon={ArrowRight} />
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
              <div className="surface-panel p-5">
                <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-[var(--text-primary)]">最近项目</h2><Link className="text-xs text-cyan-300 hover:text-cyan-200" to="/projects">查看全部</Link></div>
                <div className="divide-y divide-[var(--border-subtle)]">
                  {recentProjects.map((project) => (
                    <button key={project.id} type="button" className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-[var(--surface-hover)]" onClick={() => { loadProject(project.id); navigate('/workspace') }}>
                      <span className="min-w-0"><span className="block truncate text-sm font-medium text-[var(--text-primary)]">{project.name}</span><span className="mt-1 block truncate text-xs text-[var(--text-muted)]">{project.target} · {stageLabels[project.currentStage]}</span></span>
                      <ArrowRight size={15} className="shrink-0 text-[var(--text-muted)]" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="surface-panel p-5">
                <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-[var(--text-primary)]">最近运行</h2><Play size={15} className="text-indigo-400" /></div>
                {current.runs.length === 0 ? <p className="text-sm text-[var(--text-muted)]">尚未运行流水线。生成方案后，这里会保留阶段、错误和重试记录。</p> : <div className="space-y-3">{current.runs.slice(-3).reverse().map((run) => <div key={run.id} className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] p-3"><div className="flex items-center justify-between text-xs"><span className="text-[var(--text-primary)]">{run.currentStage ?? 'pipeline'}</span><span className="text-[var(--text-muted)]">{run.status}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]"><div className="h-full bg-cyan-400" style={{ width: `${Math.round(run.stages.filter((stage) => stage.status === 'succeeded').length / Math.max(run.stages.length, 1) * 100)}%` }} /></div></div>)}</div>}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function CodeIcon() { return <Wrench size={14} /> }

function ConnectionRow({ label, value, online, pending, warning }: { label: string; value: string; online: boolean; pending?: boolean; warning?: boolean }) {
  return <div className="flex items-start justify-between gap-3"><span className="text-xs text-[var(--text-secondary)]">{label}</span><span className={cn('flex min-w-0 items-center gap-1.5 text-right text-xs', warning ? 'text-amber-300' : online ? 'text-emerald-300' : 'text-[var(--text-muted)]')}><span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', pending ? 'animate-pulse bg-cyan-300' : online ? 'bg-emerald-400' : warning ? 'bg-amber-400' : 'bg-slate-500')} />{value}</span></div>
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Cpu }) {
  return <div className="surface-panel p-4"><div className="mb-3 flex items-center justify-between"><span className="text-xs text-[var(--text-secondary)]">{label}</span><Icon size={15} className="text-cyan-400" /></div><p className="truncate text-base font-semibold text-[var(--text-primary)]">{value}</p><p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">{detail}</p></div>
}

function nextAction(stage: ProjectStage) {
  if (stage === 'draft') return '填写需求'
  if (stage === 'requirements-ready') return '生成方案'
  if (stage === 'design-review') return '检查引脚'
  if (stage === 'implementation') return '验证代码'
  if (stage === 'verification') return '执行构建'
  return stageLabels[stage]
}

function EmptyWorkspace({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <section className="surface-panel flex min-h-[420px] flex-col items-center justify-center p-8 text-center"><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"><FolderOpen size={26} /></div><h2 className="text-lg font-semibold text-[var(--text-primary)]">还没有当前项目</h2><p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">从需求开始创建硬件项目，或者打开已有的本地工程进行诊断。</p><div className="mt-6 flex flex-wrap justify-center gap-2"><button type="button" className="btn-primary inline-flex items-center gap-2 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-medium text-white" onClick={() => onNavigate('/design/requirements')}><Plus size={15} /> 创建项目</button><button type="button" className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]" onClick={() => onNavigate('/verification/local')}><HardDrive size={15} /> 打开本地工程</button><button type="button" className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]" onClick={() => onNavigate('/projects')}><FolderOpen size={15} /> 导入项目</button></div></section>
}
