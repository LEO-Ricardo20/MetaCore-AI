import { AlertCircle, ArrowRight, FileText, MapPin, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import BOMTable from '@/components/requirement/BOMTable'
import PinDiagram from '@/components/requirement/PinDiagram'
import PinTable from '@/components/requirement/PinTable'
import WiringTable from '@/components/requirement/WiringTable'
import { selectCurrentProject, useProjectStore } from '@/store/projectStore'

export type DesignArtifactTab = 'scheme' | 'pins' | 'bom' | 'wiring'

export default function DesignArtifactView({ tab }: { tab: DesignArtifactTab }) {
  const navigate = useNavigate()
  const project = useProjectStore(selectCurrentProject)
  const scheme = project?.scheme

  if (!project || !scheme) {
    return (
      <section className="surface-panel flex min-h-[360px] flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500"><FileText size={25} /></div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">还没有硬件方案</h2>
        <p className="max-w-md text-sm text-[var(--text-secondary)]">系统必须先完成需求分析和硬件约束校验，后续的方案、引脚、BOM 和接线视图才会有可靠数据。</p>
        <button type="button" onClick={() => navigate('/design/requirements')} className="btn-primary mt-2 inline-flex items-center gap-2 rounded-[var(--radius-control)] px-4 py-2 text-sm font-medium text-white"><ArrowRight size={14} /> 去生成硬件方案</button>
      </section>
    )
  }

  if (tab === 'pins') {
    return <div className="space-y-4"><div className="surface-panel flex items-start gap-3 p-4"><MapPin className="mt-0.5 shrink-0 text-indigo-500" size={18} /><div><h2 className="text-sm font-semibold text-[var(--text-primary)]">引脚分配</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">以下分配来自已校验的硬件方案，修改需求后会自动标记为过期。</p></div></div><PinDiagram pins={scheme.pins} chipType={project.target} /><PinTable pins={scheme.pins} /></div>
  }
  if (tab === 'bom') return <div className="space-y-4"><BOMTable bom={scheme.bom} /><div className="flex items-start gap-2 rounded-[var(--radius-control)] border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-700"><AlertCircle size={14} className="mt-0.5 shrink-0" />BOM 价格是 AI 估算值，采购前请以供应商报价和封装规格为准。</div></div>
  if (tab === 'wiring') return <WiringTable wiring={scheme.wiring} />

  return (
    <div className="space-y-4">
      <section className="surface-panel p-5"><div className="flex items-center gap-2"><FileText size={17} className="text-indigo-500" /><h2 className="text-base font-semibold text-[var(--text-primary)]">硬件方案</h2><span className="status-badge ml-auto border border-emerald-500/25 bg-emerald-500/10 text-emerald-700">已生成</span></div><p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{scheme.description}</p></section>
      <div className="grid gap-4 lg:grid-cols-3">
        <InfoList title="设计假设" items={scheme.assumptions ?? []} empty="暂无额外假设" />
        <InfoList title="待确认项" items={scheme.openQuestions ?? []} empty="暂无待确认项" tone="amber" />
        <InfoList title="风险提示" items={(scheme.risks ?? []).map((risk) => risk.message)} empty="暂无风险提示" tone="red" icon={<ShieldAlert size={15} />} />
      </div>
      <div className="flex justify-end"><button type="button" onClick={() => navigate('/implementation/code')} className="btn-primary inline-flex items-center gap-2 rounded-[var(--radius-control)] px-4 py-2 text-sm font-medium text-white">进入代码生成 <ArrowRight size={14} /></button></div>
    </div>
  )
}

function InfoList({ title, items, empty, tone = 'indigo', icon }: { title: string; items: string[]; empty: string; tone?: 'indigo' | 'amber' | 'red'; icon?: ReactNode }) {
  const styles = tone === 'amber' ? 'border-amber-500/25 bg-amber-500/10' : tone === 'red' ? 'border-red-500/25 bg-red-500/10' : 'border-indigo-500/20 bg-indigo-500/10'
  return <section className={`rounded-[var(--radius-control)] border p-4 ${styles}`}><h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">{icon ?? <FileText size={15} className="text-indigo-500" />}{title}</h3>{items.length ? <ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--text-secondary)]">{items.map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}</ul> : <p className="mt-3 text-xs text-[var(--text-muted)]">{empty}</p>}</section>
}
