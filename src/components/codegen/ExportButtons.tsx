import { useState } from 'react'
import { selectCurrentProject, useProjectStore } from '@/store/projectStore'
import { Download, FileDown, FileText, Loader2 } from 'lucide-react'

export default function ExportButtons() {
  const project = useProjectStore(selectCurrentProject)
  const [zipping, setZipping] = useState(false)
  const [pdffing, setPdffing] = useState(false)
  const [markdowning, setMarkdowning] = useState(false)
  const requiredArtifacts = ['scheme', 'pinMap', 'bom', 'wiring', 'code', 'flow', 'consistencyReport', 'releaseReport'] as const
  const staleArtifacts = project
    ? Object.entries(project.artifacts).some(([key, artifact]) => {
      if (key === 'buildResult' && project.verification?.build?.status === 'skipped') return false
      return artifact.status === 'stale' || artifact.status === 'invalid'
    })
    : false
  const blockedReason = !project
    ? '当前没有项目'
    : staleArtifacts
      ? '存在过期或无效产物，请先重新生成并验证'
      : requiredArtifacts.some((key) => !['fresh', 'valid'].includes(project.artifacts[key].status))
        ? '发布检查尚未通过，请先完成验证工作区的所有检查'
        : undefined
  const blocked = Boolean(blockedReason)

  function downloadMarkdown() {
    if (!project) return
    setMarkdowning(true)
    try {
      const scheme = project.scheme
      const content = [
        `# ${project.name}`,
        '',
        `- 目标芯片：${project.target}`,
        `- 工程格式：${project.format}`,
        `- 需求：${project.requirement}`,
        '',
        '## 硬件方案',
        scheme?.description ?? '尚未生成',
        '',
        '## 引脚',
        ...(scheme?.pins ?? []).map((pin) => `- ${pin.pinNumber} · ${pin.pinName} · ${pin.function} · ${pin.connectedTo} · ${pin.voltage}`),
        '',
        '## BOM',
        ...(scheme?.bom ?? []).map((item) => `- ${item.name} · ${item.model} · ${item.quantity} × ¥${item.unitPrice.toFixed(2)}`),
        '',
        '## 接线',
        ...(scheme?.wiring ?? []).map((wire) => `- ${wire.from} → ${wire.to} · ${wire.wireColor ?? ''} · ${wire.note ?? ''}`),
        '',
        '## 工程文件',
        ...project.codeFiles.map((file) => `- ${file.path}`),
        '',
        '## 产物状态',
        ...Object.entries(project.artifacts).map(([key, artifact]) => `- ${key}: ${artifact.status}`),
      ].join('\n')
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      const anchor = document.createElement('a')
      anchor.href = URL.createObjectURL(blob)
      const safeName = (project.name || 'metacore-project')
        .replace(/[<>:"/\\|?*]/g, '_')
        .split('')
        .map((character) => character.charCodeAt(0) < 32 ? '_' : character)
        .join('')
        .slice(0, 80) || 'metacore-project'
      anchor.download = `${safeName}.md`
      anchor.click()
      URL.revokeObjectURL(anchor.href)
    } finally {
      setMarkdowning(false)
    }
  }

  async function handleZip() {
    if (!project) return
    setZipping(true)
    try {
      const { exportZip } = await import('@/services/export/zipExport')
      await exportZip(project.name || 'metacore-project', project.codeFiles, project.target, project)
    } catch (e: any) {
      alert('导出失败: ' + e.message)
    } finally {
      setZipping(false)
    }
  }

  async function handlePDF() {
    if (!project) return
    setPdffing(true)
    try {
      const { exportPDF } = await import('@/services/export/pdfExport')
      await exportPDF(project)
    } catch (e: any) {
      alert('导出失败: ' + e.message)
    } finally {
      setPdffing(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleZip}
        disabled={zipping || blocked || !project?.codeFiles.length}
        title={blocked ? blockedReason : '导出完整工程 ZIP'}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-xl transition-all shadow-lg shadow-slate-900/20 hover:shadow-slate-700/30 hover:-translate-y-0.5 active:translate-y-0"
      >
        {zipping ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        导出 ZIP
      </button>
      <button
        onClick={handlePDF}
        disabled={pdffing || blocked || !project}
        title={blocked ? blockedReason : '导出 PDF 方案报告'}
        className="btn-primary flex items-center gap-1.5 rounded-[var(--radius-control)] px-3 py-1.5 text-sm text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 hover:-translate-y-0.5 active:translate-y-0"
      >
        {pdffing ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
        导出 PDF
      </button>
      <button
        type="button"
        onClick={downloadMarkdown}
        disabled={markdowning || blocked || !project}
        title={blocked ? blockedReason : '导出 Markdown 交付报告'}
        className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {markdowning ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
        导出 Markdown
      </button>
    </div>
  )
}
