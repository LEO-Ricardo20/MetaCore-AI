# MetaCore Studio Agent 架构

本文描述 `server/agent` 中的内部 Agent Runtime，以及它与 DeepSeek Harness 的参考关系。当前实现是 **Harness-inspired internal runtime**，不是 DeepSeek Harness 的实际集成。

## 运行时选择

默认运行时：

```text
METACORE_AGENT_RUNTIME=internal
```

`GET /api/health` 会返回 `agentRuntime`。当前代码只实现 `internal`；即使把环境变量设置为 `deepseek-harness`，服务也不会加载 Python SDK、DeepSeek Harness 进程或远程 Harness Runtime。因此部署和产品文案不得宣称已经接入 DeepSeek Harness。

未来适配器应保持可选，不能让 MetaCore Studio 的项目状态、安全文件操作和 Windows 支持依赖开发者预览版运行时。

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

Tool Pipeline 已提供后端审批门槛与 `tool.approval-required` 事件。前端 diff 审批 UI 尚未完成，因此当前生产流程仍应由现有显式文件写入确认和构建按钮发起高风险操作。

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

Session 不默认写入用户工作区。API Key、Authorization、password、token、private key 和常见 secret 字段会被递归脱敏。当前 Session API 可按 ID读取；尚未提供按项目分页查询或通过 JSONL 重放 SSE 的接口。

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

## DeepSeek Harness 参考关系

内部运行时借鉴了 DeepSeek Harness 的以下概念：

- 插件和能力注册。
- Service Definition / Provider / Consumer 分层。
- Agent 生命周期事件。
- 工具执行流水线。
- 权限与审批。
- Job、Session 与 trajectory。
- Streaming/SSE。
- Token 与耗时计量。
- 上下文选择和压缩。

未实现的实际集成包括：

- 未安装或启动 DeepSeek Harness SDK/Runtime。
- 未加载 Harness 插件包。
- 未使用 Harness 的 Agent lifecycle executor。
- 未把工具调用委托给 Harness sandbox。
- 未实现 Windows 与 Harness 进程间桥接。
- 未实现 `METACORE_AGENT_RUNTIME=deepseek-harness` 的 adapter。

## 可选 Adapter 方向

未来的 Adapter 应放在独立模块中，并满足以下约束：

1. 实现 MetaCore 的 Service Definition，而不是让前端依赖 Harness 类型。
2. 将 Harness 事件转换为 `AgentEvent`。
3. 将 Harness Job 状态转换为 MetaCore Job 状态和稳定错误码。
4. 复用 MetaCore 工作区路径、备份、冲突检测和构建白名单。
5. 不允许 Harness 绕过 Tool Policy 直接写文件或执行命令。
6. 保持 `internal` 为默认和可独立运行的回退实现。
7. 在 Windows 支持、取消、日志脱敏和恢复测试全部通过前，不在 UI 中标记为可用。
