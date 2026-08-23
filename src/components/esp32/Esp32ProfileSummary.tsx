import { Cable, Cpu, HardDrive, Radio, Usb } from 'lucide-react'
import { getEsp32Profile } from '@/services/esp32/esp32Config'
import type { Esp32ProjectConfig } from '@/types/esp32'

export default function Esp32ProfileSummary({ config, compact = false }: { config: Esp32ProjectConfig; compact?: boolean }) {
  const profile = getEsp32Profile(config.boardId)
  if (!profile) return null
  const rows = [
    { icon: Cpu, label: '模组', value: profile.module },
    { icon: HardDrive, label: '存储', value: `${profile.flashSize} ${profile.flashMode.toUpperCase()} · PSRAM ${profile.psramSize}` },
    { icon: Usb, label: 'USB', value: profile.usb },
    { icon: Radio, label: '无线', value: profile.connectivity.join(' · ') },
    { icon: Cable, label: '工具链', value: `PIO ${profile.platformioId} · IDF ${profile.idfTarget}` },
  ]
  return (
    <div className={compact ? 'grid gap-2 sm:grid-cols-2' : 'grid gap-2 md:grid-cols-2 xl:grid-cols-3'}>
      {rows.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex min-w-0 items-start gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2">
          <Icon size={13} className="mt-0.5 shrink-0 text-[var(--accent-cyan)]" />
          <span className="min-w-0"><span className="block text-[10px] text-[var(--text-muted)]">{label}</span><span className="block break-words text-xs text-[var(--text-secondary)]">{value}</span></span>
        </div>
      ))}
    </div>
  )
}
