# MetaCore Studio Harness 使用手册

这份手册面向第一次运行 MetaCore Studio Harness Runtime 的开发者。它假设 Windows、Node.js 20.19+、npm 9+，以及一个可通过 `METACORE_HARNESS_ROOT` 指定的 DeepSeek Harness checkout 已经存在。

## 目录关系

```text
<parent-directory>\
├── deepseek-harness\             # 上游源码，只读依赖，不在这里改
└── MetaCore-Studio\              # MetaCore Studio 项目目录
```

## 首次安装

在 DeepSeek Harness 目录执行一次：

```powershell
cd <deepseek-harness-path>
pnpm install
```

在 MetaCore Studio 项目目录执行：

```powershell
cd <metacore-studio-path>
npm ci
```

不要在两个目录之间混用 `node_modules`、`npm install` 和 `pnpm install`。Harness 的 workspace 依赖由它自己的 `pnpm-lock.yaml` 管理。

## 启动

推荐打开两个 PowerShell。API Key 可以稍后在界面设置，不必先写环境变量：

```powershell
# PowerShell A：本地服务和 Harness Runtime
cd <metacore-studio-path>
npm run dev:server
```

```powershell
# PowerShell B：Vite UI
cd <metacore-studio-path>
npm run dev
```

浏览器打开 Vite 输出的地址，默认一般是 `http://127.0.0.1:5173`。localhost 服务默认监听 `127.0.0.1:3766`。

启动后先检查：

```powershell
Invoke-RestMethod http://127.0.0.1:3766/api/health | ConvertTo-Json -Depth 8
Invoke-RestMethod http://127.0.0.1:3766/api/agent/runtime | ConvertTo-Json -Depth 8
```

如果 `harness.ready` 为 `false`，先看 `sourceAvailable`、`dependenciesInstalled` 和 `configAvailable` 哪一项不满足。`credentialConfigured` 只表示服务端环境变量；设置页已启用的 DeepSeek 也可以在启动任务时提供凭据。

## 第一次配置 AI

1. 打开“设置”。
2. 编辑 `DeepSeek`，填写 DeepSeek 开放平台创建的 API Key。
3. Base URL 使用 `https://api.deepseek.com/v1`，不要再追加 `/chat/completions`。
4. 点击“读取模型”并选择账户实际可用的模型，或先使用 `deepseek-chat`。
5. 请求超时建议先设为 180 秒；慢速推理模型可设为 300 到 600 秒。
6. 保存后点击“测试”，测试成功后点击“使用”。

完成后，普通 AI 问答和 Agent 会使用当前“使用中”的服务。设计、固件、代码一致性和流程图这类长结构化任务会单独选择已验证的官方 DeepSeek；没有官方 DeepSeek 时才选择已验证的硅基流动 DeepSeek，最后才回退到当前“使用中”的服务。设计页会直接显示本次结构化生成将使用的服务。

## 硬件型号确认流程

在需求中没有写出传感器、显示屏、执行器、驱动器、电源或通信模块的明确型号时，点击“生成方案”会先暂停并打开型号确认对话框，不会让 AI 直接猜 BOM。

1. 在“最常用 / 最优 / 最有性价比 / 最好”四个滑杆中分配偏好。拖动任意一项时，其他项会自动挪动点数，四项始终合计 100。
2. 点击“一键生成全部候选”，查看每个问题的四类候选、型号、依据、成本估算、安全注意事项和风险。
3. 点击候选卡片手动选择，或点击“AI 自动选择”采用通过安全门槛后的保守推荐。候选请求会同时带上你在文本框里填写的电压、电流、环境和已知型号。
4. 确认每个问题后点击“用所选型号生成方案”。只有这一步之后，硬件方案、引脚分配、BOM 和接线才会继续生成。

如果需求里已经明确写出可核对的完整器件型号，系统会允许直接进入方案生成；但模型仍必须在提示词中核对电气、电流、环境和保护条件，不能静默替换型号。

如果官方 DeepSeek 服务的模型填写为 `deepseek-v4-flash`，MetaCore 在上述结构化任务中会自动用同一 Key 切换到 `deepseek-chat`。V4 Flash 在长 JSON 任务中可能把输出预算全部用于推理，返回 `finish_reason=length` 而没有最终文本；普通短问答和 Harness 任务仍按设置页选择的模型发送。硅基流动新建服务默认填写 `deepseek-ai/DeepSeek-V4-Flash`，旧的 V3 配置需要先在服务卡片中测试，失败就删除或重新编辑。

## 第一个 Agent 任务

1. 在“本地”页面输入一个工程目录并点击“启用”。
2. 先点击“扫描”，让 MetaCore 生成结构化分析。
3. 点击右下角“Agent 任务”。
4. 选择 `DeepSeek Harness`，输入例如：

   ```text
   检查当前 ESP32-C3 工程的 GPIO 分配、依赖和构建风险。先使用只读工具收集证据，不要修改文件；最后给出下一步验证动作。
   ```

5. 观察任务抽屉中的 Runtime 状态、session 事件、工具事件和 subagent 事件。
6. 如果 Agent 提出文件修改或构建，会出现等待批准的卡片。先检查路径、旧内容/新内容或构建 profile，再点击“批准并执行”或“拒绝”。

## 从构建失败进入 Agent

在“本地 -> 工程诊断 -> 构建”点击白名单构建。失败后点击“让 Agent 诊断并修复”，任务抽屉会自动打开，并把构建命令、退出码和 stdout/stderr 作为目标上下文。

Agent 仍然只能提出 Diff。批准前不要把“建议修改”理解成“文件已修改”；批准后再重新扫描和构建确认。

## Runtime 选择

| Runtime | 用途 | 凭据 |
| --- | --- | --- |
| DeepSeek Harness | 多步 Agent loop、Cordis tools、subagent 和 session trajectory | 已验证的官方 DeepSeek 优先；否则使用硅基流动中的 DeepSeek 模型；或服务端 `DEEPSEEK_API_KEY` 回退 |
| MetaCore Internal | 单轮 AI 兼容调用，适合回退、调试和没有 Harness 依赖的环境 | Settings 中启用的 AI service |

DeepSeek Harness 优先使用设置页中已验证的官方 DeepSeek；如果没有，则使用当前已启用的硅基流动 DeepSeek 模型。两者都没有时，才使用 `METACORE_HARNESS_MODEL`，默认 `deepseek-v4-flash`。设置页只显示凭据来源，不显示 Key 内容。

Harness 会根据模型自动选择 thinking：普通 `deepseek-chat` 默认关闭，`deepseek-reasoner` 和 `deepseek-v4-*` 默认使用 high。这样不会把推理参数错误发送给普通 Chat 模型。

## 常用环境变量

```powershell
$env:METACORE_AGENT_RUNTIME = 'deepseek-harness'
$env:METACORE_HARNESS_ROOT = '<deepseek-harness-path>'
$env:METACORE_HARNESS_MODEL = 'deepseek-v4-flash'
$env:METACORE_HARNESS_MAX_TOKENS = '8192'
$env:METACORE_AI_TIMEOUT_MS = '180000'
$env:METACORE_SESSION_ROOT = 'C:\Users\你的用户名\AppData\Local\MetaCore Studio\sessions'
```

不要把 `DEEPSEEK_API_KEY`、bridge token 或这些变量写入 Git 跟踪的 YAML、README、项目归档或截图。

## 常见问题

### Runtime 未就绪

确认 `deepseek-harness/node_modules/tsx` 存在，并重新运行 `pnpm install`。确认项目目录中的 `harness/cordis.yml` 和 `harness/metacore-tools.mjs` 存在。凭据既可来自设置页已启用的 DeepSeek，也可来自启动 `npm run dev:server` 的同一 PowerShell 中的 `DEEPSEEK_API_KEY`。

### Harness 启动后立即退出

查看服务端 stderr。Harness JSON-RPC stdout 必须保持纯协议；插件加载错误、配置错误和凭据错误会写到 stderr 并映射为 Job error。不要把 MetaCore 的 `harness` 子目录误设为 `METACORE_HARNESS_ROOT`，该变量必须指向包含 `packages/core/tools` 的 DeepSeek Harness 根目录。

### 批准后仍然没有写入

检查工作区是否仍然是当前授权目录、目标文件是否被其他程序修改，以及审批状态是否为 `executed`。如果 mtime 发生变化，MetaCore 会返回冲突并要求重新读取和重新提议 Diff。

### 没有 API Key 但想测试 UI

可以启动服务并查看 Runtime 状态、bridge 未授权行为、审批 API 和 Internal Runtime UI。DeepSeek Harness 的真实模型任务不会在没有 Key 时执行，文档和 UI 会明确显示这一点。

### AI 请求超时

先在设置页点击“测试”。如果短测试也失败，优先检查 Key、Base URL、模型、账户余额、限流和网络代理。如果短测试成功但生成失败，把任务拆小，或把该服务的超时从 180 秒提高到 300 到 600 秒。错误信息会显示实际超时、服务商、模型和主机；设计生成使用设置页超时，Harness JSON-RPC 默认最多等待 10 分钟。

## 升级与回滚

升级 MetaCore Studio 时，只修改当前项目目录；升级 Harness 时，在 `deepseek-harness` 中切换到经过验收的 tag 并重新运行 `pnpm install`，然后执行项目的完整检查。不要把 Harness 源码复制进 MetaCore，也不要绕过工作区边界执行迁移脚本。
