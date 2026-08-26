# MetaCore Studio Agent 架构

本文描述 `server/agent` 的运行时边界，以及它如何以 DeepSeek Harness `dsh-v0.1.1-rc.2` 作为可选执行引擎。服务默认选择 `deepseek-harness`；`internal` 仍作为兼容和无凭据回退运行时保留。

## 运行时选择

默认运行时：

```text
METACORE_AGENT_RUNTIME=deepseek-harness
```

`GET /api/health` 和 `GET /api/agent/runtime` 会返回当前选择及两个 Runtime 的就绪状态。DeepSeek Harness Runtime 使用 `@deepseek-ai/dsh-sdk-client` 启动旁边源码 checkout 的 `src/packaged-bin.ts`，通过 stdio JSON-RPC 驱动 Cordis；它不是远程 SaaS，也不是 Python SDK。

真实执行需要 Harness 源码依赖已经由 `pnpm install` 安装、`harness/cordis.yml` 可读取、设置页已有已验证的 DeepSeek 服务或本地服务环境存在 `DEEPSEEK_API_KEY`，并且 MetaCore 已授权一个工作区。

Harness 适配器保持可选，不能让 MetaCore Studio 的项目状态、安全文件操作和 Windows 支持依赖开发者预览版运行时。

## 模块结构

```text
server/agent/
├── errors.mjs     # 稳定错误码与错误响应规范化
├── events.mjs     # 内存事件总线与订阅
├── jobs.mjs       # 后台队列、并发、取消和重试
├── sessions.mjs   # Session 元数据、JSONL trajectory 和脱敏
├── context.mjs    # 服务端代码上下文选择
├── policy.mjs     # 工具权限、审批和取消策略
├── registry.mjs   # 静态 Plugin Registry
├── services.mjs   # Service Definition / Provider Registry
├── tools.mjs      # Tool Registry 与统一执行流水线
├── approvals.mjs  # 文件 Diff/构建审批与执行
└── runtime/       # Internal 与 DeepSeek Harness Runtime 适配器
└── index.mjs      # 模块导出
```

`server/index.mjs` 仍是 HTTP 组合入口和旧 API 兼容层，但 Agent 的注册表、Job、Session、事件、策略和错误模型已从路由逻辑中分离。

## 三层能力模型

### Service Definition

Service Definition 描述稳定能力标识、版本、请求和结果契约，不包含具体本地实现。当前注册的 `ai` Service 示例：

```text
id: ai
version: 1.0.0
request: messages
result: content+usage
```

### Service Provider

Provider 实现具体能力。当前 `ai/default` Provider 由 OpenAI-compatible 适配器实现，支持 Responses API 和 Chat Completions compatible API，并返回服务商、模型、耗时、usage 与上下文长度。

以后可以为同一个 Service 注册不同 Provider，例如本地模型、远程组织网关或 DeepSeek Harness Adapter。

### Consumer / Tool

Tool 面向 Agent 或前端暴露能力，只通过权限和稳定服务边界调用具体实现。当前实际注册的可执行工具为：

- `inspect_project`
- `read_file`
- `search_files`
- `run_local_analysis`
- `run_build`
- `write_file`
- `restore_backup`

Harness 侧通过 `harness/metacore-tools.mjs` 暴露一个受控子集：

- `inspect_project`
- `read_file`
- `search_files`
- `run_local_analysis`
- `validate_pin_assignment`
- `propose_file_change`
- `request_build`

Harness 不会直接挂载原始 shell 或 fs-local 插件。高风险工具只调用 MetaCore bridge 创建 `AgentApproval`，由用户在 UI 中批准后再调用已有 `write_file` 或 `run_build`。

静态插件 manifest 同时声明了方案、代码、验证、流程和导出等目标能力名，用于描述演进方向；`GET /api/agent/plugins` 返回的 `tools` 列表才是当前进程实际可执行的工具集合。

## Plugin Registry

当前使用静态注册表，不进行动态热加载。默认插件：

```json
{
  "id": "metacore.internal",
  "version": "1.0.0",
  "provides": ["ai", "workspace", "hardware-analysis", "firmware-generation", "build", "backup", "export"],
  "requires": [],
  "permissions": {
    "read": true,
    "write": true,
    "build": true,
    "export": true,
    "requiresApproval": true
  }
}
```

注册时会检查 `id`、`version`、`provides`、`requires`、`tools`、`permissions` 和 `lifecycleHooks`。重复插件 ID 返回稳定冲突错误。

## Tool Pipeline

所有工具通过统一执行流水线：

```text
tool.before
  -> 取消检查
  -> 参数校验
  -> 权限检查
  -> 审批检查
  -> 工作区检查
  -> tool.executing
  -> 执行 Service/Provider
  -> 取消检查
  -> 结果规范化
  -> tool.completed / tool.failed
```

权限维度包括 `read`、`write`、`build`、`export` 和 `requiresApproval`。未获得写入、构建或导出能力时分别返回 `TOOL_WRITE_FORBIDDEN`、`TOOL_BUILD_FORBIDDEN` 或 `TOOL_EXPORT_FORBIDDEN`；需要审批但未批准时返回 HTTP 428 和 `TOOL_APPROVAL_REQUIRED`。

Tool Pipeline 已提供后端审批门槛与 `tool.approval-required` 事件。Harness 的 Diff/构建审批由 `ApprovalStore` 管理，并通过 `approval.requested`、`approval.approved`、`approval.rejected`、`approval.executed` 和 `approval.failed` 事件同步到任务抽屉。

## Event Bus

EventBus 为每个事件分配单调递增 ID，并写入以下通道：

- `global`
- `job:<jobId>`
- `session:<sessionId>`

每个内存通道最多保留 2,000 条事件。支持的标准事件包括：

- `session.created`
- `session.resumed`
- `stage.started`
- `stage.progress`
- `stage.completed`
- `stage.failed`
- `tool.before`
- `tool.approval-required`
- `tool.executing`
- `tool.completed`
- `tool.failed`
- `validation.started`
- `validation.completed`
- `build.started`
- `build.completed`
- `job.cancelled`
- `agent.status`
- `agent.output`
- `agent.runtime-event`
- `subagent.started`
- `subagent.finished`
- `approval.requested`
- `approval.approved`
- `approval.rejected`
- `approval.executed`
- `approval.failed`

Job 和 Session 的 `/events` 接口通过 Server-Sent Events 推送事件，并支持 `Last-Event-ID` 或 `?after=<id>` 从当前进程的事件缓存继续读取。

## Job Runtime

Job 包含：

- `id`
- `projectId`
- `stage`
- `status`
- `createdAt`、`startedAt`、`finishedAt`
- `progress`
- `currentAction`
- `retryCount`
- `errorCode`、`errorMessage`、`retryable`
- `result`
- `sessionId`
- `durationMs`

默认并发数为 2。状态为 `waiting`、`running`、`succeeded`、`failed` 或 `cancelled`。取消会触发 Job 的 AbortController；构建和 AI Provider 会接收同一个 AbortSignal。

当前注册的后台执行器包括：

- `ai`
- `local-analysis`
- `build`
- `requirements`
- `clarification`
- `scheme-generation`
- `scheme-validation`
- `code-generation`
- `code-validation`
- `flow-generation`
- `release-check`

当流水线阶段带有 AI service 和 messages 时，执行器调用 AI Provider；不带执行负载时只记录该阶段。这使前端可以逐步迁移到后台任务，而不破坏现有同步页面动作。

Job 队列目前在内存中。Session trajectory 会持久化，但服务重启不会恢复正在等待或运行的 Job，也不会把它们自动转换为 interrupted 状态。这是当前内部运行时的重要限制。

## Session 与 Trajectory

Session 默认存储目录：

- Windows：`%LOCALAPPDATA%\MetaCore Studio\sessions`
- 其他系统：`~/.metacore-studio/sessions`
- 可通过 `METACORE_SESSION_ROOT` 覆盖

每个 Session 使用两个文件：

```text
<sessionId>.json   # 元数据
<sessionId>.jsonl  # 事件 trajectory
```

Session 元数据保存项目 ID、状态、时间、最后事件 ID和 Job ID 列表。JSONL trajectory 保存脱敏后的事件。服务启动时清理默认超过 7 天的历史 Session。

Session 不默认写入用户工作区。API Key、Authorization、password、token、private key 和常见 secret 字段会被递归脱敏。当前 Session API 可按 ID 读取；尚未提供按项目分页查询或通过 JSONL 重放 SSE 的接口。

## 操作日志

旧的 `GET /api/logs` 保持兼容。最近 120 条记录保存在内存，同时追加写入 Session Root 下的 `operations.jsonl`。服务启动时会重新读取历史尾部记录。

日志记录操作类型、状态、耗时和必要摘要，不记录 API Key。持久化采用 fire-and-forget 追加写入，适合本地诊断，但不是数据库级事务日志。

## Context Builder

浏览器侧 `src/services/ai/contextBuilder.ts` 和服务端 `server/agent/context.mjs` 各自实现独立的上下文选择，以避免浏览器代码依赖 Node.js 文件系统。

当前策略包括：

1. 排除 `node_modules`、`dist`、`build`、`.pio`、`.metacore-backups` 和 `coverage`。
2. 规范化文件路径。
3. 对 Bearer Token 和常见凭据赋值进行脱敏。
4. 建立函数索引并保留真实行号。
5. 提升 `setup`、`loop`、`app_main`、task、init 和错误处理相关片段的权重。
6. 根据任务关键词计算相关性分数。
7. 按 Token 预算选择完整文件或函数片段。
8. 返回文件清单、函数清单、分数和估算 Token 数。

流程图和一致性验证不再固定截取每个文件前 1,000 或 800 个字符。

## AI Task Contract

所有已接入的方案生成、代码生成、流程生成和一致性验证都使用版本化 Contract：

```json
{
  "schemaVersion": "1.0",
  "taskType": "任务类型",
  "status": "ok | needs_clarification | invalid",
  "assumptions": [],
  "openQuestions": [],
  "risks": [],
  "evidence": [],
  "data": {},
  "validationHints": []
}
```

处理流程为：

1. 注入统一 system contract。
2. 调用 AI。
3. 解析 JSON。
4. 检查 schemaVersion、taskType 和 status。
5. 使用任务专用解析器验证 `data`。
6. 首次失败时发送 repair prompt。
7. repair 仍失败才向上返回错误。

为了兼容旧服务商，完全不含 Contract 字段的旧式 JSON 仍可被包裹为 `status: ok`，但新 Prompt 会要求输出标准 envelope。

## DeepSeek Harness Runtime

真实适配器位于 `server/agent/runtime/deepseek-harness-runtime.mjs`，它只做进程和协议适配，不复制 Harness 的业务逻辑：

1. 用 `@deepseek-ai/dsh-sdk-client` 启动 Harness 源码的 `src/packaged-bin.ts`。
2. 通过 `harness/cordis.yml` 组合 JSON-RPC server、DeepSeek adapter、agent spine、session persistence、checkpoint、subagent、todo、token meter 和 compaction。
3. 将 Harness 的 `session.status`、`session.event`、`subagent.*` 通知映射为 MetaCore `AgentEvent`。
4. 将任务结果、错误、取消和退出状态回收到 MetaCore Job。
5. 通过一次启动生成的 bridge token 调用 MetaCore `POST /api/agent/bridge/tools/:toolName`。

相邻 `deepseek-harness` 仓库是运行时依赖，只读使用，不由本项目修改。由于 SDK 当前没有逐提示词取消 API，取消任务会关闭对应 Harness 子进程；Job 的取消、重试和 UI 状态仍由 MetaCore 管理。

## MetaCore 安全边界

Harness 的模型可以读取和分析授权工作区，但没有原始 shell 或任意文件系统工具。工具桥的高风险动作只产生审批：

```text
Harness propose_file_change
  -> MetaCore 读取旧文件并计算 Diff
  -> approval.requested
  -> 用户批准
  -> MetaCore write_file（备份 + mtime 冲突检查 + 工作区边界）

Harness request_build
  -> approval.requested
  -> 用户批准
  -> MetaCore run_build（固定 profile 白名单 + 超时 + 输出限制）
```

因此 Harness 的提示词不能证明文件已经修改，也不能把构建命令字符串当作已经执行。最终事实以 MetaCore 工具结果和审批事件为准。

## 当前限制

- Harness 版本为开发预览 `dsh-v0.1.1-rc.2`，当前适配器按源码 checkout 启动。
- 真实模型需要本地服务环境变量 `DEEPSEEK_API_KEY`，前端设置页不会把 Key 写入服务端配置文件。
- `ApprovalStore` 当前为内存存储，服务重启后未完成审批不会恢复。
- Job 和 EventBus 仍为进程内队列；Session JSON/JSONL 会持久化轨迹，但不会恢复运行中的子进程。
- Runtime 在 Windows 已采用本地子进程和 stdio 设计，但仍应按目标机器继续验收 Node、pnpm、路径和防火墙环境。
