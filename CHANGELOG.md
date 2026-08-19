# Changelog

All notable changes to MetaCore Studio are documented in this file.

The project follows [Semantic Versioning](https://semver.org/). Dates use `YYYY-MM-DD`.

## [Unreleased]

### Added

- Added the Project Schema v2 lifecycle model, artifact freshness propagation, pipeline run metadata, and explicit project version support.
- Added the internal Harness-inspired Agent Runtime with static plugin/service/tool registries, background jobs, cancellation, retry, SSE events, sessions, and redacted JSONL trajectories.
- Added versioned AI Task Contracts and budgeted, relevance-scored code context selection for flow and consistency tasks.
- Added product workflow, Agent architecture, security model, local API, and portable project format documentation.
- Added deterministic browser workflow coverage plus a real ESP32 PlatformIO workspace smoke test.

### Changed

- Consolidated the browser information architecture into Workspace, Design, Implementation, Verification, and Projects, while keeping legacy routes redirect-compatible.
- Migrated persisted projects without clearing the existing `metacore-projects` browser storage key.
- Updated localhost requests and delivery verification so real workspace scanning is exercised through the browser UI.

## [2.2.0] - 2026-08-17

### Changed

- Renamed the product from MetaCore AI to MetaCore Studio across the web UI, documentation, reports, prompts, startup scripts, examples, and repository metadata.
- Renamed the npm package to `metacore-studio` and the GitHub repository slug to `MetaCore-Studio`.
- Updated browser metadata, logo accessibility text, and Chinese and English release documentation for the new brand.

### Compatibility

- Preserved existing browser storage keys so saved projects, AI provider settings, chips, themes, and user preferences continue to load after the rename.
- Preserved the `metacore.project` archive kind, `.metacore.json` files, `.metacore-backups`, localhost configuration filename, and localhost API routes.

## [2.1.0] - 2026-08-04

### Added

- Versioned `.metacore.json` project export and import from the project manager.
- Runtime validation for imported project metadata, hardware schemes, generated paths, code size, and flow references.
- Unit tests for portable project files, duplicate imports, canonical project updates, and active-project deletion.
- Modular localhost-service configuration, HTTP/CORS, workspace-path security, and AI-provider transport files.
- An AI provider adapter contract with `call` and `listModels` methods for future supplier integrations.

### Changed

- Replaced the duplicated `projectStore` and `projectsStore` state with one canonical persisted project store.
- Kept generation state and selected files session-only while persisting project data and the active project ID.
- Preserved the existing `metacore-projects` browser storage key so current project lists migrate without a destructive reset.
- Reduced the responsibilities of `server/index.mjs` without changing the localhost API surface.

### Security

- Project imports reject unknown schemas, unsupported formats, unsafe generated paths, oversized archives, and invalid flow edges.
- Project archives contain project design data only; AI service configuration and API keys are not exported.
- No public cloud AI API, shared provider key, billing integration, or supplier-specific backend was added.

## [2.0.1] - 2026-07-29

### Added

- Unified MetaCore Studio SVG, browser favicon, and Apple touch icon assets.
- Reusable `MetaCoreLogo` component for consistent application branding.
- GitHub issue forms, pull request template, contribution guide, security policy, code of conduct, and repository license file.
- Runtime validation for AI-generated hardware schemes, code files, flow graphs, verification results, and chip specifications.
- Request cancellation, total request timeouts, and limited retry handling for transient AI provider failures.
- Vitest coverage for AI result validation and generated-file path safety.
- ESLint, type-check, test, smoke-test, and production-build scripts with GitHub Actions CI.

### Changed

- Reused the shared brand component in the sidebar and About page.
- Expanded the Chinese and English README files with project branding and GitHub collaboration documentation.
- Unified manual page generation and the one-click pipeline on shared AI workflow services.
- Lazy-loaded route pages and heavy PDF, Monaco, flow, and export dependencies.
- Upgraded the build toolchain to Vite 8 and raised the minimum Node.js version to 20.19.
- Stopped tracking generated `dist` output in the source repository.

### Fixed

- Included the STM32 HAL template in production builds and made public asset URLs respect the Vite base path.
- Rejected malformed AI output before it can enter Zustand stores or crash result components.
- Rejected unsafe absolute, parent-relative, duplicate, or oversized AI-generated project files.
- Corrected stale React Flow memoization and state synchronization dependencies.

### Security

- Canonicalized workspace paths with `realpath` checks before local file access.
- Blocked workspace escape through symbolic links and Windows directory junctions.
- Added a regression test that verifies linked external files cannot be listed or read.

## [2.0.0] - 2026-07-16

### Added

- Optional localhost engineering service bound to `127.0.0.1`.
- User-selected workspace browsing, text search, and Monaco file preview.
- Embedded project detection for PlatformIO, ESP-IDF, Arduino, STM32CubeIDE, and CMake.
- Chip, peripheral, IoT protocol, dependency, GPIO, code-statistics, and security analysis.
- Five-dimensional project health scoring and Markdown diagnosis reports.
- User-confirmed file editing with modification-time conflict detection.
- Automatic workspace backups and restore support.
- Allowlisted PlatformIO, ESP-IDF, and CMake build verification.
- Local API smoke test and public API documentation.
- ESP32 smart-environment PlatformIO example.

### Changed

- Reorganized the application from a browser-only generator into a browser application with an optional local engineering layer.
- Centralized the frontend and local-service version around `package.json`.
- Updated repository documentation, startup scripts, privacy language, and security guidance.

### Security

- Local service accepts localhost browser origins only.
- File paths are normalized and restricted to the selected workspace.
- File saves create backups and reject stale modification timestamps.
- Build execution uses fixed server-side profiles instead of arbitrary commands.

## [1.5.6] - 2026-03-25

### Added

- One-click generation pipeline for scheme, code, and flow graph.
- Persistent manually selected driver templates.

## [1.5.0] - 2026-03-21

### Added

- Custom chip management with datasheet parsing, AI-assisted entry, and manual configuration.
- Expanded chip specification knowledge base.
- AI consistency verification after code generation.

## [1.0.0] - 2026-03-17

### Added

- Initial hardware requirement, scheme generation, firmware generation, flow graph, and AI provider configuration.
