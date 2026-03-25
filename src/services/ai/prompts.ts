/**
 * AI 提示词模板 — 硬件方案/代码生成/流程图/问答/芯片解析
 *
 * 每个 prompt 返回 { system, user } 对象，system 注入芯片规格和角色约束，
 * user 注入具体需求和输出格式。调用时应分别放入 system 和 user 消息中。
 */

import type { HardwareScheme } from '@/types/project'
import type { ChipTarget, ProjectFormat, ChipSpec } from '@/types/hardware'
import { chipSpecToPromptText, getChipSpec } from '@/data/chipSpecs'
import { codeTemplateToPromptText } from '@/data/codeTemplates'
import { matchDriverTemplates, driverTemplatesToPromptText } from '@/data/driverTemplates'

/** prompt 消息对（system + user） */
export interface PromptPair {
  system: string
  user: string
}

// ─────────────────────────────────────────────
// 1. 硬件方案生成
// ─────────────────────────────────────────────

/** 生成硬件方案的 prompt（注入芯片规格，约束引脚分配） */
export function buildSchemePrompt(requirement: string, target: ChipTarget, customSpec?: ChipSpec): PromptPair {
  const spec = customSpec ?? getChipSpec(target)
  const chipText = spec ? chipSpecToPromptText(spec) : `目标芯片：${target}（无详细规格数据）`

  return {
    system: `你是一位资深嵌入式硬件架构工程师，拥有 15 年 ESP32/STM32 产品设计经验。

## 核心能力
- 精通芯片引脚复用规则，绝不分配冲突引脚
- 熟知各芯片的启动引脚限制、仅输入引脚、Flash 占用引脚

${chipText}

## 硬性约束
1. 只使用上述规格中列出的 GPIO 引脚，不可编造不存在的引脚
2. 每个 GPIO 只分配一个功能
3. 不使用被 Flash 占用的引脚（如 ESP32 的 GPIO6-11）
4. 不在启动受限引脚上连接会影响启动电平的负载
5. 仅输入引脚不得用于输出功能
6. I2C/SPI/UART 优先使用默认引脚
7. WiFi 功能启用时避免使用 ADC2`,

    user: `需求描述：${requirement}
目标芯片：${target}

## 输出要求
严格按以下 JSON 格式输出，仅输出 JSON，不允许添加任何其他内容（不要 markdown 代码块、不要注释）：

{
  "description": "方案概述（4-6句话，包含整体架构、主要模块、数据流向、通信方式）",
  "pins": [
    {
      "pinNumber": "引脚编号（必须是上述芯片规格中存在的引脚），如 GPIO4、PA0",
      "pinName": "标准引脚名，如 SDA、SCK、MOSI 等",
      "function": "功能描述（1-2句话）",
      "connectedTo": "连接到的外部设备全名，如 '0.96寸OLED显示屏 SDA引脚'",
      "voltage": "工作电压，如 3.3V、5V、GND"
    }
  ],
  "bom": [
    {
      "name": "器件通用名称",
      "model": "具体型号/规格",
      "quantity": 数量,
      "unitPrice": 单价（人民币元）,
      "purchaseLink": "搜索关键词（可选）"
    }
  ],
  "wiring": [
    {
      "from": "起点标识，如 'ESP32 GPIO4 (SDA)'",
      "to": "终点标识，如 'OLED SSD1306 SDA'",
      "wireColor": "推荐杜邦线颜色",
      "note": "连接注意事项（可选）"
    }
  ]
}

## 设计原则
- 引脚分配严格参考上述芯片规格中的可用引脚列表
- I2C/SPI/UART 优先使用默认引脚映射
- 避开启动受限引脚和仅输入引脚（除非确实用于输入功能）
- BOM 包含所有必要器件（芯片模块、传感器、显示屏、连接线、电阻电容等）
- 接线首尾完整，有几根就列几根`
  }
}

/** @deprecated 兼容旧调用方式，返回单个字符串。新代码请用 buildSchemePrompt */
export const SCHEME_PROMPT = (requirement: string, target: ChipTarget): string => {
  const pair = buildSchemePrompt(requirement, target)
  return pair.system + '\n\n' + pair.user
}

// ─────────────────────────────────────────────
// 2. 代码生成
// ─────────────────────────────────────────────

/** 生成工程代码的 prompt（注入芯片规格 + 代码模板） */
export function buildCodegenPrompt(scheme: HardwareScheme, target: ChipTarget, format: ProjectFormat, customSpec?: ChipSpec): PromptPair {
  const spec = customSpec ?? getChipSpec(target)
  const chipText = spec ? chipSpecToPromptText(spec) : `目标芯片：${target}`
  const templateText = codeTemplateToPromptText(format)
  const matchedDrivers = matchDriverTemplates(scheme)
  const driverText = driverTemplatesToPromptText(matchedDrivers, format)

  return {
    system: `你是一位资深嵌入式 C/C++ 工程师，专精 ${target} 固件开发。

## 核心原则
- 生成的代码必须可直接编译运行，不使用任何占位符或 TODO
- 引脚编号必须与硬件方案完全一致，禁止随意修改
- 使用芯片厂商的标准 API，不使用已废弃的接口

${chipText}

${templateText}

${driverText}

## 代码质量要求
- 每个外设驱动独立成 .c/.h 模块
- 所有 API 调用检查返回值
- 使用有意义的常量名（如 #define LED_GPIO 2），不使用魔法数字
- 中文注释说明每个函数用途`,

    user: `硬件方案：
${JSON.stringify(scheme, null, 2)}

## 要求
1. 引脚编号必须与上述方案完全一致
2. 模块化设计：每个外设独立成 module.c + module.h
3. 头文件使用 #pragma once
4. 主文件只负责初始化和主循环
5. 完整实现，可直接编译
6. 中文注释

## 输出格式
严格按 JSON 输出，不加任何其他内容（禁止 markdown 代码块）：

{
  "files": [
    {
      "path": "相对路径，如 main/main.c",
      "content": "完整文件内容",
      "language": "c | h | cpp | cmake | ini | makefile"
    }
  ]
}`
  }
}

/** @deprecated 兼容旧调用方式 */
export const CODEGEN_PROMPT = (scheme: HardwareScheme, target: ChipTarget, format: ProjectFormat): string => {
  const pair = buildCodegenPrompt(scheme, target, format)
  return pair.system + '\n\n' + pair.user
}

// ─────────────────────────────────────────────
// 3. 流程图生成
// ─────────────────────────────────────────────

/** 生成代码执行流程图的 prompt */
export function buildFlowPrompt(files: { path: string; content: string }[]): PromptPair {
  return {
    system: `你是一位嵌入式代码分析专家，擅长提取 C/C++ 工程的执行流程并生成可视化节点图。

## 节点颜色规范（nodeStyle 字段使用分类关键词）
- 初始化类：init
- 传感器类：sensor
- 通信类：comm
- 显示类：display
- 错误处理：error
- 逻辑控制：logic`,

    user: `分析以下嵌入式工程代码，提取主要执行流程。

代码文件：
${files.map(f => `=== ${f.path} ===\n${f.content.slice(0, 1000)}`).join('\n\n')}

## 节点设计原则
1. 初始化节点：系统时钟、GPIO、外设、WiFi/蓝牙等初始化
2. 任务节点：FreeRTOS 任务或主循环中的主要功能块
3. 通信节点：MQTT 发布、HTTP 请求、串口收发等
4. 数据处理节点：传感器数据读取、解析、存储
5. 每个节点包含 label（4-10 字中文）、codeSnippet（3-5 行关键代码）、codeFileRef（来源文件）

## 布局
- position: {x: 100-800, y: 50-700}，从上到下、从左到右

严格按以下 JSON 格式输出：

{
  "nodes": [
    { "id": "唯一ID", "label": "节点标签", "codeFileRef": "文件路径", "codeSnippet": "代码片段", "nodeStyle": "分类关键词", "position": { "x": 数字, "y": 数字 } }
  ],
  "edges": [
    { "id": "边ID", "source": "源节点ID", "target": "目标节点ID", "label": "边标签（可选）" }
  ]
}`
  }
}

/** @deprecated 兼容旧调用方式 */
export const FLOW_PROMPT = (files: { path: string; content: string }[]): string => {
  const pair = buildFlowPrompt(files)
  return pair.system + '\n\n' + pair.user
}

// ─────────────────────────────────────────────
// 4. AI 问答
// ─────────────────────────────────────────────

/** AI 问答系统 prompt（不变，已经是独立的 system prompt） */
export const CHAT_SYSTEM_PROMPT = (projectContext: string): string => `
你是 MetaCore AI 的硬件工程顾问助手，专注于 ESP32/STM32 嵌入式开发领域。

## 角色定位
- 资深嵌入式硬件工程师，精通硬件方案设计、PCB布局、器件选型
- 精通 ESP-IDF、Arduino、PlatformIO 三种开发框架
- 熟悉 WiFi/BT 通信、传感器驱动、显示驱动、低功耗设计

## 当前项目上下文
${projectContext || '暂无项目上下文，请先在「需求生成」页创建项目'}

## 回答规范
1. 用中文回答，技术表述要准确专业
2. 涉及代码时给出完整可运行的示例
3. 涉及硬件设计时考虑成本、可靠性、可生产性
4. 回答简洁有重点，避免冗长
5. 如涉及选型，给出2-3个方案对比
6. 遇到不确定的问题，诚实说明并给出建议
`

// ─────────────────────────────────────────────
// 5. 代码验证（自检）
// ─────────────────────────────────────────────

/** 代码与方案一致性验证 prompt */
export function buildVerifyPrompt(
  scheme: HardwareScheme,
  files: { path: string; content: string }[]
): string {
  return `请检查以下代码是否与硬件方案一致，列出所有不一致之处。

硬件方案引脚分配：
${scheme.pins.map(p => `${p.pinNumber} -> ${p.function} -> ${p.connectedTo}`).join('\n')}

代码文件：
${files.map(f => `--- ${f.path} ---\n${f.content.slice(0, 800)}`).join('\n\n')}

检查项：
1. 代码中的引脚编号是否与方案一致
2. 是否有方案中的外设在代码中遗漏
3. I2C/SPI 地址是否正确
4. 初始化顺序是否合理

如果完全一致，输出：{"consistent": true, "issues": []}
如果有问题，输出：{"consistent": false, "issues": ["问题1", "问题2"]}
仅输出 JSON。`
}

// ─────────────────────────────────────────────
// 6. 芯片 PDF 解析
// ─────────────────────────────────────────────

/** 从 PDF 文本解析芯片参数的 prompt */
export function buildChipParsePrompt(pdfText: string): string {
  return `从以下芯片数据手册文本中提取结构化技术参数。

文本内容（可能不完整）：
${pdfText.slice(0, 8000)}

## 要求提取的信息
严格按以下 JSON 格式输出：

{
  "name": "芯片短名称，如 ESP32-C3",
  "fullName": "完整型号",
  "arch": "架构，如 RISC-V 单核",
  "flash": "Flash 容量",
  "sram": "SRAM 容量",
  "clockSpeed": "最高主频",
  "voltage": "工作电压",
  "gpios": [
    { "pin": "引脚编号", "altFunctions": ["复用功能1", "功能2"], "inputOnly": false, "notes": "特殊说明" }
  ],
  "peripherals": [
    { "name": "总线名", "type": "I2C|SPI|UART|I2S|CAN|USB|ADC|DAC|PWM", "defaultPins": { "信号名": "引脚号" } }
  ],
  "bootPins": ["启动受限引脚"],
  "restrictions": ["限制条件1", "限制条件2"]
}

## 注意
- 如果某些信息在文本中找不到，用合理的默认值或标注"未知"
- GPIO 列表要尽可能完整
- 仅输出 JSON`
}
