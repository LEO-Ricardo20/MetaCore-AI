import { describe, expect, it } from 'vitest'
import { buildMissingModelQuestions } from './generationCoordinator'

describe('hardware model preflight', () => {
  it('does not treat GPIO numbers or protocols as external part models', () => {
    const questions = buildMissingModelQuestions('ESP32 使用 GPIO4 读取 I2C 传感器并通过 MQTT 上传', 'ESP32')
    expect(questions.length).toBeGreaterThan(0)
    expect(questions.join('；')).toContain('传感器')
  })

  it('recognizes explicit external component model references', () => {
    expect(buildMissingModelQuestions('使用 DHT22 和 SSD1306，ESP32 通过 I2C 读取并显示', 'ESP32')).toEqual([])
  })
})
