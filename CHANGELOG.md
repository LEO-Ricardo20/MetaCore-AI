# Changelog

All notable changes to MetaCore Studio are documented in this file.

The project follows [Semantic Versioning](https://semver.org/). Dates use `YYYY-MM-DD`.

## [Unreleased]

## [2.6.0] - 2026-08-28

### Added

- Added Knowledge Schema v1 integration with evidence metadata, pack validation, atomic installation, dependency checks, snapshots, fuzzy search, and strict model/alias resolution.
- Added `metacore.hardware-core@1.0.0` with 41 reviewed entities: 8 common ESP32/STM32 MCU entities and 33 common teaching-component entities.
- Added structured supply, IO, current, interface, address, pin, constraint, driver-framework, and source fields for common sensors, displays, actuators, motor drivers, RTC, MicroSD, and SPI flash.
- Added task-scoped local hardware context lookup for scheme generation, firmware generation, and AI consistency verification. Only requirement/BOM-matched facts are injected, while unlisted parts are reported explicitly.

### Changed

- Added knowledge-pack priority so the formal hardware pack wins exact alias ties over `metacore.legacy-core@1.0.0` without reusing legacy entity IDs.
- Routed preset chip lookup, the chip store, scheme prompts, and code-generation prompts through the local knowledge base while preserving custom-chip precedence and existing project compatibility.
- Updated the application version, Chinese and English README, architecture guide, local API examples, and in-app release metadata to v2.6.0.

### Compatibility and Scope

- Preserved existing chip targets, driver templates, browser storage, project archives, PDF upload, AI-assisted custom-chip entry, and manual chip entry.
- All new hardware entities are `reviewed`, not `verified`; the release does not claim page-by-page official-document verification.
- Official-source synchronization, document caching, network updates, and online on-demand retrieval are intentionally not included in this release.

### Verified

- Added tests for pack loading, formal-pack priority, model aliases, critical component constraints, task-scoped context selection, and explicit missing-coverage behavior.

### Previous Unreleased Work

### Added

- Added an AI hardware candidate flow with four user-visible categories: most common, optimal match, best value, and best overall.
- Added a 0-100 preference allocation view with a strict 100-point total, AI auto-selection, candidate cards, safety notes, and one-click generation from confirmed selections.

### Safety

- Candidate ranking now treats electrical compatibility, derating, thermal/current headroom, documentation completeness, lifecycle, and supply stability as hard gates before cost or performance preferences.
- Confirmed models, selection weights, rationale, and safety summary remain attached to the project for later regeneration and review.

### Changed

- Updated the visible release version to `v2.5.0-harness.2` and refreshed the in-app user-facing release notes.
- Slider edits now automatically rebalance the other preference categories so the allocation remains exactly 100 points.
- Hardware generation now has an application-level model preflight: generic requirements pause for model candidates before any BOM or pin plan is generated.
- Candidate requests include the user's current per-question answer, so voltage, current, environment, and known-part details reach the AI selection prompt.

### Harness Integration

- Integrated the `v2.5.0-harness.1` Harness refactor preview based on DeepSeek Harness `dsh-v0.1.1-rc.2`.
- Added the selectable DeepSeek Harness Runtime, Cordis composition, stdio JSON-RPC adapter, session trajectory events, MetaCore bridge tools, file Diff approvals, build approvals, task cancellation/retry, build-failure Agent entry point, Runtime settings status, and the Harness migration/user guides.
- Preserved the MetaCore workspace boundary, backups, modification-time conflict checks, build allowlist, and final approval as the authority for high-risk actions.
- Added visible per-provider request timeout and maximum output-token controls to AI service settings.

### Security and Operations

- Unified browser AI traffic through the localhost MetaCore gateway by default; browser-direct fallback now requires the explicit `VITE_METACORE_ALLOW_DIRECT_AI=true` development override.
- DeepSeek Harness tasks now reuse the active, verified DeepSeek service's API key, Base URL, model, and output budget. `DEEPSEEK_API_KEY` remains an optional server-side fallback.
- Increased the default provider request timeout from 90 to 180 seconds and allowed a bounded 30-to-600-second UI setting.

### Documentation

- Reworked the Chinese and English README prose, normalized inline UI labels and code formatting, and added an author's note describing the project's origin and its relationship to IterXAI.
- Updated Harness, security, and local API documentation to describe the integrated Runtime rather than the earlier two-directory migration state.

### Fixed

- Fixed the hard-coded “90 seconds” message that could disagree with the real timeout.
- Preserved actionable AI error codes for authentication, missing endpoints/models, rate limits, upstream failures, connection failures, cancellation, and timeouts through the Job layer.
- Normalized full `/chat/completions`, `/responses`, and `/models` URLs pasted into Base URL fields, and stopped sending `temperature` to reasoning-model routes that reject sampling controls.

## [2.4.0] - 2026-08-23

### Added

- Added an ESP32 specialization layer for ESP32, ESP32-S3, ESP32-C3, ESP32-C6, and ESP32-S2 with separate SoC, module, development-board, PlatformIO board, ESP-IDF target, Flash, PSRAM, USB, wireless, serial, partition, and source metadata.
- Added the ESP32 board configuration wizard to project creation and requirement generation, including board-aware framework availability and locally verified PlatformIO manifest status.
- Added board-aware GPIO validation for reserved, unavailable, input-only, strapping, USB-shared, and duplicate pin assignments.
- Added `docs/ESP32_SPECIALIZATION.md` with a five-family comparison and practical Arduino, PlatformIO, and ESP-IDF setup flows.

### Changed

- PlatformIO prompt skeletons now generate the selected board ID, framework, Flash mode, partition, upload speed, and monitor speed instead of always using `esp32dev`.
- ESP-IDF prompt skeletons now record the selected `idf.py set-target` and matching Flash configuration.
- Project Schema 3 stores an optional ESP32 board profile while automatically migrating older ESP32 projects to a compatible default.
- Deterministic Mock Provider fixtures now honor the board ID and recommended I2C pins injected by the same production prompt path.

### Fixed

- Removed fabricated ESP32-S3 DAC capabilities and stopped treating the N8 board profile as an N16R8 module with 8MB PSRAM.
- Prevented ESP32-C6 PlatformIO Arduino from appearing as verified when the installed board manifest only declares ESP-IDF.

### Verified

- Verified 33 unit tests, localhost smoke tests, production build, classic ESP32 cancellation/retry, and a complete ESP32-C3 PlatformIO Mock generation workflow.
- Verified the generated C3 `platformio.ini` contains `board = esp32-c3-devkitm-1` and never falls back to `esp32dev`.
- Re-scanned and successfully built `examples/esp32-smart-environment` through the allowlisted real PlatformIO build entry. No physical-device flash was claimed.

## [2.3.1] - 2026-08-19

### Changed

- Updated primary action buttons to share the Project Manager's blue-cyan to indigo gradient, hover lift, and restrained glow for a consistent visual hierarchy across workspace, design, implementation, verification, local analysis, and chip workflows.
- Refined the dark theme from near-black surfaces to a blue-gray graphite palette with distinct ambient blue, teal, violet, and workflow-stage accents.

### Fixed

- Fixed the pending-issues menu overflowing or being clipped by the sidebar; it now uses a viewport-aware portal position, flips above the trigger when needed, and remains usable on narrow mobile screens.
- Fixed cancellation races where a backend Job could continue after the user cancelled before the frontend received its Job ID; newly created Jobs are now cancelled immediately when the signal is already aborted.
- Kept the GitHub repository entry visible in the fixed sidebar system area instead of allowing navigation scrolling to hide it.

### Verified

- Added browser assertions and screenshots for pending-issues viewport bounds, desktop/mobile layouts, GitHub link behavior, light/dark workspace surfaces, project primary actions, and the standalone changelog section.

## [2.3.0] - 2026-08-19

### Added

- Added the Project Schema v2 lifecycle model, artifact freshness propagation, pipeline run metadata, and explicit project version support.
- Added the internal, Harness-inspired Agent Runtime with static plugin/service/tool registries, background jobs, cancellation, retry, SSE events, sessions, and redacted JSONL trajectories.
- Added versioned AI Task Contracts and budgeted, relevance-scored code context selection for flow and consistency tasks.
- Added product workflow, Agent architecture, security model, local API, and portable project format documentation.
- Added deterministic browser workflow coverage plus a real ESP32 PlatformIO workspace smoke test.
- Added real generation progress, cancellation, retry, stale-artifact propagation, and refresh recovery across the staged project workflow.

### Changed

- Consolidated the browser information architecture into Workspace, Design, Implementation, Verification, and Projects, while keeping legacy routes redirect-compatible.
- Migrated persisted projects without clearing the existing `metacore-projects` browser storage key.
- Updated localhost requests and delivery verification so real workspace scanning is exercised through the browser UI.
- Redirected the localhost service root to the frontend and extended the real ESP32 browser smoke through an actual PlatformIO build.

### Fixed

- Fixed generation progress timing so React render purity checks pass while elapsed time continues updating correctly.
- Fixed workflow actions that previously depended on synchronous generation paths by connecting the primary staged workflow to Session, Job, and SSE state.
- Fixed light-theme text and status contrast across workflow and verification surfaces.
- Fixed the backend root URL returning `ROUTE_NOT_FOUND`; it now redirects to the configured frontend URL.

### Verified

- Passed lint, TypeScript checking, 26 unit tests, localhost smoke tests, production build, deterministic browser E2E, and real-project browser E2E through `npm run verify:delivery`.
- Scanned and built `examples/esp32-smart-environment` through the allowlisted backend PlatformIO build entry, producing a non-empty ESP32 firmware binary with a real `SUCCESS` result.
- Kept deterministic Mock Provider verification explicitly separate from real DeepSeek provider verification and from physical-device flashing.

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
