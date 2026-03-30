import { useState } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { exportZip } from '@/services/export/zipExport'
import { exportPDF } from '@/services/export/pdfExport'
import { Download, FileDown, Loader2 } from 'lucide-react'

export default function ExportButtons() {
  const { project } = useProjectStore()
  const [zipping, setZipping] = useState(false)
  const [pdffing, setPdffing] = useState(false)

  async function handleZip() {
    if (!project) return
    setZipping(true)
    try {
      await exportZip(project.name || 'metacore-project', project.codeFiles, project.target)
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
        disabled={zipping || !project?.codeFiles.length}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-xl transition-all shadow-lg shadow-slate-900/20 hover:shadow-slate-700/30 hover:-translate-y-0.5 active:translate-y-0"
      >
        {zipping ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        导出 ZIP
      </button>
      <button
        onClick={handlePDF}
        disabled={pdffing || !project}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-xl transition-all shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 active:translate-y-0"
      >
        {pdffing ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
        导出 PDF
      </button>
    </div>
  )
}