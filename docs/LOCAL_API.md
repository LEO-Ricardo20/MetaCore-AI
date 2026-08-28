# MetaCore Studio 本地服务 API

默认地址：`http://127.0.0.1:3766/api`

本地服务只绑定 loopback。带 `Origin` 的请求仅允许来自 `localhost`、`127.0.0.1` 或 `[::1]`。每个响应包含 `X-Request-ID`；调用方也可以传入该请求头用于关联日志。

除 AI Provider 外，所有文件系统路径均相对于当前授权工作区。服务拒绝工作区外路径、符号链接或 Windows 目录联接逃逸。

## 错误格式

Agent 和新增 API 使用稳定错误格式：

```json
{
  "error": "任务不存在",
  "code": "JOB_NOT_FOUND",
  "message": "任务不存在",
  "retryable": false,
  "requestId": "8fd9...",
  "details": null
}
```

旧 API 的 HTTP 状态和 `error` 字段保持兼容。常见稳定错误码包括：

- `ROUTE_NOT_FOUND`
- `SESSION_NOT_FOUND`
- `JOB_NOT_FOUND`
- `JOB_STAGE_UNSUPPORTED`
- `JOB_NOT_RETRYABLE`
- `JOB_CANCELLED`
- `AI_CANCELLED`
- `AI_TIMEOUT`
- `TOOL_NOT_FOUND`
- `TOOL_WRITE_FORBIDDEN`
- `TOOL_BUILD_FORBIDDEN`
- `TOOL_APPROVAL_REQUIRED`

## 服务与运行时

### `GET /health`

返回版本、端口、当前工作区和 Agent Runtime：

```json
{
  "ok": true,
  "service": "metacore-studio-local",
  "version": "2.6.0",
  "workspaceRoot": "D:\\Projects\\Demo",
  "port": 3766,
  "agentRuntime": "internal"
}
```

`agentRuntime` 默认来自 `METACORE_AGENT_RUNTIME=deepseek-harness`。服务同时提供 `deepseek-harness` 和 `internal` 两个 Runtime；前者通过配置的 DeepSeek Harness 源码 checkout 和 `@deepseek-ai/dsh-sdk-client` 驱动 Cordis JSON-RPC，后者是本地单轮 AI 回退实现。使用 `GET /api/agent/runtime` 查看源码、依赖、配置和凭据状态。

DeepSeek Harness 的高风险操作不会直接写文件或执行构建。`propose_file_change` 和 `request_build` 会生成审批记录，前端在确认 Diff/构建 profile 后调用审批接口，MetaCore 才执行已有的安全写入或白名单构建。

### `GET /system/info`

返回操作系统、CPU、内存、Node 版本，以及 `pio`、`idf.py`、`cmake` 和 `arduino-cli` 等工具是否可用。

### `GET /logs`

返回最近的分析、写入、恢复、构建和 HTTP 错误记录：

```json
{
  "logs": []
}
```

最近 120 条记录保存在内存，同时追加到 Session Root 下的 `operations.jsonl`。API Key、Authorization、Token、密码和私钥字段会被脱敏。

### `GET /agent/plugins`

返回静态插件 manifest、Service Definition/Provider 和当前实际注册的工具：

```json
{
  "plugins": [],
  "services": [],
  "tools": []
}
```

## Session API

Session 元数据和 trajectory 默认存储在操作系统用户数据目录，不写入项目工作区。

### `POST /sessions`

```json
{
  "projectId": "project-1",
  "metadata": {
    "source": "workspace"
  }
}
```

成功返回 HTTP 201：

```json
{
  "id": "session-uuid",
  "projectId": "project-1",
  "status": "active",
  "createdAt": 1787000000000,
  "updatedAt": 1787000000000,
  "lastEventId": 0,
  "jobIds": [],
  "metadata": {
    "source": "workspace"
  }
}
```

Metadata 会经过递归脱敏。不要把完整源码或业务密钥作为 Metadata 提交。

### `GET /sessions/:id`

读取内存或磁盘上的 Session 元数据。不存在时返回 404 和 `SESSION_NOT_FOUND`。

### `GET /sessions/:id/events`

建立 Server-Sent Events 连接。支持 `Last-Event-ID` 请求头或 `?after=<eventId>` 查询参数。

```js
const source = new EventSource(
  'http://127.0.0.1:3766/api/sessions/session-uuid/events',
)

source.addEventListener('stage.progress', (message) => {
  const event = JSON.parse(message.data)
  console.log(event.data.progress, event.data.currentAction)
})
```

当前 SSE 只重放本进程 EventBus 中仍保留的事件，不从历史 JSONL trajectory 重放。

## Job API

### `POST /jobs`

创建后台任务。未提供 `sessionId` 时服务会自动创建 Session。

```json
{
  "projectId": "project-1",
  "sessionId": "可选-session-uuid",
  "stage": "local-analysis",
  "payload": {}
}
```

当前可执行 stage：

- `ai`
- `requirements`
- `clarification`
- `scheme-generation`
- `scheme-validation`
- `code-generation`
- `code-validation`
- `flow-generation`
- `local-analysis`
- `build`
- `release-check`

AI stage 或生成 stage 可以传入：

```json
{
  "service": {
    "provider": "deepseek",
    "apiKey": "sk-...",
    "baseURL": "https://api.deepseek.com/v1",
    "model": "deepseek-chat",
    "apiMode": "chat-completions"
  },
  "messages": [
    { "role": "user", "content": "Reply with OK only." }
  ],
  "temperature": 0
}
```

Build stage payload：

```json
{
  "profileId": "platformio"
}
```

成功创建返回 HTTP 202：

```json
{
  "id": "job-uuid",
  "projectId": "project-1",
  "stage": "local-analysis",
  "status": "waiting",
  "createdAt": 1787000000000,
  "progress": 0,
  "currentAction": "等待执行",
  "retryCount": 0,
  "sessionId": "session-uuid"
}
```

默认最多同时运行 2 个 Job。

### `GET /jobs/:id`

轮询 Job 状态。完成后可能包含：

```json
{
  "status": "succeeded",
  "progress": 100,
  "currentAction": "已完成",
  "result": {},
  "durationMs": 1432
}
```

失败时包含 `errorCode`、`errorMessage` 和 `retryable`。

### `GET /jobs/:id/events`

建立 Job SSE 连接。事件格式：

```text
id: 14
event: stage.progress
data: {"id":14,"type":"stage.progress","timestamp":1787000000000,"jobId":"...","sessionId":"...","data":{"stage":"build","progress":50,"currentAction":"正在编译"}}
```

标准事件：

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

### `POST /jobs/:id/cancel`

取消 waiting 或 running Job。running Job 的 AbortController 会传给 AI Provider 或构建进程。终态 Job 重复取消会直接返回现有状态。

### `POST /jobs/:id/retry`

只有 `failed` 或 `cancelled` Job 可以重试。重试会清除上次错误、增加 `retryCount` 并重新排队；其他状态返回 HTTP 409 和 `JOB_NOT_RETRYABLE`。

Job 队列当前为进程内状态，服务重启后不能继续轮询旧 Job。

## AI 代理

### `POST /ai/call`

通过本地服务调用配置的 AI 服务，避免浏览器跨域限制。支持 OpenAI Responses API，以及 DeepSeek、通义千问、硅基流动、Ollama 和自定义 OpenAI-compatible 服务。

```json
{
  "service": {
    "provider": "deepseek",
    "apiKey": "sk-...",
    "baseURL": "https://api.deepseek.com/v1",
    "model": "deepseek-chat",
    "apiMode": "chat-completions"
  },
  "messages": [
    { "role": "user", "content": "Reply with OK only." }
  ],
  "temperature": 0
}
```

成功响应除 `content` 外，还可包含 model、provider、apiMode、durationMs、usage 和 contextLength。单次请求默认超时 180 秒；`service.timeoutMs` 可在 5 秒到 10 分钟的服务端边界内覆盖，设置页限制为 30 到 600 秒。外部 AbortSignal 对应 `AI_CANCELLED`，超时对应 `AI_TIMEOUT`。

Base URL 如果误填为完整 `/chat/completions`、`/responses` 或 `/models` endpoint，会先规范化为服务根路径。推理模型不会发送通常不被接受的 `temperature` 参数。401/403、404、429、5xx、连接失败和超时均返回独立错误码和可操作提示。

本地服务只把 API Key 转发给目标服务商，不持久化 Key，也不写入 operation log。

### `POST /ai/models`

读取 `{baseURL}/models`，请求体只需包含 `service`。成功返回按模型 ID 排序的字符串数组。

## 工作区

### `GET /workspace/current`

返回当前工作区。

### `POST /workspace/set`

```json
{
  "root": "D:\\IoTProjects\\Demo"
}
```

工作区必须是本机存在的目录。选择工作区并不自动把全部源码发送给 AI。

## 文件

### `GET /files/list?dir=src`

列出目录中的文件和子目录。

### `GET /files/read?path=src/main.cpp`

读取文本文件。默认最大 2 MB。

### `POST /files/search`

```json
{
  "query": "OLED_SDA",
  "maxResults": 60
}
```

### `POST /files/write`

```json
{
  "path": "src/main.cpp",
  "content": "...",
  "expectedModifiedAt": 1780000000000
}
```

服务依次校验路径、文件类型、大小和修改时间，并在写入前创建备份。文件已被外部修改时返回 HTTP 409。

## 工程分析

### `POST /analyze`

返回工程类型、芯片、外设、总线、协议、依赖、引脚、代码统计、安全发现、构建配置、健康评分和建议。

### `POST /report`

重新分析工程，并返回结构化结果与 Markdown 报告。

## 备份

### `GET /backups/list`

返回工作区 `.metacore-backups` 中的备份记录。

### `POST /backups/restore`

```json
{
  "backupId": "2026-07-16T10-20-30-000Z-a1b2c3"
}
```

恢复前会再次备份当前文件。

## 构建

### `GET /build/detect`

检测工程标志文件和本机构建工具。

### `POST /build/run`

```json
{
  "profileId": "platformio"
}
```

允许的 `profileId`：`platformio`、`espidf` 和 `cmake`。前端不能传入任意命令或参数。构建最长运行 120 秒，输出最多保留 512 KB。

## 环境变量

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `METACORE_LOCAL_PORT` | `3766` | localhost API 端口 |
| `METACORE_LOCAL_CONFIG` | `server/.metacore-local.json` | 工作区配置文件 |
| `METACORE_SESSION_ROOT` | OS 用户数据目录 | Session、trajectory 和操作日志目录 |
| `METACORE_AGENT_RUNTIME` | `deepseek-harness` | 健康状态中的默认 Runtime 标识；可切换为 `internal` |

## 安全注意事项

详细边界见 [SECURITY_MODEL.md](./SECURITY_MODEL.md)。Harness bridge 使用独立的启动 token；普通 localhost API 仍依赖 loopback 与 Origin 校验，不应把端口暴露到局域网或公网。构建可能执行受信任工程自带的构建脚本；不要对未知工程运行构建。
