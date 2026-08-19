import { describe, expect, it } from 'vitest'
import { buildCodeContext } from './contextBuilder'

describe('AI context builder', () => {
  it('selects indexed functions near the end instead of only the file prefix', () => {
    const content = `${'// filler\n'.repeat(1_200)}\nvoid loop() {\n  publishTelemetry();\n}\n`
    const context = buildCodeContext([{ path: 'src/main.cpp', content }], { tokenBudget: 900, keywords: ['loop', 'telemetry'] })

    expect(context.files[0].content).toContain('publishTelemetry')
    expect(context.files[0].functions.some((item) => item.name === 'loop')).toBe(true)
  })

  it('excludes generated directories and redacts credentials', () => {
    const context = buildCodeContext([
      { path: 'node_modules/pkg/index.cpp', content: 'void ignored() {}' },
      { path: 'src/config.cpp', content: 'const char* API_KEY = "sk-secret-value";\nvoid setup() {}' },
    ], { tokenBudget: 2_000, keywords: ['setup'] })

    expect(context.files).toHaveLength(1)
    expect(context.files[0].path).toBe('src/config.cpp')
    expect(context.files[0].content).not.toContain('sk-secret-value')
    expect(context.files[0].content).toContain('[REDACTED]')
  })
})
