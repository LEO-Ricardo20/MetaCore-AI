import type { PinAssignment } from '@/types/hardware'

const VOLTAGE_COLORS: Record<string, string> = {
  '3V3': 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  '3.3V': 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  '5V': 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  'GND': 'bg-red-500/10 text-red-700 border-red-500/30',
}

export default function PinTable({ pins }: { pins: PinAssignment[] }) {
  return (
    <div className="glass-card p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-400" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">引脚分配表</span>
          <span className="text-xs text-[var(--text-muted)]">Pin Assignment</span>
        </div>
        <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-xs text-[var(--text-muted)]">{pins.length} pins</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
              <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider">#</th>
              <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider">引脚名</th>
              <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider">功能</th>
              <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider">连接设备</th>
              <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider">电压</th>
            </tr>
          </thead>
          <tbody>
            {pins.map((p, i) => (
              <tr key={i} className="group border-b border-[var(--border-subtle)] transition-colors duration-150 hover:bg-indigo-500/5">
                <td className="px-5 py-3">
                  <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-mono text-[11px] text-indigo-700 transition-colors group-hover:bg-indigo-500/20">{p.pinNumber}</span>
                </td>
                <td className="px-5 py-3 text-[13px] font-medium text-[var(--text-primary)]">{p.pinName}</td>
                <td className="px-5 py-3 text-[13px] text-[var(--text-secondary)]">{p.function}</td>
                <td className="px-5 py-3 text-[13px] text-[var(--text-secondary)]">{p.connectedTo}</td>
                <td className="px-5 py-3">
                  {p.voltage ? (
                    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${VOLTAGE_COLORS[p.voltage] ?? 'border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-secondary)]'}`}>{p.voltage}</span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
