import { describe, expect, it } from 'vitest'
import type { HardwareScheme } from '@/types/project'
import { buildChipParsePrompt, buildCodegenPrompt, buildFlowPrompt, buildSchemePrompt, buildVerifyPrompt, CHAT_SYSTEM_PROMPT } from './prompts'

const scheme: HardwareScheme = {
  description: 'ESP32 传感器节点',
  pins: [{ pinNumber: 'GPIO21', pinName: 'SDA', function: 'I2C 数据', connectedTo: '传感器 SDA', voltage: '3.3V' }],
  bom: [{ name: '传感器', model: 'TEST-I2C', quantity: 1, unitPrice: 0 }],
  wiring: [{ from: 'ESP32 GPIO21', to: '传感器 SDA' }],
}

describe('AI prompt contracts', () => {
  it('keeps hardware pin allocation strict and explicit', () => {
    const prompt = buildSchemePrompt('读取 I2C 传感器', 'ESP32')
    expect(prompt.system).toContain('同一完整引脚编号只能有一个分配记录')
    expect(prompt.system).toContain('资料不足或约束无法同时满足时，必须设为 needs_clarification')
    expect(prompt.user).toContain('pins 中每个 pinNumber 必须是资料中存在的完整引脚名，且不重复')
    expect(prompt.system).toContain('宁可保留更大的电流、功率、温升、存储和带宽余量')
    expect(prompt.system).toContain('不得悄悄换成其他芯片、模组、开发板、封装或低价替代品')
    expect(prompt.user).toContain('AI 候选阶段已选定的完整型号')
    expect(prompt.user).toContain('只输出 JSON')
    expect(prompt.system).toContain('本地硬件知识库事实')
    expect(prompt.system).toContain('metacore.hardware-core@1.0.0')
  })

  it('prevents firmware generation from changing the approved hardware map', () => {
    const prompt = buildCodegenPrompt(scheme, 'ESP32', 'espidf')
    expect(prompt.system).toContain('禁止重新选引脚、改外设、改总线地址')
    expect(prompt.system).toContain('不得使用未声明的函数、类型、变量、库、占位符')
    expect(prompt.user).toContain('禁止重新分配')
    expect(prompt.user).toContain('文件路径唯一且安全')
    expect(prompt.system).toContain('本地硬件知识库事实')
  })

  it('requires flow graph evidence and valid graph references', () => {
    const prompt = buildFlowPrompt([{ path: 'main.c', content: 'void setup(void) {}\n' }])
    expect(prompt.system).toContain('只能使用输入代码中真实存在的文件路径、函数名、代码行和代码片段')
    expect(prompt.system).toContain('codeLine 必须使用 0')
    expect(prompt.user).toContain('节点 id 必须唯一')
    expect(prompt.user).toContain('每条 edge 的 source 和 target 必须引用已存在的节点 id')
  })

  it('requires evidence-backed consistency verification', () => {
    const prompt = buildVerifyPrompt(scheme, [{ path: 'main.c', content: 'void setup(void) {}\n' }], 'ESP32')
    expect(prompt).toContain('无法确认时标记 warning')
    expect(prompt).toContain('consistent 只有在没有 error 和 warning 时才能为 true')
    expect(prompt).toContain('真实文件路径和行号证据')
    expect(prompt).toContain('I2C/SPI/UART/CAN')
    expect(prompt).toContain('本地硬件知识库事实')
  })

  it('does not allow invented chip defaults when parsing a datasheet', () => {
    const prompt = buildChipParsePrompt('ESP32-C3 datasheet excerpt')
    expect(prompt).toContain('不能用常识、其他型号或网络资料推断')
    expect(prompt).toContain('必须填 "未知"')
    expect(prompt).toContain('严格区分芯片封装引脚、模块引脚、开发板排针和 GPIO 编号')
  })

  it('keeps interactive answers evidence-based', () => {
    const prompt = CHAT_SYSTEM_PROMPT('当前方案：GPIO21 -> I2C SDA')
    expect(prompt).toContain('只能使用项目上下文中已确认的事实')
    expect(prompt).toContain('严禁编造 GPIO、芯片规格、API')
    expect(prompt).toContain('已确认事实 / 假设与风险 / 下一步')
  })
})
