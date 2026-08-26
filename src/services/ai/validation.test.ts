import { describe, expect, it } from 'vitest'
import { parseChipSpec, parseCodeFiles, parseFlowGraph, parseHardwareScheme } from './validation'

describe('AI result validation', () => {
  it('normalizes a valid hardware scheme', () => {
    const result = parseHardwareScheme(JSON.stringify({
      description: '  ESP32 sensor node  ',
      pins: [{ pinNumber: 'GPIO21', pinName: 'SDA', function: 'I2C data', connectedTo: 'OLED SDA', voltage: '3.3V' }],
      bom: [{ name: 'OLED', model: 'SSD1306', quantity: 1, unitPrice: 18.5 }],
      wiring: [{ from: 'GPIO21', to: 'OLED SDA', wireColor: 'blue' }],
    }))

    expect(result.description).toBe('ESP32 sensor node')
    expect(result.pins).toHaveLength(1)
    expect(result.bom[0].quantity).toBe(1)
  })

  it('normalizes hardware_design pinMapping, object wiring, and BOM variants', () => {
    const result = parseHardwareScheme(JSON.stringify({
      pinMapping: {
        depthSensor: { I2C1_SCL: 'PB6', I2C1_SDA: 'PB7' },
        power: { '12V_IN': 'J1-1' },
      },
      bom: [{ name: 'STM32F103C8T6', package: 'LQFP48', quantity: 1, notes: 'MCU' }],
      wiring: { depthSensor: 'I2C 连接至 PB6/PB7' },
    }))

    expect(result.description).toContain('硬件方案已生成')
    expect(result.pins).toEqual(expect.arrayContaining([
      expect.objectContaining({ pinNumber: 'PB6', pinName: 'I2C1_SCL' }),
      expect.objectContaining({ pinNumber: 'J1-1', pinName: '12V_IN' }),
    ]))
    expect(result.bom[0]).toMatchObject({ model: 'LQFP48', unitPrice: 0 })
    expect(result.wiring[0]).toMatchObject({ from: 'depthSensor', to: 'I2C 连接至 PB6/PB7' })
  })

  it('rejects generated files that can escape an exported project', () => {
    expect(() => parseCodeFiles(JSON.stringify({
      files: [{ path: '../../secret.txt', content: 'secret', language: 'other' }],
    }))).toThrow(/不安全的工程文件路径/)
  })

  it('rejects duplicate generated file paths case-insensitively', () => {
    expect(() => parseCodeFiles(JSON.stringify({
      files: [
        { path: 'main/App.c', content: 'a', language: 'c' },
        { path: 'main/app.c', content: 'b', language: 'c' },
      ],
    }))).toThrow(/重复的工程文件路径/)
  })

  it('rejects flow edges that point to missing nodes', () => {
    expect(() => parseFlowGraph(JSON.stringify({
      nodes: [{ id: 'start', label: 'Start', position: { x: 0, y: 0 } }],
      edges: [{ id: 'edge-1', source: 'start', target: 'missing' }],
    }))).toThrow(/不存在的节点/)
  })

  it('parses a complete chip specification', () => {
    const result = parseChipSpec(JSON.stringify({
      name: 'ESP32-C3',
      fullName: 'ESP32-C3-MINI-1',
      arch: 'RISC-V',
      flash: '4MB',
      sram: '400KB',
      clockSpeed: '160MHz',
      voltage: '3.3V',
      gpios: [{ pin: 'GPIO4', altFunctions: ['ADC1_CH4'] }],
      peripherals: [{ name: 'I2C0', type: 'I2C', defaultPins: { SDA: 'GPIO4', SCL: 'GPIO5' } }],
      bootPins: ['GPIO9'],
      restrictions: ['GPIO9 affects boot mode'],
    }))

    expect(result.peripherals[0].type).toBe('I2C')
    expect(result.gpios[0].pin).toBe('GPIO4')
  })
})
