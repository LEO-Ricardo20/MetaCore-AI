/** AI 助填模式 — 手动表单 + 可选上传 PDF 让 AI 预填字段 */

import { useState, useRef, useCallback } from 'react'
import { useThemeStore } from '@/store/themeStore'
import { useAIConfigStore } from '@/store/aiConfigStore'
import { extractTextFromPdf } from '@/services/pdf/pdfExtractor'
import { buildChipParsePrompt } from '@/services/ai/prompts'
import { callAI } from '@/services/ai/client'
import { cn } from '@/lib/utils'
import type { ChipSpec } from '@/types/hardware'
import { parseChipSpec } from '@/services/ai/validation'
import FormMode from './FormMode'
import {
  FileUp,
  Loader2,
  Wand2,
  Trash2,
  AlertCircle,
} from 'lucide-react'

interface Props {
  onDone: () => void
}

export default function AssistedMode({ onDone }: Props) {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const { getActive } = useAIConfigStore()

  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [filling, setFilling] = useState(false)
  const [error, setError] = useState('')
  // AI 预填后的数据传给 FormMode
  const [prefilled, setPrefilled] = useState<ChipSpec | undefined>(undefined)

  /* ---------- 文件选择 ---------- */
  const handleFile = useCallback((f: File | null) => {
    if (!f || !f.name.endsWith('.pdf')) return
    setFile(f)
    setError('')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0] ?? null)
  }, [handleFile])

  /* ---------- 文件大小格式化 ---------- */
  const fmtSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`

  /* ---------- AI 预填 ---------- */
  const handlePrefill = async () => {
    if (!file) return
    const svc = getActive()
    if (!svc) { setError('请先在设置页配置并选择 AI 服务'); return }

    setFilling(true)
    setError('')

    try {
      const pdfText = await extractTextFromPdf(file)
      if (!pdfText.trim()) throw new Error('PDF 文本提取为空')

      const prompt = buildChipParsePrompt(pdfText)
      const raw = await callAI(svc, [
        { role: 'system', content: '你是芯片数据手册解析专家，只输出 JSON。' },
        { role: 'user', content: prompt },
      ], { temperature: 0.2 })

      const spec = parseChipSpec(raw)
      setPrefilled(spec)
    } catch (e: any) {
      setError(e.message ?? '预填失败')
    } finally {
      setFilling(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ---- PDF 上传区（可选，紧凑版） ---- */}
      <div className={cn('glass-card p-4')}>
        <p className={cn('text-xs font-medium mb-3', isDark ? 'text-violet-400' : 'text-violet-600')}>
          可选：上传 PDF 数据手册，让 AI 自动预填表单
        </p>

        {!file ? (
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'flex items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
              isDark
                ? 'border-slate-700 hover:border-violet-500/50 bg-slate-800/20'
                : 'border-slate-300 hover:border-violet-500/50 bg-slate-50',
            )}
          >
            <FileUp size={18} className={isDark ? 'text-violet-400' : 'text-violet-500'} />
            <span className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
              拖放或点击上传 PDF
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
              <FileUp size={14} className="text-violet-400" />
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
              onClick={handlePrefill}
              disabled={filling}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              {filling ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {filling ? 'AI 预填中...' : 'AI 预填'}
            </button>
          </div>
        )}

        {/* 预填进度 */}
        {filling && (
          <div className="mt-3 flex items-center gap-2">
            <div className="w-32 h-1 bg-slate-700/40 rounded-full overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-violet-500 to-indigo-500 animate-pulse rounded-full" />
            </div>
            <span className={cn('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
              AI 正在解析 PDF...
            </span>
          </div>
        )}

        {/* 预填成功提示 */}
        {prefilled && !filling && (
          <p className="mt-3 text-xs text-emerald-400 flex items-center gap-1">
            <Wand2 size={12} /> AI 已预填 {prefilled.name} 的参数，你可以在下方修改
          </p>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-400 text-xs">
            <AlertCircle size={13} className="flex-shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* ---- 下方表单（与 FormMode 一致） ---- */}
      <FormMode key={prefilled?.name ?? 'empty'} onDone={onDone} initialData={prefilled} />
    </div>
  )
}
