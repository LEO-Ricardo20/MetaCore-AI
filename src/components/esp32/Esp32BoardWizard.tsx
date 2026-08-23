import { AlertTriangle, BadgeCheck, BookOpen, Cpu, Gauge, MemoryStick, Radio, Usb } from 'lucide-react'
import { ESP32_BOARD_PROFILES } from '@/data/esp32Profiles'
import { cn } from '@/lib/utils'
import { createEsp32ProjectConfig, getEsp32Profile, validateEsp32ProjectConfig } from '@/services/esp32/esp32Config'
import type { ProjectFormat } from '@/types/hardware'
import type { Esp32ProjectConfig } from '@/types/esp32'
import Esp32ProfileSummary from './Esp32ProfileSummary'

interface Props {
  value: Esp32ProjectConfig
  format: ProjectFormat
  onChange: (config: Esp32ProjectConfig) => void
  onTargetChange?: (target: string) => void
  onFormatChange?: (format: ProjectFormat) => void
  compact?: boolean
}

const partitions = ['default.csv', 'default_8MB.csv', 'min_spiffs.csv', 'huge_app.csv']
const uploadSpeeds = [115200, 460800, 921600]
const monitorSpeeds = [9600, 57600, 115200, 230400]

export default function Esp32BoardWizard({ value, format, onChange, onTargetChange, onFormatChange, compact = false }: Props) {
  const profile = getEsp32Profile(value.boardId) ?? ESP32_BOARD_PROFILES[0]
  const issues = validateEsp32ProjectConfig(value, format)
  const selectClass = 'min-h-9 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-cyan)]'

  function chooseBoard(boardId: string) {
    const nextProfile = ESP32_BOARD_PROFILES.find((item) => item.id === boardId) ?? ESP32_BOARD_PROFILES[0]
    onChange(createEsp32ProjectConfig(nextProfile))
    onTargetChange?.(nextProfile.target)
    if (!nextProfile.supportedFormats.includes(format)) onFormatChange?.(nextProfile.supportedFormats[0])
  }

  return (
    <section className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-medium)] bg-[var(--surface-panel)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3 pl-14 sm:pl-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] bg-cyan-500/10 text-[var(--accent-cyan)]"><Cpu size={15} /></div>
          <div><h3 className="text-sm font-semibold text-[var(--text-primary)]">ESP32 开发板配置</h3><p className="text-[11px] text-[var(--text-muted)]">{profile.label} · {profile.cpu}</p></div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-300"><BadgeCheck size={11} /> PlatformIO 清单已核对</span>
      </div>

      <div className={cn('space-y-4 p-4', compact && 'space-y-3')}>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-secondary)]">开发板 / 模组</label>
          <select value={profile.id} onChange={(event) => chooseBoard(event.target.value)} className={selectClass} aria-label="ESP32 开发板">
            {ESP32_BOARD_PROFILES.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.module}</option>)}
          </select>
        </div>

        <Esp32ProfileSummary config={value} compact />

        <div className={cn('grid gap-3', compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4')}>
          {format === 'platformio' && (
            <label className="block"><span className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)]"><Cpu size={11} />PlatformIO 框架</span>
              <select value={value.platformioFramework} onChange={(event) => onChange({ ...value, platformioFramework: event.target.value as Esp32ProjectConfig['platformioFramework'] })} className={selectClass}>
                {profile.platformioFrameworks.map((framework) => <option key={framework} value={framework}>{framework === 'arduino' ? 'Arduino' : 'ESP-IDF'}</option>)}
              </select>
            </label>
          )}
          <label className="block"><span className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)]"><MemoryStick size={11} />分区方案</span>
            <select value={value.partitionScheme} onChange={(event) => onChange({ ...value, partitionScheme: event.target.value })} className={selectClass}>
              {[...new Set([value.partitionScheme, profile.defaultPartition, ...partitions])].map((partition) => <option key={partition} value={partition}>{partition}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)]"><Gauge size={11} />上传速度</span>
            <select value={value.uploadSpeed} onChange={(event) => onChange({ ...value, uploadSpeed: Number(event.target.value) })} className={selectClass}>
              {uploadSpeeds.map((speed) => <option key={speed} value={speed}>{speed} baud</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)]"><Radio size={11} />串口速度</span>
            <select value={value.monitorSpeed} onChange={(event) => onChange({ ...value, monitorSpeed: Number(event.target.value) })} className={selectClass}>
              {monitorSpeeds.map((speed) => <option key={speed} value={speed}>{speed} baud</option>)}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2 text-[10px] text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-1"><MemoryStick size={10} />Flash {profile.flashSize} {profile.flashMode.toUpperCase()}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-1"><Usb size={10} />{profile.usb}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-1"><Radio size={10} />{profile.connectivity.join(' / ')}</span>
        </div>

        {profile.notes.length > 0 && <div className="rounded-[var(--radius-control)] border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] leading-5 text-amber-700 dark:text-amber-300">{profile.notes.join(' ')}</div>}
        {issues.map((issue) => <div key={issue.code} className={cn('flex items-start gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-[11px]', issue.severity === 'error' ? 'border-red-500/25 bg-red-500/8 text-red-600 dark:text-red-300' : 'border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-300')}><AlertTriangle size={12} className="mt-0.5 shrink-0" />{issue.message}</div>)}

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3 text-[10px] text-[var(--text-muted)]">
          <BookOpen size={11} /> 数据来源
          {profile.sourceUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="text-[var(--accent-cyan)] hover:underline">{index === 0 ? 'Espressif' : 'PlatformIO'}</a>)}
        </div>
      </div>
    </section>
  )
}
