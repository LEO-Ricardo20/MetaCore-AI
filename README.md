# MetaCore Studio

[简体中文](./README.md) | [English](./README_EN.md)

<p align="center">
  <img src="./public/logo.svg" alt="MetaCore Studio logo" width="96" />
</p>

> 面向 ESP32、STM32 与自定义芯片的 AI 硬件架构、固件生成和本地嵌入式工程分析平台。

[![React](https://img.shields.io/badge/React-18-149eca?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![Node](https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Version](https://img.shields.io/github/package-json/v/LEO-Ricardo20/MetaCore-Studio?label=version&color=16a34a)](#版本状态)
[![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-lightgrey)](#许可证)

MetaCore Studio 将自然语言硬件需求转化为以项目生命周期为中心的嵌入式研发流程：

```text
项目创建 -> 需求澄清 -> 硬件设计 -> 固件实现 -> 一致性验证 -> 本地诊断 -> 构建验证 -> 发布检查 -> 导出
```

浏览器应用负责产品界面和 AI 工作流；localhost 服务负责 AI 代理、本地工作区分析、安全文件操作、备份和构建验证。

## 目录

- [功能亮点](#功能亮点)
- [产品工作流](#产品工作流)
- [系统架构](#系统架构)
- [版本状态](#版本状态)
- [赞助支持](#赞助支持)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [本地工程模式](#本地工程模式)
- [AI 服务](#ai-服务)
- [后台任务与 Agent Runtime](#后台任务与-agent-runtime)
- [典型使用流程](#典型使用流程)
- [示例工程](#示例工程)
- [常用命令](#常用命令)
- [项目结构](#项目结构)
- [安全边界](#安全边界)
- [测试](#测试)
- [版本规范](#版本规范)
- [更新日志](#更新日志)
- [故障排查](#故障排查)
- [已知限制](#已知限制)
- [参与贡献](#参与贡献)
- [GitHub 协作文件](#github-协作文件)
- [许可证](#许可证)

## 功能亮点

| 模块 | 能力 |
| --- | --- |
| 硬件方案 | 芯片选择、GPIO 分配、BOM、接线表和引脚可视化 |
| 固件生成 | 为 Arduino、PlatformIO、ESP-IDF 和 STM32CubeIDE 生成模块化 C/C++ 工程 |
| 外设驱动库 | 内置 SSD1306、DHT、AHT20、WS2812、HC-SR04、蜂鸣器、舵机和 DRV8833 模板 |
| AI 一致性检查 | 生成代码后自动检查代码与硬件方案是否一致 |
| 流程图可视化 | 根据工程代码生成可交互执行流程图，并提供 AI 工程问答 |
| 自定义芯片 | 支持数据手册解析、AI 辅助填写和手动芯片参数配置 |
| 本地工程诊断 | 目录浏览、全文搜索、代码预览、静态分析、健康评分和诊断报告 |
| 安全文件操作 | 用户确认后写入、修改时间冲突检测、自动备份和恢复 |
| 构建验证 | 检测并运行白名单内的 PlatformIO、ESP-IDF 和 CMake 构建 |
| 项目导出 | 导出 ZIP 固件工程和格式化 PDF 设计文档 |
| 项目迁移 | 导入、导出经过校验的 `.metacore.json` 项目归档，不包含 API Key |
| 项目生命周期 | 统一的阶段、产物 freshness、版本、运行记录、取消和重试 |
| Agent Runtime | localhost Job、SSE 事件、Session trajectory、工具权限和审批策略 |

## 产品工作流

应用打开后进入 `/workspace` 工作台，研发流程收敛为五个一级板块：

1. `工作台`：查看当前项目、阶段、产物状态、连接状态和下一步动作。
2. `设计`：需求、芯片、外设、方案、引脚、BOM、接线和设计审查。
3. `实现`：固件生成、文件树、Monaco、代码状态、版本和导出。
4. `验证`：一致性、流程图、本地分析、构建、安全和发布检查。
5. `项目`：项目切换、导入、导出和删除。

当前项目使用 Project Schema v2 和明确的 `ProjectStage`。需求、方案、引脚、代码、流程、本地分析、构建和发布检查都作为带版本的 Artifact 保存；上游变化会把下游结果标为 `stale`，过期结果不能继续显示为已通过。

完整状态机、stale 传播规则和恢复行为见 [`docs/PRODUCT_WORKFLOW.md`](docs/PRODUCT_WORKFLOW.md)。

## 系统架构

```mermaid
flowchart LR
    User[用户] --> Web[React + TypeScript Web UI]
    Web --> Local[localhost 本地服务]
    Local --> AI[用户配置的 AI 服务商]
    Web -. 服务商允许 CORS 时回退 .-> AI
    Local --> Workspace[用户授权的工作区]
    Local --> Analyzer[嵌入式工程分析器]
    Local --> Backup[备份与恢复]
    Local --> Build[白名单构建工具]
    Analyzer --> Report[结构化诊断报告]
    Report --> Web
```

完整模式建议同时运行前端和 localhost 服务。AI 请求优先通过本地代理发送，从而减少浏览器 CORS 问题；只有服务商允许浏览器跨域访问时，客户端才可能回退到浏览器直连。

## 版本状态

当前版本：**v2.2.0**，发布日期为 `2026-08-17`。

2.2.0 将产品由 **MetaCore AI** 更名为 **MetaCore Studio**，同步更新应用界面、npm 包名、GitHub 仓库地址、文档、启动脚本、导出报告和示例内容。为保证无损升级，现有浏览器存储键、`.metacore.json` 项目归档、`.metacore-backups` 备份目录和 localhost API 路径保持兼容。

> [!IMPORTANT]
> MetaCore Studio 生成的是工程建议和参考代码，不是经过认证的量产硬件。请始终根据真实芯片手册和目标开发板复核引脚、电气限制、依赖和固件行为。

> [!CAUTION]
> 本地工作区可能包含源代码。只有用户主动发起 AI 分析时，相关上下文才会提交到所选服务商。不要选择包含私钥、生产凭据或无关个人数据的目录。

## 赞助支持

VPS.Town 是一家专注于 VPS 与云服务器服务的平台，为开发者、个人站长及项目团队提供稳定、灵活的云计算资源，适用于网站部署、应用托管、开发测试以及个人项目运行等场景。感谢 VPS.Town 对 MetaCore Studio 项目开发与开源工作的支持。

<a href="https://vps.town/" target="_blank" rel="noreferrer">
  <img src="./public/sponsor.png" alt="VPS.Town sponsor" width="900" />
</a>

- [访问 VPS.Town 官网](https://vps.town/)

## 环境要求

- Windows、macOS 或 Linux
- Node.js 20.19 或更高版本
- npm 9 或更高版本
- 使用 AI 生成或 AI 诊断时，需要一个兼容的 AI 服务
- 只有进行本地构建验证时，才需要 PlatformIO、ESP-IDF 或 CMake

## 快速开始

### 完整模式

```bash
git clone https://github.com/LEO-Ricardo20/MetaCore-Studio.git
cd MetaCore-Studio
npm ci
```

分别启动本地服务和前端：

```bash
# 终端 1
npm run dev:server

# 终端 2
npm run dev
```

Vite 通常会输出 `http://127.0.0.1:5173` 或 `http://localhost:5173`。

Windows 用户可以直接双击：

```text
start-local.bat
```

### 仅浏览器模式

```bash
npm run dev
```

仅浏览器模式可以使用基础界面和不依赖本地文件的功能，但 AI 服务可能受到浏览器 CORS 限制，`本地`工作区页面也无法使用。

## 本地工程模式

本地服务监听 `127.0.0.1:3766`，Web UI 通常监听 `127.0.0.1:5173`。

打开`本地`页面，设置工作区路径并点击`扫描`。分析器可以识别：

- PlatformIO、ESP-IDF、Arduino、STM32CubeIDE 和 CMake 工程
- ESP32、ESP32-S3、ESP32-C3、STM32F103 和 STM32F4 相关代码
- GPIO 定义和常见引脚调用
- DHT、OLED、WS2812、舵机、电机、I2C、SPI 和 UART 线索
- Wi-Fi、MQTT、HTTP、WebSocket、BLE、LoRa、Zigbee、Modbus 和 CoAP 线索
- `#include` 依赖和 PlatformIO `lib_deps`
- 代码规模、语言分布和注释比例
- 硬编码凭据和明文网络端点

服务不会把当前工作区暴露到公网。文件写入需要用户确认，并会在修改前创建备份。

本地 API 说明见 [`docs/LOCAL_API.md`](docs/LOCAL_API.md)。

## AI 服务

在`设置`页面配置 AI 服务。当前支持：

- DeepSeek
- 硅基流动
- 通义千问
- OpenAI Responses API
- Ollama 本地模型
- 自定义 OpenAI 兼容服务

自定义服务可以选择：

- Responses API
- Chat Completions API

`autobits.cc` 类型的 CCH 服务会自动使用 Responses API。其他中转平台应以其官方文档和 `/models` 返回结果为准。

当前实现将 API Key 保存到浏览器 `localStorage`。浏览器存储不属于 Git 工作区，不会被 `git add`、commit 或 push 上传。localhost 服务只把 Key 转发给用户配置的目标服务商，不会持久化 Key，也不会把 Key 写入操作日志。

当前不提供公共云端 AI API。未来供应商接入应实现现有适配器的 `call` 和 `listModels` 契约，并在独立云端服务中处理登录、权限、限流和费用控制；不得把供应商密钥提交到本仓库。

不要在共享浏览器配置中保存正式凭据。交接电脑前应清除网站数据，不要把真实 Key 放进源码、截图、Issue、日志或导出配置。

## 后台任务与 Agent Runtime

localhost 服务默认使用 `METACORE_AGENT_RUNTIME=internal`。该运行时是 MetaCore Studio 内部的 Harness-inspired 实现，提供静态 Plugin Registry、Service Provider、Tool Policy、Job 队列、取消、重试、SSE 事件和独立 Session trajectory。

可用接口包括：

```text
POST /api/sessions
GET  /api/sessions/:id
GET  /api/sessions/:id/events
POST /api/jobs
GET  /api/jobs/:id
GET  /api/jobs/:id/events
POST /api/jobs/:id/cancel
POST /api/jobs/:id/retry
GET  /api/agent/plugins
```

Job 默认最多并发 2 个，Session 和操作日志默认写入操作系统用户数据目录，不写入工程目录。写文件、恢复备份和构建仍需要服务端权限、工作区检查、备份、修改时间冲突检查和白名单约束。

当前没有实际 DeepSeek Harness adapter。`METACORE_AGENT_RUNTIME=deepseek-harness` 只是未来适配方向，不能当作已经接入的运行时。详细边界见 [`docs/AGENT_ARCHITECTURE.md`](docs/AGENT_ARCHITECTURE.md) 和 [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md)。

## 典型使用流程

1. 打开`设置`，配置并测试 AI 服务。
2. 从`工作台`进入`设计/需求`，填写硬件需求、目标芯片和工程格式。
3. 生成硬件方案，检查引脚图、BOM、接线、电源约束和风险。
4. 在`实现`中生成固件代码，确认方案版本、代码状态和一致性结果。
5. 在`验证`中查看流程图，运行本地工程分析和白名单构建。
6. 处理 stale、警告和阻塞错误，执行发布前检查。
7. 导出 ZIP 工程、PDF 设计文档或 `.metacore.json` 项目归档。
8. 可选：在`项目`中切换、导入、另存为新版本或删除项目。

## 示例工程

仓库内包含一个用于本地分析的 PlatformIO 示例：

[`examples/esp32-smart-environment`](examples/esp32-smart-environment/)

示例包含 ESP32、Wi-Fi、MQTT、DHT22、SSD1306、I2C、GPIO、依赖识别和 PlatformIO 构建检测。连接真实硬件前，请替换示例网络配置。

真实工程浏览器 smoke 会打开验证工作区、点击“扫描”，确认 PlatformIO、ESP32、Wi-Fi、MQTT、SSD1306、DHT、I2C、UART 和真实 GPIO 证据能够显示，然后通过白名单构建入口执行 PlatformIO 固件构建并确认 `SUCCESS`。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 Vite 前端 |
| `npm run dev:server` | 启动 localhost 本地工程和 AI 代理服务 |
| `npm run lint` | 检查 TypeScript、React Hooks、浏览器和 Node.js 代码规范 |
| `npm run typecheck` | 运行 TypeScript 严格类型检查 |
| `npm run test` | 运行前端服务和 AI 数据校验单元测试 |
| `npm run build` | 运行 TypeScript 检查并构建生产版本 |
| `npm run preview` | 使用 Vite 预览生产构建 |
| `npm run test:local` | 运行本地服务冒烟测试 |
| `npm run test:e2e` | 使用 Deterministic Mock Provider 验证生成、取消、重试和跨页面后台任务 |
| `npm run test:e2e:real` | 在真实 ESP32 示例工程中验证浏览器扫描和硬件证据展示 |
| `npm run verify:delivery` | 启动或复用本地服务，运行全部质量检查和两套浏览器 smoke |
| `npm run check` | 依次运行代码规范、类型、单元测试、本地服务测试和构建 |

## 项目结构

```text
src/
├── components/          # React UI、页面、编辑器、图表和本地工作区组件
├── data/                # 芯片规格、代码模板和驱动模板
├── services/            # AI、项目归档、PDF、导出和本地服务客户端
├── store/               # Zustand 单一项目状态与其他浏览器状态
├── types/               # 硬件、项目和 AI 服务领域类型
└── App.tsx              # HashRouter 路由
server/
├── index.mjs            # 本地服务组合入口、旧 API 兼容和路由
├── config.mjs           # 监听地址、限制和版本元数据
├── lib/http.mjs         # JSON、CORS、本机来源和请求体处理
├── security/            # 工作区真实路径安全边界
├── services/            # 可替换的 AI 服务商适配器
├── agent/               # Internal Agent Runtime、Job、Session、Tool 和事件
└── smoke-test.mjs       # 独立本地 API 冒烟测试
docs/
├── ARCHITECTURE.md      # 模块边界与依赖方向
├── PRODUCT_WORKFLOW.md  # 项目生命周期、阶段和 stale 规则
├── AGENT_ARCHITECTURE.md# Agent Runtime、Job、Session 和 Contract
├── SECURITY_MODEL.md    # localhost、工作区和凭据安全边界
├── LOCAL_API.md         # 本地服务 API、Job 和 SSE
└── PROJECT_FILES.md     # Project Schema v2 与归档兼容性
examples/
└── esp32-smart-environment/  # PlatformIO 分析示例
public/
├── fonts/               # PDF 导出字体
├── apple-touch-icon.png # Apple 设备主屏图标
├── logo.svg             # 项目 Logo 和浏览器图标
├── logo-64.png          # 浏览器 favicon 回退图标
└── sponsor.png          # VPS.Town 赞助横幅
.github/
├── ISSUE_TEMPLATE/      # GitHub Issue 表单
└── PULL_REQUEST_TEMPLATE.md
```

## 安全边界

完整威胁模型、工作区授权、路径校验、Agent 权限和已知缺口见 [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md)。

localhost 服务面向本地开发流程，不是通用远程文件服务器：

- 只绑定 `127.0.0.1`。
- 拒绝非本地浏览器来源。
- 所有路径都会规范化，并检查是否位于授权工作区内。
- 扫描会跳过 `.git`、`node_modules`、构建输出和备份目录。
- 文本读取和请求体均有大小限制。
- 保存文件前会比较原始修改时间，避免覆盖外部修改。
- 构建使用服务端固定配置，不接受任意命令或参数。
- 用户未主动发起 AI 分析时，AI 服务商不会收到本地文件内容。
- API Key 不写入仓库、本地服务配置或操作日志。

### 运行注意事项

- 备份写入所选工作区内的 `.metacore-backups`。
- 构建验证可能生成 `.pio`、`build` 等正常工具输出。
- 清除浏览器存储会删除浏览器内保存的项目和 AI 配置。
- 清除浏览器存储前，可在`项目`页面导出 `.metacore.json` 归档；归档不包含 API Key。
- 静态托管只能提供浏览器功能；本地工作区和 AI 代理仍需用户机器运行 `npm run dev:server`。
- API Key 不得提交到仓库或写入示例工程。

## 测试

运行完整交付检查：

```bash
npm run verify:delivery
```

单元测试会验证 AI 结果结构、项目单一状态、项目归档、流程图引用和生成文件路径安全；本地服务测试会创建临时 PlatformIO 风格工程，并验证工作区设置、目录读取、符号链接越界阻止、ESP32 和物联网协议识别、依赖提取、文件写入与备份、报告生成、构建配置检测、AI Chat Completions、Responses API、模型列表和上游错误处理。

当前改造新增覆盖项目生命周期迁移、Artifact stale 传播、Pipeline 取消/重试、AI Task Contract repair、上下文选择、Session/Job/SSE 顺序和日志脱敏。

`test:e2e` 使用明确标识的 Deterministic Mock Provider 验证 AI 编排状态机，不代表真实 DeepSeek 调用；`test:e2e:real` 使用仓库内 ESP32 工程验证真实本地分析页面和 PlatformIO 构建。其他工程的真实固件编译仍取决于本机 PlatformIO/ESP-IDF/CMake 工具链和依赖是否可用。

提交改动前运行生产构建：

```bash
npm run build
```

## 版本规范

MetaCore Studio 遵循[语义化版本](https://semver.org/lang/zh-CN/)：

- **主版本** `2.0.0`：不兼容的架构或工作流变化
- **次版本** `2.2.0`：向后兼容的新功能或品牌升级
- **修订版本** `2.0.1`：向后兼容的问题修复和文档调整

`package.json` 是应用版本的唯一来源。前端和 localhost 服务会在运行时读取该版本。发布脚本和更新日志应在同一个发布提交中同步更新。

## 更新日志

版本历史和迁移说明见 [`CHANGELOG.md`](CHANGELOG.md)。

## 故障排查

### AI 生成失败

- 确认`设置`页面已有测试成功并处于`使用中`的 AI 服务。
- 确认 `npm run dev:server` 正在运行。
- 检查 Base URL、模型名称和 API 协议。
- CCH / Codex / GPT-5.5 服务应使用 Responses API。
- 使用`读取模型`确认中转平台实际返回的模型 ID。
- Ollama 用户应启动 `ollama serve`，并确认模型已安装。
- `429` 表示服务商限流或繁忙；`503 No available providers` 表示中转平台没有可用上游通道。

### 本地页面显示服务离线

在项目目录执行：

```bash
npm run dev:server
```

然后在`本地`页面点击`刷新连接`。

### 构建配置不可用

工程标志文件可能存在，但对应工具不在 `PATH`。安装 PlatformIO、ESP-IDF 或 CMake 后，重新启动本地服务。

## 已知限制

- 静态分析基于规则，无法完整理解复杂宏、生成代码和所有条件编译路径。
- 引脚校验依赖识别到的芯片和本地知识库完整度。
- Arduino CLI 编译需要明确的开发板 FQBN，目前未作为自动构建配置开放。
- 生成的硬件设计和固件必须根据真实芯片手册和硬件进行复核。
- 本项目不能替代电气安全评审、安全审计和硬件在环测试。
- 大模型生成代码和复杂方案可能需要较长时间，具体取决于模型、服务商容量和输出规模。
- 当前 Agent Runtime 是内部 Harness-inspired 实现，不是 DeepSeek Harness 的实际集成；`deepseek-harness` 适配器仍未启用。
- Job 队列和 EventBus 仍在 localhost 进程内存中，服务重启后不会恢复 running Job 或重放历史 SSE；Session 元数据和 JSONL trajectory 会保留。
- 当前没有 capability token、请求速率保护或同一工作区写操作锁；服务只适合单用户本机 loopback 使用。
- 验证工作区的构建、安全和发布 Tab 当前以统一质量门禁面板呈现，完整的专用操作仍复用原本地工作区能力。
- PDF renderer 和 PDF worker 仍会生成较大的异步 chunk，构建会提示体积警告；这不影响功能，但后续可继续拆分依赖。
- `verify:delivery` 使用仓库内真实 ESP32 示例验证应用编排、工程扫描和 PlatformIO 固件构建；其他目标工程仍需单独准备对应工具链。

## 参与贡献

1. 创建独立功能分支。
2. UI 改动应保持 React、TypeScript、Tailwind 和 Zustand 的现有风格。
3. 本地文件系统操作必须保持在授权工作区安全边界内。
4. 修改服务端行为时，应添加或更新本地冒烟测试。
5. 提交 Pull Request 前运行 `npm run check`。

## GitHub 协作文件

- [贡献指南](CONTRIBUTING.md)：分支、提交、测试和 Pull Request 约定。
- [架构说明](docs/ARCHITECTURE.md)：前端、本地服务和依赖边界。
- [安全政策](SECURITY.md)：漏洞和 API Key 等敏感信息的处理方式。
- [行为准则](CODE_OF_CONDUCT.md)：参与公开协作时的基本要求。
- `.github/ISSUE_TEMPLATE/`：Bug 和功能请求表单。
- `.github/PULL_REQUEST_TEMPLATE.md`：Pull Request 检查清单。

## 许可证

当前仓库使用 **All Rights Reserved** 声明。源代码公开用于查看和协作，但目前未授予 OSI 认可的开源许可证。未经版权持有人许可，不得重新分发、重新授权或用于商业用途。完整文本见 [`LICENSE`](LICENSE)。

© 2026 Leo. All rights reserved.
