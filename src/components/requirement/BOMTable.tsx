import type { BOMItem } from '@/types/hardware'

export default function BOMTable({ bom }: { bom: BOMItem[] }) {
  const total = bom.reduce((s, b) => s + b.unitPrice * b.quantity, 0)
  return (
    <div className="glass-card p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">采购清单</span>
          <span className="text-xs text-[var(--text-muted)]">BOM</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)]">{bom.length} 种器件</span>
          <div className="flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1">
            <span className="text-xs text-[var(--text-secondary)]">预估</span>
            <span className="text-sm font-bold text-amber-700">¥{total.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
              <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider">名称</th>
              <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider">型号</th>
              <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider">数量</th>
              <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider">单价</th>
              <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider">小计</th>
            </tr>
          </thead>
          <tbody>
            {bom.map((b, i) => (
              <tr key={i} className="border-b border-[var(--border-subtle)] transition-colors duration-150 hover:bg-cyan-500/5">
                <td className="px-5 py-3 text-[13px] font-medium text-[var(--text-primary)]">{b.name}</td>
                <td className="px-5 py-3 font-mono text-[12px] text-[var(--text-secondary)]">{b.model}</td>
                <td className="px-5 py-3 text-[13px] text-[var(--text-secondary)]">{b.quantity}</td>
                <td className="px-5 py-3 text-[13px] text-[var(--text-secondary)]">¥{b.unitPrice.toFixed(2)}</td>
                <td className="px-5 py-3 text-[13px] font-semibold text-amber-700">¥{(b.unitPrice * b.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
