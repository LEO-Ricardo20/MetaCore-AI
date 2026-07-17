# Contributing to MetaCore AI

[English](#english) | [简体中文](#简体中文)

## English

Thank you for helping improve MetaCore AI. Contributions should stay focused on embedded engineering workflows, hardware safety, maintainable frontend architecture, and controlled localhost operations.

### Development setup

```bash
npm install
npm run dev
npm run dev:server
```

The frontend and localhost service run as separate processes. Do not commit API keys, local workspace data, generated backups, or provider credentials.

### Change workflow

1. Create a focused branch from `main`.
2. Keep changes within the existing module boundaries under `components`, `services`, `store`, `types`, and `server`.
3. Add reusable components when the same behavior or visual element appears in more than one place.
4. Add or update smoke tests for localhost service behavior.
5. Run the required checks before opening a pull request.

```bash
npm run test:local
npm run build
```

### Pull requests

- Explain the user-visible behavior and technical approach.
- Keep unrelated refactors out of the same pull request.
- Include screenshots for UI changes.
- Document new configuration, API routes, security boundaries, or migration steps.
- Confirm that no secrets or personal local data are included.

## 简体中文

感谢参与改进 MetaCore AI。贡献内容应围绕嵌入式工程流程、硬件安全、可维护的前端架构以及受控的 localhost 本地操作展开。

### 开发环境

```bash
npm install
npm run dev
npm run dev:server
```

前端和本地服务需要分别启动。请勿提交 API Key、本地工作区内容、自动备份文件或服务商凭据。

### 修改流程

1. 从 `main` 创建职责明确的功能分支。
2. 保持 `components`、`services`、`store`、`types` 和 `server` 等现有模块边界。
3. 同一行为或视觉元素出现多次时，优先提取可复用组件。
4. 修改本地服务行为时，添加或更新冒烟测试。
5. 创建 Pull Request 前运行必要检查。

```bash
npm run test:local
npm run build
```

Pull Request 应说明用户可见变化和技术实现；UI 修改应附截图；新增配置、API、安全边界或迁移步骤应同步更新文档。
