# DeepSeek Harness 集成计划与交付边界

本文是 Harness 集成的实施记录和后续路线。

> 历史说明：本文记录 Harness 集成最初在独立工作目录中的实施过程。相关代码现已同步到当前主工作目录；下文中的“副本”、路径和“原项目未修改”等表述属于当时的迁移背景，保留用于追溯，不代表当前目录关系。

## 已完成

### 1. 工作目录与源码边界（历史记录）

- Harness 集成最初在独立工作目录中完成，随后同步到当前 MetaCore Studio 项目目录。
- 当时保留 `deepseek-harness` 源码仓库不变。
- 当时使用 `harness-refactor` 分支，并将原始远程改名为 `upstream-source`，避免误推送。
- DeepSeek Harness 版本固定为 `dsh-v0.1.1-rc.2`。

### 2. Runtime 适配

- 安装 `@deepseek-ai/dsh-sdk-client@0.1.1-rc.2`。
- 新增 `DeepSeekHarnessRuntime`、`InternalAgentRuntime` 和 `AgentRuntimeManager`。
- Harness 通过官方 JSON-RPC `packaged-bin.ts` 入口以 Windows 子进程启动。
- Harness 通知映射到 MetaCore Job/SSE：`agent.status`、`agent.output`、`agent.runtime-event` 和 `subagent.*`。
- 取消任务时关闭对应 Harness 进程；Internal Runtime 保留为回退路径。

### 3. 受控工具桥

`harness/cordis.yml` 只挂载 MetaCore 专用工具插件，不挂载原始 shell/fs-local 工具。工具桥提供：

| 工具 | 行为 |
| --- | --- |
| `inspect_project` | 读取结构化项目诊断 |
| `read_file` | 读取工作区内受支持文本文件 |
| `search_files` | 搜索工作区文本 |
| `run_local_analysis` | 执行确定性本地分析 |
| `validate_pin_assignment` | 校验 GPIO 规划 |
| `propose_file_change` | 创建完整文件替换 Diff 审批，不直接写入 |
| `request_build` | 创建白名单构建审批，不直接执行 |

桥接请求必须带服务启动时随机生成的 token。所有最终文件和构建动作继续复用 MetaCore 的路径安全、备份、mtime 冲突和命令白名单。

### 4. UI 与 API

- 右下角 Agent 任务抽屉：Runtime 选择、目标输入、starter goals、任务轨迹和最终结果。
- 任务抽屉支持取消、失败重试、文件 Diff 审批和构建命令审批。
- 本地构建失败结果提供“让 Agent 诊断并修复”入口，并自动把构建日志作为目标上下文。
- Settings 增加 Agent Runtime 状态卡片，不显示 API Key 内容。
- 新增 API：`/api/agent/runtime`、`/api/agent/tasks`、`/api/agent/approvals/*` 和 Harness bridge。

## 迁移后的能力变化

界面仍以工程工作台、编辑器、诊断和构建为主，并没有变成聊天窗口；新增的是：

1. Agent 的执行轨迹可见，而不是只显示一次性文本结果。
2. Harness 提议的写文件和构建操作必须在 Diff/命令预览后批准。
3. 构建失败、引脚冲突和工程分析可以从当前页面直接转成 Agent 任务。
4. Runtime、Harness 版本、依赖和凭据状态可以在 Settings 中确认。
5. MetaCore 保留最终事实和安全边界，Harness 负责 Agent loop、插件组合、工具编排和 subagent。

## 下一阶段

### P0：稳定性

- 在目标 Windows 机器完成 Node、pnpm、路径编码、工作区权限和真实 API Key 冒烟。
- 增加服务重启时的 Job/Approval 状态迁移，至少将运行中 Job 标记为 `interrupted`。
- 为 ApprovalStore 增加持久化元数据和过期策略。

### P1：工程体验

- 将当前简要 Diff 预览升级为逐 hunk Diff，并在批准前显示文件类型、行数和风险。
- 支持从全局 Agent 事件直接打开任务抽屉并定位对应 session。
- 在批准写入后自动触发局部分析；在批准构建后回写构建结果和错误上下文。
- 增加 Harness Runtime 的模型选择、最大输出 token 和启动诊断入口。

### P2：可扩展性

- 把 GPIO、BOM、固件生成和发布检查包装成更细的受控 Harness 工具。
- 增加 Harness plugin manifest 到 MetaCore capability manifest 的映射。
- 在不扩大权限的前提下增加可配置 Cordis composition 和项目级 Agent persona。
- 研究可恢复 session、逐提示词取消和更细的提示词/工具结果归因，等待上游 SDK 提供稳定协议。

## 验收标准

每次发布前至少执行：

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:local
npm run build
```

另外验证：

- 没有 `DEEPSEEK_API_KEY` 时，Runtime 状态诚实显示未配置，任务不会假装成功。
- bridge 缺少或错误 token 返回 401。
- 相对工作区外路径、符号链接逃逸、未批准写入和未批准构建都被拒绝。
- Harness 子进程 stdout 只承载 JSON-RPC，不混入日志。
- Harness 源码 checkout 仍作为独立的只读运行时依赖，不复制进 MetaCore Studio 项目目录。
