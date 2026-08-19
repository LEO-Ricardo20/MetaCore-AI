# MetaCore Studio 产品工作流

本文描述 MetaCore Studio 2.2 的项目生命周期、页面信息架构、状态机、产物依赖和恢复行为。实现以 `src/types/project.ts`、`src/services/projects/projectLifecycle.ts` 与 `src/store/projectStore.ts` 为准。

## 产品定位

MetaCore Studio 不再把需求、代码、流程图和本地分析视为互不相关的工具页，而是把它们组织为同一个嵌入式项目的连续研发过程：

```text
项目创建
  -> 需求澄清
  -> 硬件设计
  -> 设计审查
  -> 固件实现
  -> 代码与硬件一致性验证
  -> 本地工程分析
  -> 构建验证
  -> 发布检查
  -> 导出
```

项目、阶段、产物和后台任务分别建模，避免使用多个互不关联的布尔值推导整个应用状态。

## 五个一级板块

| 板块 | 主路由 | 职责 |
| --- | --- | --- |
| 工作台 | `/workspace` | 当前项目、阶段、产物新鲜度、连接状态、最近项目和下一步操作 |
| 设计 | `/design/*` | 需求、芯片、外设、方案、引脚、BOM、接线和设计审查 |
| 实现 | `/implementation/*` | 固件生成、文件树、Monaco 编辑、版本信息、一致性状态和导出 |
| 验证 | `/verification/*` | 一致性、流程图、本地分析、构建、安全和发布门禁 |
| 项目 | `/projects` | 项目列表、切换、导入、导出和删除 |

设置、帮助、关于、主题切换、AI 服务状态与 localhost 服务状态位于侧边栏系统区域，不再与研发流程平级。

旧路由继续兼容：

| 旧路由 | 新路由 |
| --- | --- |
| `/requirement` | `/design/requirements` |
| `/codegen` | `/implementation/code` |
| `/flow` | `/verification/flow` |
| `/local` | `/verification/local` |
| `/chips` | `/design/chips` |
| `/drivers` | `/design/peripherals` |

## 项目主状态

`Project.currentStage` 使用以下状态：

| 状态 | 含义 |
| --- | --- |
| `draft` | 项目已创建，但需求尚未就绪 |
| `requirements-ready` | 已有可继续处理的需求 |
| `planning` | 正在生成或调整设计方案 |
| `design-review` | 方案、引脚、BOM 或接线进入审查 |
| `implementation` | 正在生成或修改固件 |
| `verification` | 正在执行一致性、流程、本地分析或构建验证 |
| `ready-to-export` | 必要门禁通过，可导出或发布 |
| `failed` | 当前流程失败，需要重试或返回修改输入 |
| `cancelled` | 用户取消当前流程 |

旧项目没有 `currentStage` 时，迁移逻辑会根据已有需求、方案、代码和流程图推断阶段。

## 阶段运行状态

每个 Pipeline 阶段使用统一的 `StageRunStatus`：

- `idle`：尚未进入任务。
- `waiting`：已排队，等待执行。
- `running`：正在执行。
- `succeeded`：执行成功。
- `failed`：执行失败，可根据错误和重试策略处理。
- `cancelled`：用户取消或 AbortSignal 中止。
- `skipped`：从后续阶段继续时，之前阶段被明确跳过。

每个阶段可以保存进度、当前操作、开始/结束时间、服务商、模型、Prompt 版本、Token 使用量、重试次数、稳定错误码、原始响应、结构化结果和验证结果。项目归档会主动移除原始 AI 响应和 Session 引用，避免把诊断数据或敏感上下文带入可移植文件。

## 一键流水线

统一阶段顺序为：

1. `requirements`
2. `clarification`
3. `scheme-generation`
4. `scheme-validation`
5. `code-generation`
6. `code-validation`
7. `flow-generation`
8. `local-analysis`
9. `build`
10. `release-check`

`ProjectRun` 保存一次流水线运行，`PipelineStageState` 保存每一步的状态。前端 Store 支持：

- 从指定阶段创建新运行。
- 更新阶段进度和诊断字段。
- 取消当前运行。
- 对失败或取消的运行执行重试。
- 将指定阶段之前的步骤标为 `skipped`，从中间继续。

localhost Job Runtime 同时提供后台 Job、取消、重试与 SSE 事件。当前前端一键生成已记录 ProjectRun；完整的十阶段可视化编排仍需逐步把所有页面动作统一切换到后台 Job API。

## 产物模型

核心产物为：

- `requirements`
- `scheme`
- `pinMap`
- `bom`
- `wiring`
- `code`
- `flow`
- `localAnalysis`
- `consistencyReport`
- `buildResult`
- `releaseReport`

每个产物都有独立的状态和版本号：

| 状态 | 含义 |
| --- | --- |
| `missing` | 尚未生成 |
| `generating` | 正在生成 |
| `fresh` | 与当前上游输入一致 |
| `stale` | 上游已变化，当前结果不能继续视为有效 |
| `validating` | 正在验证 |
| `valid` | 验证通过 |
| `invalid` | 验证失败 |

`stale` 产物不得显示为“已通过”。质量门禁会优先显示 stale 或 invalid 状态。

## Stale 传播规则

| 变化来源 | 被标记为 stale 的下游产物 |
| --- | --- |
| 需求或驱动变化 | 方案、引脚、BOM、接线、代码、流程、本地分析、一致性报告、构建、发布报告 |
| 目标芯片变化 | 方案、引脚、BOM、接线、代码、流程、本地分析、一致性报告、构建、发布报告 |
| 工程格式变化 | 代码、流程、一致性报告、构建、发布报告 |
| 硬件方案变化 | 代码、流程、一致性报告、构建、发布报告 |
| 引脚映射变化 | 代码、流程、一致性报告、构建、发布报告 |
| 代码变化 | 流程、一致性报告、构建、发布报告 |
| 本地文件变化 | 本地分析、构建、发布报告 |

规则只把已经存在的下游产物标记为 stale；从未生成的产物继续保持 `missing`。

## 项目创建、更新与版本

生成行为由 `ensureProject(input, mode)` 统一处理：

- `update-current`：存在当前项目时更新当前项目；不存在时创建第一个项目。
- `new-project`：用户明确要求另存为新项目时创建独立项目记录。
- `new-version`：复制当前项目为新版本，并在版本历史中记录来源、方案版本和代码版本。

因此，重复点击生成不会因为每次调用 `createProject` 而产生重复项目。只有显式“新项目”或“新版本”操作才新增记录。

## 失败、取消与恢复

前端 ProjectRun 和 localhost Job 使用同一组核心语义：

- 取消会触发 AbortSignal，并将运行或 Job 标记为 `cancelled`。
- AbortError 不作为普通业务错误显示。
- 失败状态保存稳定错误码和错误信息。
- 重试会增加 `retryCount`，清除上次错误并重新排队。
- 从指定阶段继续时，之前的阶段保持历史记录或显式标记为 `skipped`。
- 已成功、失败或取消的 Job 不会继续写入结果；具体文件写入仍必须经过工具权限、审批、路径检查、备份与冲突检查。

当前 Job 队列和 EventBus 保存在服务进程内存中；Session 元数据和 JSONL trajectory 会持久化。服务重启后可读取 Session 元数据，但尚未恢复内存中的 Job 队列或重放历史 SSE 事件。

## 质量门禁

项目级 `validation.status` 支持：

- `unchecked`
- `running`
- `warning`
- `error`
- `passed`
- `stale`

验证工作区按一致性、流程、本地分析、构建、安全和发布检查组织。结构化一致性问题可以携带：

- 严重等级与分类。
- 文件路径和真实行号。
- 问题描述与证据。
- 期望值和实际值。
- 修复建议。

当前流程图和本地分析页继续复用原有完整能力；构建、安全和发布页已接入统一门禁状态面板，后续可以继续把现有本地构建操作拆入对应专用 Tab。

## AI 审批和文件修改

读操作可在授权工作区内执行。写文件、恢复备份和运行构建属于高风险工具：

1. 工具声明权限和 `requiresApproval`。
2. Tool Pipeline 验证参数、权限和工作区。
3. 未批准时返回 `TOOL_APPROVAL_REQUIRED`。
4. 获得批准后执行安全文件操作或白名单构建。
5. 写入前比较修改时间并创建备份。
6. 记录脱敏后的工具事件和操作日志。

Tool Registry 已实现审批策略与事件，但前端“显示 diff -> 用户批准 -> 写入 -> 重新验证”的完整审批面板仍是后续工作，当前不会把该能力描述为已经完成。

## 持久化与兼容

- Zustand 存储键继续使用 `metacore-projects`。
- Store 持久化版本为 2，旧项目通过 `normalizeProject` 补齐生命周期字段。
- 浏览器已有项目不会因升级被清空。
- `.metacore.json` 外层归档 `schemaVersion` 继续保持 1。
- 归档内部项目使用 Project Schema v2，并可迁移旧项目字段。
- API Key、AI 服务配置、本地工作区、Session 路径、原始响应和日志不会进入项目归档。

## 使用建议

1. 在设置中配置并测试 AI 服务。
2. 在设计工作区填写需求、选择芯片和工程格式。
3. 生成方案并审查引脚、BOM、接线、假设和风险。
4. 在实现工作区生成或编辑固件。
5. 运行一致性验证；如果上游变化，先处理 stale 产物。
6. 在验证工作区运行流程图、本地分析和构建。
7. 处理阻塞问题后执行发布检查。
8. 导出 ZIP、PDF 或 `.metacore.json` 归档。
