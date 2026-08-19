import type { WiringEntry } from '@/types/hardware'

const WIRE_COLORS: Record<string, string> = {
  红: 'bg-red-500/10 text-red-700 border border-red-500/30',
  橙: 'bg-orange-500/10 text-orange-700 border border-orange-500/30',
  黄: 'bg-yellow-500/10 text-yellow-700 border border-yellow-500/30',
  绿: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30',
  蓝: 'bg-blue-500/10 text-blue-700 border border-blue-500/30',
  紫: 'bg-purple-500/10 text-purple-700 border border-purple-500/30',
  黑: 'bg-slate-500/10 text-slate-700 border border-slate-500/30',
  白: 'bg-slate-100 text-slate-700 border border-slate-300',
}

export default function WiringTable({ wiring }: { wiring: WiringEntry[] }) {
  return (
    <div className="glass-card p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-400" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">接线对照表</span>
          <span className="text-xs text-[var(--text-muted)]">Wiring Guide</span>
        </div>
        <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-xs text-[var(--text-muted)]">{wiring.length} 条连接</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
              <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider">起点</th>
              <th className="text-left px-3 py-3 w-8 text-center">
                <svg width="16" height="16" viewBox="0 0 16 16" className="inline text-slate-600">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </th>
              <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider">终点</th>
              <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider">线色</th>
              <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider">备注</th>
            </tr>
          </thead>
          <tbody>
            {wiring.map((w, i) => (
              <tr key={i} className="border-b border-[var(--border-subtle)] transition-colors duration-150 hover:bg-violet-500/5">
                <td className="px-5 py-3 font-mono text-[12px] text-indigo-700">{w.from}</td>
                <td className="px-3 py-3 text-center text-sm text-[var(--text-muted)]">→</td>
                <td className="px-5 py-3 font-mono text-[12px] text-emerald-700">{w.to}</td>
                <td className="px-5 py-3">
                  {w.wireColor ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${WIRE_COLORS[w.wireColor] ?? 'border border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-secondary)]'}`}>{w.wireColor}</span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">-</span>
                  )}
                </td>
                <td className="px-5 py-3 text-[12px] text-[var(--text-secondary)]">{w.note || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
