/** SVG 芯片引脚可视化组件 — 按芯片型号渲染引脚图，支持悬停查看连接详情 */
import { useState } from 'react'
import type { PinAssignment, ChipTarget } from '@/types/hardware'
import { useThemeStore } from '@/store/themeStore'

interface Props {
  pins: PinAssignment[]
  chipType: ChipTarget
}

// 芯片引脚定义（标准布局）
const CHIP_DEFS: Record<string, { name: string; totalPins: number; leftPins: string[]; rightPins: string[] }> = {
  'ESP32': {
    name: 'ESP32-WROOM-32',
    totalPins: 38,
    leftPins: ['GND', '3V3', 'EN', 'IO36', 'IO39', 'IO34', 'IO35', 'IO32', 'IO33', 'IO25', 'IO26', 'IO27', 'IO14', 'IO12', 'IO13', 'IO9', 'IO10', 'IO11', '3V3'],
    rightPins: ['GND', 'IO0', 'IO4', 'IO16', 'IO17', 'IO5', 'IO18', 'IO19', 'IO21', 'RXD0', 'TXD0', 'IO22', 'IO23', 'GND', 'IO2', 'IO15', 'GND', 'GND', 'GND'],
  },
  'ESP32-S3': {
    name: 'ESP32-S3-WROOM-1',
    totalPins: 38,
    // 左侧 1-19 脚（从上到下）：对照乐鑫官方 ESP32-S3-WROOM-1 Datasheet Pin Layout
    leftPins:  ['GND', '3V3', 'EN', 'IO0', 'IO1', 'IO2', 'IO3', 'IO4', 'IO5', 'IO6', 'IO7', 'IO8', 'IO9', 'IO10', 'IO11', 'IO12', 'IO13', 'IO14', '3V3'],
    // 右侧 20-38 脚（从上到下）：IO32-IO37 被 Flash/PSRAM 占用，模块未引出
    rightPins: ['GND', 'IO46', 'IO45', 'IO44', 'IO43', 'IO42', 'IO41', 'IO40', 'IO39', 'IO38', 'IO21', 'IO20', 'IO19', 'IO18', 'IO17', 'IO16', 'IO15', 'GND', 'GND'],
  },
  'STM32F103': {
    name: 'STM32F103C8T6',
    totalPins: 48,
    leftPins: ['VBAT', 'PC13', 'PC14', 'PC15', 'PD0', 'PD1', 'NRST', 'VSSA', 'VDDA', 'PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6', 'PA7', 'PB0', 'PB1', 'PB2', 'PB10', 'PB11', 'VSS', 'VDD'],
    rightPins: ['PB12', 'PB13', 'PB14', 'PB15', 'PA8', 'PA9', 'PA10', 'PA11', 'PA12', 'PA13', 'PA14', 'PA15', 'PB3', 'PB4', 'PB5', 'PB6', 'PB7', 'PB8', 'PB9', 'VSS', 'VDD', 'PC0', 'PC1', 'BOOT0'],
  },
  'STM32F4': {
    name: 'STM32F407VGT6',
    totalPins: 100,
    leftPins: ['VBAT', 'PC13', 'PC14', 'PC15', 'PI8', 'PI9', 'PI10', 'PI11', 'VCAP', 'VSSA', 'VDDA', 'PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6', 'PA7', 'PB0', 'PB1', 'PB2', 'PF0', 'PF1', 'PF2', 'PF3', 'PF4', 'PF5', 'PF6', 'PF7', 'PF8', 'PF9', 'PF10', 'PF11', 'PF12', 'PF13', 'PF14', 'PF15', 'PG0', 'PG1', 'VSS', 'VDD', 'PA8', 'PA9', 'PA10', 'PA11', 'PA12', 'PA13'],
    rightPins: ['PC0', 'PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7', 'PC8', 'PC9', 'PC10', 'PC11', 'PC12', 'PD0', 'PD1', 'PD2', 'PD3', 'PD4', 'PD5', 'PD6', 'PD7', 'PD8', 'PD9', 'PD10', 'PD11', 'PD12', 'PD13', 'PD14', 'PD15', 'PG2', 'PG3', 'PG4', 'PG5', 'PG6', 'PG7', 'PG8', 'VSS', 'VDD', 'PG9', 'PG10', 'PG11', 'PG12', 'PG13', 'PG14', 'PG15', 'PB3', 'PB4', 'PB5', 'PB6', 'PB7'],
  },
  'STM32F103-KIT': {
    name: 'STM32F103C8T6 (KEYSKING学习板)',
    totalPins: 48,
    leftPins:  ['VBAT', 'PC13', 'PC14', 'PC15', 'PD0', 'PD1', 'NRST', 'VSSA', 'VDDA', 'PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6', 'PA7', 'PB0', 'PB1', 'PB2', 'PB10', 'PB11', 'VSS', 'VDD'],
    rightPins: ['PB12', 'PB13', 'PB14', 'PB15', 'PA8', 'PA9', 'PA10', 'PA11', 'PA12', 'PA13', 'PA14', 'PA15', 'PB3', 'PB4', 'PB5', 'PB6', 'PB7', 'PB8', 'PB9', 'VSS', 'VDD', 'PC0', 'PC1', 'BOOT0'],
  },
}

// 电源/地线/特殊引脚颜色
const POWER_COLORS: Record<string, string> = {
  '3V3': '#22c55e', '3.3V': '#22c55e', '5V': '#f59e0b',
  'GND': '#ef4444', 'VCC': '#22c55e', 'VBAT': '#f59e0b',
  'VDD': '#22c55e', 'VSSA': '#ef4444', 'VDDA': '#22c55e',
  'VSS': '#ef4444', 'VCAP': '#8b5cf6', 'EN': '#6366f1',
  'NRST': '#ef4444', 'BOOT0': '#6366f1',
}

/** 判断是否为电源引脚 */
const isPowerPin = (name: string) =>
  ['3V3', '3.3V', '5V', 'VCC', 'VDD', 'VDDA', 'VBAT', 'VCAP'].some(k => name.includes(k))

/** 判断是否为地线引脚 */
const isGndPin = (name: string) =>
  ['GND', 'VSS', 'VSSA'].some(k => name.includes(k))

/** 判断是否为特殊功能引脚 */
const isSpecialPin = (name: string) =>
  ['EN', 'NRST', 'BOOT0'].some(k => name.includes(k))

/** 根据引脚名称返回对应的显示颜色 */
function getPinColor(pinName: string): string {
  for (const key of Object.keys(POWER_COLORS)) {
    if (pinName.includes(key)) return POWER_COLORS[key]
  }
  return '#6366f1'
}

// ─── 布局常量 ───
const SVG_WIDTH = 700
const CHIP_WIDTH = 160
const PIN_LENGTH = 44
const ROW_HEIGHT = 30
const FONT_SIZE = 11
const CHIP_FONT_SIZE = 12

export default function PinDiagram({ pins, chipType }: Props) {
  const [hoveredPin, setHoveredPin] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; pin: PinAssignment } | null>(null)
  const isDark = useThemeStore(s => s.theme) === 'dark'

  const chipDef = CHIP_DEFS[chipType] ?? CHIP_DEFS['ESP32']

  // 按 pinNumber 和 pinName 建立双向映射，兼容 GPIO/IO 格式
  const pinMap = new Map<string, PinAssignment>()
  for (const pin of pins) {
    pinMap.set(pin.pinName, pin)
    pinMap.set(pin.pinNumber, pin)
    if (pin.pinNumber.startsWith('GPIO')) pinMap.set('IO' + pin.pinNumber.slice(4), pin)
    if (pin.pinNumber.startsWith('IO')) pinMap.set('GPIO' + pin.pinNumber.slice(2), pin)
  }

  const totalRows = Math.max(chipDef.leftPins.length, chipDef.rightPins.length)
  const CHIP_HEIGHT = totalRows * ROW_HEIGHT + 50
  const ROW_START_Y = (CHIP_HEIGHT - totalRows * ROW_HEIGHT) / 2 + 15

  // 芯片主体 x 坐标
  const chipX = (SVG_WIDTH - CHIP_WIDTH) / 2

  /** 计算单个引脚的渲染样式 */
  function getPinStyles(pinName: string, isHovered: boolean, hasConnection: boolean) {
    const pinColor = getPinColor(pinName)
    const alwaysColored = isPowerPin(pinName) || isGndPin(pinName) || isSpecialPin(pinName)
    const colored = alwaysColored || hasConnection

    const fill = colored
      ? (isHovered ? pinColor : `${pinColor}88`)
      : (isDark ? '#1e293b' : '#cbd5e1')

    const stroke = colored ? pinColor : (isDark ? '#334155' : '#94a3b8')
    const strokeWidth = isHovered ? 2 : 0.5

    let textFill: string
    if (alwaysColored) {
      textFill = pinColor
    } else if (hasConnection) {
      textFill = isDark ? '#e2e8f0' : '#1e293b'
    } else {
      textFill = isDark ? '#64748b' : '#64748b'
    }

    return { pinColor, fill, stroke, strokeWidth, textFill }
  }

  /** 处理引脚悬停 */
  function handlePinHover(pinName: string, side: 'left' | 'right', idx: number, e: React.MouseEvent) {
    setHoveredPin(`${side}-${idx}`)
    const assignment = pinMap.get(pinName)
    if (assignment) {
      const rect = (e.target as SVGElement).getBoundingClientRect()
      setTooltip({ x: rect.left + rect.width / 2, y: rect.top, pin: assignment })
    }
  }

  function handlePinLeave() {
    setHoveredPin(null)
    setTooltip(null)
  }

  /** 渲染一侧的引脚 */
  function renderPins(pinList: string[], side: 'left' | 'right') {
    return pinList.map((pinName, idx) => {
      const y = ROW_START_Y + idx * ROW_HEIGHT
      const isHovered = hoveredPin === `${side}-${idx}`
      const assignment = pinMap.get(pinName)
      const hasConnection = !!assignment
      const { pinColor, fill, stroke, strokeWidth, textFill } = getPinStyles(pinName, isHovered, hasConnection)

      const isLeft = side === 'left'
      // 引脚条 x 坐标
      const pinX = isLeft ? chipX - PIN_LENGTH : chipX + CHIP_WIDTH
      // 文字 x 坐标（在引脚条外侧）
      const textX = isLeft ? pinX - 6 : pinX + PIN_LENGTH + 6
      const anchor = isLeft ? 'end' : 'start'
      // 连接点 x 坐标
      const dotX = isLeft ? pinX - 4 : pinX + PIN_LENGTH + 4

      return (
        <g key={`${side}-${idx}`}>
          {/* 引脚条 */}
          <rect
            x={pinX}
            y={y - 8}
            width={PIN_LENGTH}
            height={16}
            rx={3}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            className="cursor-pointer transition-all duration-150"
            onMouseEnter={(e) => handlePinHover(pinName, side, idx, e)}
            onMouseLeave={handlePinLeave}
          />
          {/* 引脚名称 */}
          <text
            x={textX}
            y={y + 1}
            textAnchor={anchor}
            fill={textFill}
            fontSize={FONT_SIZE}
            fontWeight={hasConnection || isPowerPin(pinName) || isGndPin(pinName) ? 600 : 400}
            fontFamily="'JetBrains Mono', 'Fira Code', monospace"
          >
            {pinName.length > 8 ? pinName.slice(0, 7) + '…' : pinName}
          </text>
          {/* 连接指示点 */}
          {hasConnection && (
            <circle cx={dotX} cy={y} r={3.5} fill={pinColor} />
          )}
        </g>
      )
    })
  }

  // 主题相关的渐变 ID（避免多实例冲突）
  const gradientId = `chipGrad-${chipType}`
  const borderGradId = `chipBorder-${chipType}`

  return (
    <div className="relative">
      {/* 芯片标题 */}
      <div className="flex items-center justify-center mb-4">
        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border ${
          isDark ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-200'
        }`}>
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className={`text-xs font-medium ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
            {chipDef.name} · {chipDef.totalPins} Pin
          </span>
        </div>
      </div>

      {/* SVG 引脚图（支持横向滚动） */}
      <div className="flex justify-center overflow-x-auto">
        <svg
          width={SVG_WIDTH}
          height={CHIP_HEIGHT}
          viewBox={`0 0 ${SVG_WIDTH} ${CHIP_HEIGHT}`}
          className="overflow-visible flex-shrink-0"
        >
          {/* 渐变定义 */}
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isDark ? '#1e1b4b' : '#e0e7ff'} />
              <stop offset="100%" stopColor={isDark ? '#0f0a2e' : '#f0f4ff'} />
            </linearGradient>
            <linearGradient id={borderGradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={isDark ? '#6366f1' : '#818cf8'} stopOpacity={0.6} />
              <stop offset="100%" stopColor={isDark ? '#8b5cf6' : '#a5b4fc'} stopOpacity={0.3} />
            </linearGradient>
          </defs>

          {/* 芯片主体 */}
          <rect
            x={chipX}
            y={0}
            width={CHIP_WIDTH}
            height={CHIP_HEIGHT}
            rx={10}
            ry={10}
            fill={`url(#${gradientId})`}
            stroke={`url(#${borderGradId})`}
            strokeWidth={2}
            style={{ filter: isDark
              ? 'drop-shadow(0 8px 24px rgba(99,102,241,0.15))'
              : 'drop-shadow(0 4px 16px rgba(99,102,241,0.1))'
            }}
          />

          {/* 芯片顶部标签 */}
          <rect
            x={chipX + 8}
            y={10}
            width={CHIP_WIDTH - 16}
            height={32}
            rx={6}
            fill={isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)'}
          />
          <text
            x={SVG_WIDTH / 2}
            y={30}
            textAnchor="middle"
            fill={isDark ? '#a5b4fc' : '#4f46e5'}
            fontSize={CHIP_FONT_SIZE}
            fontWeight={600}
            fontFamily="'JetBrains Mono', 'Fira Code', monospace"
          >
            {chipDef.name}
          </text>

          {/* 引脚 */}
          {renderPins(chipDef.leftPins, 'left')}
          {renderPins(chipDef.rightPins, 'right')}
        </svg>
      </div>

      {/* 图例 */}
      <div className="flex justify-center gap-5 mt-4 flex-wrap">
        {[
          { label: '电源 (3V3/5V)', color: '#22c55e' },
          { label: '地线 (GND)', color: '#ef4444' },
          { label: 'GPIO', color: '#6366f1' },
          { label: '特殊功能', color: '#8b5cf6' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{label}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-4 py-3 rounded-xl shadow-2xl border pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 10,
            transform: 'translate(-50%, -100%)',
            background: isDark
              ? 'linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.98))'
              : 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(241,245,249,0.98))',
            borderColor: isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className={`text-xs font-mono mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            #{tooltip.pin.pinNumber} {tooltip.pin.pinName}
          </div>
          <div className={`text-sm font-medium ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
            {tooltip.pin.function}
          </div>
          <div className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            → {tooltip.pin.connectedTo}
          </div>
          {tooltip.pin.voltage && (
            <div className="text-xs mt-0.5" style={{ color: getPinColor(tooltip.pin.voltage) }}>
              {tooltip.pin.voltage}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
