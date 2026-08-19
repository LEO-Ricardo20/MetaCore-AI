import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, ClipboardList, Cpu, Layers, Link2, MapPin, Route, ShieldCheck } from 'lucide-react'
import RequirementPage from './RequirementPage'
import ChipManager from '@/components/chips/ChipManager'
import DriversPage from '@/components/drivers/DriversPage'
import DesignArtifactView, { type DesignArtifactTab } from './DesignArtifactView'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/store/projectStore'

const tabs = [
  ['requirements', '需求', ClipboardList], ['chips', '芯片', Cpu], ['peripherals', '外设', Layers], ['scheme', '方案', Route], ['pins', '引脚', MapPin], ['bom', 'BOM', ClipboardList], ['wiring', '接线', Link2], ['review', '审查', ShieldCheck],
] as const

export default function DesignWorkspacePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const project = useProjectStore((state) => state.projects.find((item) => item.id === state.currentProjectId))
  const active = location.pathname.split('/')[2] || 'requirements'
  const artifactTab = active === 'scheme' || active === 'pins' || active === 'bom' || active === 'wiring' ? active as DesignArtifactTab : null
  return <div className="h-full overflow-y-auto"><div className="page-container tone-design"><div className="workspace-header flex flex-wrap items-end justify-between gap-3"><div><div className="workspace-eyebrow"><Route size={13} /> Design Trajectory</div><h1 className="workspace-title">需求到硬件方案</h1><p className="workspace-subtitle">{project ? `${project.target} · ${project.format} · 每个阶段的输入、产物和影响均保留版本状态` : '先输入需求并选择目标芯片'}</p></div>{project && <span className="status-badge border border-[var(--border-medium)] bg-[var(--surface-selected)] text-[var(--text-primary)]"><CheckCircle2 size={12} /> {project.currentStage}</span>}</div><nav className="stage-tabs mb-5" aria-label="设计阶段">{tabs.map(([key, label, Icon]) => <button key={key} type="button" className={cn('stage-tab', active === key && 'stage-tab-active')} onClick={() => navigate(`/design/${key}`)}><Icon size={14} />{label}</button>)}</nav>{active === 'chips' ? <ChipManager /> : active === 'peripherals' ? <DriversPage /> : active === 'review' ? <ReviewPanel /> : artifactTab ? <DesignArtifactView tab={artifactTab} /> : <RequirementPage />}</div></div>
}

function ReviewPanel() { const project = useProjectStore((state) => state.projects.find((item) => item.id === state.currentProjectId)); const stale = project ? Object.entries(project.artifacts).filter(([, value]) => value.status === 'stale' || value.status === 'invalid') : []; return <section className="surface-panel p-6"><h2 className="text-base font-semibold text-[var(--text-primary)]">设计审查</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">审查会阻止过期产物被误认为可发布。</p><div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-[var(--radius-control)] border border-emerald-500/30 bg-emerald-500/10 p-4"><CheckCircle2 className="text-emerald-300" size={18} /><p className="mt-2 text-sm font-medium text-emerald-200">硬件约束</p><p className="mt-1 text-xs text-emerald-200/70">{project?.scheme ? '已生成方案，可检查引脚和电源约束。' : '等待硬件方案。'}</p></div><div className={cn('rounded-[var(--radius-control)] border p-4', stale.length ? 'border-amber-500/30 bg-amber-500/10' : 'border-emerald-500/30 bg-emerald-500/10')}><ShieldCheck className={stale.length ? 'text-amber-300' : 'text-emerald-300'} size={18} /><p className={cn('mt-2 text-sm font-medium', stale.length ? 'text-amber-200' : 'text-emerald-200')}>{stale.length ? `${stale.length} 个产物过期` : '没有过期产物'}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">重新生成方案后必须重新验证代码与流程。</p></div><div className="rounded-[var(--radius-control)] border border-cyan-500/30 bg-cyan-500/10 p-4"><MapPin className="text-cyan-300" size={18} /><p className="mt-2 text-sm font-medium text-cyan-200">设计证据</p><p className="mt-1 text-xs text-cyan-200/70">引脚、BOM、接线表将随项目版本保存。</p></div></div></section> }
