import { describe, expect, it } from 'vitest'
import { CHIP_SPECS } from '@/data/chipSpecs'
import { ESP32_BOARD_PROFILES } from '@/data/esp32Profiles'
import { getCodeTemplate } from '@/data/codeTemplates'
import { normalizeProject } from '@/services/projects/projectLifecycle'
import {
  createEsp32ProjectConfig,
  getEsp32Profile,
  normalizeEsp32ProjectConfig,
  validateEsp32PinAssignments,
  validateEsp32ProjectConfig,
} from './esp32Config'

describe('ESP32 board profiles', () => {
  it('covers the five common ESP32 families with distinct build identities', () => {
    expect(ESP32_BOARD_PROFILES.map((profile) => profile.family)).toEqual(['esp32', 'esp32s3', 'esp32c3', 'esp32c6', 'esp32s2'])
    expect(new Set(ESP32_BOARD_PROFILES.map((profile) => profile.platformioId)).size).toBe(5)
    expect(new Set(ESP32_BOARD_PROFILES.map((profile) => profile.idfTarget)).size).toBe(5)
  })

  it('migrates an old ESP32 project to the classic board profile', () => {
    const project = normalizeProject({
      id: 'legacy', name: 'legacy', target: 'ESP32', format: 'platformio', requirement: '',
      codeFiles: [], flowNodes: [], flowEdges: [], createdAt: 1, updatedAt: 1,
    })
    expect(project.schemaVersion).toBe(3)
    expect(project.esp32?.boardId).toBe('esp32-dev-module')
    expect(project.esp32?.platformioBoard).toBe('esp32dev')
  })

  it('does not advertise C6 Arduino support from the installed PlatformIO manifest', () => {
    const config = createEsp32ProjectConfig('esp32-c6-devkitc-1')
    expect(getEsp32Profile(config.boardId)?.platformioFrameworks).toEqual(['espidf'])
    expect(validateEsp32ProjectConfig({ ...config, platformioFramework: 'arduino' }, 'platformio'))
      .toContainEqual(expect.objectContaining({ code: 'ESP32_PIO_FRAMEWORK_UNSUPPORTED', severity: 'error' }))
    expect(validateEsp32ProjectConfig(config, 'arduino'))
      .toContainEqual(expect.objectContaining({ code: 'ESP32_FORMAT_UNSUPPORTED', severity: 'error' }))
  })

  it('keeps the S3 N8 profile free of fabricated PSRAM and DAC capabilities', () => {
    const config = createEsp32ProjectConfig('esp32-s3-devkitc-1-n8')
    expect(config.psramSize).toBe('无（N8 变体）')
    expect(CHIP_SPECS['ESP32-S3'].fullName).toBe('ESP32-S3-WROOM-1-N8')
    expect(CHIP_SPECS['ESP32-S3'].peripherals.some((peripheral) => peripheral.type === 'DAC')).toBe(false)
    expect(CHIP_SPECS['ESP32-S3'].gpios.flatMap((pin) => pin.altFunctions).some((item) => item.includes('DAC'))).toBe(false)
  })

  it('generates the correct PlatformIO board and ESP-IDF target skeletons', () => {
    const c3 = createEsp32ProjectConfig('esp32-c3-devkitm-1')
    const platformio = getCodeTemplate('platformio', c3).skeleton.find((file) => file.path === 'platformio.ini')?.template
    const idf = getCodeTemplate('espidf', c3)
    expect(platformio).toContain('board = esp32-c3-devkitm-1')
    expect(platformio).not.toContain('board = esp32dev')
    expect(idf.description).toContain('idf.py set-target esp32c3')
    const c6 = createEsp32ProjectConfig('esp32-c6-devkitc-1')
    const c6Template = getCodeTemplate('platformio', c6)
    expect(c6Template.skeleton.some((file) => file.path === 'src/main.c' && file.template.includes('app_main'))).toBe(true)
    expect(c6Template.skeleton.every((file) => !file.template.includes('#include <Arduino.h>'))).toBe(true)
  })

  it('rejects reserved/output-only violations and records USB/strapping warnings', () => {
    const classic = createEsp32ProjectConfig('esp32-dev-module')
    const issues = validateEsp32PinAssignments(classic, [
      { pinNumber: 'GPIO6', pinName: 'LED', function: '状态灯输出', connectedTo: 'LED', voltage: '3.3V' },
      { pinNumber: 'GPIO34', pinName: 'PWM', function: 'PWM 输出', connectedTo: 'Buzzer', voltage: '3.3V' },
      { pinNumber: 'GPIO0', pinName: 'BUTTON', function: '按键输入', connectedTo: 'Button', voltage: '3.3V' },
    ])
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['ESP32_PIN_RESERVED', 'ESP32_PIN_INPUT_ONLY', 'ESP32_PIN_STRAPPING']))
  })

  it('normalizes mismatched stored fields from the authoritative board profile', () => {
    const config = normalizeEsp32ProjectConfig({
      ...createEsp32ProjectConfig('esp32-c3-devkitm-1'),
      family: 'esp32s3',
      module: 'wrong',
      platformioBoard: 'esp32dev',
      idfTarget: 'esp32',
    }, 'ESP32-C3')
    expect(config).toMatchObject({ family: 'esp32c3', module: 'ESP32-C3-MINI-1', platformioBoard: 'esp32-c3-devkitm-1', idfTarget: 'esp32c3' })
  })
})
