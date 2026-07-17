# MetaCore AI 本地服务 API

默认地址：`http://127.0.0.1:3766/api`

所有文件路径均相对于当前工作区。服务拒绝访问工作区之外的路径。

## 服务与环境

### `GET /health`

返回服务状态、端口和当前工作区。

### `GET /system/info`

返回操作系统、CPU、内存、Node 版本，以及 `pio`、`idf.py`、`cmake`、`arduino-cli` 等工具是否可用。

### `GET /logs`

返回最近的分析、写入、恢复和构建操作记录。

## AI 代理

### `POST /ai/call`

通过本地服务调用配置的 AI 服务，避免浏览器跨域限制。支持 OpenAI Responses API，以及 DeepSeek、通义千问、硅基流动、Ollama 和自定义 OpenAI 兼容服务。自定义服务可以通过 `apiMode` 选择 `responses` 或 `chat-completions`；未设置时，OpenAI 和 `autobits.cc` 自动使用 Responses API，其他服务默认使用 Chat Completions。

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

成功时返回：

```json
{
  "content": "OK"
}
```

本地服务只把 API Key 转发给配置中的目标服务商，不会把 Key 写入操作日志。日志仅记录服务商、模型和目标主机名。Ollama 可以省略 API Key，其他服务默认要求提供 API Key。单次请求超时时间为 90 秒。

前端当前会在浏览器本地配置中保存用户填写的服务信息。请勿在共享电脑上保存私人 API Key，也不要把包含真实 Key 的配置、截图或日志提交到 GitHub。

### `POST /ai/models`

读取服务商 OpenAI 兼容的 `GET {baseURL}/models` 模型列表。请求体只需要传入 `service` 配置，成功时返回按模型 ID 排序的字符串数组：

```json
{
  "models": ["gpt-example", "gpt-example-pro"]
}
```

中转平台可能使用自定义模型别名，也可能暂时没有可用的上游通道。应优先使用该接口返回的模型 ID；列表中存在某个模型，只表示平台声明支持，不保证每次调用都有可用上游容量。

## 工作区

### `GET /workspace/current`

返回当前工作区。

### `POST /workspace/set`

```json
{
  "root": "D:\\IoTProjects\\Demo"
}
```

工作区必须是本机存在的目录。

## 文件

### `GET /files/list?dir=src`

列出目录中的文件和子目录。

### `GET /files/read?path=src/main.cpp`

读取文本文件。默认最大 2MB。

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

保存前会：

1. 校验路径。
2. 校验文本文件类型和大小。
3. 对比原修改时间。
4. 创建备份。
5. 保存新内容。

如果文件已被外部程序修改，返回 HTTP 409。

## 工程分析

### `POST /analyze`

返回：

- 工程类型
- 芯片
- 外设与总线
- 物联网协议
- 依赖
- 引脚
- 代码统计
- 安全发现
- 构建配置
- 健康评分
- 风险与建议

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

允许的 `profileId`：

- `platformio`
- `espidf`
- `cmake`

前端不能传入任意命令或参数。构建最长运行 120 秒，输出最多保留 512KB。
