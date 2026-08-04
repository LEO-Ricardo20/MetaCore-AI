import fs from 'node:fs/promises'
import path from 'node:path'

export function normalizeForCompare(value) {
  return process.platform === 'win32' ? value.toLowerCase() : value
}

function isInside(root, target) {
  const rootValue = normalizeForCompare(root)
  const targetValue = normalizeForCompare(target)
  return targetValue === rootValue || targetValue.startsWith(rootValue + path.sep)
}

export async function resolveExistingInsideWorkspace(root, inputPath = '') {
  const target = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(root, inputPath || '.')

  if (!isInside(root, target)) {
    const error = new Error('禁止访问工作区外部路径')
    error.status = 403
    throw error
  }

  let realTarget
  try {
    realTarget = await fs.realpath(target)
  } catch (cause) {
    if (cause?.code === 'ENOENT') {
      const error = new Error('目标路径不存在')
      error.status = 404
      throw error
    }
    throw cause
  }

  if (!isInside(root, realTarget)) {
    const error = new Error('禁止通过符号链接或目录联接访问工作区外部路径')
    error.status = 403
    throw error
  }
  return target
}

export function toWorkspaceRelative(root, target) {
  const relative = path.relative(root, target)
  return relative ? relative.split(path.sep).join('/') : ''
}
