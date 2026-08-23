import { DEFAULT_ESP32_PROFILE_BY_FAMILY, ESP32_BOARD_PROFILES, ESP32_PROFILE_BY_ID } from '@/data/esp32Profiles'
import type { ProjectFormat } from '@/types/hardware'
import type { Esp32BoardProfile, Esp32Family, Esp32ProjectConfig, Esp32ValidationIssue } from '@/types/esp32'
import type { PinAssignment } from '@/types/hardware'

const TARGET_TO_FAMILY: Record<string, Esp32Family> = {
  ESP32: 'esp32',
  'ESP32-S3': 'esp32s3',
  'ESP32-C3': 'esp32c3',
  'ESP32-C6': 'esp32c6',
  'ESP32-S2': 'esp32s2',
}

export function isEsp32Target(target: string | undefined): boolean {
  return Boolean(target && TARGET_TO_FAMILY[target.toUpperCase()])
}

export function inferEsp32Family(target: string | undefined): Esp32Family {
  return TARGET_TO_FAMILY[String(target ?? '').toUpperCase()] ?? 'esp32'
}

export function getEsp32Profile(boardId: string | undefined): Esp32BoardProfile | undefined {
  return boardId ? ESP32_PROFILE_BY_ID[boardId] : undefined
}

export function getDefaultEsp32Profile(target: string | Esp32Family | undefined): Esp32BoardProfile {
  const family = String(target ?? '').startsWith('esp32') && !String(target).includes('-')
    ? target as Esp32Family
    : inferEsp32Family(String(target ?? ''))
  return ESP32_PROFILE_BY_ID[DEFAULT_ESP32_PROFILE_BY_FAMILY[family]] ?? ESP32_BOARD_PROFILES[0]
}

export function createEsp32ProjectConfig(profileOrId: Esp32BoardProfile | string = ESP32_BOARD_PROFILES[0]): Esp32ProjectConfig {
  const profile = typeof profileOrId === 'string' ? ESP32_PROFILE_BY_ID[profileOrId] ?? ESP32_BOARD_PROFILES[0] : profileOrId
  return {
    family: profile.family,
    boardId: profile.id,
    module: profile.module,
    platformioBoard: profile.platformioId,
    platformioFramework: profile.platformioFrameworks[0],
    idfTarget: profile.idfTarget,
    arduinoBoard: profile.arduinoBoard,
    flashSize: profile.flashSize,
    flashMode: profile.flashMode,
    psramSize: profile.psramSize,
    usbMode: profile.usb,
    uploadSpeed: profile.defaultUploadSpeed,
    monitorSpeed: profile.defaultMonitorSpeed,
    partitionScheme: profile.defaultPartition,
  }
}

export function normalizeEsp32ProjectConfig(config: Partial<Esp32ProjectConfig> | undefined, target?: string): Esp32ProjectConfig | undefined {
  if (!config && !isEsp32Target(target)) return undefined
  const inferredProfile = getDefaultEsp32Profile(target ?? config?.family)
  const profile = getEsp32Profile(config?.boardId) ?? inferredProfile
  const defaults = createEsp32ProjectConfig(profile)
  const platformioFramework = profile.platformioFrameworks.includes(config?.platformioFramework as never)
    ? config?.platformioFramework
    : defaults.platformioFramework
  return {
    ...defaults,
    ...config,
    family: profile.family,
    boardId: profile.id,
    module: profile.module,
    platformioBoard: profile.platformioId,
    platformioFramework: platformioFramework ?? defaults.platformioFramework,
    idfTarget: profile.idfTarget,
    arduinoBoard: profile.arduinoBoard,
  }
}

export function validateEsp32ProjectConfig(config: Esp32ProjectConfig, format: ProjectFormat): Esp32ValidationIssue[] {
  const profile = getEsp32Profile(config.boardId)
  if (!profile) return [{ severity: 'error', code: 'ESP32_BOARD_UNKNOWN', message: `未知 ESP32 开发板：${config.boardId}` }]
  const issues: Esp32ValidationIssue[] = []
  if (profile.family !== config.family) issues.push({ severity: 'error', code: 'ESP32_FAMILY_MISMATCH', message: `${profile.label} 不属于 ${config.family}` })
  if (!profile.supportedFormats.includes(format)) issues.push({ severity: 'error', code: 'ESP32_FORMAT_UNSUPPORTED', message: `${profile.label} 当前未验证 ${format} 工程配置` })
  if (format === 'platformio' && !profile.platformioFrameworks.includes(config.platformioFramework)) {
    issues.push({ severity: 'error', code: 'ESP32_PIO_FRAMEWORK_UNSUPPORTED', message: `${profile.label} 的本地 PlatformIO 清单不支持 ${config.platformioFramework}` })
  }
  if (config.flashSize !== profile.flashSize || config.flashMode !== profile.flashMode) {
    issues.push({ severity: 'error', code: 'ESP32_FLASH_MISMATCH', message: `Flash 配置必须与 ${profile.label} profile 保持一致：${profile.flashSize} / ${profile.flashMode}` })
  }
  if (config.psramSize !== profile.psramSize) {
    issues.push({ severity: 'error', code: 'ESP32_PSRAM_MISMATCH', message: `PSRAM 配置与所选模组不一致：应为“${profile.psramSize}”` })
  }
  if (profile.support[format] === 'unverified') issues.push({ severity: 'warning', code: 'ESP32_TOOLCHAIN_UNVERIFIED', message: `${profile.label} 的 ${format} 配置尚未在本机工具链验证` })
  return issues
}

function normalizePin(pin: string) {
  const match = String(pin).toUpperCase().match(/GPIO\s*(\d+)/)
  return match ? `GPIO${Number(match[1])}` : String(pin).toUpperCase().trim()
}

function looksLikeOutput(pin: PinAssignment) {
  return /LED|TX|SCL|SDA|MOSI|SCK|CLK|CS|PWM|OUT|蜂鸣|舵机|显示|时钟|数据线/i.test(`${pin.pinName} ${pin.function}`)
}

export function validateEsp32PinAssignments(config: Esp32ProjectConfig, pins: PinAssignment[]): Esp32ValidationIssue[] {
  const profile = getEsp32Profile(config.boardId)
  if (!profile) return validateEsp32ProjectConfig(config, 'espidf')
  const issues: Esp32ValidationIssue[] = []
  const seen = new Map<string, PinAssignment>()
  for (const assignment of pins) {
    const pin = normalizePin(assignment.pinNumber)
    if (!/^GPIO\d+$/.test(pin)) continue
    const previous = seen.get(pin)
    if (previous && previous.connectedTo !== assignment.connectedTo) {
      issues.push({ severity: 'error', code: 'ESP32_PIN_DUPLICATE', message: `${pin} 同时分配给 ${previous.connectedTo} 与 ${assignment.connectedTo}`, pins: [pin] })
    }
    seen.set(pin, assignment)
    const reserved = profile.pinPolicy.reserved.find((group) => group.pins.includes(pin))
    if (reserved) issues.push({ severity: 'error', code: 'ESP32_PIN_RESERVED', message: `${pin} 不可用于普通外设：${reserved.reason}`, pins: [pin] })
    else if (!profile.pinPolicy.available.includes(pin)) issues.push({ severity: 'error', code: 'ESP32_PIN_UNAVAILABLE', message: `${pin} 未在 ${profile.label} 的可用引脚范围内`, pins: [pin] })
    if (profile.pinPolicy.inputOnly.includes(pin) && looksLikeOutput(assignment)) {
      issues.push({ severity: 'error', code: 'ESP32_PIN_INPUT_ONLY', message: `${pin} 仅支持输入，不能承担“${assignment.function}”`, pins: [pin] })
    }
    if (profile.pinPolicy.strapping.includes(pin)) issues.push({ severity: 'warning', code: 'ESP32_PIN_STRAPPING', message: `${pin} 是启动配置引脚，外部电路不能在复位期间强拉错误电平`, pins: [pin] })
    if (profile.pinPolicy.usbPins.includes(pin)) issues.push({ severity: 'warning', code: 'ESP32_PIN_USB_SHARED', message: `${pin} 与原生 USB/USB Serial-JTAG 共用，使用前确认已关闭对应 USB 功能`, pins: [pin] })
  }
  return issues
}

export function esp32ConfigToPromptText(config: Esp32ProjectConfig, format: ProjectFormat): string {
  const profile = getEsp32Profile(config.boardId)
  if (!profile) return ''
  const defaults = profile.pinPolicy.defaultPins
  return `## 已确认的 ESP32 开发板配置
- SoC 系列：${profile.target}（ESP-IDF target: ${profile.idfTarget}）
- 开发板：${profile.label}
- 模组：${profile.module}
- 工程：${format}${format === 'platformio' ? ` / ${config.platformioFramework}` : ''}
- PlatformIO board：${profile.platformioId}
- Flash：${profile.flashSize} / ${profile.flashMode}
- PSRAM：${profile.psramSize}
- USB：${profile.usb}
- 无线：${profile.connectivity.join('、')}
- 上传/串口：${config.uploadSpeed} / ${config.monitorSpeed} baud
- 分区：${config.partitionScheme}
- 推荐 I2C：${defaults.i2c ? `${defaults.i2c.sda}/${defaults.i2c.scl}` : '按板卡文档选择'}

严禁把其他 ESP32 系列的引脚、DAC、USB、PSRAM 或 Flash 能力套到本板卡。PlatformIO 工程必须使用 board = ${profile.platformioId}；ESP-IDF 工程目标必须是 ${profile.idfTarget}。`
}
