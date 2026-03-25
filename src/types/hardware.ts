/** 硬件相关类型定义 — 芯片规格、引脚分配、BOM、接线 */

export type ChipTarget = string
export const PRESET_CHIPS: string[] = ['ESP32', 'ESP32-S3', 'STM32F103', 'STM32F4', 'STM32F103-KIT']

export type ProjectFormat = 'espidf' | 'arduino' | 'platformio' | 'cubeide'

/** GPIO 引脚定义 */
export interface GpioPin {
  /** 引脚编号，如 GPIO4、PA0 */
  pin: string
  /** 复用功能列表，如 ['I2C0_SDA', 'ADC1_CH0'] */
  altFunctions: string[]
  /** 是否仅支持输入 */
  inputOnly?: boolean
  /** 特殊说明，如 '启动引脚，上电时需拉高' */
  notes?: string
}

/** 外设总线定义 */
export interface PeripheralBus {
  /** 总线名称，如 'I2C0', 'SPI2' */
  name: string
  /** 总线类型 */
  type: 'I2C' | 'SPI' | 'UART' | 'I2S' | 'CAN' | 'SDIO' | 'USB' | 'ADC' | 'DAC' | 'PWM'
  /** 默认引脚映射，如 { SDA: 'GPIO21', SCL: 'GPIO22' } */
  defaultPins: Record<string, string>
}

/** 芯片完整技术规格 */
export interface ChipSpec {
  /** 短名称，如 'ESP32' */
  name: string
  /** 完整型号，如 'ESP32-WROOM-32' */
  fullName: string
  /** 架构，如 'Xtensa LX6 双核' */
  arch: string
  /** Flash 容量 */
  flash: string
  /** SRAM 容量 */
  sram: string
  /** 主频 */
  clockSpeed: string
  /** 工作电压 */
  voltage: string
  /** GPIO 引脚列表 */
  gpios: GpioPin[]
  /** 外设总线列表 */
  peripherals: PeripheralBus[]
  /** 启动受限引脚 */
  bootPins: string[]
  /** 关键限制条件 */
  restrictions: string[]
}

export interface PinAssignment {
  pinNumber: string
  pinName: string
  function: string
  connectedTo: string
  voltage: string
}

export interface BOMItem {
  name: string
  model: string
  quantity: number
  unitPrice: number
  purchaseLink?: string
}

export interface WiringEntry {
  from: string
  to: string
  wireColor?: string
  note?: string
}
