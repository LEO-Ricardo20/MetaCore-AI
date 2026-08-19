import { spawn } from 'node:child_process'
import process from 'node:process'
import path from 'node:path'

const root = process.cwd()
const children = []
const npmCommand = process.platform === 'win32'
  ? process.execPath
  : 'npm'
const npmArgs = process.platform === 'win32'
  ? [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')]
  : []

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...npmArgs, ...args], { cwd: root, stdio: 'inherit', windowsHide: true })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} 退出码 ${code}`)))
  })
}

async function isReachable(url) {
  try {
    const response = await fetch(url)
    return response.ok
  } catch {
    return false
  }
}

async function waitReachable(url) {
  const started = Date.now()
  while (Date.now() - started < 20_000) {
    if (await isReachable(url)) return
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`服务健康检查超时：${url}`)
}

function startService(args) {
  const child = spawn(npmCommand, [...npmArgs, ...args], { cwd: root, stdio: 'ignore', windowsHide: true })
  children.push(child)
  return child
}

try {
  if (!await isReachable('http://127.0.0.1:3766/api/health')) startService(['run', 'dev:server'])
  await waitReachable('http://127.0.0.1:3766/api/health')
  if (!await isReachable('http://127.0.0.1:5173')) startService(['run', 'dev', '--', '--host', '127.0.0.1'])
  await waitReachable('http://127.0.0.1:5173')
  await run(npmCommand, ['run', 'lint'])
  await run(npmCommand, ['run', 'typecheck'])
  await run(npmCommand, ['run', 'test'])
  await run(npmCommand, ['run', 'test:local'])
  await run(npmCommand, ['run', 'build'])
  await run(npmCommand, ['run', 'test:e2e'])
  await run(npmCommand, ['run', 'test:e2e:real'])
  console.log('verify:delivery passed')
} catch (error) {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
} finally {
  for (const child of children) {
    if (process.platform === 'win32' && child.pid) {
      spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    } else {
      child.kill()
    }
  }
}
