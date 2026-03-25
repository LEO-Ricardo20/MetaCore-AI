/** 芯片技术参数静态数据 — 为 AI prompt 提供引脚/外设/限制信息 */

import type { ChipSpec } from '@/types/hardware'

export const CHIP_SPECS: Record<string, ChipSpec> = {
  'ESP32': {
    name: 'ESP32',
    fullName: 'ESP32-WROOM-32',
    arch: 'Xtensa LX6 双核',
    flash: '4MB',
    sram: '520KB',
    clockSpeed: '240MHz',
    voltage: '3.3V',
    gpios: [
      { pin: 'GPIO0', altFunctions: ['CLK_OUT1', 'TOUCH1'], notes: '启动引脚，上电时需拉高' },
      { pin: 'GPIO1', altFunctions: ['UART0_TX'], notes: '默认 UART0 TX，烧录/调试用' },
      { pin: 'GPIO2', altFunctions: ['ADC2_CH2', 'TOUCH2'], notes: '启动引脚' },
      { pin: 'GPIO3', altFunctions: ['UART0_RX'], notes: '默认 UART0 RX，烧录/调试用' },
      { pin: 'GPIO4', altFunctions: ['ADC2_CH0', 'TOUCH0'] },
      { pin: 'GPIO5', altFunctions: ['VSPI_CS0'], notes: '启动时输出PWM' },
      { pin: 'GPIO12', altFunctions: ['ADC2_CH5', 'HSPI_MISO', 'TOUCH5'], notes: 'MTDI引脚，影响Flash电压' },
      { pin: 'GPIO13', altFunctions: ['ADC2_CH4', 'HSPI_MOSI', 'TOUCH4'] },
      { pin: 'GPIO14', altFunctions: ['ADC2_CH6', 'HSPI_CLK', 'TOUCH6'] },
      { pin: 'GPIO15', altFunctions: ['ADC2_CH3', 'HSPI_CS0', 'TOUCH3'], notes: '启动时输出PWM' },
      { pin: 'GPIO16', altFunctions: ['UART2_RX'] },
      { pin: 'GPIO17', altFunctions: ['UART2_TX'] },
      { pin: 'GPIO18', altFunctions: ['VSPI_CLK'] },
      { pin: 'GPIO19', altFunctions: ['VSPI_MISO'] },
      { pin: 'GPIO21', altFunctions: ['I2C_SDA'] },
      { pin: 'GPIO22', altFunctions: ['I2C_SCL'] },
      { pin: 'GPIO23', altFunctions: ['VSPI_MOSI'] },
      { pin: 'GPIO25', altFunctions: ['DAC1', 'ADC2_CH8'] },
      { pin: 'GPIO26', altFunctions: ['DAC2', 'ADC2_CH9'] },
      { pin: 'GPIO27', altFunctions: ['ADC2_CH7', 'TOUCH7'] },
      { pin: 'GPIO32', altFunctions: ['ADC1_CH4', 'TOUCH9'] },
      { pin: 'GPIO33', altFunctions: ['ADC1_CH5', 'TOUCH8'] },
      { pin: 'GPIO34', altFunctions: ['ADC1_CH6'], inputOnly: true, notes: '仅输入，无内部上拉' },
      { pin: 'GPIO35', altFunctions: ['ADC1_CH7'], inputOnly: true, notes: '仅输入，无内部上拉' },
      { pin: 'GPIO36', altFunctions: ['ADC1_CH0', 'VP'], inputOnly: true, notes: '仅输入，无内部上拉' },
      { pin: 'GPIO39', altFunctions: ['ADC1_CH3', 'VN'], inputOnly: true, notes: '仅输入，无内部上拉' },
    ],
    peripherals: [
      { name: 'I2C0', type: 'I2C', defaultPins: { SDA: 'GPIO21', SCL: 'GPIO22' } },
      { name: 'HSPI', type: 'SPI', defaultPins: { MOSI: 'GPIO13', MISO: 'GPIO12', CLK: 'GPIO14', CS: 'GPIO15' } },
      { name: 'VSPI', type: 'SPI', defaultPins: { MOSI: 'GPIO23', MISO: 'GPIO19', CLK: 'GPIO18', CS: 'GPIO5' } },
      { name: 'UART0', type: 'UART', defaultPins: { TX: 'GPIO1', RX: 'GPIO3' } },
      { name: 'UART1', type: 'UART', defaultPins: { TX: 'GPIO10', RX: 'GPIO9' } },
      { name: 'UART2', type: 'UART', defaultPins: { TX: 'GPIO17', RX: 'GPIO16' } },
      { name: 'DAC1', type: 'DAC', defaultPins: { OUT: 'GPIO25' } },
      { name: 'DAC2', type: 'DAC', defaultPins: { OUT: 'GPIO26' } },
    ],
    bootPins: ['GPIO0', 'GPIO2', 'GPIO5', 'GPIO12', 'GPIO15'],
    restrictions: [
      'GPIO6-11 连接内部 Flash，不可用作普通 GPIO',
      'GPIO34/35/36/39 仅支持输入，无内部上拉/下拉',
      'GPIO12(MTDI) 上电时电平影响 Flash 电压，默认应拉低',
      'WiFi 启用时 ADC2 不可用',
      'I2C/SPI 引脚可重映射到任意 GPIO，但推荐使用默认引脚',
    ],
  },

  'ESP32-S3': {
    name: 'ESP32-S3',
    fullName: 'ESP32-S3-WROOM-1-N16R8',
    arch: 'Xtensa LX7 双核',
    flash: '16MB（Quad SPI，GPIO27-32 占用）',
    sram: '512KB 内部 + 8MB Octal PSRAM（GPIO33-37 占用）',
    clockSpeed: '240MHz',
    voltage: '3.3V',
    gpios: [
      // ── GPIO0-21：可用（GPIO22-26 为模块内部 NC）──
      { pin: 'GPIO0', altFunctions: ['RTC_GPIO0'], notes: 'Strapping 引脚：上电时拉低进入下载模式；外部连接需确保上电高电平' },
      { pin: 'GPIO1', altFunctions: ['ADC1_CH0', 'TOUCH1', 'RTC_GPIO1'] },
      { pin: 'GPIO2', altFunctions: ['ADC1_CH1', 'TOUCH2', 'RTC_GPIO2'] },
      { pin: 'GPIO3', altFunctions: ['ADC1_CH2', 'TOUCH3', 'RTC_GPIO3'], notes: 'Strapping 引脚：控制 JTAG 接口使能，建议悬空或上拉' },
      { pin: 'GPIO4', altFunctions: ['ADC1_CH3', 'TOUCH4', 'RTC_GPIO4'] },
      { pin: 'GPIO5', altFunctions: ['ADC1_CH4', 'TOUCH5', 'RTC_GPIO5'] },
      { pin: 'GPIO6', altFunctions: ['ADC1_CH5', 'TOUCH6', 'RTC_GPIO6'] },
      { pin: 'GPIO7', altFunctions: ['ADC1_CH6', 'TOUCH7', 'RTC_GPIO7'] },
      { pin: 'GPIO8', altFunctions: ['ADC1_CH7', 'TOUCH8', 'RTC_GPIO8'], notes: '推荐用作 I2C SDA 默认引脚' },
      { pin: 'GPIO9', altFunctions: ['ADC1_CH8', 'TOUCH9', 'RTC_GPIO9'], notes: '推荐用作 I2C SCL 默认引脚' },
      { pin: 'GPIO10', altFunctions: ['ADC1_CH9', 'TOUCH10', 'RTC_GPIO10'] },
      { pin: 'GPIO11', altFunctions: ['ADC2_CH0', 'TOUCH11', 'RTC_GPIO11'] },
      { pin: 'GPIO12', altFunctions: ['ADC2_CH1', 'TOUCH12', 'RTC_GPIO12'] },
      { pin: 'GPIO13', altFunctions: ['ADC2_CH2', 'TOUCH13', 'RTC_GPIO13'] },
      { pin: 'GPIO14', altFunctions: ['ADC2_CH3', 'TOUCH14', 'RTC_GPIO14'] },
      { pin: 'GPIO15', altFunctions: ['ADC2_CH4', 'RTC_GPIO15'] },
      { pin: 'GPIO16', altFunctions: ['ADC2_CH5', 'RTC_GPIO16'] },
      { pin: 'GPIO17', altFunctions: ['ADC2_CH6', 'RTC_GPIO17', 'DAC_1'] },
      { pin: 'GPIO18', altFunctions: ['ADC2_CH7', 'RTC_GPIO18', 'DAC_2'] },
      { pin: 'GPIO19', altFunctions: ['ADC2_CH8', 'RTC_GPIO19', 'USB_D-'], notes: 'USB OTG D-，默认用于 USB-Serial-JTAG，用作 GPIO 需禁用 USB' },
      { pin: 'GPIO20', altFunctions: ['ADC2_CH9', 'RTC_GPIO20', 'USB_D+'], notes: 'USB OTG D+，默认用于 USB-Serial-JTAG，用作 GPIO 需禁用 USB' },
      { pin: 'GPIO21', altFunctions: ['RTC_GPIO21'] },
      // ── GPIO38-48：可用（JTAG 默认占用 GPIO39-42，可重映射）──
      { pin: 'GPIO38', altFunctions: ['FSPIWP'], notes: '可用作普通 GPIO' },
      { pin: 'GPIO39', altFunctions: ['FSPICS1', 'JTAG_TCK'], notes: '默认 JTAG TCK，可通过 menuconfig 重映射后用作 GPIO' },
      { pin: 'GPIO40', altFunctions: ['FSPICS0', 'JTAG_TDO'], notes: '默认 JTAG TDO，可通过 menuconfig 重映射后用作 GPIO' },
      { pin: 'GPIO41', altFunctions: ['FSPIQ', 'JTAG_TDI'], notes: '默认 JTAG TDI，可通过 menuconfig 重映射后用作 GPIO' },
      { pin: 'GPIO42', altFunctions: ['FSPID', 'JTAG_TMS'], notes: '默认 JTAG TMS，可通过 menuconfig 重映射后用作 GPIO' },
      { pin: 'GPIO43', altFunctions: ['UART0_TX'], notes: '默认 UART0 TX，用于串口下载/日志' },
      { pin: 'GPIO44', altFunctions: ['UART0_RX'], notes: '默认 UART0 RX，用于串口下载/日志' },
      { pin: 'GPIO45', altFunctions: ['RTC_GPIO45'], notes: 'Strapping 引脚：控制 VDD_SPI 电压（3.3V），通常保持默认高电平' },
      { pin: 'GPIO46', altFunctions: ['RTC_GPIO46'], inputOnly: true, notes: 'Strapping 引脚，仅输入，无内部上下拉，上电时控制 ROM 消息打印' },
      { pin: 'GPIO47', altFunctions: ['RTC_GPIO47', 'SPICLK_P_DIFF'] },
      { pin: 'GPIO48', altFunctions: ['RTC_GPIO48', 'SPICLK_N_DIFF'] },
    ],
    peripherals: [
      // I2C：ESP32-S3 的 I2C 引脚完全可重映射，GPIO8/9 是常用选择
      { name: 'I2C0', type: 'I2C', defaultPins: { SDA: 'GPIO8', SCL: 'GPIO9' } },
      { name: 'I2C1', type: 'I2C', defaultPins: { SDA: 'GPIO1', SCL: 'GPIO2' } },
      // SPI2：软件可配置到任意 GPIO，以下为常用默认
      { name: 'SPI2', type: 'SPI', defaultPins: { MOSI: 'GPIO11', MISO: 'GPIO13', CLK: 'GPIO12', CS: 'GPIO10' } },
      { name: 'UART0', type: 'UART', defaultPins: { TX: 'GPIO43', RX: 'GPIO44' } },
      { name: 'UART1', type: 'UART', defaultPins: { TX: 'GPIO17', RX: 'GPIO16' } },
      { name: 'USB', type: 'USB', defaultPins: { 'D+': 'GPIO20', 'D-': 'GPIO19' } },
      { name: 'DAC1', type: 'DAC', defaultPins: { OUT: 'GPIO17' } },
      { name: 'DAC2', type: 'DAC', defaultPins: { OUT: 'GPIO18' } },
    ],
    bootPins: ['GPIO0', 'GPIO3', 'GPIO45', 'GPIO46'],
    restrictions: [
      '【Flash 占用】GPIO27-32 连接内部 16MB Quad Flash，不可用作普通 GPIO',
      '【PSRAM 占用】GPIO33-37 连接 8MB Octal PSRAM（N16R8 型号），不可用作普通 GPIO',
      '【USB 默认】GPIO19/GPIO20 默认用于 USB-Serial-JTAG，如需用作 GPIO 须在 menuconfig 中禁用 USB 外设',
      '【JTAG 默认】GPIO39-42 默认为 JTAG 接口，可在 menuconfig 中将 JTAG 重映射到 USB 后恢复这 4 个引脚',
      '【ADC2 限制】WiFi 启用时 ADC2（GPIO11-20）不可用，建议优先使用 ADC1（GPIO1-10）',
      '【Strapping】GPIO0（下载模式）/ GPIO3（JTAG 使能）/ GPIO45（VDD_SPI）/ GPIO46（ROM 打印）上电期间勿随意拉低',
      '【I2C 重映射】ESP32-S3 的 I2C 可配置到任意 GPIO，无固定引脚限制',
      '总可用 GPIO：GPIO0-21（22 个）+ GPIO38-48（11 个）= 最多 33 个外部引脚，其中 GPIO19/20 有 USB 冲突',
    ],
  },

  'STM32F103': {
    name: 'STM32F103',
    fullName: 'STM32F103C8T6',
    arch: 'ARM Cortex-M3',
    flash: '64KB',
    sram: '20KB',
    clockSpeed: '72MHz',
    voltage: '3.3V',
    gpios: [
      { pin: 'PA0', altFunctions: ['UART2_CTS', 'ADC12_IN0', 'TIM2_CH1'] },
      { pin: 'PA1', altFunctions: ['UART2_RTS', 'ADC12_IN1', 'TIM2_CH2'] },
      { pin: 'PA2', altFunctions: ['UART2_TX', 'ADC12_IN2', 'TIM2_CH3'] },
      { pin: 'PA3', altFunctions: ['UART2_RX', 'ADC12_IN3', 'TIM2_CH4'] },
      { pin: 'PA4', altFunctions: ['SPI1_NSS', 'ADC12_IN4', 'DAC_OUT1'] },
      { pin: 'PA5', altFunctions: ['SPI1_SCK', 'ADC12_IN5', 'DAC_OUT2'] },
      { pin: 'PA6', altFunctions: ['SPI1_MISO', 'ADC12_IN6', 'TIM3_CH1'] },
      { pin: 'PA7', altFunctions: ['SPI1_MOSI', 'ADC12_IN7', 'TIM3_CH2'] },
      { pin: 'PA8', altFunctions: ['UART1_CK', 'TIM1_CH1', 'MCO'] },
      { pin: 'PA9', altFunctions: ['UART1_TX', 'TIM1_CH2'] },
      { pin: 'PA10', altFunctions: ['UART1_RX', 'TIM1_CH3'] },
      { pin: 'PA11', altFunctions: ['USB_DM', 'CAN_RX', 'TIM1_CH4'], notes: 'USB 与 CAN 共用，不可同时使用' },
      { pin: 'PA12', altFunctions: ['USB_DP', 'CAN_TX', 'TIM1_ETR'], notes: 'USB 与 CAN 共用，不可同时使用' },
      { pin: 'PA13', altFunctions: ['SWDIO', 'JTMS'], notes: '默认为 SWD 调试口（SWDIO）' },
      { pin: 'PA14', altFunctions: ['SWCLK', 'JTCK'], notes: '默认为 SWD 调试口（SWCLK）' },
      { pin: 'PA15', altFunctions: ['JTDI', 'SPI3_NSS', 'TIM2_CH1'], notes: '默认为 JTAG 引脚，需禁用 JTAG 后可用' },
      { pin: 'PB0', altFunctions: ['ADC12_IN8', 'TIM3_CH3'] },
      { pin: 'PB1', altFunctions: ['ADC12_IN9', 'TIM3_CH4'] },
      { pin: 'PB2', altFunctions: ['BOOT1'], notes: 'BOOT1 引脚' },
      { pin: 'PB3', altFunctions: ['JTDO', 'SPI3_SCK', 'TIM2_CH2'], notes: '默认为 JTAG 引脚，需禁用 JTAG 后可用' },
      { pin: 'PB4', altFunctions: ['JNTRST', 'SPI3_MISO', 'TIM3_CH1'], notes: '默认为 JTAG 引脚，需禁用 JTAG 后可用' },
      { pin: 'PB5', altFunctions: ['SPI3_MOSI', 'I2C1_SMBA', 'TIM3_CH2'] },
      { pin: 'PB6', altFunctions: ['I2C1_SCL', 'TIM4_CH1', 'UART1_TX'] },
      { pin: 'PB7', altFunctions: ['I2C1_SDA', 'TIM4_CH2', 'UART1_RX'] },
      { pin: 'PB8', altFunctions: ['I2C1_SCL', 'TIM4_CH3', 'CAN_RX'], notes: 'I2C1 重映射' },
      { pin: 'PB9', altFunctions: ['I2C1_SDA', 'TIM4_CH4', 'CAN_TX'], notes: 'I2C1 重映射' },
      { pin: 'PB10', altFunctions: ['I2C2_SCL', 'UART3_TX', 'TIM2_CH3'] },
      { pin: 'PB11', altFunctions: ['I2C2_SDA', 'UART3_RX', 'TIM2_CH4'] },
      { pin: 'PB12', altFunctions: ['SPI2_NSS', 'I2C2_SMBA', 'TIM1_BKIN'] },
      { pin: 'PB13', altFunctions: ['SPI2_SCK', 'TIM1_CH1N'] },
      { pin: 'PB14', altFunctions: ['SPI2_MISO', 'TIM1_CH2N'] },
      { pin: 'PB15', altFunctions: ['SPI2_MOSI', 'TIM1_CH3N'] },
      { pin: 'PC13', altFunctions: ['RTC_TAMPER', 'RTC_OUT'], notes: '板载 LED（部分开发板）' },
      { pin: 'PC14', altFunctions: ['OSC32_IN'], notes: 'LSE 振荡器引脚，使用外部晶振时不可用作 GPIO' },
      { pin: 'PC15', altFunctions: ['OSC32_OUT'], notes: 'LSE 振荡器引脚，使用外部晶振时不可用作 GPIO' },
      { pin: 'PD0', altFunctions: ['OSC_IN'], notes: 'HSE 振荡器引脚' },
      { pin: 'PD1', altFunctions: ['OSC_OUT'], notes: 'HSE 振荡器引脚' },
    ],
    peripherals: [
      { name: 'I2C1', type: 'I2C', defaultPins: { SDA: 'PB7', SCL: 'PB6' } },
      { name: 'I2C2', type: 'I2C', defaultPins: { SDA: 'PB11', SCL: 'PB10' } },
      { name: 'SPI1', type: 'SPI', defaultPins: { MOSI: 'PA7', MISO: 'PA6', CLK: 'PA5', CS: 'PA4' } },
      { name: 'SPI2', type: 'SPI', defaultPins: { MOSI: 'PB15', MISO: 'PB14', CLK: 'PB13', CS: 'PB12' } },
      { name: 'UART1', type: 'UART', defaultPins: { TX: 'PA9', RX: 'PA10' } },
      { name: 'UART2', type: 'UART', defaultPins: { TX: 'PA2', RX: 'PA3' } },
      { name: 'UART3', type: 'UART', defaultPins: { TX: 'PB10', RX: 'PB11' } },
      { name: 'CAN', type: 'CAN', defaultPins: { TX: 'PA12', RX: 'PA11' } },
      { name: 'USB', type: 'USB', defaultPins: { 'D+': 'PA12', 'D-': 'PA11' } },
    ],
    bootPins: ['BOOT0', 'PB2'],
    restrictions: [
      'PA13/PA14 默认为 SWD 调试口（SWDIO/SWCLK），重映射后可用作 GPIO',
      'PA15/PB3/PB4 默认为 JTAG 引脚，需禁用 JTAG 后才可用作 GPIO',
      'PA11/PA12 与 USB 和 CAN 共用，不可同时使用',
      'PC14/PC15 为 LSE 振荡器引脚，使用外部晶振时不可用作 GPIO',
      'PD0/PD1 为 HSE 振荡器引脚',
    ],
  },

  'STM32F4': {
    name: 'STM32F4',
    fullName: 'STM32F407VGT6',
    arch: 'ARM Cortex-M4 + FPU',
    flash: '1MB',
    sram: '192KB',
    clockSpeed: '168MHz',
    voltage: '3.3V',
    gpios: [
      { pin: 'PA0', altFunctions: ['UART4_TX', 'TIM2_CH1', 'TIM5_CH1', 'ADC123_IN0'] },
      { pin: 'PA1', altFunctions: ['UART4_RX', 'TIM2_CH2', 'TIM5_CH2', 'ADC123_IN1'] },
      { pin: 'PA2', altFunctions: ['UART2_TX', 'TIM2_CH3', 'TIM5_CH3', 'TIM9_CH1', 'ADC123_IN2'] },
      { pin: 'PA3', altFunctions: ['UART2_RX', 'TIM2_CH4', 'TIM5_CH4', 'TIM9_CH2', 'ADC123_IN3'] },
      { pin: 'PA4', altFunctions: ['SPI1_NSS', 'SPI3_NSS', 'DAC_OUT1', 'ADC12_IN4'] },
      { pin: 'PA5', altFunctions: ['SPI1_SCK', 'DAC_OUT2', 'ADC12_IN5'] },
      { pin: 'PA6', altFunctions: ['SPI1_MISO', 'TIM3_CH1', 'TIM13_CH1', 'ADC12_IN6'] },
      { pin: 'PA7', altFunctions: ['SPI1_MOSI', 'TIM3_CH2', 'TIM14_CH1', 'ADC12_IN7'] },
      { pin: 'PA8', altFunctions: ['I2C3_SCL', 'UART1_CK', 'TIM1_CH1', 'MCO1'] },
      { pin: 'PA9', altFunctions: ['UART1_TX', 'TIM1_CH2', 'I2C3_SMBA'] },
      { pin: 'PA10', altFunctions: ['UART1_RX', 'TIM1_CH3'] },
      { pin: 'PA11', altFunctions: ['USB_OTG_DM', 'CAN1_RX', 'TIM1_CH4'] },
      { pin: 'PA12', altFunctions: ['USB_OTG_DP', 'CAN1_TX', 'TIM1_ETR'] },
      { pin: 'PA13', altFunctions: ['SWDIO', 'JTMS'], notes: '默认为 SWD 调试口（SWDIO）' },
      { pin: 'PA14', altFunctions: ['SWCLK', 'JTCK'], notes: '默认为 SWD 调试口（SWCLK）' },
      { pin: 'PA15', altFunctions: ['JTDI', 'SPI1_NSS', 'SPI3_NSS', 'TIM2_CH1'], notes: '默认为 JTAG 引脚' },
      { pin: 'PB0', altFunctions: ['TIM3_CH3', 'TIM8_CH2N', 'ADC12_IN8'] },
      { pin: 'PB1', altFunctions: ['TIM3_CH4', 'TIM8_CH3N', 'ADC12_IN9'] },
      { pin: 'PB2', altFunctions: ['BOOT1'], notes: 'BOOT1 引脚' },
      { pin: 'PB3', altFunctions: ['JTDO', 'SPI1_SCK', 'SPI3_SCK', 'TIM2_CH2'], notes: '默认为 JTAG 引脚' },
      { pin: 'PB4', altFunctions: ['JNTRST', 'SPI1_MISO', 'SPI3_MISO', 'TIM3_CH1'], notes: '默认为 JTAG 引脚' },
      { pin: 'PB5', altFunctions: ['SPI1_MOSI', 'SPI3_MOSI', 'I2C1_SMBA', 'TIM3_CH2'] },
      { pin: 'PB6', altFunctions: ['I2C1_SCL', 'UART1_TX', 'TIM4_CH1'] },
      { pin: 'PB7', altFunctions: ['I2C1_SDA', 'UART1_RX', 'TIM4_CH2'] },
      { pin: 'PB8', altFunctions: ['I2C1_SCL', 'TIM4_CH3', 'TIM10_CH1', 'CAN1_RX'], notes: 'I2C1 重映射' },
      { pin: 'PB9', altFunctions: ['I2C1_SDA', 'TIM4_CH4', 'TIM11_CH1', 'CAN1_TX'], notes: 'I2C1 重映射' },
      { pin: 'PB10', altFunctions: ['I2C2_SCL', 'UART3_TX', 'TIM2_CH3'] },
      { pin: 'PB11', altFunctions: ['I2C2_SDA', 'UART3_RX', 'TIM2_CH4'] },
      { pin: 'PB12', altFunctions: ['SPI2_NSS', 'CAN2_RX', 'TIM1_BKIN', 'I2C2_SMBA'] },
      { pin: 'PB13', altFunctions: ['SPI2_SCK', 'CAN2_TX', 'TIM1_CH1N'] },
      { pin: 'PB14', altFunctions: ['SPI2_MISO', 'TIM1_CH2N', 'TIM12_CH1'] },
      { pin: 'PB15', altFunctions: ['SPI2_MOSI', 'TIM1_CH3N', 'TIM12_CH2'] },
      { pin: 'PC0', altFunctions: ['ADC123_IN10'] },
      { pin: 'PC1', altFunctions: ['ADC123_IN11'] },
      { pin: 'PC2', altFunctions: ['SPI2_MISO', 'ADC123_IN12'] },
      { pin: 'PC3', altFunctions: ['SPI2_MOSI', 'ADC123_IN13'] },
      { pin: 'PC4', altFunctions: ['ADC12_IN14'] },
      { pin: 'PC5', altFunctions: ['ADC12_IN15'] },
      { pin: 'PC6', altFunctions: ['UART6_TX', 'TIM3_CH1', 'TIM8_CH1', 'I2S2_MCK'] },
      { pin: 'PC7', altFunctions: ['UART6_RX', 'TIM3_CH2', 'TIM8_CH2'] },
      { pin: 'PC8', altFunctions: ['TIM3_CH3', 'TIM8_CH3', 'SDIO_D0'] },
      { pin: 'PC9', altFunctions: ['I2C3_SDA', 'TIM3_CH4', 'TIM8_CH4', 'SDIO_D1'] },
      { pin: 'PC10', altFunctions: ['SPI3_SCK', 'UART3_TX', 'UART4_TX', 'SDIO_D2'] },
      { pin: 'PC11', altFunctions: ['SPI3_MISO', 'UART3_RX', 'UART4_RX', 'SDIO_D3'] },
      { pin: 'PC12', altFunctions: ['SPI3_MOSI', 'UART5_TX', 'SDIO_CK'] },
      { pin: 'PC13', altFunctions: ['RTC_AF1'] },
      { pin: 'PC14', altFunctions: ['OSC32_IN'], notes: 'LSE 振荡器引脚' },
      { pin: 'PC15', altFunctions: ['OSC32_OUT'], notes: 'LSE 振荡器引脚' },
      { pin: 'PD0', altFunctions: ['CAN1_RX', 'FSMC_D2'] },
      { pin: 'PD1', altFunctions: ['CAN1_TX', 'FSMC_D3'] },
      { pin: 'PD2', altFunctions: ['UART5_RX', 'TIM3_ETR', 'SDIO_CMD'] },
      { pin: 'PD3', altFunctions: ['FSMC_CLK'] },
      { pin: 'PD4', altFunctions: ['FSMC_NOE'] },
      { pin: 'PD5', altFunctions: ['UART2_TX', 'FSMC_NWE'] },
      { pin: 'PD6', altFunctions: ['UART2_RX', 'FSMC_NWAIT'] },
      { pin: 'PD7', altFunctions: ['UART2_CK', 'FSMC_NE1'] },
      { pin: 'PD8', altFunctions: ['UART3_TX', 'FSMC_D13'] },
      { pin: 'PD9', altFunctions: ['UART3_RX', 'FSMC_D14'] },
      { pin: 'PD10', altFunctions: ['UART3_CK', 'FSMC_D15'] },
      { pin: 'PD11', altFunctions: ['UART3_CTS', 'FSMC_A16'] },
      { pin: 'PD12', altFunctions: ['TIM4_CH1', 'FSMC_A17'] },
      { pin: 'PD13', altFunctions: ['TIM4_CH2', 'FSMC_A18'] },
      { pin: 'PD14', altFunctions: ['TIM4_CH3', 'FSMC_D0'] },
      { pin: 'PD15', altFunctions: ['TIM4_CH4', 'FSMC_D1'] },
      { pin: 'PE0', altFunctions: ['TIM4_ETR', 'FSMC_NBL0'] },
      { pin: 'PE1', altFunctions: ['FSMC_NBL1'] },
      { pin: 'PE2', altFunctions: ['FSMC_A23'] },
      { pin: 'PE3', altFunctions: ['FSMC_A19'] },
      { pin: 'PE4', altFunctions: ['FSMC_A20'] },
      { pin: 'PE5', altFunctions: ['TIM9_CH1', 'FSMC_A21'] },
      { pin: 'PE6', altFunctions: ['TIM9_CH2', 'FSMC_A22'] },
      { pin: 'PE7', altFunctions: ['TIM1_ETR', 'FSMC_D4'] },
      { pin: 'PE8', altFunctions: ['TIM1_CH1N', 'FSMC_D5'] },
      { pin: 'PE9', altFunctions: ['TIM1_CH1', 'FSMC_D6'] },
      { pin: 'PE10', altFunctions: ['TIM1_CH2N', 'FSMC_D7'] },
      { pin: 'PE11', altFunctions: ['TIM1_CH2', 'FSMC_D8'] },
      { pin: 'PE12', altFunctions: ['TIM1_CH3N', 'FSMC_D9'] },
      { pin: 'PE13', altFunctions: ['TIM1_CH3', 'FSMC_D10'] },
      { pin: 'PE14', altFunctions: ['TIM1_CH4', 'FSMC_D11'] },
      { pin: 'PE15', altFunctions: ['TIM1_BKIN', 'FSMC_D12'] },
    ],
    peripherals: [
      { name: 'I2C1', type: 'I2C', defaultPins: { SDA: 'PB7/PB9', SCL: 'PB6/PB8' } },
      { name: 'I2C2', type: 'I2C', defaultPins: { SDA: 'PB11', SCL: 'PB10' } },
      { name: 'I2C3', type: 'I2C', defaultPins: { SDA: 'PC9', SCL: 'PA8' } },
      { name: 'SPI1', type: 'SPI', defaultPins: { MOSI: 'PA7', MISO: 'PA6', CLK: 'PA5' } },
      { name: 'SPI2', type: 'SPI', defaultPins: { MOSI: 'PB15', MISO: 'PB14', CLK: 'PB13' } },
      { name: 'SPI3', type: 'SPI', defaultPins: { MOSI: 'PB5', MISO: 'PB4', CLK: 'PB3' } },
      { name: 'UART1', type: 'UART', defaultPins: { TX: 'PA9', RX: 'PA10' } },
      { name: 'UART2', type: 'UART', defaultPins: { TX: 'PA2', RX: 'PA3' } },
      { name: 'UART3', type: 'UART', defaultPins: { TX: 'PB10', RX: 'PB11' } },
      { name: 'UART4', type: 'UART', defaultPins: { TX: 'PA0', RX: 'PA1' } },
      { name: 'UART5', type: 'UART', defaultPins: { TX: 'PC12', RX: 'PD2' } },
      { name: 'UART6', type: 'UART', defaultPins: { TX: 'PC6', RX: 'PC7' } },
      { name: 'CAN1', type: 'CAN', defaultPins: { TX: 'PD1', RX: 'PD0' } },
      { name: 'CAN2', type: 'CAN', defaultPins: { TX: 'PB13', RX: 'PB12' } },
      { name: 'USB_OTG', type: 'USB', defaultPins: { 'D+': 'PA12', 'D-': 'PA11' } },
    ],
    bootPins: ['BOOT0', 'PB2'],
    restrictions: [
      'PA13/PA14 默认为 SWD 调试口（SWDIO/SWCLK），重映射后可用作 GPIO',
      'PA15/PB3/PB4 默认为 JTAG 引脚，需禁用 JTAG 后才可用作 GPIO',
      'PA11/PA12 与 USB OTG 和 CAN1 共用，不可同时使用',
      'PC14/PC15 为 LSE 振荡器引脚，使用外部晶振时不可用作 GPIO',
      'PB13 与 CAN2_TX 和 SPI2_SCK 共用，注意外设冲突',
    ],
  },

  // ─── KEYSKING STM32F103C8T6 学习板 ──────────────────────────────────────────
  'STM32F103-KIT': {
    name: 'STM32F103-KIT',
    fullName: 'STM32F103C8T6 (KEYSKING学习板)',
    arch: 'ARM Cortex-M3',
    flash: '64KB',
    sram: '20KB',
    clockSpeed: '72MHz',
    voltage: '3.3V（板载 5V→3.3V LDO，部分引脚 5V 耐受）',
    gpios: [
      // PA port
      { pin: 'PA0',  altFunctions: ['ADC1_IN0', 'TIM2_CH1', 'UART4_TX'], notes: '已接 DRV8833 IN1（电机驱动输入1）' },
      { pin: 'PA1',  altFunctions: ['ADC1_IN1', 'TIM2_CH2', 'UART4_RX'], notes: '已接 DRV8833 IN2（电机驱动输入2）' },
      { pin: 'PA2',  altFunctions: ['ADC1_IN2', 'TIM2_CH3', 'UART2_TX'], notes: '已接 CH343P USB串口 RXD（UART2 TX → PC）' },
      { pin: 'PA3',  altFunctions: ['ADC1_IN3', 'TIM2_CH4', 'UART2_RX'], notes: '已接 CH343P USB串口 TXD（UART2 RX ← PC）' },
      { pin: 'PA4',  altFunctions: ['ADC1_IN4', 'SPI1_NSS'], notes: '已接 NTC温度传感器（R=10KΩ, β=3950, T0=25°C）' },
      { pin: 'PA5',  altFunctions: ['ADC1_IN5', 'SPI1_SCK'], notes: '已接电位器 VOL（ADC 采样）' },
      { pin: 'PA6',  altFunctions: ['ADC1_IN6', 'SPI1_MISO', 'TIM3_CH1'], notes: '已接 RGB绿灯（MHP5050RGBDT 共阴，限流R22=2.2KΩ）' },
      { pin: 'PA7',  altFunctions: ['ADC1_IN7', 'SPI1_MOSI', 'TIM3_CH2'], notes: '已接 RGB蓝灯（共阴，限流R24=1.8KΩ）' },
      { pin: 'PA8',  altFunctions: ['TIM1_CH1', 'MCO'], notes: '5V耐受；已接 EC11旋转编码器 A相（TIM1编码器模式）' },
      { pin: 'PA9',  altFunctions: ['TIM1_CH2', 'UART1_TX'], notes: '5V耐受；已接 EC11旋转编码器 C相（TIM1编码器模式）' },
      { pin: 'PA10', altFunctions: ['TIM1_CH3', 'UART1_RX'], notes: '已接 HC-SR04 TRIG（GPIO输出，触发超声波）' },
      { pin: 'PA11', altFunctions: ['TIM1_CH4', 'USB_DM'], notes: '已接 HC-SR04 ECHO（GPIO输入，接收回波）' },
      { pin: 'PA12', altFunctions: ['USB_DP'], notes: 'USB_DP（预留，当前未使用）' },
      { pin: 'PA13', altFunctions: ['SWDIO'], notes: 'SWD调试接口 SWDIO，用于烧录和调试，慎用作GPIO' },
      { pin: 'PA14', altFunctions: ['SWCLK'], notes: 'SWD调试接口 SWCLK，用于烧录和调试，慎用作GPIO' },
      { pin: 'PA15', altFunctions: ['TIM2_CH1_ETR', 'SPI1_NSS_REMAP'], notes: '可用 GPIO（JTAG禁用后）' },
      // PB port
      { pin: 'PB0',  altFunctions: ['ADC1_IN8', 'TIM3_CH3'], notes: '已接 RGB红灯（共阴，限流R24=1.8KΩ）' },
      { pin: 'PB1',  altFunctions: ['ADC1_IN9', 'TIM3_CH4'], notes: '可用 GPIO' },
      { pin: 'PB2',  altFunctions: ['BOOT1'], notes: 'BOOT1 引脚，上电采样后可用作GPIO' },
      { pin: 'PB4',  altFunctions: ['TIM3_CH1'], notes: '5V耐受；已接 WS2812C数据线，必须配置为开漏输出（OD）' },
      { pin: 'PB5',  altFunctions: ['TIM3_CH2', 'I2C1_SMBA'], notes: '已接继电器控制（SS8050+R9=3KΩ驱动，高电平闭合）' },
      { pin: 'PB6',  altFunctions: ['I2C1_SCL', 'TIM4_CH1'], notes: '已接 I2C1 SCL → OLED CH1116(0x7A) + AHT20(0x70)' },
      { pin: 'PB7',  altFunctions: ['I2C1_SDA', 'TIM4_CH2'], notes: '已接 I2C1 SDA → OLED CH1116(0x7A) + AHT20(0x70)' },
      { pin: 'PB8',  altFunctions: ['TIM4_CH3', 'I2C1_SCL_REMAP'], notes: '已接舵机 PWM（TIM4_CH3，5V供电舵机）' },
      { pin: 'PB9',  altFunctions: ['TIM4_CH4', 'I2C1_SDA_REMAP'], notes: '已接无源蜂鸣器（TIM4_CH4 PWM驱动，不可直接GPIO High）' },
      { pin: 'PB10', altFunctions: ['I2C2_SCL', 'UART3_TX'], notes: '已接蓝牙模块 RX（UART3 TX）' },
      { pin: 'PB11', altFunctions: ['I2C2_SDA', 'UART3_RX'], notes: '已接蓝牙模块 TX（UART3 RX）' },
      { pin: 'PB12', altFunctions: ['SPI2_NSS', 'TIM1_BKIN', 'I2C2_SMBA'], notes: '已接 KEY1（外部10KΩ下拉，低电平触发）' },
      { pin: 'PB13', altFunctions: ['SPI2_SCK', 'TIM1_CH1N'], notes: '已接 KEY2（无外部上拉，输入时必须开启 GPIO 内部上拉）' },
      { pin: 'PB14', altFunctions: ['SPI2_MISO', 'TIM1_CH2N'], notes: '已接 TCRT5000循迹传感器（DO输出，GPIO输入读取）' },
      { pin: 'PB15', altFunctions: ['SPI2_MOSI', 'TIM1_CH3N'], notes: '已接 EC11旋转编码器按压（SW），无外部上拉，必须开内部上拉' },
      // PC port
      { pin: 'PC13', altFunctions: ['TAMPER_RTC'], notes: '可用 GPIO（板载红色电源指示灯旁）' },
      { pin: 'PC14', altFunctions: ['OSC32_IN'], notes: '接 RTC 晶振 32.768kHz OSC32_IN，不可用作 GPIO' },
      { pin: 'PC15', altFunctions: ['OSC32_OUT'], notes: '接 RTC 晶振 32.768kHz OSC32_OUT，不可用作 GPIO' },
    ],
    peripherals: [
      { name: 'I2C1', type: 'I2C', defaultPins: { SDA: 'PB7', SCL: 'PB6' } },
      { name: 'UART2', type: 'UART', defaultPins: { TX: 'PA2', RX: 'PA3' } },
      { name: 'UART3', type: 'UART', defaultPins: { TX: 'PB10', RX: 'PB11' } },
      { name: 'TIM4_PWM', type: 'PWM', defaultPins: { CH3: 'PB8', CH4: 'PB9' } },
      { name: 'TIM1_Encoder', type: 'PWM', defaultPins: { CH1: 'PA8', CH2: 'PA9' } },
      { name: 'ADC1', type: 'ADC', defaultPins: { CH4: 'PA4', CH5: 'PA5' } },
    ],
    bootPins: ['BOOT0', 'PB2'],
    restrictions: [
      'PB4 驱动 WS2812 必须配置为开漏输出（OD）模式，否则无法驱动 5V 信号电平',
      'PB9 无源蜂鸣器必须用 PWM（TIM4_CH4）驱动，直接拉高 GPIO 蜂鸣器不响',
      'PB13 KEY2 / PB15 EC11-SW 无外部上拉，用作输入时必须启用 GPIO 内部上拉（PULLUP）',
      'PA8/PA9 为 5V 耐受引脚，接 5V EC11 旋转编码器信号安全',
      'PC14/PC15 接 32.768kHz RTC 晶振，PD0/PD1 接 8MHz 主晶振，均不可用作 GPIO',
      'I2C1 总线同时挂载 OLED CH1116（地址 0x7A）和 AHT20（地址 0x70），两设备共享 PB6/PB7',
      'PA13/PA14 为 SWD 调试口（SWDIO/SWCLK），烧录期间不可复用',
      'VBAT 接 CR1220 纽扣电池，维持 RTC 掉电保时',
      '所有 GPIO 输出电压为 3.3V，驱动 5V 器件时需确认兼容性',
    ],
  },
}

/** 将芯片规格格式化为可注入 AI prompt 的文本 */
export function chipSpecToPromptText(spec: ChipSpec): string {
  const lines: string[] = []

  lines.push(`## ${spec.name} (${spec.fullName})`)
  lines.push(`- 架构: ${spec.arch}`)
  lines.push(`- Flash: ${spec.flash} | SRAM: ${spec.sram}`)
  lines.push(`- 主频: ${spec.clockSpeed} | 工作电压: ${spec.voltage}`)
  lines.push('')

  // 可用 GPIO
  lines.push('### 可用 GPIO')
  for (const gpio of spec.gpios) {
    let desc = `- ${gpio.pin}: [${gpio.altFunctions.join(', ')}]`
    if (gpio.inputOnly) desc += ' (仅输入)'
    if (gpio.notes) desc += ` — ${gpio.notes}`
    lines.push(desc)
  }
  lines.push('')

  // 外设总线
  lines.push('### 外设总线（默认引脚映射）')
  for (const bus of spec.peripherals) {
    const pinMapping = Object.entries(bus.defaultPins)
      .map(([signal, pin]) => `${signal}=${pin}`)
      .join(', ')
    lines.push(`- ${bus.name} (${bus.type}): ${pinMapping}`)
  }
  lines.push('')

  // 启动引脚
  lines.push(`### 启动受限引脚: ${spec.bootPins.join(', ')}`)
  lines.push('')

  // 限制条件
  lines.push('### 关键限制')
  for (const r of spec.restrictions) {
    lines.push(`- ${r}`)
  }

  return lines.join('\n')
}

/** 根据芯片名获取规格（支持预置和自定义） */
export function getChipSpec(target: string): ChipSpec | null {
  return CHIP_SPECS[target] ?? null
}
