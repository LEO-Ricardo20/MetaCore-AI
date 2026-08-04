# MetaCore AI Portable Project Files

[English](#english) | [简体中文](#简体中文)

## English

The project manager can export one project as a versioned `.metacore.json` archive and import it on another browser or computer.

The archive contains:

- Project metadata, target chip, and framework.
- Hardware scheme, pins, BOM, and wiring.
- Selected driver template IDs.
- Generated code files.
- Flow nodes and edges.

The archive does not contain AI provider configuration, API keys, local workspace paths, operation logs, local backups, or files that were not explicitly part of the project state.

Imports are limited to 10 MB and are validated before entering the Zustand store. Validation rejects unknown schema versions, unsupported project formats, unsafe absolute or parent-relative generated paths, duplicate paths, invalid flow references, and malformed project data. Importing an existing project again creates a new project ID instead of overwriting the original.

Current envelope:

```json
{
  "kind": "metacore.project",
  "schemaVersion": 1,
  "appVersion": "2.1.0",
  "exportedAt": "2026-08-04T00:00:00.000Z",
  "project": {}
}
```

## 简体中文

项目管理页可以把单个项目导出为带版本的 `.metacore.json` 归档，并在其他浏览器或电脑中导入。

归档包含项目基本信息、目标芯片、工程格式、硬件方案、引脚、BOM、接线、驱动模板、生成代码和流程图。归档不包含 AI 服务配置、API Key、本地工作区路径、操作日志、本地备份，也不会自动收集未进入项目状态的电脑文件。

导入文件限制为 10 MB。数据进入 Zustand Store 前会校验归档版本、工程格式、生成文件路径、重复文件、流程图引用和字段结构。重复导入同一个项目时会生成新的项目 ID，不会覆盖原项目。
