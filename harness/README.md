# MetaCore DeepSeek Harness runtime

This directory owns the MetaCore-specific Harness composition. The Harness
source checkout remains in the sibling `deepseek-harness` directory and is not
modified by MetaCore development.

The composition deliberately omits raw shell and filesystem plugins. The
model receives MetaCore tools through `metacore-tools.mjs`, which calls the
loopback server with a per-process bearer token. Read-only operations execute
inside the authorized workspace. File changes and builds create approval
records; the existing MetaCore safety checks execute them only after approval.

Required local setup:

```powershell
cd ..\deepseek-harness
corepack enable
pnpm install

cd ..\MetaCore-Studio-Harness
npm run dev:server
```

For a normal Windows run, use the project root `start.bat` after both projects
have their dependencies installed. It starts or reuses the localhost service,
waits for the health endpoint, and starts the Vite UI. `start-local.bat` is a
compatibility alias. Start the two commands manually when you need separate
logs or want to debug Harness startup.

The normal UI flow is to configure and test an official DeepSeek service in
Settings. Harness prefers that verified official service; when it is not
available, a verified SiliconFlow service whose model contains `DeepSeek` is
accepted as an OpenAI-compatible fallback. Each task receives the selected
service's API key, Base URL, model, and output budget through its process
environment. `DEEPSEEK_API_KEY` and `DEEPSEEK_BASE_URL` remain optional
server-side fallbacks.

Optional environment variables:

| Variable | Purpose |
| --- | --- |
| `METACORE_HARNESS_ROOT` | Override the sibling Harness source path. |
| `METACORE_HARNESS_MODEL` | Default model sent during SDK initialization. |
| `METACORE_HARNESS_MAX_TOKENS` | Per-request output limit. |
| `METACORE_HARNESS_PERSONA` | Override the embedded-engineering persona. |
| `METACORE_HARNESS_REQUEST_TIMEOUT_MS` | JSON-RPC request timeout. |

Do not add API keys to this directory or to Cordis YAML.
