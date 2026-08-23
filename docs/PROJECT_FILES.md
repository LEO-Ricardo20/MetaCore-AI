# MetaCore Studio Portable Project Files

[English](#english) | [简体中文](#简体中文)

## English

MetaCore Studio exports one project as a `.metacore.json` archive. The portable envelope remains at schema version 1 for compatibility, while the embedded project is normalized to Project Schema v3.

### Envelope

```json
{
  "kind": "metacore.project",
  "schemaVersion": 1,
  "appVersion": "2.4.0",
  "exportedAt": "2026-08-23T00:00:00.000Z",
  "project": {}
}
```

`kind` and the envelope `schemaVersion` are stable compatibility identifiers. They are independent from `project.schemaVersion`.

### Project Schema v3

The embedded project can contain:

- Identity, name, requirement, target chip, and project format.
- Hardware scheme, pin assignments, BOM, wiring, and selected driver IDs.
- Generated code files and flow graph references.
- `currentStage` project lifecycle state.
- Artifact freshness, version, timestamp, source version, and stale reason.
- Pipeline run summaries and per-stage status, progress, timing, model, provider, prompt version, token usage, retries, and errors.
- Explicit project version history.
- Project validation summary.
- Optional ESP32 board profile with module, PlatformIO board, ESP-IDF target, storage, USB, partition, upload, and monitor settings.

Legacy projects without lifecycle fields are normalized during import and browser-store migration. Missing arrays and status fields are initialized without deleting the original design data.

### Data deliberately excluded

Archives do not contain:

- AI provider configuration or API keys.
- Local workspace paths.
- Operation logs, Session files, or local backups.
- `lastSessionId` or per-run `sessionId`.
- Raw AI responses.
- Parsed structured diagnostic responses.
- Stage validation payloads.
- Files that were not explicitly part of project state.

Run and lifecycle summaries remain portable, but process-local references and potentially sensitive diagnostics are removed.

### Validation

Imports are limited to 10 MB and validated before entering the Zustand store. Validation rejects:

- Unknown archive kind or envelope schema version.
- Unsupported project formats or malformed chip targets.
- Unsafe absolute or parent-relative generated paths.
- Duplicate generated paths.
- Oversized code or malformed project structures.
- Flow edges that reference missing nodes.
- Invalid lifecycle status values.

Importing an archive whose project ID already exists creates a new project ID rather than overwriting the local project.

### Compatibility rules

- Keep `kind: metacore.project` stable.
- Keep envelope `schemaVersion: 1` until the portable wire format requires an incompatible change.
- Add optional embedded Project fields through normalization where possible.
- Never add AI keys, local workspace authorization, logs, or backup contents to the archive.
- Preserve the browser storage key `metacore-projects` independently from the portable file format.

## 简体中文

MetaCore Studio 可以把单个项目导出为 `.metacore.json` 归档。为了兼容已有文件，外层归档 Schema 继续保持 1；归档内部项目会规范化为 Project Schema v3。

### 外层 Envelope

```json
{
  "kind": "metacore.project",
  "schemaVersion": 1,
  "appVersion": "2.4.0",
  "exportedAt": "2026-08-23T00:00:00.000Z",
  "project": {}
}
```

外层 `schemaVersion` 与内部 `project.schemaVersion` 是两个独立版本。外层版本表示可移植文件协议，内部版本表示浏览器领域模型。

### Project Schema v3 内容

内部项目可以包含：

- 项目 ID、名称、需求、目标芯片和工程格式。
- 硬件方案、引脚、BOM、接线和已选驱动模板。
- 生成代码文件和流程图。
- `currentStage` 项目生命周期状态。
- 各产物的状态、版本、更新时间、来源版本和 stale 原因。
- 流水线运行摘要，以及各阶段状态、进度、时间、模型、服务商、Prompt 版本、Token、重试和错误。
- 显式创建的项目版本历史。
- 项目级质量门禁摘要。
- 可选 ESP32 开发板 profile，包含模组、PlatformIO board、ESP-IDF target、存储、USB、分区、上传和串口设置。

旧项目缺少生命周期字段时，导入和 Zustand Store 迁移会调用规范化逻辑补齐默认值，不删除原有需求、方案、代码或流程图。

### 明确排除的数据

归档不会包含：

- AI 服务配置和 API Key。
- 本地工作区路径。
- 操作日志、Session 文件和本地备份。
- `lastSessionId` 和每次运行的 `sessionId`。
- AI 原始响应。
- 结构化诊断响应。
- 阶段验证 payload。
- 没有进入项目状态的本机文件。

生命周期和运行摘要可以随项目迁移，但进程内引用和可能包含敏感上下文的诊断数据会在导出时移除。

### 导入校验

导入文件限制为 10 MB。数据进入 Zustand Store 前会校验：

- 归档 kind 和外层版本。
- 工程格式、目标芯片和项目基础字段。
- 生成文件路径是否为安全相对路径。
- 是否存在重复路径或超大代码内容。
- 流程边是否引用真实节点。
- 生命周期状态是否在允许集合中。

重复导入已有项目 ID 时会生成新的项目 ID，不会覆盖本地原项目。

### 兼容规则

- 保持 `kind: metacore.project`。
- 在可移植协议没有不兼容变化前保持外层 `schemaVersion: 1`。
- 优先通过可选字段和规范化函数扩展内部 Project Schema。
- 永远不要把 API Key、工作区授权、日志或备份内容加入归档。
- 浏览器存储键 `metacore-projects` 与项目文件协议分别维护。
