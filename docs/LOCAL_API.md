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
