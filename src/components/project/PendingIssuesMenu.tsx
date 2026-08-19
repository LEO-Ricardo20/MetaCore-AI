import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowRight, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Project } from '@/types/project'
import { cn } from '@/lib/utils'
import { getPendingIssues } from './pendingIssues'

const VIEWPORT_GAP = 12
const POPOVER_GAP = 8
const POPOVER_MAX_WIDTH = 340

interface PopoverPosition {
  left: number
  top: number
  width: number
  ready: boolean
}

export default function PendingIssuesMenu({ project, compact = false, className }: { project?: Project | null; compact?: boolean; className?: string }) {
  const navigate = useNavigate()
  const issues = getPendingIssues(project)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<PopoverPosition>({ left: VIEWPORT_GAP, top: VIEWPORT_GAP, width: POPOVER_MAX_WIDTH, ready: false })

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const triggerRect = trigger.getBoundingClientRect()
    const width = Math.min(POPOVER_MAX_WIDTH, Math.max(0, window.innerWidth - VIEWPORT_GAP * 2))
    const popoverHeight = popoverRef.current?.offsetHeight ?? Math.min(360, window.innerHeight * 0.72)
    const maxLeft = Math.max(VIEWPORT_GAP, window.innerWidth - width - VIEWPORT_GAP)
    const left = Math.max(VIEWPORT_GAP, Math.min(triggerRect.right - width, maxLeft))
    const belowTop = triggerRect.bottom + POPOVER_GAP
    const aboveTop = triggerRect.top - popoverHeight - POPOVER_GAP
    const hasRoomBelow = belowTop + popoverHeight <= window.innerHeight - VIEWPORT_GAP
    const preferredTop = hasRoomBelow || aboveTop < VIEWPORT_GAP ? belowTop : aboveTop
    const maxTop = Math.max(VIEWPORT_GAP, window.innerHeight - popoverHeight - VIEWPORT_GAP)
    const top = Math.max(VIEWPORT_GAP, Math.min(preferredTop, maxTop))

    setPosition({ left, top, width, ready: true })
  }, [])

  useLayoutEffect(() => {
    if (!open) return

    updatePosition()
    const animationFrame = window.requestAnimationFrame(updatePosition)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, issues.length, updatePosition])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  if (!issues.length) return null

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button ref={triggerRef} type="button" onClick={() => { setPosition((current) => ({ ...current, ready: false })); setOpen((value) => !value) }} className={cn('inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 font-semibold text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-300', compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1.5 text-xs')} aria-expanded={open} aria-haspopup="menu" title="查看待处理事项">
        <AlertTriangle size={compact ? 11 : 13} /> {issues.length} 待处理
      </button>
      {open && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[100] flex max-h-[min(72vh,360px)] flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-medium)] bg-[var(--surface-solid)] shadow-[var(--shadow-floating)]"
          role="menu"
          style={{ left: position.left, top: position.top, width: position.width, visibility: position.ready ? 'visible' : 'hidden' }}
        >
          <div className="border-b border-[var(--border-subtle)] px-3.5 py-3"><p className="text-xs font-semibold text-[var(--text-primary)]">待处理事项</p><p className="mt-1 text-[10px] leading-4 text-[var(--text-muted)]">点击问题直接前往对应阶段，不再逐页查找。</p></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {issues.map((issue) => {
              const invalid = issue.artifact.status === 'invalid'
              const Icon = invalid ? XCircle : AlertTriangle
              return (
                <button key={issue.key} type="button" role="menuitem" onClick={() => { setOpen(false); navigate(issue.route) }} className="flex w-full items-start gap-2.5 rounded-[var(--radius-control)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]">
                  <Icon size={14} className={cn('mt-0.5 shrink-0', invalid ? 'text-red-500' : 'text-amber-500')} />
                  <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="text-xs font-medium text-[var(--text-primary)]">{issue.label}</span><span className={cn('text-[9px] font-semibold uppercase', invalid ? 'text-red-500' : 'text-amber-600 dark:text-amber-300')}>{invalid ? 'invalid' : 'stale'}</span></span><span className="mt-1 block line-clamp-2 text-[10px] leading-4 text-[var(--text-muted)]">{issue.artifact.staleReason ?? (invalid ? '该产物未通过校验，需要重新检查或生成。' : '上游输入已变化，需要重新生成或验证。')}</span></span>
                  <ArrowRight size={13} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
                </button>
              )
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
