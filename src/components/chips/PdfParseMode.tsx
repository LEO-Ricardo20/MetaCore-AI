/** AI 识图模式 — 上传 PDF 数据手册，AI 自动解析芯片参数 */

import { useState, useRef, useCallback } from 'react'
import { useThemeStore } from '@/store/themeStore'
import { useChipStore } from '@/store/chipStore'
import { useAIConfigStore } from '@/store/aiConfigStore'
import { extractTextFromPdf } from '@/services/pdf/pdfExtractor'
import { buildChipParsePrompt } from '@/services/ai/prompts'
import { callAI } from '@/services/ai/client'
import { cn } from '@/lib/utils'
import type { ChipSpec } from '@/types/hardware'
import { parseChipSpec } from '@/services/ai/validation'
import {
  FileUp,
  Loader2,
  Check,
  AlertCircle,
  Trash2,
  Save,
  Cpu,
} from 'lucide-react'

interface Props {
  onDone: () => void
}

export default function PdfParseMode({ onDone }: Props) {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const { addChip } = useChipStore()
  const { getActive } = useAIConfigStore()

  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ChipSpec | null>(null)
  const [saved, setSaved] = useState(false)

  /* ---------- 文件选择 ---------- */
  const handleFile = useCallback((f: File | null) => {
    if (!f || !f.name.endsWith('.pdf')) return
    setFile(f)
    setResult(null)
    setError('')
    setSaved(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0] ?? null)
  }, [handleFile])

  /* ---------- 解析 ---------- */
  const handleParse = async () => {
    if (!file) return
    const svc = getActive()
    if (!svc) { setError('请先在设置页配置并选择 AI 服务'); return }

    setParsing(true)
    setError('')
    setResult(null)

    try {
      // 1. 提取 PDF 文本
      const pdfText = await extractTextFromPdf(file)
      if (!pdfText.trim()) throw new Error('PDF 文本提取为空，请确认文件是否包含可选中文本')

      // 2. 构造 prompt 并调用 AI
      const prompt = buildChipParsePrompt(pdfText)
      const raw = await callAI(svc, [
        { role: 'system', content: '你是芯片数据手册解析专家，只输出 JSON。' },
        { role: 'user', content: prompt },
      ], { temperature: 0.2 })

      // 3. 解析结果
      const spec = parseChipSpec(raw)
      setResult(spec)
    } catch (e: any) {
      setError(e.message ?? '解析失败')
    } finally {
      setParsing(false)
    }
  }

  /* ---------- 保存 ---------- */
  const handleSave = () => {
    if (!result) return
    addChip(result)
    setSaved(true)
    setTimeout(() => onDone(), 800)
  }

  /* ---------- 文件大小格式化 ---------- */
  const fmtSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`

  return (
    <div className="flex flex-col gap-5">

      {/* ---- 上传区 ---- */}
      {!result && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-3 py-12 rounded-2xl border-2 border-dashed cursor-pointer transition-colors',
            isDark
              ? 'border-slate-700 hover:border-cyan-500/50 bg-slate-800/20'
              : 'border-slate-300 hover:border-cyan-500/50 bg-slate-50',
          )}
        >
          <FileUp size={28} className={isDark ? 'text-cyan-400' : 'text-cyan-500'} />
          <p className={cn('text-sm font-medium', isDark ? 'text-slate-300' : 'text-slate-600')}>
            拖放 PDF 数据手册到这里，或点击选择
          </p>
          <p className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
            支持芯片 Datasheet PDF（建议 &lt; 20MB）
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0] ?? null)}
          />
        </div>
      )}

      {/* ---- 文件信息 + 操作 ---- */}
      {file && !result && (
        <div className={cn('glass-card p-4 flex items-center gap-3')}>
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
            <FileUp size={16} className="text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-medium truncate', isDark ? 'text-white' : 'text-slate-800')}>
              {file.name}
            </p>
            <p className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
              {fmtSize(file.size)}
            </p>
          </div>
          <button
            onClick={() => { setFile(null); setError('') }}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={handleParse}
            disabled={parsing}
            className="btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {parsing ? <Loader2 size={14} className="animate-spin" /> : <Cpu size={14} />}
            {parsing ? '解析中...' : '开始解析'}
          </button>
        </div>
      )}

      {/* ---- 解析进度 ---- */}
      {parsing && (
        <div className={cn('glass-card p-6 flex flex-col items-center gap-3')}>
          <Loader2 size={24} className="animate-spin text-cyan-400" />
          <p className={cn('text-sm', isDark ? 'text-slate-300' : 'text-slate-600')}>
            AI 正在分析数据手册...
          </p>
          <div className="w-48 h-1 bg-slate-700/40 rounded-full overflow-hidden">
            <div className="h-full w-full bg-gradient-to-r from-cyan-500 to-indigo-500 animate-pulse rounded-full" />
          </div>
        </div>
      )}

      {/* ---- 错误提示 ---- */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm p-3 bg-red-950/20 border border-red-900/40 rounded-xl">
          <AlertCircle size={15} className="flex-shrink-0" /> {error}
        </div>
      )}

      {/* ---- 解析结果预览 ---- */}
      {result && (
        <div className="flex flex-col gap-4 fade-in">
          <div className={cn('glass-card p-5')}>
            <h3 className={cn('text-base font-bold mb-3', isDark ? 'text-white' : 'text-slate-800')}>
              {result.name} — {result.fullName}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                ['架构', result.arch],
                ['主频', result.clockSpeed],
                ['Flash', result.flash],
                ['SRAM', result.sram],
                ['电压', result.voltage],
                ['GPIO 数量', `${result.gpios.length} 个`],
                ['外设数量', `${result.peripherals.length} 个`],
                ['限制条件', `${result.restrictions.length} 条`],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className={cn('rounded-xl p-3', isDark ? 'bg-slate-800/40' : 'bg-slate-100')}>
                  <p className={cn('text-xs mb-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>{label}</p>
                  <p className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-slate-800')}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setResult(null); setFile(null) }}
              className={cn('text-sm px-4 py-2 rounded-xl transition-colors', isDark ? 'text-slate-400 hover:bg-slate-700/60' : 'text-slate-500 hover:bg-slate-100')}
            >
              重新上传
            </button>
            <button
              onClick={handleSave}
              disabled={saved}
              className={cn(
                'flex items-center gap-2 text-sm px-5 py-2 rounded-xl font-medium transition-all shadow-lg hover:-translate-y-0.5',
                saved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-emerald-500/20'
              )}
            >
              {saved ? <><Check size={15} /> 已保存</> : <><Save size={15} /> 保存到芯片库</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
