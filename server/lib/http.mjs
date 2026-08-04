import { LIMITS } from '../config.mjs'

export function isAllowedOrigin(origin = '') {
  if (!origin) return false
  try {
    const url = new URL(origin)
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  } catch {
    return false
  }
}

export function corsHeaders(origin = '') {
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
  }
  if (isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

export function json(res, status, data, origin = '') {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...corsHeaders(origin),
  })
  res.end(body)
}

export function ensureLocalOrigin(req) {
  const origin = req.headers.origin ?? ''
  if (!origin) return
  if (!isAllowedOrigin(origin)) {
    const error = new Error('拒绝非本机页面访问本地文件服务')
    error.status = 403
    throw error
  }
}

export async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > LIMITS.bodyBytes) {
      const error = new Error('请求体过大')
      error.status = 413
      throw error
    }
    chunks.push(chunk)
  }
  if (!chunks.length) return {}

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    const error = new Error('请求体必须是有效的 JSON')
    error.status = 400
    throw error
  }
}
