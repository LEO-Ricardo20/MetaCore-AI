import { Code2, FileCode2, GitCompare, PackageCheck } from 'lucide-react'
import CodegenPage from './CodegenPage'
import { useProjectStore } from '@/store/projectStore'

export default function ImplementationWorkspacePage() {
  const project = useProjectStore((state) => state.projects.find((item) => item.id === state.currentProjectId))
  return <div className="h-full overflow-y-auto"><div className="mx-auto max-w-[1500px] px-5 py-5 lg:px-8"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300"><Code2 size={14} /> 实现工作区</div><h1 className="text-xl font-semibold text-[var(--text-primary)]">固件工程</h1><p className="mt-1 text-xs text-[var(--text-secondary)]">{project ? `${project.target} · ${project.format} · ${project.codeFiles.length} 个文件` : '请先完成硬件方案'}</p></div><div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]"><span className="status-badge border border-[var(--border-subtle)]"><FileCode2 size={12} /> 代码 {project?.artifacts.code.status ?? 'missing'}</span><span className="status-badge border border-[var(--border-subtle)]"><GitCompare size={12} /> 方案版本 {project?.artifacts.scheme.version ?? 0}</span><span className="status-badge border border-[var(--border-subtle)]"><PackageCheck size={12} /> 构建 {project?.artifacts.buildResult.status ?? 'missing'}</span></div></div><CodegenPage /></div></div>
}
