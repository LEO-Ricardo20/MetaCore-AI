# MetaCore Studio 安全模型

本文说明 React 应用、localhost 服务、Agent Runtime、工作区、AI Provider、日志和项目归档之间的安全边界。

MetaCore Studio 是本机研发工具，不是公共远程文件服务器。安全设计目标是：只有用户在本机打开的页面可以访问服务；所有文件操作都限制在用户明确授权的工作区内；高风险写入和构建不能绕过审批、备份、冲突检查与白名单；API Key 和疑似凭据不进入仓库、日志或项目归档。

## 信任边界

```text
浏览器 UI
  -> localhost HTTP / SSE
  -> Agent Policy / Workspace Security
  -> 用户授权的工程目录

浏览器 UI
  -> localhost AI Provider Proxy
  -> 用户选择的 AI 服务商

Session Root 与浏览器项目存储均在工作区之外
```

本地服务信任操作系统当前用户，但不信任任意网页、任意路径、任意命令、任意 AI 输出或未经批准的工具调用。

## Localhost 边界

- 服务固定绑定 `127.0.0.1`，不会监听 `0.0.0.0`。
- 默认端口为 3766，可通过 `METACORE_LOCAL_PORT` 修改。
- 带 `Origin` 的请求只允许 `localhost`、`127.0.0.1` 和 `[::1]`。
- CORS 只回显通过校验的本机 Origin。
- 每个请求具有 `X-Request-ID`；前端可传入，服务也可自动生成。
- 请求体、文本读取、扫描数量、扫描深度、构建输出和构建时间均有限制。

没有 `Origin` 的本机脚本请求允许访问 API，这是为了保留 CLI、冒烟测试和本地自动化兼容性。因此“只绑定 loopback + Origin 校验”不能防御同一用户会话中的恶意本机进程。

## Capability Token 状态

当前版本 **尚未实现每次启动生成的 capability token 或 session token 握手**。现有保护层是：

1. loopback-only 监听。
2. 本机 Origin 校验。
3. 显式工作区授权。
4. 工作区 realpath 校验。
5. 文件类型和大小限制。
6. 写入冲突检测与备份。
7. 构建配置白名单。
8. Agent Tool 权限和审批策略。

未来如增加 capability token，应满足：

- 每次服务启动生成高熵随机值，不写入项目目录或日志。
- 前端通过受控启动配置或一次性本机握手获取。
- 普通 JSON API 使用请求头；SSE 需要使用不会泄露到第三方 Referer 的安全连接方案。
- 保留开发模式易用性和现有 API 的迁移窗口。
- Token 只能证明调用者获得了本机启动能力，不能替代工作区、路径、审批和构建白名单。

在 capability token 落地前，不应把 localhost 服务暴露到局域网、端口转发、远程浏览器或多用户共享主机环境。

## 工作区授权

用户通过 `POST /api/workspace/set` 选择一个本机存在的目录。服务保存规范化后的工作区路径，所有文件、备份、分析和构建操作都以该根目录为边界。

- 浏览器不能通过请求切换到不存在的路径。
- 工作区配置不进入 `.metacore.json` 项目归档。
- 选择工作区不代表自动同意上传全部文件给 AI；只有用户主动发起相关 AI 功能时，经过筛选的上下文才会发送给所选服务商。

## 路径校验和符号链接

路径检查分为两步：

1. 使用 `path.resolve` 检查目标的词法路径是否位于工作区。
2. 使用 `fs.realpath` 检查真实目标是否仍位于工作区。

Windows 比较不区分大小写。符号链接或目录联接如果指向工作区外部，会被拒绝。工作区外绝对路径、`..` 越界和不存在目标分别返回相应的 403 或 404 错误。

扫描会跳过 `.git`、`node_modules`、`dist`、`build`、`.pio`、`.metacore-backups` 和其他生成目录，减少意外读取无关或大型文件的风险。

## 文件读取和搜索

- 只读取受支持的文本文件。
- 单文件读取默认限制为 2 MB。
- 搜索和扫描有文件数、深度和累计读取限制。
- API 返回工作区相对路径，不向前端暴露不必要的系统路径。
- AI Context Builder 会再次排除构建目录并脱敏疑似凭据。

静态脱敏不能保证识别所有业务秘密。用户不应选择包含生产私钥、真实设备证书、客户数据或无关个人文件的工作区。

## 文件写入

安全写入流程：

1. 验证工作区已经授权。
2. 验证目标路径位于工作区。
3. 验证文件类型和内容大小。
4. 对比 `expectedModifiedAt` 与当前修改时间。
5. 如外部程序已经修改文件，返回 HTTP 409，拒绝覆盖。
6. 在 `.metacore-backups` 中创建备份。
7. 写入新内容。
8. 返回新文件元数据和备份 ID。
9. 记录脱敏后的操作摘要。

Agent `write_file` 工具还要求 `allowWrite` 和用户批准。当前前端尚未完成统一的 AI diff 审批面板，因此 AI 不应静默调用写工具；现有手动文件编辑确认流程继续作为实际交互边界。

## 备份和恢复

- 备份目录保持为工作区内的 `.metacore-backups`，兼容旧版本。
- 备份保存目标相对路径和必要元数据。
- 恢复前会再次备份当前文件，形成可回退链。
- 恢复目标仍需通过工作区路径校验。
- `restore_backup` Agent 工具需要写权限和用户审批。

备份目录不是版本控制系统，也不替代 Git。用户仍应对重要工程使用独立版本控制和离线备份。

## 构建白名单

浏览器只能提交 `profileId`，不能提交任意命令、参数、Shell 片段或工作目录。当前白名单：

- `platformio`
- `espidf`
- `cmake`

命令、参数和工作目录由服务端固定配置决定。构建默认最长 120 秒，输出最多保留 512 KB。后台 build Job 接收 AbortSignal，取消后会终止构建子进程并停止结果写入。

`run_build` Agent 工具需要 `allowBuild` 和用户批准。构建本身仍可能执行工程自带的 CMake、PlatformIO 或其他构建脚本，因此只应对受信任的本地工程运行构建。

## Agent 权限与审批

Tool Policy 将能力拆为：

- `read`
- `write`
- `build`
- `export`
- `requiresApproval`

工具执行前检查取消信号、参数、权限、审批和工作区。写文件、恢复备份和构建被标记为需要审批。权限不足或未批准时返回稳定错误码，Tool Event 不应被当作已经完成的操作。

当前 Policy 是进程内能力控制，不是操作系统沙箱。Internal Runtime 不会启动容器或低权限子账户；真正的远程、多租户或不受信任代码执行场景需要额外的 OS sandbox。

## AI 上下文

AI 请求只在用户主动执行方案、代码、流程、一致性验证或工程问答时发送。Context Builder 会：

- 排除依赖、构建、覆盖率和备份目录。
- 建立文件与函数清单。
- 按任务关键词、初始化、主循环、任务和错误处理计算相关性。
- 按 Token 预算选择片段。
- 保留来源文件和真实行号。
- 对 Bearer Token 和常见 secret 赋值进行脱敏。

脱敏是降低风险的辅助措施，不是数据丢失防护系统。向第三方 AI 服务提交源码前，用户仍需确认服务商、模型、数据政策和所选工作区内容。

## API Key

- AI 服务配置和 API Key 当前保存在浏览器 `localStorage`。
- Key 不进入 Git 工作区、项目归档、Session 元数据或操作日志。
- localhost AI Proxy 只把 Key 转发给用户配置的目标服务商。
- 日志只记录服务商、模型、目标主机、耗时、usage 和错误摘要。
- Ollama 可以不提供 Key；其他远程服务通常需要 Key。

共享电脑、浏览器同步、恶意扩展和同源脚本都可能读取浏览器存储。不要在不受信任的浏览器配置中保存正式生产凭据，交接电脑前应清除网站数据。

## 日志与脱敏

以下字段名会触发递归脱敏：Authorization、API Key、access token、token、secret、password、passwd、private key 等。字符串中的 Bearer Token 和常见 `sk-*`、`token-*` 形式也会被替换。

持久化位置：

- 操作日志：Session Root 下的 `operations.jsonl`。
- Session 元数据：`<sessionId>.json`。
- Trajectory：`<sessionId>.jsonl`。

日志不默认写入用户工程目录。脱敏规则不可能覆盖所有自定义凭据格式，用户不应把完整敏感源码作为 Job payload 或 Session metadata 提交。

## Session 数据

Session 默认保存在操作系统用户数据目录，可通过 `METACORE_SESSION_ROOT` 覆盖。服务启动时清理超过 7 天的历史 Session。

当前限制：

- 没有加密静态存储。
- 没有多用户访问控制。
- 没有按项目分页查询 API。
- 服务重启后不会恢复内存 Job 或重放历史 SSE。
- `operations.jsonl` 使用异步追加，不提供事务一致性保证。

如果设备存在多用户共享或磁盘取证风险，应把 `METACORE_SESSION_ROOT` 指向受操作系统权限保护或加密的目录，并缩短保留周期。

## 项目归档

`.metacore.json` 只包含可移植的项目设计状态。导出时移除：

- `lastSessionId`
- `run.sessionId`
- 阶段 `rawResponse`
- 阶段 `structuredResult`
- 阶段 `validationResult`

归档也不包含 AI 配置、API Key、本地工作区、日志、Session 文件或备份。导入限制为 10 MB，并校验 envelope、工程格式、生成文件路径、重复路径、流程图引用和项目字段。

## 已知安全缺口与后续优先级

1. 增加 localhost capability token 或等价的安全握手。
2. 增加有限的请求速率保护。
3. 对同一工作区的写操作和恢复操作串行化。
4. 完成前端 AI diff 审批、批准记录和重新验证闭环。
5. 持久化 Job 元数据，并在重启时把 `running` 转换为 `interrupted`。
6. 从 JSONL trajectory 重放 Session SSE。
7. 为 Session Root 提供可配置保留期和显式清理 API。
8. 扩展凭据检测并允许用户预览实际提交给 AI 的 context manifest。

在以上能力落地前，MetaCore Studio 的安全承诺限定为单用户本机研发环境，不应扩展为多用户、远程访问或不受信任代码托管服务。
