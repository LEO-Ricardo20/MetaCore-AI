import { CHIP_SPECS } from '@/data/chipSpecs'
import {
  KNOWLEDGE_SCHEMA_VERSION,
  type KnowledgeEntity,
  type KnowledgeFact,
  type KnowledgeEvidenceRef,
  type KnowledgeEntityKind,
  type KnowledgePack,
} from '@/types/knowledge'

const PACK_ID = 'metacore.hardware-core'
const ESPRESSIF = `${PACK_ID}.espressif`
const ST = `${PACK_ID}.st`
const BOSCH = `${PACK_ID}.bosch`
const TI = `${PACK_ID}.ti`
const AOSONG = `${PACK_ID}.aosong`
const ANALOG = `${PACK_ID}.analog-devices`
const MAXIM = `${PACK_ID}.maxim`
const TDK = `${PACK_ID}.tdk`
const GENERIC = `${PACK_ID}.teaching-components`

function evidence(sourceId: string, excerpt?: string): KnowledgeEvidenceRef[] {
  return [{ sourceId, confidence: 'medium', ...(excerpt ? { excerpt } : {}) }]
}

function fact(value: KnowledgeFact['value'], sourceId: string, critical = false): KnowledgeFact {
  return { value, critical, evidence: evidence(sourceId) }
}

function pin(id: string, signals: string[], sourceId: string, notes?: string, inputOnly?: boolean): KnowledgeEntity['pins'][number] {
  return { id, signals, ...(inputOnly ? { inputOnly: true } : {}), ...(notes ? { notes: [notes] } : {}), evidence: evidence(sourceId) }
}

function interfaceDef(type: string, name: string, sourceId: string, defaultPins?: Record<string, string>, addresses?: string[], notes?: string[]): KnowledgeEntity['interfaces'][number] {
  return { type, name, ...(defaultPins ? { defaultPins } : {}), ...(addresses ? { addresses } : {}), ...(notes ? { notes } : {}), evidence: evidence(sourceId) }
}

function constraint(id: string, category: string, severity: 'info' | 'warning' | 'error', description: string, sourceId: string): KnowledgeEntity['constraints'][number] {
  return { id, category, severity, description, evidence: evidence(sourceId) }
}

function entityBase(input: Pick<KnowledgeEntity, 'id' | 'kind' | 'manufacturer' | 'model' | 'displayName' | 'aliases' | 'tags'> & Partial<Pick<KnowledgeEntity, 'category'>>, sourceId: string, facts: Record<string, KnowledgeFact>, interfaces: KnowledgeEntity['interfaces'] = [], pins: KnowledgeEntity['pins'] = [], constraints: KnowledgeEntity['constraints'] = [], drivers: KnowledgeEntity['drivers'] = []): KnowledgeEntity {
  return {
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    ...input,
    facts,
    pins,
    interfaces,
    constraints,
    relations: [],
    drivers,
    sourceRefs: [sourceId],
    reviewStatus: 'reviewed',
    revision: '1.0.0',
  }
}

function chipEntity(target: string, model: string, sourceId: string): KnowledgeEntity {
  const spec = CHIP_SPECS[target]
  if (!spec) throw new Error(`Missing chip spec for ${target}`)
  return entityBase({
    id: `hardware.chip.${target.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    kind: 'chip', manufacturer: target.startsWith('ESP32') ? 'Espressif Systems' : 'STMicroelectronics', model,
    displayName: target, aliases: [target, spec.fullName, model], tags: ['mcu', target.toLocaleLowerCase(), 'hardware-core'],
  }, sourceId, {
    architecture: fact(spec.arch, sourceId), flash: fact(spec.flash, sourceId, true), sram: fact(spec.sram, sourceId, true),
    clockSpeed: fact(spec.clockSpeed, sourceId), voltage: fact(spec.voltage, sourceId, true), bootPins: fact(spec.bootPins, sourceId, true),
  }, spec.peripherals.map((item) => interfaceDef(item.type, item.name, sourceId, item.defaultPins)), spec.gpios.map((item) => pin(item.pin, item.altFunctions, sourceId, item.notes, item.inputOnly)), spec.restrictions.map((description, index) => constraint(`restriction-${index + 1}`, 'chip-constraint', 'warning', description, sourceId)), [
    { framework: target.startsWith('ESP32') ? 'ESP-IDF' : 'STM32Cube HAL', status: 'supported', sourceRefs: [sourceId] },
    { framework: 'Arduino', status: target === 'ESP32-C6' ? 'experimental' : 'supported', sourceRefs: [sourceId] },
  ])
}

function chipVariant(baseTarget: string, displayName: string, model: string, sourceId: string): KnowledgeEntity {
  const entity = chipEntity(baseTarget, model, sourceId)
  return {
    ...entity,
    id: `hardware.chip.${displayName.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    displayName,
    model,
    aliases: [displayName, model],
    tags: [...entity.tags, 'variant'],
    relations: [{ type: 'variant-of', targetId: entity.id }],
  }
}

type ComponentSeed = {
  id: string; kind: KnowledgeEntityKind; manufacturer: string; model: string; displayName: string; aliases: string[]; tags: string[]; sourceId: string
  facts: Record<string, KnowledgeFact>; interfaces?: KnowledgeEntity['interfaces']; pins?: KnowledgeEntity['pins']; constraints?: KnowledgeEntity['constraints']; drivers?: KnowledgeEntity['drivers']
}

function component(seed: Omit<ComponentSeed, 'facts'> & { facts: Record<string, KnowledgeFact> }): KnowledgeEntity {
  return entityBase(seed, seed.sourceId, seed.facts, seed.interfaces, seed.pins, seed.constraints, seed.drivers)
}

function sourceManufacturer(sourceId: string) {
  if (sourceId === TI) return 'Texas Instruments'
  if (sourceId === BOSCH) return 'Bosch Sensortec'
  if (sourceId === AOSONG) return 'Aosong Electronics'
  if (sourceId === ST) return 'STMicroelectronics'
  if (sourceId === ANALOG) return 'Analog Devices'
  if (sourceId === MAXIM) return 'Maxim Integrated / Analog Devices'
  if (sourceId === TDK) return 'TDK InvenSense'
  return '常见教学器件'
}

function interfacePins(interfaces: KnowledgeEntity['interfaces'], sourceId: string) {
  const pinSignals = new Map<string, string[]>()
  const add = (id: string, signal: string) => pinSignals.set(id, [...new Set([...(pinSignals.get(id) ?? []), signal])])
  if (interfaces.length) { add('VCC', 'POWER'); add('GND', 'GROUND') }
  interfaces.forEach((item) => {
    const type = item.type.toLocaleLowerCase()
    if (type === 'i2c') { add('SDA', 'I2C_SDA'); add('SCL', 'I2C_SCL') }
    else if (type === 'spi') { add('SCK', 'SPI_SCK'); add('MOSI', 'SPI_MOSI'); add('MISO', 'SPI_MISO'); add('CS', 'SPI_CS') }
    else if (type === '1-wire') add('DQ', 'ONE_WIRE_DATA')
    else if (type === 'single-wire') add('DATA', 'DATA')
    else if (type === 'adc') add('OUT', 'ANALOG_OUT')
    else if (type === 'pwm') add('CTRL', 'PWM_IN')
    else if (type === 'gpio') add('SIGNAL', 'GPIO')
  })
  return [...pinSignals].map(([id, signals]) => pin(id, signals, sourceId, '常见教学模块引脚名；实际模块丝印和芯片封装需单独核对。'))
}

function interfaceDrivers(interfaces: KnowledgeEntity['interfaces'], sourceId: string): KnowledgeEntity['drivers'] {
  return [...new Set(interfaces.map((item) => item.type.toLocaleUpperCase()))].map((type) => ({
    framework: `Generic ${type} driver`, status: 'supported' as const, sourceRefs: [sourceId],
  }))
}

function simpleComponent(id: string, displayName: string, model: string, aliases: string[], sourceId: string, facts: Record<string, KnowledgeFact>, interfaces: KnowledgeEntity['interfaces'], constraints: KnowledgeEntity['constraints'] = [], kind: KnowledgeEntityKind = 'component') {
  return component({ id, kind, manufacturer: sourceManufacturer(sourceId), model, displayName, aliases, tags: ['teaching', 'hardware-core'], sourceId, facts, interfaces, pins: interfacePins(interfaces, sourceId), constraints, drivers: interfaceDrivers(interfaces, sourceId) })
}

const components: KnowledgeEntity[] = [
  simpleComponent('hardware.component.led-5mm', '5mm LED', 'LED-5MM', ['LED', '发光二极管', '5mm 发光二极管'], GENERIC, { voltage: fact('1.8-3.2V Vf（取决于颜色）', GENERIC, true), current: fact('建议 5-15mA，必须串联限流电阻', GENERIC, true), ioLevel: fact('GPIO 电平驱动', GENERIC) }, [interfaceDef('GPIO', '单色 LED', GENERIC)], [constraint('series-resistor', 'electrical', 'error', 'LED 必须串联限流电阻，不能直接接 GPIO。', GENERIC)]),
  simpleComponent('hardware.component.rgb-led', 'RGB LED', 'RGB-5MM-COMMON-CATHODE', ['RGB LED', '三色 LED', '共阴 RGB'], GENERIC, { voltage: fact('各颜色 Vf 约 2.0-3.2V', GENERIC, true), current: fact('每个颜色通道建议 5-15mA', GENERIC, true), ioLevel: fact('每色一个 PWM GPIO，公共端按共阴/共阳型号连接', GENERIC, true) }, [interfaceDef('PWM', 'R/G/B', GENERIC)], [constraint('per-channel-resistor', 'electrical', 'error', 'R、G、B 每个通道都要独立限流；共阳型号逻辑电平相反。', GENERIC)]),
  simpleComponent('hardware.component.push-button', '轻触按键', 'TS-1187A', ['按键', '按钮', 'SW 按键'], GENERIC, { voltage: fact('GPIO 逻辑电平', GENERIC), contact: fact('机械触点，需去抖', GENERIC, true) }, [interfaceDef('GPIO', '数字输入', GENERIC)], [constraint('debounce', 'firmware', 'warning', '需要硬件或软件去抖，并避免悬空输入。', GENERIC)]),
  simpleComponent('hardware.component.potentiometer-10k', '10K 电位器', 'B10K', ['10K 电位器', '电位器', '可调电阻'], GENERIC, { resistance: fact('10kΩ', GENERIC, true), voltage: fact('端到端电压不得超过所用电阻额定值；ADC 输入不超过 MCU VDD', GENERIC, true) }, [interfaceDef('ADC', '滑动端', GENERIC)], [constraint('adc-range', 'electrical', 'error', '滑动端必须限制在 MCU ADC 输入电压范围内，端点接 VDD/GND。', GENERIC)]),
  simpleComponent('hardware.component.ldr', '光敏电阻', 'GL5528', ['LDR', '光敏电阻', 'GL5528'], GENERIC, { resistance: fact('约 10kΩ（典型光照条件，个体差异大）', GENERIC), voltage: fact('与固定电阻组成分压后接 ADC', GENERIC, true) }, [interfaceDef('ADC', '光照分压输出', GENERIC)]),
  simpleComponent('hardware.component.ntc-10k', 'NTC 热敏电阻', 'NTC 10K B3950', ['NTC', '10K 热敏电阻', 'B3950'], GENERIC, { resistance: fact('10kΩ @25°C，Beta 3950（需核对具体批次）', GENERIC, true), voltage: fact('分压输出接 ADC', GENERIC, true) }, [interfaceDef('ADC', '温度分压输出', GENERIC)]),
  simpleComponent('hardware.component.active-buzzer', '有源蜂鸣器', 'Buzzer-Active-3V3', ['有源蜂鸣器', '主动蜂鸣器'], GENERIC, { voltage: fact('3.3V 或 5V，按购买型号确认', GENERIC, true), current: fact('典型 10-30mA', GENERIC), ioLevel: fact('GPIO 只驱动小电流型号；更大电流需三极管/MOSFET', GENERIC, true) }, [interfaceDef('GPIO', '开关控制', GENERIC)], [constraint('buzzer-drive', 'electrical', 'warning', '超过 GPIO 驱动能力时必须使用三极管或 MOSFET，并配置续流/保护。', GENERIC)]),
  simpleComponent('hardware.component.passive-buzzer', '无源蜂鸣器', 'Buzzer-Passive-5V', ['无源蜂鸣器', '被动蜂鸣器'], GENERIC, { voltage: fact('通常 3-5V', GENERIC, true), current: fact('按型号确认；用 PWM 产生音调', GENERIC, true) }, [interfaceDef('PWM', '音调控制', GENERIC)], [constraint('pwm-required', 'firmware', 'warning', '无源蜂鸣器不能只用固定高电平驱动，需要 PWM。', GENERIC)]),
  simpleComponent('hardware.ic.74hc595', '8 位移位寄存器', '74HC595', ['74HC595', 'HC595', '串入并出'], GENERIC, { voltage: fact('2.0-6.0V', GENERIC, true), ioLevel: fact('逻辑电平随 VCC；3.3V MCU 建议 VCC=3.3V', GENERIC, true) }, [interfaceDef('SPI', 'SER/SH_CP/ST_CP', GENERIC, undefined, undefined, ['可用 SPI MOSI/SCK，锁存脚单独 GPIO'])], [constraint('logic-level', 'electrical', 'warning', 'VCC=5V 时 3.3V 高电平兼容性需核对 VIH；输出不能直接驱动大电流负载。', GENERIC)]),
  simpleComponent('hardware.sensor.dht11', '温湿度传感器', 'DHT11', ['DHT11', 'DHT-11'], AOSONG, { voltage: fact('3.0-5.5V', AOSONG, true), current: fact('测量期间约 0.3mA，待机低于 60uA（典型）', AOSONG), ioLevel: fact('单总线，数据线需上拉', AOSONG, true), sampling: fact('建议采样间隔不小于 1s', AOSONG, true) }, [interfaceDef('single-wire', 'DATA', AOSONG)], [constraint('sample-interval', 'timing', 'warning', 'DHT11 采样速度慢，不能高频轮询。', AOSONG)] , 'sensor'),
  simpleComponent('hardware.sensor.dht22', '温湿度传感器', 'DHT22 / AM2302', ['DHT22', 'AM2302'], AOSONG, { voltage: fact('3.3-6V', AOSONG, true), ioLevel: fact('单总线，数据线需上拉', AOSONG, true), sampling: fact('建议采样间隔不小于 2s', AOSONG, true) }, [interfaceDef('single-wire', 'DATA', AOSONG)], [constraint('sample-interval', 'timing', 'warning', 'DHT22 不能高频轮询，读取失败需要重试和超时。', AOSONG)], 'sensor'),
  simpleComponent('hardware.sensor.aht20', '温湿度传感器', 'AHT20', ['AHT20', 'AHT-20'], AOSONG, { voltage: fact('2.2-5.5V', AOSONG, true), ioLevel: fact('I2C，3.3V GPIO 直连时建议 VDD=3.3V', AOSONG, true), address: fact('0x38', AOSONG, true) }, [interfaceDef('I2C', 'I2C0', AOSONG, undefined, ['0x38'])], [], 'sensor'),
  simpleComponent('hardware.sensor.bme280', '环境传感器', 'BME280', ['BME280', '温湿度气压传感器'], BOSCH, { voltage: fact('1.71-3.6V（芯片）；模块供电范围需核对', BOSCH, true), ioLevel: fact('I2C 或 SPI', BOSCH, true), address: fact('I2C 0x76 或 0x77，由 SDO 决定', BOSCH, true) }, [interfaceDef('I2C', 'I2C', BOSCH, undefined, ['0x76', '0x77']), interfaceDef('SPI', 'SPI', BOSCH)], [], 'sensor'),
  simpleComponent('hardware.sensor.bmp280', '气压传感器', 'BMP280', ['BMP280'], BOSCH, { voltage: fact('1.71-3.6V（芯片）；模块供电范围需核对', BOSCH, true), ioLevel: fact('I2C 或 SPI', BOSCH), address: fact('I2C 0x76 或 0x77', BOSCH, true) }, [interfaceDef('I2C', 'I2C', BOSCH, undefined, ['0x76', '0x77']), interfaceDef('SPI', 'SPI', BOSCH)], [], 'sensor'),
  simpleComponent('hardware.sensor.ds18b20', '数字温度传感器', 'DS18B20', ['DS18B20', 'DS18B20 防水探头'], MAXIM, { voltage: fact('3.0-5.5V', MAXIM, true), ioLevel: fact('1-Wire；DQ 需要 4.7kΩ 上拉（按总线长度调整）', MAXIM, true), resolution: fact('9-12 bit 可配置', MAXIM) }, [interfaceDef('1-wire', 'DQ', MAXIM)], [constraint('pullup', 'electrical', 'error', 'DQ 必须有上拉电阻，长线需要考虑寄生供电和信号完整性。', MAXIM)], 'sensor'),
  simpleComponent('hardware.sensor.hc-sr04', '超声波测距模块', 'HC-SR04', ['HC-SR04', '超声波模块'], GENERIC, { voltage: fact('5V', GENERIC, true), ioLevel: fact('ECHO 输出通常为 5V，接 3.3V MCU 必须分压/电平转换', GENERIC, true), range: fact('约 2-400cm（受环境影响）', GENERIC, true) }, [interfaceDef('GPIO', 'TRIG/ECHO', GENERIC)], [constraint('echo-level', 'electrical', 'error', 'ECHO 不能直接接 3.3V MCU 输入，必须使用分压或电平转换。', GENERIC)], 'sensor'),
  simpleComponent('hardware.sensor.mpu6050', '六轴 IMU', 'MPU-6050', ['MPU6050', 'MPU-6050'], TDK, { voltage: fact('1.8-3.46V（芯片）；模块可能带稳压/电平转换', TDK, true), ioLevel: fact('I2C', TDK), address: fact('0x68 或 0x69，由 AD0 决定', TDK, true) }, [interfaceDef('I2C', 'I2C', TDK, undefined, ['0x68', '0x69'])], [], 'sensor'),
  simpleComponent('hardware.sensor.pir-hc-sr501', '人体红外传感器', 'HC-SR501', ['HC-SR501', 'PIR', '人体感应'], GENERIC, { voltage: fact('5V 供电；输出高电平约 3.3V（按模块核对）', GENERIC, true), ioLevel: fact('数字输出', GENERIC) }, [interfaceDef('GPIO', 'OUT', GENERIC)], [], 'sensor'),
  simpleComponent('hardware.sensor.vl53l0x', 'ToF 距离传感器', 'VL53L0X', ['VL53L0X', 'ToF 激光测距'], ST, { voltage: fact('2.6-3.5V（芯片）；模块供电范围需核对', ST, true), ioLevel: fact('I2C', ST, true), address: fact('默认 0x29，可通过 XSHUT 管理多器件', ST, true) }, [interfaceDef('I2C', 'I2C', ST, undefined, ['0x29'])], [constraint('multi-device', 'address', 'warning', '多个模块必须通过 XSHUT 逐个改地址，不能共享同一默认地址直接并联。', ST)], 'sensor'),
  simpleComponent('hardware.sensor.ina219', '电流电压监测器', 'INA219', ['INA219', '电流传感器'], TI, { voltage: fact('总线电压 0-26V', TI, true), current: fact('量程由分流电阻决定', TI, true), ioLevel: fact('I2C', TI), address: fact('0x40-0x4F（由地址脚配置）', TI, true) }, [interfaceDef('I2C', 'I2C', TI, undefined, ['0x40-0x4F'])], [], 'sensor'),
  simpleComponent('hardware.sensor.ads1115', '16 位 ADC', 'ADS1115', ['ADS1115', '外置 ADC'], TI, { voltage: fact('2.0-5.5V', TI, true), ioLevel: fact('I2C', TI, true), address: fact('0x48-0x4B', TI, true), resolution: fact('16-bit', TI) }, [interfaceDef('I2C', 'I2C', TI, undefined, ['0x48', '0x49', '0x4A', '0x4B'])], [], 'sensor'),
  simpleComponent('hardware.display.ssd1306', 'OLED 显示屏', 'SSD1306 128x64', ['SSD1306', '0.96寸 OLED', 'OLED'], GENERIC, { voltage: fact('模块常见 3.3-5V；控制器逻辑按模块核对', GENERIC, true), ioLevel: fact('I2C 或 SPI', GENERIC), address: fact('I2C 常见 0x3C/0x3D', GENERIC, true) }, [interfaceDef('I2C', 'I2C', GENERIC, undefined, ['0x3C', '0x3D']), interfaceDef('SPI', 'SPI', GENERIC)], [], 'display'),
  simpleComponent('hardware.display.sh1106', 'OLED 显示屏', 'SH1106 128x64', ['SH1106', 'SH1106 OLED'], GENERIC, { voltage: fact('模块常见 3.3-5V；按模块核对', GENERIC, true), ioLevel: fact('I2C 或 SPI', GENERIC), address: fact('I2C 常见 0x3C', GENERIC, true) }, [interfaceDef('I2C', 'I2C', GENERIC, undefined, ['0x3C']), interfaceDef('SPI', 'SPI', GENERIC)], [], 'display'),
  simpleComponent('hardware.display.lcd1602-pcf8574', '1602 字符屏 I2C 背包', 'LCD1602 + PCF8574', ['LCD1602', '1602 屏', 'PCF8574 LCD'], GENERIC, { voltage: fact('常见 5V；I2C 电平需核对，必要时电平转换', GENERIC, true), ioLevel: fact('I2C', GENERIC, true), address: fact('常见 0x27 或 0x3F', GENERIC, true) }, [interfaceDef('I2C', 'I2C', GENERIC, undefined, ['0x27', '0x3F'])], [constraint('level-shift', 'electrical', 'error', '5V 模块的 SDA/SCL 上拉可能把总线拉到 5V，3.3V MCU 需要确认或电平转换。', GENERIC)], 'display'),
  simpleComponent('hardware.display.max7219', 'LED 点阵/数码管驱动', 'MAX7219', ['MAX7219', '8x8 点阵', '数码管驱动'], ANALOG, { voltage: fact('4.0-5.5V', ANALOG, true), ioLevel: fact('串行 SPI 类接口；3.3V 逻辑兼容性按 VIH 核对', ANALOG, true) }, [interfaceDef('SPI', 'DIN/CLK/CS', ANALOG)], [], 'display'),
  simpleComponent('hardware.input.ec11', '旋转编码器', 'EC11', ['EC11', '旋转编码器', '编码器按键'], GENERIC, { voltage: fact('机械触点，使用 MCU GPIO 上拉', GENERIC, true), ioLevel: fact('A/B/按键为开关触点，需要去抖', GENERIC) }, [interfaceDef('GPIO', 'A/B/SW', GENERIC)], [constraint('debounce', 'firmware', 'warning', 'A/B 相和按键都需要去抖；可使用定时器捕获或中断加滤波。', GENERIC)]),
  simpleComponent('hardware.led.ws2812b', '可编程 RGB 灯珠', 'WS2812B', ['WS2812B', 'WS2812', '灯带'], GENERIC, { voltage: fact('3.5-5.3V', GENERIC, true), ioLevel: fact('单线时序数据；5V 供电时 3.3V 数据高电平裕量需核对，建议电平转换', GENERIC, true), current: fact('满白约 60mA/颗（典型，需按亮度降额）', GENERIC, true) }, [interfaceDef('single-wire', 'DIN', GENERIC)], [constraint('power-budget', 'power', 'error', '按每颗最大电流估算电源并加入余量；长灯带需分段供电和地线回流。', GENERIC)] , 'actuator'),
  simpleComponent('hardware.actuator.sg90', '舵机', 'SG90', ['SG90', '9g 舵机'], GENERIC, { voltage: fact('4.8-6V', GENERIC, true), current: fact('堵转电流可达数百 mA，不能由 MCU 3.3V 供电', GENERIC, true), ioLevel: fact('50Hz PWM，脉宽约 0.5-2.5ms（按舵机校准）', GENERIC, true) }, [interfaceDef('PWM', '控制信号', GENERIC)], [constraint('separate-power', 'power', 'error', '舵机使用独立 5V 供电并与 MCU 共地，电源需按堵转电流留余量。', GENERIC)], 'actuator'),
  simpleComponent('hardware.driver.drv8833', '双路直流电机驱动', 'DRV8833', ['DRV8833', '直流电机驱动'], TI, { voltage: fact('电机电源 2.7-10.8V', TI, true), current: fact('每路约 1.5A 峰值（受散热和封装限制）', TI, true), ioLevel: fact('IN1/IN2 PWM/方向控制', TI, true) }, [interfaceDef('PWM', 'AIN/BIN', TI)], [constraint('motor-protection', 'power', 'error', '电机电源需独立去耦；必须处理故障、过流和反接，不能从 MCU 3.3V 直接供电。', TI)], 'driver'),
  simpleComponent('hardware.driver.tb6612fng', '双路直流电机驱动', 'TB6612FNG', ['TB6612FNG', 'TB6612', '电机驱动'], GENERIC, { voltage: fact('逻辑 VCC 2.7-5.5V；电机 VM 4.5-13.5V', GENERIC, true), current: fact('每路约 1.2A 连续（取决于散热）', GENERIC, true), ioLevel: fact('PWM/方向/待机控制', GENERIC) }, [interfaceDef('PWM', 'AIN/BIN/STBY', GENERIC)], [constraint('separate-power', 'power', 'error', '电机电源必须独立并充分去耦，STBY 需定义安全默认状态。', GENERIC)], 'driver'),
  simpleComponent('hardware.rtc.ds3231', '实时时钟', 'DS3231', ['DS3231', 'RTC 模块'], MAXIM, { voltage: fact('2.3-5.5V', MAXIM, true), ioLevel: fact('I2C', MAXIM), address: fact('0x68', MAXIM, true), backup: fact('VBAT 备份供电', MAXIM) }, [interfaceDef('I2C', 'I2C', MAXIM, undefined, ['0x68'])], [], 'storage'),
  simpleComponent('hardware.storage.microsd', 'MicroSD 卡模块', 'MicroSD SPI', ['MicroSD', 'TF 卡', 'SD 卡模块'], GENERIC, { voltage: fact('卡本体 2.7-3.6V；模块可能含 5V 电平转换', GENERIC, true), ioLevel: fact('SPI，CS 单独 GPIO', GENERIC, true) }, [interfaceDef('SPI', 'SCK/MOSI/MISO/CS', GENERIC)], [constraint('level-shift', 'electrical', 'warning', '确认模块是否带电平转换；卡座信号不能直接承受 5V。', GENERIC)], 'storage'),
  simpleComponent('hardware.storage.w25q64', 'SPI NOR Flash', 'W25Q64JV', ['W25Q64', 'W25Q32', 'W25QXX'], GENERIC, { voltage: fact('2.7-3.6V', GENERIC, true), ioLevel: fact('SPI/QSPI', GENERIC, true), capacity: fact('64M-bit（W25Q64）；W25Q32 为 32M-bit', GENERIC, true) }, [interfaceDef('SPI', 'SCK/IO0-IO3/CS', GENERIC)], [constraint('write-cycle', 'firmware', 'warning', '写入前需擦除并等待忙状态；需设计掉电保护和磨损均衡。', GENERIC)], 'storage'),
  simpleComponent('hardware.communication.ir-receiver', '红外接收模块', 'VS1838B', ['VS1838B', '红外接收头', 'IR receiver'], GENERIC, { voltage: fact('2.7-5.5V', GENERIC, true), ioLevel: fact('数字脉冲输出，通常低有效', GENERIC) }, [interfaceDef('GPIO', 'OUT', GENERIC)], [], 'communication'),
]

export const HARDWARE_CORE_ENTITIES: KnowledgeEntity[] = [
  chipEntity('ESP32', 'ESP32-WROOM-32E', ESPRESSIF),
  chipEntity('ESP32-S3', 'ESP32-S3-WROOM-1-N8', ESPRESSIF),
  chipEntity('ESP32-C3', 'ESP32-C3-MINI-1', ESPRESSIF),
  chipEntity('ESP32-C6', 'ESP32-C6-WROOM-1-N8', ESPRESSIF),
  chipEntity('ESP32-S2', 'ESP32-S2-WROOM', ESPRESSIF),
  chipEntity('STM32F103', 'STM32F103C8T6', ST),
  chipVariant('STM32F103', 'STM32F103RBT6', 'STM32F103RBT6', ST),
  chipEntity('STM32F4', 'STM32F407VGT6', ST),
  ...components,
]

export function createHardwareCoreKnowledgePack(): KnowledgePack {
  return {
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    id: PACK_ID,
    name: 'MetaCore Common Hardware Core',
    version: '1.0.0',
    priority: 100,
    description: '常用 ESP32、STM32 和教学元器件的本地结构化知识。当前为 reviewed 状态，供检索和提示词上下文使用；联网同步与按需官方资料检索留待后续阶段。',
    generatedAt: '2026-08-28T00:00:00.000Z',
    sources: [
      { id: ESPRESSIF, type: 'official-documentation', title: 'Espressif ESP32 系列数据手册与 ESP-IDF 文档', owner: 'Espressif Systems', official: true, url: 'https://docs.espressif.com/projects/esp-idf/en/latest/esp32/' },
      { id: ST, type: 'official-documentation', title: 'STMicroelectronics STM32 数据手册与参考手册', owner: 'STMicroelectronics', official: true, url: 'https://www.st.com/en/microcontrollers-microprocessors/stm32-32-bit-arm-cortex-mcus.html' },
      { id: BOSCH, type: 'datasheet', title: 'Bosch Sensortec 传感器数据手册', owner: 'Bosch Sensortec', official: true, url: 'https://www.bosch-sensortec.com/products/environmental-sensors/' },
      { id: TI, type: 'datasheet', title: 'Texas Instruments 模拟与电源器件数据手册', owner: 'Texas Instruments', official: true, url: 'https://www.ti.com/' },
      { id: AOSONG, type: 'datasheet', title: 'Aosong AHT20 与 DHT 系列资料', owner: 'Aosong Electronics', official: true, url: 'https://www.aosong.com/' },
      { id: ANALOG, type: 'datasheet', title: 'Analog Devices MAX7219 资料', owner: 'Analog Devices', official: true, url: 'https://www.analog.com/en/products/max7219.html' },
      { id: MAXIM, type: 'datasheet', title: 'Maxim Integrated 1-Wire、RTC 和传感器资料', owner: 'Analog Devices', official: true, url: 'https://www.analog.com/en/technical-articles/1wire-technology.html' },
      { id: TDK, type: 'datasheet', title: 'TDK InvenSense MPU-6050 资料', owner: 'TDK InvenSense', official: true, url: 'https://invensense.tdk.com/products/motion-tracking/6-axis/mpu-6050/' },
      { id: GENERIC, type: 'community', title: '常见教学模块与器件使用约定', owner: 'MetaCore Studio', official: false, url: 'https://github.com/LEO-Ricardo20/MetaCore-Studio' },
    ],
    entities: HARDWARE_CORE_ENTITIES,
  }
}
