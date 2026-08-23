import { Code2, FileCode2, GitCompare, PackageCheck } from 'lucide-react'
import CodegenPage from './CodegenPage'
import { useProjectStore } from '@/store/projectStore'
import { getEsp32Profile } from '@/services/esp32/esp32Config'

export default function ImplementationWorkspacePage() {
  const project = useProjectStore((state) => state.projects.find((item) => item.id === state.currentProjectId))
  const boardLabel = project?.esp32 ? getEsp32Profile(project.esp32.boardId)?.label : undefined
  return <div className="h-full overflow-y-auto"><div className="page-container tone-implementation"><div className="workspace-header flex flex-wrap items-end justify-between gap-3"><div><div className="workspace-eyebrow"><Code2 size={13} /> Implementation Runtime</div><h1 className="workspace-title">固件工程</h1><p className="workspace-subtitle">{project ? `${boardLabel ?? project.target} · ${project.format} · ${project.codeFiles.length} 个文件 · 代码与硬件方案保持版本关联` : '请先完成硬件方案'}</p></div><div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]"><span className="status-badge border border-[var(--border-subtle)] bg-[var(--surface-muted)]"><FileCode2 size={12} /> 代码 {project?.artifacts.code.status ?? 'missing'}</span><span className="status-badge border border-[var(--border-subtle)] bg-[var(--surface-muted)]"><GitCompare size={12} /> 方案版本 {project?.artifacts.scheme.version ?? 0}</span><span className="status-badge border border-[var(--border-subtle)] bg-[var(--surface-muted)]"><PackageCheck size={12} /> 构建 {project?.artifacts.buildResult.status ?? 'missing'}</span></div></div><div className="surface-panel overflow-hidden"><CodegenPage /></div></div></div>
}
