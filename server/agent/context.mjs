const EXCLUDED = /(^|[\\/])(node_modules|dist|build|\.pio|\.metacore-backups|coverage)([\\/]|$)/i
const SECRET = /(authorization|api[-_]?key|access[-_]?token|password|passwd|private[-_]?key|secret)/i

function redact(text) {
  return String(text)
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/(["'])([^"']{4,})(\1)/g, (match, quote) => SECRET.test(match) ? `${quote}[REDACTED]${quote}` : match)
}

function tokenCount(text) { return Math.ceil(String(text).length / 4) }

function indexFunctions(content) {
  const results = []
  const lines = String(content).split(/\r?\n/)
  lines.forEach((line, index) => {
    if (/\b(?:void|bool|int|float|double|size_t|static|inline|TaskHandle_t)\s+[A-Za-z_][A-Za-z0-9_]*\s*\([^;]*\)\s*\{?/.test(line) || /\b(setup|loop)\s*\(/.test(line)) results.push({ name: line.trim().slice(0, 120), line: index + 1, excerpt: lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 12)).join('\n') })
  })
  return results.slice(0, 240)
}

export function buildCodeContext(files, options = {}) {
  const budget = Math.max(500, Number(options.tokenBudget ?? 12_000))
  const keywords = (options.keywords ?? []).map((value) => String(value).toLowerCase()).filter(Boolean)
  const candidates = []
  for (const file of files ?? []) {
    const filePath = String(file.path ?? '').replaceAll('\\', '/')
    if (!filePath || EXCLUDED.test(filePath)) continue
    const content = redact(file.content ?? '')
    const lower = `${filePath}\n${content}`.toLowerCase()
    const hits = keywords.reduce((count, word) => count + (lower.match(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 0)
    const functions = indexFunctions(content)
    const score = hits * 5 + functions.length + (/\b(setup|loop|app_main|main|task|error|exception)\b/i.test(content) ? 10 : 0)
    candidates.push({ filePath, content, functions, score })
  }
  candidates.sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath))
  const selected = []
  let used = 0
  for (const candidate of candidates) {
    if (used >= budget) break
    const maxChars = Math.max(800, Math.min(candidate.content.length, (budget - used) * 4))
    const text = candidate.content.length <= maxChars ? candidate.content : candidate.functions.length ? candidate.functions.slice(0, 12).map((item) => `// ${item.name} @ ${candidate.filePath}:${item.line}\n${item.excerpt}`).join('\n\n').slice(0, maxChars) : candidate.content.slice(0, maxChars)
    selected.push({ path: candidate.filePath, content: text, functions: candidate.functions.map((item) => ({ name: item.name, line: item.line })), score: candidate.score })
    used += tokenCount(text)
  }
  return { files: selected, tokenCount: used, budget, excluded: candidates.length - selected.length }
}
