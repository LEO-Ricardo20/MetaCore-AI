import type { CodeFile } from '@/types/project'

const EXCLUDED_PATH = /(^|\/)(node_modules|dist|build|\.pio|\.metacore-backups|coverage)(\/|$)/i
const SECRET_ASSIGNMENT = /\b(api[_-]?key|access[_-]?token|authorization|password|passwd|private[_-]?key|secret)\b\s*(?:=|:)\s*(["'])([^"']+)(\2)/gi

export interface ContextFunction {
  name: string
  line: number
}

export interface ContextFile {
  path: string
  content: string
  score: number
  functions: ContextFunction[]
}

export interface CodeContext {
  files: ContextFile[]
  tokenCount: number
  tokenBudget: number
  excludedFiles: number
}

function redact(content: string) {
  return content
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(SECRET_ASSIGNMENT, (_match, key, quote) => `${key}=${quote}[REDACTED]${quote}`)
}

function estimateTokens(value: string) { return Math.ceil(value.length / 4) }

function functionIndex(content: string) {
  const lines = content.split(/\r?\n/)
  const functions: Array<ContextFunction & { excerpt: string }> = []
  lines.forEach((line, index) => {
    const match = line.match(/\b(?:void|bool|int|float|double|size_t|static|inline|esp_err_t|TaskHandle_t)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^;]*\)/)
      ?? line.match(/\b(setup|loop|app_main)\s*\(/)
    if (!match) return
    functions.push({
      name: match[1],
      line: index + 1,
      excerpt: lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 18)).join('\n'),
    })
  })
  return functions.slice(0, 240)
}

function countMatches(value: string, terms: string[]) {
  const lower = value.toLowerCase()
  return terms.reduce((score, term) => score + (lower.split(term.toLowerCase()).length - 1), 0)
}

export function buildCodeContext(
  files: Pick<CodeFile, 'path' | 'content'>[],
  options: { tokenBudget?: number; keywords?: string[] } = {},
): CodeContext {
  const tokenBudget = Math.max(800, options.tokenBudget ?? 12_000)
  const keywords = [...new Set((options.keywords ?? []).map((term) => term.trim()).filter(Boolean))]
  const candidates = files
    .map((file) => ({ ...file, path: file.path.replaceAll('\\', '/') }))
    .filter((file) => file.path && !EXCLUDED_PATH.test(file.path))
    .map((file) => {
      const content = redact(file.content)
      const functions = functionIndex(content)
      const score = countMatches(`${file.path}\n${content}`, keywords) * 5
        + functions.length
        + (/\b(setup|loop|app_main|task|error|exception|init)\b/i.test(content) ? 12 : 0)
      return { path: file.path, content, functions, score }
    })
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))

  const selected: ContextFile[] = []
  let tokenCount = 0
  for (const candidate of candidates) {
    if (tokenCount >= tokenBudget) break
    const remainingCharacters = (tokenBudget - tokenCount) * 4
    const indexedContent = candidate.functions.length
      ? candidate.functions.map((item) => `// ${item.name} @ ${candidate.path}:${item.line}\n${item.excerpt}`).join('\n\n')
      : candidate.content
    const content = candidate.content.length <= remainingCharacters
      ? candidate.content
      : indexedContent.slice(0, Math.max(800, remainingCharacters))
    tokenCount += estimateTokens(content)
    selected.push({ path: candidate.path, content, score: candidate.score, functions: candidate.functions.map(({ name, line }) => ({ name, line })) })
  }

  return { files: selected, tokenCount, tokenBudget, excludedFiles: files.length - selected.length }
}
