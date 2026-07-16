# Changelog

All notable changes to MetaCore AI are documented in this file.

The project follows [Semantic Versioning](https://semver.org/). Dates use `YYYY-MM-DD`.

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
