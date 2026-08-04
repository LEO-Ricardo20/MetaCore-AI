# Security Policy

## Supported version

Security fixes are applied to the latest version on the `main` branch unless a release notice states otherwise.

## Reporting a vulnerability

Do not publish vulnerabilities, API keys, tokens, private source files, or local workspace data in a public issue.

Use GitHub private vulnerability reporting when it is available for this repository. If private reporting is unavailable, contact the repository owner through GitHub before sharing technical details publicly.

Include only the information required to reproduce the problem:

- Affected version or commit.
- Affected frontend page, localhost endpoint, or workflow.
- Reproduction steps and expected impact.
- Whether local files, credentials, or external AI providers are involved.
- A minimal proof of concept with secrets removed.

## Project security boundaries

- The localhost service must remain bound to loopback interfaces.
- Filesystem access must remain inside the user-selected workspace.
- Workspace containment checks must use canonical real paths and reject symbolic-link or directory-junction escapes.
- Arbitrary shell commands must not be accepted from the browser.
- File writes must preserve backup and modification-conflict checks.
- API keys and browser-local data must never be committed to the repository.
- AI requests must only include local project context after an explicit user action.
- Portable project imports must preserve schema, size, generated-path, and flow-reference validation.
- Portable project exports must not include AI provider configuration, API keys, workspace paths, logs, or backups.

## Dependency audit note

As of `2026-08-04`, `npm audit` reports one upstream React Router advisory through both `react-router` and `react-router-dom`: [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2). The advisory affects React Server Components action handling. MetaCore AI uses a client-only `HashRouter` and does not enable React Server Components, route actions, or server-side React Router execution. `react-router-dom` remains pinned to `7.18.2` for the current client API and must be upgraded when a compatible upstream fix becomes available. Do not use `npm audit fix --force` to apply the suggested downgrade.

中文说明：请勿在公开 Issue 中提交漏洞细节、API Key、访问令牌、私人源代码或本地工作区数据。优先使用 GitHub 私密漏洞报告功能，并在公开讨论前删除所有敏感信息。
