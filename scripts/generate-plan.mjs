/**
 * MetaCore AI 项目计划书生成脚本
 * 运行：node scripts/generate-plan.mjs
 * 输出：MetaCore_AI_项目计划书.docx
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle, ShadingType, PageBreak, Header, Footer,
  convertInchesToTwip
} from 'docx'
import { writeFileSync } from 'fs'

// ─── 颜色常量 ───────────────────────────────────────────
const COLOR = {
  primary:   '2563EB', // 蓝色
  accent:    '7C3AED', // 紫色
  dark:      '1E293B', // 深色标题
  body:      '374151', // 正文
  muted:     '6B7280', // 次要文字
  tableHead: '1E293B', // 表头背景
  tableAlt:  'F1F5F9', // 隔行背景
  white:     'FFFFFF',
  border:    'E2E8F0', // 表格边框
  highlight: 'EFF6FF', // 封面背景色
}

// ─── 字体 ───────────────────────────────────────────────
const FONT = { cn: '微软雅黑', en: 'Calibri' }

// ─── 辅助函数 ────────────────────────────────────────────

function txt(text, opts = {}) {
  return new TextRun({
    text,
    font: FONT.cn,
    size: opts.size ?? 22,          // 11pt = 22 half-points
    bold: opts.bold ?? false,
    color: opts.color ?? COLOR.body,
    italics: opts.italics ?? false,
    ...opts
  })
}

function para(runs, opts = {}) {
  const children = Array.isArray(runs) ? runs : [typeof runs === 'string' ? txt(runs) : runs]
  return new Paragraph({
    children,
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0, line: opts.line ?? 276 },
    alignment: opts.align ?? AlignmentType.LEFT,
    indent: opts.indent ? { left: convertInchesToTwip(opts.indent) } : undefined,
    ...opts
  })
}

function heading1(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT.cn, size: 32, bold: true, color: COLOR.dark })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.primary, space: 6 } }
  })
}

function heading2(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT.cn, size: 26, bold: true, color: COLOR.primary })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 100 }
  })
}

function bullet(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT.cn, size: 22, color: COLOR.body })],
    bullet: { level: opts.level ?? 0 },
    spacing: { after: 80 }
  })
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] })
}

function spacer(pt = 1) {
  return new Paragraph({ children: [], spacing: { after: pt * 20 } })
}

// ─── 表格辅助 ────────────────────────────────────────────

function cell(text, opts = {}) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({
        text,
        font: FONT.cn,
        size: opts.size ?? 20,
        bold: opts.bold ?? false,
        color: opts.color ?? COLOR.body,
      })],
      alignment: opts.align ?? AlignmentType.LEFT,
      spacing: { before: 60, after: 60 }
    })],
    shading: opts.shading ? { type: ShadingType.SOLID, color: opts.shading, fill: opts.shading } : undefined,
    verticalAlign: 'center',
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    columnSpan: opts.span,
  })
}

function tableRow(cells, isHeader = false) {
  return new TableRow({
    children: cells,
    tableHeader: isHeader,
  })
}

function makeTable(headers, rows) {
  const colCount = headers.length
  const colWidth = Math.floor(9000 / colCount)

  const headerRow = tableRow(
    headers.map(h => cell(h, { bold: true, color: COLOR.white, shading: COLOR.tableHead, size: 20 })),
    true
  )

  const dataRows = rows.map((row, ri) =>
    tableRow(
      row.map(c => cell(c, { shading: ri % 2 === 1 ? COLOR.tableAlt : undefined }))
    )
  )

  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [headerRow, ...dataRows],
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: COLOR.border },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.border },
      left:   { style: BorderStyle.SINGLE, size: 4, color: COLOR.border },
      right:  { style: BorderStyle.SINGLE, size: 4, color: COLOR.border },
      insideH:{ style: BorderStyle.SINGLE, size: 2, color: COLOR.border },
      insideV:{ style: BorderStyle.SINGLE, size: 2, color: COLOR.border },
    }
  })
}

// ═══════════════════════════════════════════════════════
// 第一章：封面与执行摘要
// ═══════════════════════════════════════════════════════
function buildCover() {
  return [
    spacer(40),
    new Paragraph({
      children: [txt('MetaCore AI', { size: 72, bold: true, color: COLOR.primary, font: FONT.cn })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 }
    }),
    new Paragraph({
      children: [txt('AI 驱动的嵌入式硬件架构工程师平台', { size: 36, color: COLOR.accent, font: FONT.cn })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [txt('「自然语言 → 完整硬件工程，全链路 AI 自动化」', { size: 26, italics: true, color: COLOR.muted })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }),
    new Paragraph({
      children: [
        txt('版本：', { size: 22, color: COLOR.muted }), txt('v1.5.6', { size: 22, bold: true, color: COLOR.dark }),
        txt('    |    日期：', { size: 22, color: COLOR.muted }), txt('2026-03-28', { size: 22, color: COLOR.dark }),
        txt('    |    作者：', { size: 22, color: COLOR.muted }), txt('Leo', { size: 22, bold: true, color: COLOR.dark }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 }
    }),
    pageBreak(),
    heading1('执行摘要'),
    para('MetaCore AI 是一个纯 Web 端的 AI 嵌入式硬件架构工程师平台。用户只需用自然语言描述硬件需求，平台通过 AI 自动完成从芯片引脚分配、BOM 物料清单、接线表，到模块化 C/C++ 工程代码、代码执行流程图的全链路生成，无需安装任何桌面软件。', { after: 160 }),
    para('目标用户群体涵盖创客/Maker、硬件创业团队、高校实验室和 IoT 产品原型团队。平台支持 ESP32、ESP32-S3、STM32F103、STM32F4 等主流芯片，以及 ESP-IDF、Arduino、PlatformIO、STM32CubeIDE 四种主流开发框架，内置 8 个经过验证的外设驱动模板，生成代码可直接上板编译。', { after: 160 }),
    para('MetaCore AI 采用纯前端架构，所有数据保存在用户本地浏览器，不经过任何中间服务器，API Key 安全可控。平台支持 DeepSeek、通义千问、硅基流动、OpenAI、本地 Ollama 等多家 AI 服务商，用户自由选择。当前版本 v1.5.6 已完成完整功能矩阵，产品成熟度高，可一键部署到任意静态服务器。', { after: 200 }),
    spacer(10),
    makeTable(
      ['核心指标', '详情'],
      [
        ['当前版本', 'v1.5.6（2026-03-28 发布）'],
        ['支持芯片', '5 款预置（ESP32/S3/STM32F103/F4/KIT）+ 无限自定义'],
        ['内置驱动', '8 个经验证驱动（SSD1306、DHT、AHT20、WS2812 等）'],
        ['工程格式', 'ESP-IDF / Arduino / PlatformIO / STM32CubeIDE'],
        ['AI 服务商', 'DeepSeek / 硅基流动 / 通义千问 / OpenAI / Ollama（本地）'],
        ['部署方式', '纯前端，npm run build 后部署到任意静态服务器'],
        ['数据安全', '全本地存储，API Key 不上传任何服务器'],
      ]
    ),
    spacer(20),
    pageBreak(),
  ]
}

// ═══════════════════════════════════════════════════════
// 第二章：问题与市场机会
// ═══════════════════════════════════════════════════════
function buildProblem() {
  return [
    heading1('一、问题与市场机会'),
    heading2('1.1 嵌入式硬件开发的痛点'),
    para('传统嵌入式硬件开发流程极为繁琐，工程师在方案设计阶段需要花费大量时间查阅芯片数据手册、手动规划引脚分配、逐一确认电气规则，稍有疏漏就会导致硬件返工。进入编码阶段后，驱动程序往往需要从零编写，缺乏可复用的经验积累。整个工具链高度割裂——方案设计、原理图、代码开发、文档归档分属不同软件，极大拖慢了原型迭代速度。', { after: 160 }),
    makeTable(
      ['痛点', '具体表现', '影响'],
      [
        ['手查手册', '每个芯片引脚规则需人工查阅 PDF 数据手册，易出错', '方案设计耗时长、引脚冲突频发'],
        ['手写驱动', '传感器/显示屏驱动需从零实现，缺少可靠参考', '代码质量不稳定，调试周期长'],
        ['工具链割裂', '方案、代码、文档在不同软件间切换，信息不同步', '项目管理混乱，协作效率低'],
        ['门槛高', '新手面对芯片规格和框架 API，学习曲线陡峭', '创新想法难以快速验证落地'],
      ]
    ),
    spacer(10),
    heading2('1.2 目标用户群体'),
    makeTable(
      ['用户类型', '核心需求', '痛点强度'],
      [
        ['创客 / Maker', '快速验证创意，无需深入硬件背景', '★★★★★'],
        ['硬件创业团队', '缩短原型开发周期，降低人力成本', '★★★★★'],
        ['高校实验室', '教学演示、科研原型，节省重复劳动', '★★★★☆'],
        ['IoT 产品原型团队', '多芯片方案快速对比，加速量产前验证', '★★★★☆'],
        ['嵌入式学习者', '从需求到代码的完整学习路径', '★★★★☆'],
      ]
    ),
    spacer(10),
    heading2('1.3 市场机会'),
    para('AI 代码生成工具（GitHub Copilot、Cursor 等）已在通用软件开发领域引发巨大变革，但嵌入式硬件领域至今缺乏专业化的 AI 全链路工具。硬件开发有其特殊性——芯片引脚规则严苛、驱动代码需要贴合具体硬件、输出必须可直接编译——这使得通用 AI 工具难以胜任。MetaCore AI 正是瞄准这一空白市场，以专业化的芯片知识库和驱动模板库为壁垒，构建嵌入式 AI 工具的垂直赛道。', { after: 160 }),
    pageBreak(),
  ]
}

// ═══════════════════════════════════════════════════════
// 第三章：产品解决方案
// ═══════════════════════════════════════════════════════
function buildSolution() {
  return [
    heading1('二、产品解决方案'),
    heading2('2.1 核心理念'),
    para('MetaCore AI 的核心理念是「一句话需求 → 可编译工程」。用户无需了解底层芯片手册，只需用自然语言描述想要实现的功能，平台即可自动完成整个硬件方案设计和代码生成流程。', { after: 160 }),
    heading2('2.2 五步工作流'),
    makeTable(
      ['步骤', '用户操作', '平台自动完成'],
      [
        ['① 描述需求', '输入自然语言需求，如「做一个温湿度监控仪，OLED 显示，WiFi 上报」', 'AI 理解需求意图，分析所需外设'],
        ['② 选择配置', '选择目标芯片和工程格式', '加载芯片完整规格数据，约束引脚分配'],
        ['③ 生成方案', '点击「生成方案」', 'AI 输出引脚分配表、BOM 清单、接线对照表、SVG 引脚图'],
        ['④ 生成代码', '点击「生成代码」（或开启一键生成自动完成）', 'AI 生成模块化 C/C++ 工程 + 自动注入验证驱动 + AI 自检'],
        ['⑤ 导出使用', '下载 ZIP 或 PDF', '输出完整工程包，可直接导入 IDE 编译'],
      ]
    ),
    spacer(10),
    heading2('2.3 Before / After 对比'),
    makeTable(
      ['环节', '传统方式', '使用 MetaCore AI'],
      [
        ['方案设计', '查阅 PDF 手册 2-4 小时，手动规划引脚', '< 1 分钟，AI 自动分配并校验'],
        ['BOM 清单', '逐项搜索器件、估算价格，30-60 分钟', '自动生成含参考价格的完整清单'],
        ['驱动编写', '参考示例代码，调试 1-3 天', '内置验证驱动自动注入，可直接上板'],
        ['文档归档', '手写 Word/Markdown，1-2 小时', '一键导出专业 PDF，包含所有方案细节'],
        ['工程创建', '手动配置 CMakeLists/platformio.ini', '自动生成对应格式的完整工程结构'],
      ]
    ),
    spacer(20),
    pageBreak(),
  ]
}

// ═══════════════════════════════════════════════════════
// 第四章：功能特性详解
// ═══════════════════════════════════════════════════════
function buildFeatures() {
  return [
    heading1('三、功能特性详解'),
    heading2('3.1 硬件方案生成'),
    para('用户输入自然语言需求后，AI 基于芯片完整技术规格（GPIO 列表、外设总线、启动限制引脚、电气约束）自动生成精准的硬件方案。输出包含引脚分配表（引脚号、功能、连接外设、工作电压）、BOM 物料清单（器件名称、型号、数量、参考价格）和完整接线对照表（含推荐杜邦线颜色和注意事项）。', { after: 120 }),
    heading2('3.2 SVG 引脚可视化图'),
    para('方案生成后自动渲染 SVG 格式的芯片引脚图，悬停引脚可查看连接外设详情。支持暗色/亮色双主题自适应，提供表格视图和图形视图两种切换模式，直观展示引脚分配结果。', { after: 120 }),
    heading2('3.3 模块化工程代码生成'),
    para('基于硬件方案生成完整可编译的 C/C++ 工程代码，采用模块化设计，每个外设独立成 .c/.h 文件对。支持四种主流工程格式：ESP-IDF（CMake）、Arduino（.ino）、PlatformIO（platformio.ini）、STM32CubeIDE（.ioc）。所有 API 调用检查返回值，使用具名常量，包含中文注释。', { after: 120 }),
    heading2('3.4 AI 自检验证'),
    para('代码生成完成后，平台自动发起第二次 AI 调用，对比硬件方案引脚分配与生成代码的一致性，检查引脚编号、I2C/SPI 地址、初始化顺序等关键项。如发现不一致，在顶栏以警告形式展示具体问题列表，帮助用户快速定位潜在错误。', { after: 120 }),
    heading2('3.5 代码执行流程图'),
    para('AI 分析生成的工程代码，提取主要执行流程并生成可交互的节点图（基于 ReactFlow）。节点按功能分类着色（初始化/传感器/通信/显示/错误处理/逻辑控制），点击节点可查看对应代码片段和来源文件，支持自由拖动调整布局。', { after: 120 }),
    heading2('3.6 AI 问答助手'),
    para('流程图页内置 AI 聊天面板，扮演「硬件工程顾问」角色，自动注入当前项目上下文（需求、芯片、方案、代码摘要），可针对性回答硬件选型、引脚配置、驱动调用等专业问题。', { after: 120 }),
    heading2('3.7 芯片管理'),
    para('内置 5 款预置芯片（ESP32、ESP32-S3、STM32F103、STM32F4、STM32F103-KIT），每款均包含完整 GPIO 列表、外设总线默认引脚、启动限制引脚和使用约束。支持三种方式添加自定义芯片：AI 识图（上传 PDF Datasheet 自动提取）、AI 助填（AI 预填后手动微调）、手动配置（4 步分步表单）。', { after: 120 }),
    heading2('3.8 驱动模板库'),
    para('内置 8 个经过实际验证的外设驱动模板，代码生成时根据 BOM 自动匹配并注入 AI prompt，确保生成代码可直接上板编译。用户也可在生成前手动预选驱动，与自动匹配结果合并注入。', { after: 120 }),
    spacer(5),
    makeTable(
      ['驱动', '外设类型', '通信接口', '支持框架'],
      [
        ['SSD1306', 'OLED 显示屏', 'I2C', 'ESP-IDF / Arduino'],
        ['DHT11/22', '温湿度传感器', 'GPIO 单总线', 'ESP-IDF / Arduino'],
        ['AHT20', '高精度温湿度传感器', 'I2C', 'ESP-IDF / Arduino'],
        ['WS2812', 'RGB LED 灯珠', 'GPIO（RMT）', 'ESP-IDF / Arduino'],
        ['HC-SR04', '超声波测距传感器', 'GPIO', 'ESP-IDF / Arduino'],
        ['蜂鸣器', '有源/无源蜂鸣器', 'GPIO / PWM', 'ESP-IDF / Arduino'],
        ['舵机', 'PWM 舵机控制', 'PWM', 'ESP-IDF / Arduino'],
        ['DRV8833', '双路电机驱动', 'GPIO / PWM', 'ESP-IDF / Arduino'],
      ]
    ),
    spacer(10),
    heading2('3.9 一键式生成流水线'),
    para('可选开关功能，开启后点击「生成方案」将自动串行完成「方案生成 → 代码生成 → 流程图生成」三步，最终跳转至流程图页。按钮实时显示当前步骤进度，开关状态跨会话持久化记忆。', { after: 120 }),
    heading2('3.10 导出功能'),
    para('ZIP 工程包包含完整目录结构，可直接导入 VS Code + ESP-IDF / Arduino IDE / PlatformIO 使用。PDF 文档包含硬件方案、引脚分配、BOM 清单、接线表、代码清单，内置 SimHei 中文字体，支持中文内容完美导出，适合打印和存档。', { after: 120 }),
    heading2('3.11 多项目管理'),
    para('支持创建、加载、删除多个独立项目，所有项目数据（需求、芯片配置、方案、代码、流程图）均持久化存储在浏览器 localStorage，无需登录，无需网络，刷新不丢失。', { after: 120 }),
    heading2('3.12 多 AI 服务商支持'),
    para('支持 DeepSeek、硅基流动、通义千问、OpenAI、Ollama（本地部署）五类服务商。OpenAI 自动使用 Responses API，其他服务商使用标准 Chat Completions 协议。API Key 仅存储在本地 localStorage，不经过任何中间服务器。', { after: 120 }),
    pageBreak(),
  ]
}

// ═══════════════════════════════════════════════════════
// 第五章：技术架构
// ═══════════════════════════════════════════════════════
function buildArch() {
  return [
    heading1('四、技术架构概述'),
    heading2('4.1 纯前端架构'),
    para('MetaCore AI 采用完全纯前端架构，无需后端服务、无需数据库、无需用户注册。所有 AI 调用直接从用户浏览器发送至对应服务商，平台本身不转发任何请求。这一架构使得产品可以部署到任意静态服务器（CDN、GitHub Pages、Nginx 等），运营成本极低，同时从根本上消除了数据隐私风险。', { after: 160 }),
    heading2('4.2 技术栈'),
    makeTable(
      ['技术', '版本', '用途'],
      [
        ['React', '18.2', 'UI 框架，组件化开发'],
        ['TypeScript', '5.3', '类型安全，减少运行时错误'],
        ['Vite', '5.1', '构建工具，毫秒级热更新'],
        ['Tailwind CSS', '3.4', '原子化 CSS，暗色/亮色主题适配'],
        ['Zustand', '4.5', '轻量状态管理，含 persist 持久化'],
        ['React Router', '6.22', '前端路由（HashRouter，支持静态部署）'],
        ['ReactFlow', '11.11', '流程图可视化，可交互节点图'],
        ['Monaco Editor', '4.6', '代码预览（VS Code 同款编辑器）'],
        ['@react-pdf/renderer', '4.3', '浏览器端 PDF 生成，内置中文字体'],
        ['JSZip', '3.10', '浏览器端 ZIP 打包下载'],
        ['pdfjs-dist', '5.5', '芯片 PDF Datasheet 文本提取'],
      ]
    ),
    spacer(10),
    heading2('4.3 AI 调用层'),
    para('统一的 callAI() 客户端根据服务商类型自动选择协议：OpenAI 使用 Responses API（/v1/responses），其余服务商使用标准 Chat Completions API（/v1/chat/completions）。支持流式输出（streaming），AI 问答面板实时显示生成内容。temperature 参数按用途精细调节：方案生成 0.2、代码生成 0.15、流程图 0.2、自检 0.1。', { after: 160 }),
    heading2('4.4 数据持久化'),
    makeTable(
      ['Store', '存储键', '持久化内容'],
      [
        ['projectStore', 'metacore-project-state', '当前活跃项目（方案/代码/流程图）'],
        ['projectsStore', 'metacore-projects', '所有项目列表'],
        ['aiConfigStore', 'metacore-ai-config', 'AI 服务配置和 API Key'],
        ['chipStore', 'metacore-chips', '用户自定义芯片规格'],
        ['settingsStore', 'metacore-settings', '全局偏好（一键生成开关等）'],
        ['themeStore', '（内存）', '暗色/亮色主题'],
      ]
    ),
    spacer(20),
    pageBreak(),
  ]
}

// ═══════════════════════════════════════════════════════
// 第六章：芯片与驱动生态
// ═══════════════════════════════════════════════════════
function buildEcosystem() {
  return [
    heading1('五、芯片与驱动生态'),
    heading2('5.1 预置芯片规格库'),
    para('平台内置 5 款主流芯片的完整技术规格，每款芯片包含 GPIO 引脚列表（含复用功能、仅输入标记、特殊说明）、外设总线默认引脚、启动受限引脚和关键限制条件。这些数据在 AI 生成方案时注入 prompt，使 AI 能够准确分配引脚、避免冲突。', { after: 120 }),
    makeTable(
      ['芯片', '架构', 'Flash', 'SRAM', '主频', '可用 GPIO'],
      [
        ['ESP32-WROOM-32', 'Xtensa LX6 双核', '4MB', '520KB', '240MHz', '26 个'],
        ['ESP32-S3-WROOM-1', 'Xtensa LX7 双核', '16MB', '512KB+8MB PSRAM', '240MHz', '33 个'],
        ['STM32F103C8T6', 'ARM Cortex-M3', '64KB', '20KB', '72MHz', '37 个'],
        ['STM32F407VGT6', 'ARM Cortex-M4+FPU', '1MB', '192KB', '168MHz', '80+ 个'],
        ['STM32F103-KIT', 'ARM Cortex-M3', '64KB', '20KB', '72MHz', '开发板引出引脚'],
      ]
    ),
    spacer(10),
    heading2('5.2 自定义芯片三模式'),
    makeTable(
      ['模式', '操作方式', '适用场景'],
      [
        ['AI 识图', '上传芯片 PDF Datasheet，AI 自动提取参数', '有官方 Datasheet，想快速录入'],
        ['AI 助填', 'AI 基于 PDF 预填表单，用户手动微调', '需要在 AI 基础上精确调整'],
        ['手动配置', '4 步分步表单，完全手动填写', '无 PDF 或需要完全自定义'],
      ]
    ),
    spacer(10),
    para('自定义芯片录入后自动加入芯片选择列表，技术规格同样会注入 AI 方案生成流程，与预置芯片享有相同的精准度保障。', { after: 160 }),
    pageBreak(),
  ]
}

// ═══════════════════════════════════════════════════════
// 第七章：差异化竞争优势
// ═══════════════════════════════════════════════════════
function buildDiff() {
  return [
    heading1('六、差异化竞争优势'),
    heading2('6.1 竞品对比'),
    makeTable(
      ['对比维度', 'MetaCore AI', '传统 IDE', 'ChatGPT/通用 AI', 'Cursor/Copilot'],
      [
        ['引脚约束', '✅ 芯片规格数据库约束，绝不分配冲突引脚', '❌ 需手动查手册', '⚠️ 易产生幻觉引脚', '❌ 无硬件约束'],
        ['驱动代码', '✅ 8 个验证驱动，可直接上板编译', '❌ 需自行编写', '⚠️ 代码质量不稳定', '⚠️ 泛用代码，不保证可编译'],
        ['全链路', '✅ 方案→代码→流程图→导出一体化', '❌ 仅代码编辑', '❌ 仅文本生成', '❌ 仅代码补全'],
        ['BOM 清单', '✅ 自动生成含参考价格', '❌ 无', '⚠️ 需手动整理', '❌ 无'],
        ['SVG 引脚图', '✅ 自动渲染，悬停交互', '❌ 需专用 EDA 工具', '❌ 无', '❌ 无'],
        ['数据安全', '✅ 全本地，API Key 不离开浏览器', '✅ 本地', '❌ 数据上传云端', '❌ 数据上传云端'],
        ['部署成本', '✅ 纯静态，零服务器成本', '—', '订阅费用', '订阅费用'],
      ]
    ),
    spacer(10),
    heading2('6.2 核心技术壁垒'),
    bullet('芯片知识库：5 款主流芯片完整规格，GPIO 引脚、外设总线、启动限制全量录入，AI 约束有据可查'),
    bullet('硬件约束 Prompt 工程：精心设计的 system prompt 将芯片规格注入 AI 上下文，引脚分配遵循硬性规则，可验证可审查'),
    bullet('驱动模板库：8 个经实际硬件验证的驱动，含完整 .c/.h 实现和 main 调用示例，生成代码直接可编译'),
    bullet('自检闭环：代码生成后自动发起一致性验证，AI 审查引脚编号、I2C 地址等关键项，主动发现潜在错误'),
    bullet('全链路整合：方案→代码→流程图→导出在单一平台完成，信息全程同步，无工具切换损耗'),
    spacer(20),
    pageBreak(),
  ]
}

// ═══════════════════════════════════════════════════════
// 第八章：产品完成度与版本历程
// ═══════════════════════════════════════════════════════
function buildHistory() {
  return [
    heading1('七、产品完成度与版本历程'),
    heading2('7.1 v1.5.6 功能完成情况'),
    makeTable(
      ['功能模块', '完成状态', '说明'],
      [
        ['硬件方案生成', '✅ 已完成', '引脚分配 / BOM / 接线表，芯片规格约束'],
        ['SVG 引脚可视化', '✅ 已完成', '双主题，悬停交互，表格/图形双视图'],
        ['工程代码生成', '✅ 已完成', '4 种格式，模块化，AI 自检'],
        ['代码执行流程图', '✅ 已完成', 'ReactFlow 可交互，分类着色节点'],
        ['AI 问答助手', '✅ 已完成', '项目上下文注入，流式输出'],
        ['芯片管理', '✅ 已完成', '5 种预置 + 三模式自定义'],
        ['驱动模板库', '✅ 已完成', '8 个验证驱动，自动匹配 + 手动预选'],
        ['一键式流水线', '✅ 已完成', '方案→代码→流程图全自动，状态持久化'],
        ['ZIP 导出', '✅ 已完成', '完整工程目录结构'],
        ['PDF 导出', '✅ 已完成', '专业排版，内置中文字体'],
        ['多项目管理', '✅ 已完成', '本地持久化，跨会话保存'],
        ['多 AI 服务商', '✅ 已完成', '5 家服务商 + 本地 Ollama'],
        ['暗色/亮色主题', '✅ 已完成', '全组件适配'],
      ]
    ),
    spacer(10),
    heading2('7.2 版本演进历程'),
    makeTable(
      ['版本', '主要里程碑'],
      [
        ['v1.0', '基础方案生成，ESP32 单芯片支持，简单引脚表输出'],
        ['v1.1', '新增代码生成功能，支持 ESP-IDF 格式'],
        ['v1.2', '新增 ReactFlow 流程图，支持 Arduino/PlatformIO 格式'],
        ['v1.3', '新增芯片管理模块，支持自定义芯片，PDF 导出'],
        ['v1.4', '新增驱动模板库（SSD1306/DHT），AI 问答助手'],
        ['v1.5', '驱动库扩展至 8 个，STM32CubeIDE 格式，外设库页面'],
        ['v1.5.6', '修复驱动预选持久化 Bug，新增一键式生成流水线'],
      ]
    ),
    spacer(20),
    pageBreak(),
  ]
}

// ═══════════════════════════════════════════════════════
// 第九章：产品路线图
// ═══════════════════════════════════════════════════════
function buildRoadmap() {
  return [
    heading1('八、产品路线图'),
    heading2('8.1 近期规划（v2.0）'),
    bullet('原理图自动生成：基于硬件方案输出 KiCad / EasyEDA 格式原理图文件'),
    bullet('芯片生态扩展：新增 ESP32-C3、ESP32-C6、RP2040、nRF52840 等热门芯片'),
    bullet('驱动模板扩展：MPU6050 六轴传感器、NRF24L01 无线模块、OLED 中文字库、MAX98357 音频 DAC 等'),
    bullet('代码质量提升：生成代码支持 FreeRTOS 任务模式，MQTT 连接模板'),
    spacer(5),
    heading2('8.2 中期规划（v2.x）'),
    bullet('云端项目同步：可选云端备份，支持多设备访问同一项目'),
    bullet('团队协作功能：项目共享、评论、版本对比'),
    bullet('OTA 固件升级代码生成：一键生成 OTA 更新逻辑'),
    bullet('更多 AI 服务商：支持 Claude、Gemini、本地 LLM（LM Studio）'),
    spacer(5),
    heading2('8.3 远期愿景'),
    bullet('完整 EDA 工具链集成：从需求到 PCB 打样的全链路 AI 辅助'),
    bullet('硬件设计知识库：社区驱动的芯片规格和驱动模板共享平台'),
    bullet('CI/CD 集成：与 GitHub Actions 集成，自动触发固件编译和测试'),
    spacer(20),
    pageBreak(),
  ]
}

// ═══════════════════════════════════════════════════════
// 第十章：快速开始
// ═══════════════════════════════════════════════════════
function buildQuickStart() {
  return [
    heading1('九、快速开始与部署'),
    heading2('9.1 环境要求'),
    bullet('Node.js >= 18'),
    bullet('npm >= 9（或 pnpm / yarn）'),
    bullet('现代浏览器（Chrome / Edge / Firefox / Safari）'),
    spacer(5),
    heading2('9.2 本地开发'),
    para('克隆项目后执行以下命令：', { after: 80 }),
    para([txt('npm install', { font: 'Courier New', size: 20, color: COLOR.primary })], { after: 60, indent: 0.3 }),
    para([txt('npm run dev', { font: 'Courier New', size: 20, color: COLOR.primary })], { after: 120, indent: 0.3 }),
    para('Windows 用户可直接双击 start.bat，自动检测依赖、安装缺失包并打开浏览器。', { after: 120 }),
    heading2('9.3 生产部署'),
    para([txt('npm run build', { font: 'Courier New', size: 20, color: COLOR.primary })], { after: 80, indent: 0.3 }),
    para('将生成的 dist/ 目录部署到任意静态服务器即可，支持 GitHub Pages、Nginx、Cloudflare Pages、阿里云 OSS 等。', { after: 120 }),
    heading2('9.4 配置 AI 服务（5 步）'),
    bullet('打开「设置」页面'),
    bullet('选择服务商（推荐 DeepSeek，性价比高）'),
    bullet('填入 API Key'),
    bullet('点击「测试连接」验证'),
    bullet('点击「设为活跃」，即可开始使用'),
    spacer(5),
    heading2('9.5 五分钟上手示例'),
    makeTable(
      ['步骤', '操作'],
      [
        ['1', '在「方案」页输入：做一个温湿度监控仪，OLED 显示数据，WiFi 上报到服务器'],
        ['2', '选择芯片：ESP32，格式：ESP-IDF'],
        ['3', '开启「一键生成」开关，点击「一键生成」'],
        ['4', '等待约 30-60 秒，自动完成方案→代码→流程图三步'],
        ['5', '在「代码」页点击「下载 ZIP」，导入 VS Code + ESP-IDF 插件直接编译'],
      ]
    ),
    spacer(20),
    pageBreak(),
  ]
}

// ═══════════════════════════════════════════════════════
// 第十一章：开源贡献 & 免责声明
// ═══════════════════════════════════════════════════════
function buildContrib() {
  return [
    heading1('十、开源贡献指南'),
    heading2('10.1 如何添加新驱动模板'),
    para('在 src/data/driverTemplates.ts 中按照 DriverTemplate 接口定义新驱动，填写 id、name、interface、matchKeywords（用于 BOM 自动匹配）和各框架的 templates（header/source/usage 三部分代码）。', { after: 120 }),
    heading2('10.2 如何添加新预置芯片'),
    para('在 src/data/chipSpecs.ts 的 CHIP_SPECS 对象中按照 ChipSpec 接口添加新条目，填写完整的 GPIO 列表、外设总线默认引脚、启动限制引脚和约束条件，同时在 src/types/hardware.ts 的 PRESET_CHIPS 数组中加入芯片名称。', { after: 120 }),
    heading2('10.3 Issue 与 PR 指引'),
    bullet('Bug 报告：请附上复现步骤、浏览器版本、AI 服务商信息'),
    bullet('功能建议：描述使用场景和期望效果'),
    bullet('PR：新功能请先提 Issue 讨论，驱动模板和芯片规格 PR 优先合并'),
    spacer(20),
    heading1('十一、免责声明'),
    para('1. AI 生成内容：所有硬件方案、代码、流程图均由 AI 自动生成，仅供学习和参考。生成结果的准确性与所选 AI 模型性能及芯片参数完整度直接相关。用户在实际应用前应自行验证准确性和安全性。', { after: 100 }),
    para('2. 价格信息：BOM 清单中的价格均为 AI 预估参考价，不构成任何报价承诺，请以实际询价为准。', { after: 100 }),
    para('3. 安全与合规：生成内容未经安全认证或合规审查。用于商业产品、医疗设备、车载系统等安全关键领域前，必须进行专业评审。', { after: 100 }),
    para('4. 数据隐私：所有数据保存在用户本地浏览器中，平台不收集、存储或处理任何用户数据。AI 调用直接发送至用户配置的服务商，用户应自行评估其数据隐私政策。', { after: 100 }),
    para('5. 知识产权：AI 生成的代码和方案归用户所有，但可能无意中包含与第三方知识产权相似的部分，用户在商业使用前应自行审查。', { after: 200 }),
    spacer(20),
    new Paragraph({
      children: [txt('© 2026 Leo. All rights reserved.', { size: 20, color: COLOR.muted })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 }
    }),
  ]
}

// ═══════════════════════════════════════════════════════
// 组装文档并生成
// ═══════════════════════════════════════════════════════
async function main() {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT.cn, size: 22, color: COLOR.body },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1.0),
            bottom: convertInchesToTwip(1.0),
            left:   convertInchesToTwip(1.2),
            right:  convertInchesToTwip(1.2),
          }
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                txt('MetaCore AI  项目计划书  |  v1.5.6', { size: 18, color: COLOR.muted }),
              ],
              alignment: AlignmentType.RIGHT,
              border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR.border, space: 4 } },
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                txt('© 2026 Leo  |  MetaCore AI v1.5.6', { size: 16, color: COLOR.muted }),
              ],
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 2, color: COLOR.border, space: 4 } },
            })
          ]
        })
      },
      children: [
        ...buildCover(),
        ...buildProblem(),
        ...buildSolution(),
        ...buildFeatures(),
        ...buildArch(),
        ...buildEcosystem(),
        ...buildDiff(),
        ...buildHistory(),
        ...buildRoadmap(),
        ...buildQuickStart(),
        ...buildContrib(),
      ]
    }]
  })

  const buffer = await Packer.toBuffer(doc)
  writeFileSync('MetaCore_AI_项目计划书.docx', buffer)
  console.log('✅ 已生成：MetaCore_AI_项目计划书.docx')
}

main().catch(e => { console.error('生成失败：', e); process.exit(1) })
