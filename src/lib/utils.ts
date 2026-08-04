import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseJSON<T>(text: string): T | null {
  try {
    return JSON.parse(text.trim()) as T
  } catch { /* 继续尝试 */ }

  try {
    const m = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
    if (m) return JSON.parse(m[1].trim()) as T
  } catch { /* 继续尝试 */ }

  try {
    const start = text.search(/[{[]/)
    const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1)) as T
    }
  } catch { /* 放弃 */ }

  return null
}
