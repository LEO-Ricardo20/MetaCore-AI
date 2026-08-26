/* global fetch, process */
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const name = 'metacore-tools'
export const inject = ['tools']

export async function apply(ctx) {
  const harnessRoot = requireEnv('METACORE_HARNESS_ROOT')
  const toolsModule = pathToFileURL(path.join(harnessRoot, 'packages', 'core', 'tools', 'src', 'index.ts')).href
  const { defineTool } = await import(toolsModule)

  registerJsonTool(ctx, defineTool, {
    name: 'inspect_project',
    description: 'Inspect the authorized embedded project and return its detected project type, chips, peripherals, protocols, dependencies, pins, risks, and health summary.',
    parameters: {},
  })
  registerJsonTool(ctx, defineTool, {
    name: 'read_file',
    description: 'Read one supported UTF-8 text file inside the authorized MetaCore workspace.',
    parameters: {
      path: { type: 'string', required: true, description: 'Workspace-relative file path.' },
    },
  })
  registerJsonTool(ctx, defineTool, {
    name: 'search_files',
    description: 'Search supported text files inside the authorized MetaCore workspace.',
    parameters: {
      query: { type: 'string', required: true, description: 'Non-empty search text.' },
      maxResults: { type: 'integer', description: 'Maximum returned files, up to the server limit.' },
    },
  })
  registerJsonTool(ctx, defineTool, {
    name: 'run_local_analysis',
    description: 'Run the deterministic MetaCore embedded-project analyzer in the authorized workspace.',
    parameters: {},
  })
  registerJsonTool(ctx, defineTool, {
    name: 'validate_pin_assignment',
    description: 'Validate proposed GPIO assignments for duplicate or invalid pins before firmware generation.',
    parameters: {
      pins: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', required: true },
            pin: { type: 'integer', required: true },
          },
        },
      },
    },
  })
  registerJsonTool(ctx, defineTool, {
    name: 'propose_file_change',
    description: 'Propose a complete UTF-8 file replacement for user review. This never writes immediately; MetaCore creates a diff approval item.',
    parameters: {
      path: { type: 'string', required: true, description: 'Workspace-relative file path.' },
      content: { type: 'string', required: true, description: 'Complete proposed file content.' },
      reason: { type: 'string', required: true, description: 'Engineering reason and expected verification.' },
    },
  })
  registerJsonTool(ctx, defineTool, {
    name: 'request_build',
    description: 'Request a whitelisted PlatformIO, ESP-IDF, or CMake build. MetaCore creates an approval item and does not execute before user approval.',
    parameters: {
      profileId: { type: 'string', required: true, enum: ['platformio', 'espidf', 'cmake'] },
      reason: { type: 'string', required: true, description: 'Why this build is needed and what it verifies.' },
    },
  })
}

function registerJsonTool(ctx, defineTool, definition) {
  ctx.tools.register(defineTool({
    ...definition,
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: (args, exec) => callMetaCore(definition.name, args, exec.signal),
  }))
}

async function callMetaCore(toolName, args, signal) {
  const baseUrl = requireEnv('METACORE_BRIDGE_URL').replace(/\/+$/, '')
  const token = requireEnv('METACORE_HARNESS_BRIDGE_TOKEN')
  const response = await fetch(`${baseUrl}/agent/bridge/tools/${encodeURIComponent(toolName)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      args,
      projectId: process.env.METACORE_PROJECT_ID || '',
      jobId: process.env.METACORE_JOB_ID || '',
      sessionId: process.env.METACORE_SESSION_ID || '',
    }),
    signal,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || payload.error || `MetaCore tool bridge returned HTTP ${response.status}`)
  return payload.result
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required by the MetaCore Harness plugin`)
  return value
}
