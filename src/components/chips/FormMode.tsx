/** 自由配置模式 — 手动填写芯片参数 */

import { useState } from 'react'
import { useThemeStore } from '@/store/themeStore'
import { useChipStore } from '@/store/chipStore'
import { cn } from '@/lib/utils'
import type { ChipSpec, GpioPin, PeripheralBus } from '@/types/hardware'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Save,
  Check,
} from 'lucide-react'

/* ---------- 外设类型选项 ---------- */
const BUS_TYPES: PeripheralBus['type'][] = [
  'I2C', 'SPI', 'UART', 'I2S', 'CAN', 'SDIO', 'USB', 'ADC', 'DAC', 'PWM',
]

/* ---------- 空模板 ---------- */
const emptySpec = (): ChipSpec => ({
  name: '', fullName: '', arch: '', flash: '', sram: '',
  clockSpeed: '', voltage: '',
  gpios: [], peripherals: [], bootPins: [], restrictions: [],
})

const emptyGpio = (): GpioPin => ({
  pin: '', altFunctions: [], inputOnly: false, notes: '',
})

const emptyBus = (): PeripheralBus => ({
  name: '', type: 'I2C', defaultPins: {},
})

/* ---------- 组件 ---------- */
interface Props {
  onDone: () => void
  initialData?: ChipSpec
}

export default function FormMode({ onDone, initialData }: Props) {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const { addChip, updateChip } = useChipStore()

  const [step, setStep] = useState(1)
  const [spec, setSpec] = useState<ChipSpec>(initialData ?? emptySpec())
  const [saved, setSaved] = useState(false)

  const isEdit = !!initialData

  /* ---------- 输入框样式 ---------- */
  const inputCls = cn(
    'bg-transparent border rounded-lg px-3 py-2 text-sm outline-none w-full transition-colors',
    isDark ? 'border-slate-700 text-white placeholder-slate-500' : 'border-slate-300 text-slate-800 placeholder-slate-400'
  )

  /* ---------- 更新字段 ---------- */
  const set = <K extends keyof ChipSpec>(k: K, v: ChipSpec[K]) =>
    setSpec(prev => ({ ...prev, [k]: v }))

  /* ---------- GPIO 操作 ---------- */
  const updateGpio = (i: number, patch: Partial<GpioPin>) =>
    set('gpios', spec.gpios.map((g, idx) => idx === i ? { ...g, ...patch } : g))

  const removeGpio = (i: number) =>
    set('gpios', spec.gpios.filter((_, idx) => idx !== i))

  /* ---------- 外设操作 ---------- */
  const updateBus = (i: number, patch: Partial<PeripheralBus>) =>
    set('peripherals', spec.peripherals.map((p, idx) => idx === i ? { ...p, ...patch } : p))

  const removeBus = (i: number) =>
    set('peripherals', spec.peripherals.filter((_, idx) => idx !== i))

  /* ---------- 保存 ---------- */
  const handleSave = () => {
    if (!spec.name.trim()) return
    if (isEdit) {
      updateChip(initialData!.name, spec)
    } else {
      addChip(spec)
    }
    setSaved(true)
    setTimeout(() => onDone(), 800)
  }

  /* ---------- Step 1: 基本信息 ---------- */
  const renderStep1 = () => (
    <div className="grid grid-cols-2 gap-4">
      {([
        ['name', '短名称', 'ESP32-C3'],
        ['fullName', '完整型号', 'ESP32-C3-MINI-1'],
        ['arch', '架构', 'RISC-V 单核'],
        ['flash', 'Flash', '4MB'],
        ['sram', 'SRAM', '400KB'],
        ['clockSpeed', '主频', '160MHz'],
        ['voltage', '工作电压', '3.3V'],
      ] as [keyof ChipSpec, string, string][]).map(([key, label, ph]) => (
        <label key={key} className="flex flex-col gap-1">
          <span className={cn('text-xs font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>{label}</span>
          <input
            className={inputCls}
            placeholder={ph}
            value={spec[key] as string}
            onChange={e => set(key, e.target.value as any)}
          />
        </label>
      ))}
    </div>
  )

  /* ---------- Step 2: GPIO 引脚 ---------- */
  const renderStep2 = () => (
    <div className="flex flex-col gap-3">
      {spec.gpios.map((g, i) => (
        <div key={i} className={cn('flex items-start gap-2 p-3 rounded-xl border', isDark ? 'border-slate-700/60 bg-slate-800/30' : 'border-slate-200 bg-slate-50')}>
          <div className="flex-1 grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="引脚 (如 GPIO4)" value={g.pin} onChange={e => updateGpio(i, { pin: e.target.value })} />
            <input className={inputCls} placeholder="复用功能 (逗号分隔)" value={g.altFunctions.join(', ')} onChange={e => updateGpio(i, { altFunctions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
            <input className={inputCls} placeholder="备注" value={g.notes ?? ''} onChange={e => updateGpio(i, { notes: e.target.value })} />
            {/* 仅输入开关 */}
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input type="checkbox" checked={g.inputOnly ?? false} onChange={e => updateGpio(i, { inputOnly: e.target.checked })} className="accent-indigo-500" />
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>仅输入</span>
            </label>
          </div>
          <button onClick={() => removeGpio(i)} className="mt-1 p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button onClick={() => set('gpios', [...spec.gpios, emptyGpio()])} className={cn('flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors', isDark ? 'text-indigo-400 hover:bg-indigo-500/10' : 'text-indigo-600 hover:bg-indigo-50')}>
        <Plus size={14} /> 添加引脚
      </button>
    </div>
  )

  /* ---------- Step 3: 外设总线 ---------- */
  const renderStep3 = () => (
    <div className="flex flex-col gap-3">
      {spec.peripherals.map((p, i) => (
        <div key={i} className={cn('flex items-start gap-2 p-3 rounded-xl border', isDark ? 'border-slate-700/60 bg-slate-800/30' : 'border-slate-200 bg-slate-50')}>
          <div className="flex-1 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder="名称 (如 I2C0)" value={p.name} onChange={e => updateBus(i, { name: e.target.value })} />
              <select className={inputCls} value={p.type} onChange={e => updateBus(i, { type: e.target.value as PeripheralBus['type'] })}>
                {BUS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {/* 默认引脚映射 — 键值对输入 */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(p.defaultPins).map(([signal, pin]) => (
                <div key={signal} className="flex items-center gap-1">
                  <input className={cn(inputCls, 'w-16')} value={signal} onChange={e => {
                    const newPins = { ...p.defaultPins }
                    delete newPins[signal]
                    newPins[e.target.value] = pin
                    updateBus(i, { defaultPins: newPins })
                  }} />
                  <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>=</span>
                  <input className={cn(inputCls, 'w-20')} value={pin} onChange={e => {
                    updateBus(i, { defaultPins: { ...p.defaultPins, [signal]: e.target.value } })
                  }} />
                  <button onClick={() => {
                    const newPins = { ...p.defaultPins }
                    delete newPins[signal]
                    updateBus(i, { defaultPins: newPins })
                  }} className="text-red-400 hover:text-red-300">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button onClick={() => updateBus(i, { defaultPins: { ...p.defaultPins, '': '' } })} className={cn('text-xs px-2 py-1 rounded-lg', isDark ? 'text-cyan-400 hover:bg-cyan-500/10' : 'text-cyan-600 hover:bg-cyan-50')}>
                + 引脚
              </button>
            </div>
          </div>
          <button onClick={() => removeBus(i)} className="mt-1 p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button onClick={() => set('peripherals', [...spec.peripherals, emptyBus()])} className={cn('flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors', isDark ? 'text-indigo-400 hover:bg-indigo-500/10' : 'text-indigo-600 hover:bg-indigo-50')}>
        <Plus size={14} /> 添加外设
      </button>
    </div>
  )

  /* ---------- Step 4: 限制条件 ---------- */
  const renderStep4 = () => (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className={cn('text-xs font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>启动受限引脚（逗号分隔）</span>
        <input className={inputCls} placeholder="GPIO0, GPIO2, GPIO5" value={spec.bootPins.join(', ')} onChange={e => set('bootPins', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={cn('text-xs font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>限制条件（每行一条）</span>
        <textarea className={cn(inputCls, 'min-h-[120px] resize-y')} placeholder={'GPIO6-11 连接内部 Flash，不可用\nWiFi 启用时 ADC2 不可用'} value={spec.restrictions.join('\n')} onChange={e => set('restrictions', e.target.value.split('\n').filter(Boolean))} />
      </label>
    </div>
  )

  /* ---------- 步骤标题 ---------- */
  const stepTitles = ['基本信息', 'GPIO 引脚', '外设总线', '限制条件']

  return (
    <div className="flex flex-col gap-5">
      {/* 步骤指示器 */}
      <div className="flex items-center gap-2">
        {stepTitles.map((t, i) => (
          <button
            key={t}
            onClick={() => setStep(i + 1)}
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all',
              step === i + 1
                ? (isDark ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-100 text-indigo-700 border border-indigo-200')
                : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')
            )}
          >
            <span className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
              step === i + 1
                ? 'bg-indigo-500 text-white'
                : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500')
            )}>
              {i + 1}
            </span>
            {t}
          </button>
        ))}
      </div>

      {/* 表单内容 */}
      <div className={cn('glass-card p-5')}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>

      {/* 底部按钮 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
          className={cn(
            'flex items-center gap-1 text-sm px-4 py-2 rounded-xl transition-all',
            step === 1
              ? 'opacity-30 cursor-not-allowed'
              : (isDark ? 'text-slate-300 hover:bg-slate-700/60' : 'text-slate-600 hover:bg-slate-100')
          )}
        >
          <ChevronLeft size={15} /> 上一步
        </button>

        {step < 4 ? (
          <button
            onClick={() => setStep(s => Math.min(4, s + 1))}
            className="btn-primary flex items-center gap-1 rounded-[var(--radius-control)] px-4 py-2 text-sm font-medium text-white transition-all hover:-translate-y-0.5"
          >
            下一步 <ChevronRight size={15} />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={!spec.name.trim() || saved}
            className={cn(
              'flex items-center gap-2 text-sm px-5 py-2 rounded-xl font-medium transition-all shadow-lg hover:-translate-y-0.5',
              saved
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-emerald-500/20',
              (!spec.name.trim() && !saved) && 'opacity-40 cursor-not-allowed'
            )}
          >
            {saved ? <><Check size={15} /> 已保存</> : <><Save size={15} /> {isEdit ? '更新芯片' : '保存到芯片库'}</>}
          </button>
        )}
      </div>
    </div>
  )
}
