# MetaCore Studio

[English](./README_EN.md) | [简体中文](./README.md)

<p align="center">
  <img src="./public/logo.svg" alt="MetaCore Studio logo" width="96" />
</p>

> AI-assisted hardware design, firmware generation, and local embedded project analysis for ESP32, STM32, and custom chips.

面向 ESP32、STM32 与自定义芯片的 AI 硬件方案生成、固件设计和本地嵌入式工程分析平台。

Documentation language: English with Chinese UI names where they match the application.

[![React](https://img.shields.io/badge/React-18-149eca?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![Node](https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Version](https://img.shields.io/github/package-json/v/LEO-Ricardo20/MetaCore-Studio?label=version&color=16a34a)](#release-status)
[![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-lightgrey)](#license)

MetaCore Studio turns a natural-language hardware requirement into a structured embedded design workflow. When a part number is unknown, the clarification dialog can request conservative AI candidates, allocate a strict 100-point preference budget across common, optimal, value, and best options, auto-select a model, and continue only after confirmation:

```text
Requirement -> Hardware scheme -> Pin/BOM/Wiring -> Firmware -> Flow graph -> Local diagnosis -> Export
```

The browser application handles the product interface and AI workflows. An optional localhost service adds controlled access to a user-selected embedded project directory for analysis, backups, editing, and build verification.

## Contents

- [Highlights](#highlights)
- [Architecture](#architecture)
- [ESP32 Specialization](#esp32-specialization)
- [Release Status](#release-status)
- [Sponsor](#sponsor)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Local Engineering Mode](#local-engineering-mode)
- [AI Providers](#ai-providers)
- [DeepSeek Harness Runtime](#deepseek-harness-runtime)
- [Example Project](#example-project)
- [Commands](#commands)
- [Security Boundaries](#security-boundaries)
- [Testing](#testing)
- [Versioning](#versioning)
- [Changelog](#changelog)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Contributing](#contributing)
- [GitHub Collaboration Files](#github-collaboration-files)
- [License](#license)
- [Author's Note](#authors-note)

## Highlights

| Area | What it provides |
| --- | --- |
| Hardware design | Chip selection, GPIO allocation, BOM, wiring table, and pin visualization |
| AI candidate selection | Four conservative candidate categories, safety gates, weighted preferences, and confirmed model selection |
| Preference budget | A strict 100-point allocation across common, optimal, value, and best options |
| ESP32 specialization | Five board-aware family profiles with correct PlatformIO/IDF targets, storage, USB, radio, and GPIO policy |
| Firmware generation | Modular C/C++ project generation for Arduino, PlatformIO, ESP-IDF, and STM32CubeIDE |
| Driver library | Built-in templates for SSD1306, DHT, AHT20, WS2812, HC-SR04, buzzer, servo, and DRV8833 |
| AI verification | Post-generation consistency checks against the selected hardware scheme |
| Flow visualization | Interactive execution-flow graph with code context and AI assistant |
| Custom chips | Datasheet parsing, AI-assisted form filling, and manual chip specification |
| Local engineering mode | Directory browsing, text search, code preview, static analysis, health scoring, and reports |
| Safe operations | User-confirmed file editing, modification-time conflict detection, automatic backups, and restore |
| Build verification | Detect and run allowlisted PlatformIO, ESP-IDF, and CMake builds |
| Export | ZIP firmware project packages and formatted PDF design documents |
| Project portability | Validated `.metacore.json` import and export without API keys |

## Architecture

```mermaid
flowchart LR
    User[User] --> Web[React + TypeScript Web UI]
    Web --> AI[Configured AI Provider]
    Web --> Local[Optional localhost service]
    Local --> Workspace[User-selected workspace]
    Local --> Analyzer[Embedded project analyzer]
    Local --> Backup[Backup and restore]
    Local --> Build[Allowlisted build tools]
    Analyzer --> Report[Structured diagnosis report]
    Report --> Web
```

The localhost service provides the local AI proxy and the `本地` workspace boundary. Requirement generation, chip management, code generation, flow graphs, and export can run in the browser, but the local proxy is recommended for AI providers that do not allow browser CORS.

## ESP32 Specialization

Version 2.4.0 separates the SoC family, module, development board, and build identifier instead of treating all of them as a single chip name:

| Family | Default board | PlatformIO board | ESP-IDF target | Main use |
| --- | --- | --- | --- | --- |
| ESP32 | ESP32 Dev Module | `esp32dev` | `esp32` | Mature Wi-Fi and Bluetooth ecosystem |
| ESP32-S3 | ESP32-S3-DevKitC-1 N8 | `esp32-s3-devkitc-1` | `esp32s3` | USB, BLE 5, vector instructions |
| ESP32-C3 | ESP32-C3-DevKitM-1 | `esp32-c3-devkitm-1` | `esp32c3` | Low-cost RISC-V Wi-Fi/BLE nodes |
| ESP32-C6 | ESP32-C6-DevKitC-1 | `esp32-c6-devkitc-1` | `esp32c6` | Wi-Fi 6, Thread, Zigbee, BLE 5 |
| ESP32-S2 | ESP32-S2-Saola-1 | `esp32-s2-saola-1` | `esp32s2` | USB OTG and Wi-Fi without Bluetooth |

The project and requirement screens now expose board, module, Flash, PSRAM, USB, radio, partition, upload-speed, and monitor-speed configuration. Generation rejects unsupported board/framework combinations and validates reserved, unavailable, input-only, strapping, USB-shared, and duplicate GPIO assignments. PlatformIO skeletons use the selected board ID instead of always falling back to `esp32dev`.

See [`docs/ESP32_SPECIALIZATION.md`](docs/ESP32_SPECIALIZATION.md) for the family comparison, practical Arduino/PlatformIO/ESP-IDF setup, sources, and next-stage roadmap.

## Release Status

Current release: **v2.5.0-harness.2** (`2026-08-25`). This release adds conservative AI candidate selection, a four-way 100-point preference view, model confirmation evidence, one-click scheme generation from selected models, and the integrated DeepSeek Harness Runtime.

Version 2.4.0 introduces board-aware ESP32 specialization for ESP32, S3, C3, C6, and S2. Projects now retain the exact PlatformIO board, ESP-IDF target, Flash, PSRAM, USB, radio, partition, upload, and monitor configuration; prompt skeletons no longer hard-code `esp32dev`, and board-level GPIO policy runs after scheme generation. The complete Mock workflow was verified with ESP32-C3, while the repository's classic ESP32 example was scanned and built with the real PlatformIO toolchain. Mock results are not presented as real DeepSeek calls, and a successful build does not imply a physical board was flashed.

> [!IMPORTANT]
> MetaCore Studio generates engineering suggestions and code, not verified production hardware. Always validate pin assignments, electrical limits, dependencies, and firmware against the actual datasheet and target board.

> [!CAUTION]
> The local workspace can expose source files to the application. AI providers only receive local engineering context when you explicitly start an AI analysis, but you should still avoid selecting folders containing private keys, production credentials, or unrelated personal data.

## Sponsor

VPS.Town is a platform focused on VPS and cloud server services, providing stable and flexible cloud resources for developers, personal website owners, and project teams. Its services are suitable for website deployment, application hosting, development and testing, and personal project operations. We thank VPS.Town for supporting the development and public collaboration around MetaCore Studio.

<a href="https://vps.town/" target="_blank" rel="noreferrer">
  <img src="./public/sponsor.png" alt="VPS.Town sponsor" width="900" />
</a>

- [VPS.Town official website](https://vps.town/)

## Requirements

- Windows, macOS, or Linux
- Node.js 20.19 or newer
- npm 9 or newer
- A compatible AI provider, if you want AI generation or AI diagnosis
- PlatformIO, ESP-IDF, or CMake only when you want local build verification

## Quick Start

### Browser application

```bash
git clone https://github.com/LEO-Ricardo20/MetaCore-Studio.git
cd MetaCore-Studio
npm ci
npm run dev
```

Vite will print the local URL, normally `http://localhost:5173`.

For Windows, `start.bat` starts the browser-only application. It does not need the local file service.

## Local Engineering Mode

### Frontend and local service

The local mode runs as two processes:

```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev
```

Windows users can double-click `start-local.bat` to start both processes. The service listens on `127.0.0.1:3766` and the web UI normally runs on `127.0.0.1:5173`.

Open the `本地` page, set a workspace path, and click `扫描`. The analyzer can identify:

- PlatformIO, ESP-IDF, Arduino, STM32CubeIDE, and CMake projects
- ESP32, ESP32-S3, ESP32-C3, ESP32-C6, ESP32-S2, STM32F103, and STM32F4 references
- GPIO definitions and common pin calls
- DHT, OLED, WS2812, servo, motor, I2C, SPI, and UART clues
- Wi-Fi, MQTT, HTTP, WebSocket, BLE, LoRa, Zigbee, Modbus, and CoAP clues
- `#include` dependencies and PlatformIO `lib_deps`
- Code size, language distribution, and comment ratio
- Hard-coded credentials and plain-text network endpoints

The current workspace is not exposed to the public network by the service. File edits require confirmation and create a backup before writing.

API details are documented in [`docs/LOCAL_API.md`](docs/LOCAL_API.md).

## AI Providers

Configure providers from the `设置` page. The current client supports:

- DeepSeek
- SiliconFlow
- Qwen
- OpenAI Responses API
- Ollama-compatible local models
- Custom OpenAI-compatible endpoints

Custom endpoints can use either the Responses API or Chat Completions. CCH-compatible endpoints such as `autobits.cc` use the Responses API according to their provider documentation. Use the provider's `/models` response as the source of truth for model IDs.

AI keys are stored in the browser's `localStorage` by the current implementation. Browser storage is outside the Git working tree and is not included by `git add`, commit, or push. AI traffic uses the localhost MetaCore gateway by default; the service forwards the key only to the configured provider and does not persist it or write it to operation logs. Browser-direct calls require the explicit `VITE_METACORE_ALLOW_DIRECT_AI=true` development override. Each provider can use a bounded 30-to-600-second timeout; the default is 180 seconds.

MetaCore Studio does not currently provide a public cloud AI API. Future supplier integrations should implement the existing `call` and `listModels` adapter contract in a separately secured service with authentication, rate limits, and cost controls. Supplier secrets must never be committed to this repository.

Do not use a shared browser profile for production credentials. Clear the site's browser data before handing the computer to another user, never place real keys in source files, screenshots, issues, or exported configuration, and review the provider's privacy policy before sending source code or datasheets for analysis.

## DeepSeek Harness Runtime

The optional DeepSeek Harness Runtime is selected by default when its source checkout, dependencies, configuration, and credentials are available. It is based on source tag `dsh-v0.1.1-rc.2`; `MetaCore Internal` remains available as a fallback when Harness is not ready.

Install the Harness workspace once with `pnpm install`, then start the localhost service and Vite UI. In `设置`, test and activate a DeepSeek service; Harness tasks reuse its API key, Base URL, model, and output budget. A server-side `DEEPSEEK_API_KEY` remains an optional fallback. The Agent task drawer shows Runtime readiness, session/tool/subagent trajectory, and approval cards. Harness can inspect the authorized workspace through the MetaCore bridge, but file changes and builds become approval records first. It cannot use raw shell or filesystem plugins.

The detailed setup and troubleshooting guide is [`docs/HARNESS_USER_GUIDE.md`](docs/HARNESS_USER_GUIDE.md); the implementation roadmap is [`docs/HARNESS_MIGRATION_PLAN.md`](docs/HARNESS_MIGRATION_PLAN.md).

## Typical Workflow

1. Open `设置` and configure an AI provider.
2. Open `方案`, describe the hardware requirement, and select a target chip and project format.
3. Generate the hardware scheme and review the pin diagram, BOM, and wiring table.
4. Generate firmware code and run the built-in AI consistency check.
5. Open `流程` to inspect the generated execution flow.
6. Export a ZIP project or PDF design document.
7. Optionally open `本地`, select an existing embedded project, scan it, and review the diagnosis report.

## Example Project

The repository includes a small PlatformIO example for local analysis:

[`examples/esp32-smart-environment`](examples/esp32-smart-environment/)

It demonstrates ESP32, Wi-Fi, MQTT, DHT22, SSD1306, I2C, GPIO extraction, dependency detection, and PlatformIO build detection. Replace the example network settings before using it with real hardware.

The real-workspace browser smoke opens the verification workspace, clicks Scan, verifies PlatformIO, ESP32, Wi-Fi, MQTT, SSD1306, DHT, I2C, UART, and source-backed GPIO evidence, then runs the PlatformIO firmware build through the allowlisted build entry and verifies `SUCCESS`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite frontend |
| `npm run dev:server` | Start the localhost engineering service |
| `npm run lint` | Check TypeScript, React Hooks, browser, and Node.js source conventions |
| `npm run typecheck` | Run strict TypeScript checks |
| `npm run test` | Run AI result and frontend-service unit tests |
| `npm run build` | Type-check and create a production frontend build |
| `npm run preview` | Preview the production build with Vite |
| `npm run test:local` | Run the local service smoke test |
| `npm run test:e2e` | Verify generation, cancellation, retry, and background navigation with the deterministic mock provider |
| `npm run test:e2e:real` | Verify browser-based analysis and hardware evidence for the real ESP32 example workspace |
| `npm run verify:delivery` | Start or reuse local services and run all quality checks plus both browser smoke workflows |
| `npm run check` | Run lint, type checks, unit tests, local smoke tests, and the production build |

## Project Structure

```text
src/
├── components/          # React UI, pages, editors, diagrams, and local workspace panels
├── data/                # Chip specifications, code templates, and driver templates
├── services/            # AI, project archives, PDF, export, and local-service clients
├── store/               # Canonical project state and other browser stores
├── types/               # Domain types for hardware, projects, and AI services
└── App.tsx              # HashRouter routes
server/
├── index.mjs            # Local-service composition, files, analysis, backups, and builds
├── config.mjs           # Bind address, limits, and package metadata
├── lib/http.mjs         # JSON, CORS, origin, and request-body handling
├── security/            # Canonical workspace-path boundary
├── services/            # Replaceable AI provider adapter
├── agent/               # Internal/Harness Runtime, jobs, sessions, approvals, and tools
└── smoke-test.mjs       # Self-contained local API smoke test
docs/
├── ARCHITECTURE.md      # Module boundaries and dependency direction
├── LOCAL_API.md         # Local service API reference
└── PROJECT_FILES.md     # Portable project format and safety limits
examples/
└── esp32-smart-environment/  # PlatformIO analysis example
public/
├── fonts/              # Fonts used by PDF export
├── apple-touch-icon.png # Apple touch icon
├── logo.svg            # Project Logo and browser icon
├── logo-64.png         # Browser favicon fallback
└── sponsor.png         # VPS.Town sponsor banner
.github/
├── ISSUE_TEMPLATE/     # GitHub issue forms
└── PULL_REQUEST_TEMPLATE.md
```

## Security Boundaries

The local service is designed for a local development workflow, not as a general remote file server:

- It binds to `127.0.0.1` only.
- It rejects non-local browser origins.
- Every path is normalized and checked against the selected workspace.
- Scans skip `.git`, `node_modules`, build outputs, and backup directories.
- Text reads and request bodies have size limits.
- File saves compare the original modification time to avoid overwriting external edits.
- Builds use fixed server-side profiles instead of arbitrary commands or arguments.
- The AI provider does not receive local files unless the user explicitly starts an AI analysis.

### Operational notes

- Backups are written to `.metacore-backups` inside the selected workspace.
- Build verification can create normal tool output such as `.pio`, `build`, or generated artifacts.
- Clearing browser storage removes saved projects and AI configuration from the browser.
- Export `.metacore.json` archives from the project manager before clearing browser storage. Archives do not contain API keys.
- Static hosting only provides browser features; the local workspace page still requires `npm run dev:server` on the user's machine.
- API keys must not be committed to this repository or placed in the example project.

## Testing

Run the complete delivery gate:

```bash
npm run verify:delivery
```

Unit tests validate AI result structures, canonical project state, portable project archives, flow references, and generated-file path safety. The local service test creates a temporary PlatformIO-like project and verifies workspace setup, directory listing, linked-path escape protection, ESP32 and IoT protocol detection, dependency extraction, file writing with backup, report generation, build profile detection, AI proxy calls, model discovery, Responses API handling, and upstream error propagation.

`test:e2e` uses an explicitly labeled deterministic mock provider to verify the AI orchestration state machine; it is not a real DeepSeek call. `test:e2e:real` uses the repository ESP32 project to verify the actual local-analysis UI and PlatformIO build. Other projects still require their matching local PlatformIO, ESP-IDF, or CMake toolchain and dependencies.

Run the production build before submitting changes:

```bash
npm run build
```

## Versioning

MetaCore Studio follows [Semantic Versioning](https://semver.org/):

- **Major** (`2.0.0`): incompatible architecture or workflow changes
- **Minor** (`2.3.0`): backward-compatible features or workflow updates
- **Patch** (`2.0.1`): backward-compatible fixes and documentation corrections

The canonical application version is stored in `package.json`. The frontend and localhost service read this value at runtime. Release-facing scripts and the changelog should be updated in the same release commit.

## Changelog

See [`CHANGELOG.md`](CHANGELOG.md) for release history and migration notes.

## Troubleshooting

### AI generation fails

- Confirm an active provider and API key on `设置`.
- Check the provider endpoint and model name.
- For Ollama, start `ollama serve` and confirm the model is installed.
- Check browser developer tools for CORS or provider-side errors.

### The local page says the service is offline

Start the service in the project directory:

```bash
npm run dev:server
```

Then click `刷新连接` in the local workspace page.

### A build profile is disabled

The project marker may exist, but the corresponding tool is not available in `PATH`. Install PlatformIO, ESP-IDF, or CMake and restart the local service.

## Limitations

- Static analysis is rule-based and cannot fully understand complex macros, generated code, or every conditional compilation path.
- Pin validation depends on the detected chip and the available local knowledge base.
- Arduino CLI compilation requires an explicit board FQBN and is not enabled as an automatic build profile yet.
- Generated hardware designs and firmware must be reviewed against the actual datasheet and hardware.
- This project does not replace electrical safety review, security review, or hardware-in-the-loop testing.

## Contributing

1. Create a feature branch.
2. Keep UI changes consistent with the existing React, TypeScript, Tailwind, and Zustand patterns.
3. Keep local filesystem operations inside the workspace security boundary.
4. Add or update the local smoke test when changing server behavior.
5. Run `npm run check` before opening a pull request.

## GitHub Collaboration Files

- [Contributing guide](CONTRIBUTING.md): Branch, commit, testing, and pull request conventions.
- [Architecture guide](docs/ARCHITECTURE.md): Frontend, localhost service, and dependency boundaries.
- [Security policy](SECURITY.md): Handling vulnerabilities, API keys, and sensitive information.
- [Code of conduct](CODE_OF_CONDUCT.md): Basic expectations for public collaboration.
- `.github/ISSUE_TEMPLATE/`: Bug report and feature request forms.
- `.github/PULL_REQUEST_TEMPLATE.md`: Pull request checklist.

## License

The repository currently uses an **All Rights Reserved** notice. The source is published on GitHub for reference and collaboration, but it is not granted an OSI-approved open-source license at this time. Do not redistribute, relicense, or use the code commercially without permission from the copyright holder. See [`LICENSE`](LICENSE) for the full text.

© 2026 Leo. All rights reserved.

---

## Author's Note

> The idea I started with in March is one I intend to keep working on.

In March 2026, I began thinking about and working on MetaCore Studio. I wanted to make hardware development feel less like a jump into chip manuals, project configuration, and scattered source files, and more like a guided path from one hardware requirement to a design, firmware, project analysis, and verification. It started as an idea; since then, I have been implementing it gradually, revisiting the details, and learning from each iteration.

Later, I came across IterXAI by 词元开物, which is exploring a related direction and presents the path from an idea to real hardware in a remarkably direct way: requirements, module selection, design, code generation, simulation, PCB fabrication, and physical validation. I was surprised, and I also felt a sense of recognition. We began with a similar question at different times and followed different routes. To me, that is also evidence that AI-assisted hardware development is a real and valuable direction worth pursuing.

There is some overlap between IterXAI and MetaCore Studio, but our centers of gravity are different. IterXAI is especially good at helping makers, students, and prototype teams move quickly from an idea to a first physical board. MetaCore Studio focuses more on ESP32, STM32, custom chips, embedded code, local project analysis, hardware-software consistency, build verification, and maintainable iteration. One leans toward “idea to hardware”; the other toward “requirement to a maintainable, verifiable engineering project.” These paths do not have to be defined only by competition. They may also complement each other at different stages and help make AI-assisted hardware development more complete.

You are welcome to explore [IterXAI](https://www.iterx.ai/) and see how it turns a hardware idea into a real project step by step.

For me, this is not a reason to stop. Seeing others work on a related problem makes the next direction for MetaCore Studio clearer. I intend to keep improving the product and learning seriously from what others do well. Similar directions do not mean that only one of us can exist; they may mean that we are making the same broader possibility real from different angles.

<p align="right"><strong>Leo</strong><br />Author of MetaCore Studio · 2026</p>
