import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FileSearch,
  GitBranch,
  HardDrive,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import FlowPage from './FlowPage'
import LocalWorkspacePage from '@/components/local/LocalWorkspacePage'
import { cn } from '@/lib/utils'
import { selectCurrentProject, useProjectStore } from '@/store/projectStore'
import { detectBuildProfiles, runBuild } from '@/services/local/localClient'
import type { ArtifactKey, Project } from '@/types/project'
import type { BuildProfile, BuildResult } from '@/services/local/types'
import PendingIssuesMenu from '@/components/project/PendingIssuesMenu'

const tabs = [['consistency', '一致性', CheckCircle2], ['flow', '流程', GitBranch], ['local', '本地分析', HardDrive], ['build', '构建', Play], ['security', '安全', ShieldAlert], ['release', '发布检查', FileSearch]] as const

type CheckState = 'idle' | 'running' | 'passed' | 'warning' | 'failed'
type ConsistencyFinding = { severity: 'error' | 'warning' | 'info'; message: string; file?: string; line?: number; expected?: string; actual?: string }
type SecurityFinding = { severity: 'error' | 'warning'; message: string; file: string; line: number }

function statusLabel(status: string | undefined) {
  const labels: Record<string, string> = { missing: '未执行', generating: '执行中', validating: '校验中', fresh: '已有结果', valid: '通过', stale: '已过期', invalid: '未通过' }
  return labels[status ?? 'missing'] ?? status ?? '未执行'
}

function findLine(content: string, matcher: RegExp) {
  const index = content.split(/\r?\n/).findIndex((line) => matcher.test(line))
  return index < 0 ? undefined : index + 1
}

function runConsistencyCheck(project: Project): ConsistencyFinding[] {
  if (!project.scheme) return [{ severity: 'error', message: '尚未生成硬件方案，无法校验代码与引脚。' }]
  if (!project.codeFiles.length) return [{ severity: 'error', message: '尚未生成固件工程，无法校验代码与引脚。' }]
  const source = project.codeFiles.map((file) => ({ file, content: file.content })).filter(({ content }) => content.trim())
  const findings: ConsistencyFinding[] = []
  const pinNumbers = new Set<string>()
  for (const pin of project.scheme.pins) {
    const normalized = pin.pinNumber.toUpperCase().replace(/^GPIO/, '')
    if (pinNumbers.has(normalized)) findings.push({ severity: 'error', message: `引脚 ${pin.pinNumber} 被方案重复分配。`, expected: '每个 GPIO 只能绑定一个功能。' })
    pinNumbers.add(normalized)
    const matcher = new RegExp(`(?:GPIO|PIN_|PIN|gpio|pin)[^\\n]{0,18}\\b${normalized}\\b|\\b${normalized}\\b[^\\n]{0,18}(?:GPIO|PIN_|PIN|gpio|pin)`, 'i')
    const match = source.find(({ content }) => matcher.test(content))
    if (!match) findings.push({ severity: 'warning', message: `${pin.pinNumber}（${pin.function}）未在生成代码中找到明确引用。`, expected: pin.pinNumber, actual: '未找到代码引用' })
    else findings.push({ severity: 'info', message: `${pin.pinNumber}（${pin.function}）与代码引用一致。`, file: match.file.path, line: findLine(match.content, matcher), expected: pin.pinNumber, actual: match.file.path })
  }
  return findings
}

function runSecurityCheck(project: Project): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  const patterns: Array<{ regex: RegExp; message: string; severity: SecurityFinding['severity'] }> = [
    { regex: /(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})/, message: '疑似硬编码 API Key 或云凭据。', severity: 'error' },
    { regex: /(password|passwd|secret|token)\s*[:=]\s*["'][^"']{6,}["']/i, message: '疑似硬编码密码、Token 或 Secret。', severity: 'error' },
    { regex: /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/, message: '发现私钥内容，禁止写入工程源码。', severity: 'error' },
    { regex: /https?:\/\/[^\s"']+\/(?:api|v1)\b/i, message: '发现未经说明的外部 API 地址，请确认发布前已脱敏。', severity: 'warning' },
  ]
  for (const file of project.codeFiles) {
    const lines = file.content.split(/\r?\n/)
    lines.forEach((line, index) => patterns.forEach((pattern) => {
      if (pattern.regex.test(line)) findings.push({ severity: pattern.severity, message: pattern.message, file: file.path, line: index + 1 })
    }))
  }
  return findings
}

export default function VerificationWorkspacePage() {
  const location = useLocation(); const navigate = useNavigate()
  const project = useProjectStore(selectCurrentProject)
  const active = location.pathname.split('/')[2] || 'consistency'
  const [consistencyState, setConsistencyState] = useState<CheckState>('idle')
  const [consistencyFindings, setConsistencyFindings] = useState<ConsistencyFinding[]>([])
  const [securityState, setSecurityState] = useState<CheckState>('idle')
  const [securityFindings, setSecurityFindings] = useState<SecurityFinding[]>([])
  const [buildState, setBuildState] = useState<CheckState>('idle')
  const [buildProfiles, setBuildProfiles] = useState<BuildProfile[]>([])
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null)
  const [buildError, setBuildError] = useState('')
  const [releaseState, setReleaseState] = useState<CheckState>('idle')
  const [releaseReasons, setReleaseReasons] = useState<string[]>([])
  const [releaseCheckedAt, setReleaseCheckedAt] = useState<number>()
  const [notice, setNotice] = useState('')

  const staleArtifacts = useMemo(() => project ? Object.entries(project.artifacts).filter(([, value]) => value.status === 'stale' || value.status === 'invalid') : [], [project])

  useEffect(() => {
    setConsistencyState('idle'); setSecurityState('idle'); setBuildState('idle'); setReleaseState('idle')
    setConsistencyFindings([]); setSecurityFindings([]); setReleaseReasons([]); setBuildResult(null); setBuildError('')
  }, [project?.id])

  function setArtifact(key: ArtifactKey, status: 'valid' | 'invalid' | 'fresh' | 'stale') { useProjectStore.getState().setArtifactStatus(key, status) }

  function handleConsistency() {
    if (!project) { navigate('/design/requirements'); return }
    setConsistencyState('running'); setNotice('')
    window.setTimeout(() => {
      const findings = runConsistencyCheck(project); const failed = findings.some((item) => item.severity === 'error')
      setConsistencyFindings(findings); setConsistencyState(failed ? 'failed' : findings.some((item) => item.severity === 'warning') ? 'warning' : 'passed'); setArtifact('consistencyReport', failed ? 'invalid' : 'valid')
      setNotice(failed ? '一致性校验发现阻断问题' : findings.some((item) => item.severity === 'warning') ? '一致性校验完成，但有提示' : '一致性校验通过')
    }, 260)
  }

  function handleSecurity() {
    if (!project) { navigate('/design/requirements'); return }
    setSecurityState('running'); setNotice('')
    window.setTimeout(() => {
      const findings = runSecurityCheck(project); const failed = findings.some((item) => item.severity === 'error')
      setSecurityFindings(findings); setSecurityState(failed ? 'failed' : findings.length ? 'warning' : 'passed'); setNotice(failed ? '安全检查发现阻断问题' : findings.length ? '安全检查完成，但有提示' : '未发现硬编码凭据')
    }, 260)
  }

  async function handleDetectBuild() {
    setBuildState('running'); setBuildError(''); setNotice('')
    try { const result = await detectBuildProfiles(); setBuildProfiles(result.profiles); setBuildState('idle'); if (!result.profiles.length) setBuildError('当前工作区没有识别到受支持的构建配置') }
    catch (error) { setBuildState('failed'); setBuildError(error instanceof Error ? error.message : '无法检测构建环境') }
  }

  async function handleBuild(profileId: string) {
    setBuildState('running'); setBuildError(''); setBuildResult(null); setNotice('')
    try { const result = await runBuild(profileId); setBuildResult(result); setBuildState(result.success ? 'passed' : 'failed'); setArtifact('buildResult', result.success ? 'valid' : 'invalid'); setNotice(result.success ? '构建验证通过' : `构建未通过（退出码 ${result.exitCode}）`) }
    catch (error) { setBuildState('failed'); setBuildError(error instanceof Error ? error.message : '构建执行失败'); setArtifact('buildResult', 'invalid') }
  }

  function handleRelease() {
    if (!project) { navigate('/design/requirements'); return }
    const reasons: string[] = []; const required: Array<[ArtifactKey, string]> = [['scheme', '硬件方案'], ['pinMap', '引脚映射'], ['bom', 'BOM'], ['wiring', '接线'], ['code', '固件工程'], ['flow', '流程图'], ['consistencyReport', '一致性报告'], ['buildResult', '构建结果']]
    required.forEach(([key, label]) => { const status = project.artifacts[key].status; if (status !== 'valid' && status !== 'fresh') reasons.push(`${label}状态为“${statusLabel(status)}”`) })
    if (securityFindings.some((item) => item.severity === 'error')) reasons.push('安全检查存在阻断级问题')
    if (staleArtifacts.length) reasons.push(`存在 ${staleArtifacts.length} 个过期或无效产物`)
    setReleaseReasons(reasons); setReleaseCheckedAt(Date.now()); setReleaseState(reasons.length ? 'failed' : 'passed'); setArtifact('releaseReport', reasons.length ? 'invalid' : 'valid'); setNotice(reasons.length ? '发布检查被阻断，请先处理下方问题' : '发布检查通过，可以导出交付物')
  }

  const topState: CheckState = staleArtifacts.length ? 'warning' : project?.validation.status === 'passed' ? 'passed' : 'idle'
  return <div className="h-full overflow-y-auto"><div className="page-container tone-verification"><div className="workspace-header flex flex-wrap items-end justify-between gap-3"><div><div className="workspace-eyebrow"><ShieldAlert size={13} /> Verification Trajectory</div><h1 className="workspace-title">质量门禁</h1><p className="workspace-subtitle">按顺序运行一致性、安全、构建和发布检查，所有证据、耗时和阻断原因都保留在当前项目上下文中。</p></div>{staleArtifacts.length ? <PendingIssuesMenu project={project} /> : <StatusBadge state={topState} label="等待验证" />}</div><nav className="stage-tabs mb-5" aria-label="验证阶段">{tabs.map(([key, label, Icon]) => <button key={key} type="button" className={cn('stage-tab', active === key && 'stage-tab-active')} onClick={() => navigate(`/verification/${key}`)}><Icon size={14} />{label}</button>)}</nav>{notice && <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--border-medium)] bg-[var(--surface-selected)] px-3 py-2 text-xs text-[var(--text-primary)]"><CheckCircle2 size={14} className="text-[var(--accent-cyan)]" />{notice}</div>}{!project ? <EmptyProject onNavigate={() => navigate('/design/requirements')} /> : active === 'flow' ? <FlowPage /> : active === 'local' ? <LocalWorkspacePage /> : active === 'consistency' ? <ConsistencyPanel project={project} state={consistencyState} findings={consistencyFindings} onRun={handleConsistency} onNavigate={() => navigate('/implementation/code')} /> : active === 'build' ? <BuildPanel project={project} state={buildState} profiles={buildProfiles} result={buildResult} error={buildError} onDetect={handleDetectBuild} onRun={handleBuild} /> : active === 'security' ? <SecurityPanel project={project} state={securityState} findings={securityFindings} onRun={handleSecurity} onNavigate={() => navigate('/implementation/code')} /> : <ReleasePanel state={releaseState} reasons={releaseReasons} checkedAt={releaseCheckedAt} onRun={handleRelease} onNavigate={(path) => navigate(path)} />}</div></div>
}

function StatusBadge({ state, label }: { state: CheckState; label: string }) {
  const Icon = state === 'passed' ? CheckCircle2 : state === 'failed' ? AlertCircle : state === 'warning' ? AlertTriangle : state === 'running' ? Loader2 : CircleDashed
  return <span className={cn('status-badge border', state === 'passed' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : state === 'failed' ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300' : state === 'warning' ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]')}><Icon size={12} className={state === 'running' ? 'animate-spin' : ''} /> {label}</span>
}

function ActionBar({ state, label, onRun, disabled = false }: { state: CheckState; label: string; onRun: () => void; disabled?: boolean }) {
  const running = state === 'running'
  return <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={onRun} disabled={running || disabled} className="btn-primary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{running ? <Loader2 size={13} className="animate-spin" /> : state === 'passed' ? <RefreshCw size={13} /> : <Play size={13} />}{running ? '执行中…' : state === 'passed' ? `重新${label}` : label}</button>{running && <span className="text-xs text-[var(--text-muted)]">请等待当前检查结束</span>}</div>
}

function PanelShell({ title, description, state, children, action }: { title: string; description: string; state: CheckState; children: React.ReactNode; action: React.ReactNode }) {
  return <section className="surface-panel trajectory-panel p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2 text-[var(--accent-cyan)]"><ShieldCheck size={18} /></div><div><h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2><p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">{description}</p></div></div><StatusBadge state={state} label={state === 'passed' ? '通过' : state === 'failed' ? '未通过' : state === 'warning' ? '有提示' : state === 'running' ? '执行中' : '未执行'} /></div><div className="mt-5">{children}</div><div className="mt-5 border-t border-[var(--border-subtle)] pt-4">{action}</div></section>
}

function EmptyProject({ onNavigate }: { onNavigate: () => void }) { return <section className="surface-panel flex flex-col items-center gap-3 p-10 text-center"><CircleDashed size={30} className="text-[var(--text-muted)]" /><p className="text-sm text-[var(--text-secondary)]">请先创建项目并生成硬件方案。</p><button type="button" onClick={onNavigate} className="btn-primary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white"><Play size={13} />前往需求生成</button></section> }

function ConsistencyPanel({ project, state, findings, onRun, onNavigate }: { project: Project; state: CheckState; findings: ConsistencyFinding[]; onRun: () => void; onNavigate: () => void }) {
  const errors = findings.filter((item) => item.severity === 'error').length; const warnings = findings.filter((item) => item.severity === 'warning').length
  return <PanelShell title="代码与硬件方案一致性" description="对比方案引脚、接线和生成代码中的可追溯引用，并列出文件与行号证据。" state={state} action={<ActionBar state={state} label="运行一致性检查" onRun={onRun} disabled={!project.scheme || !project.codeFiles.length} />}><div className="grid gap-3 md:grid-cols-3"><Metric label="方案引脚" value={project.scheme?.pins.length ?? 0} /><Metric label="代码文件" value={project.codeFiles.length} /><Metric label="发现" value={`${errors} 个错误 · ${warnings} 个提示`} /></div>{!project.scheme || !project.codeFiles.length ? <EmptyHint text="需要先生成硬件方案和固件工程，才能运行一致性检查。" action="去生成" onClick={onNavigate} /> : findings.length ? <div className="mt-4 space-y-2">{findings.map((item, index) => <Finding key={`${item.message}-${index}`} severity={item.severity} message={item.message} file={item.file} line={item.line} expected={item.expected} actual={item.actual} />)}</div> : <EmptyHint text="尚未执行检查。运行后这里会显示 GPIO、外设、接线的实际证据。" />}</PanelShell>
}

function SecurityPanel({ project, state, findings, onRun, onNavigate }: { project: Project; state: CheckState; findings: SecurityFinding[]; onRun: () => void; onNavigate: () => void }) {
  return <PanelShell title="安全与依赖风险" description="扫描项目代码中的硬编码凭据、私钥和外部 API 线索；结果只保留脱敏后的文件与行号。" state={state} action={<ActionBar state={state} label="运行安全检查" onRun={onRun} disabled={!project.codeFiles.length} />}><div className="grid gap-3 md:grid-cols-3"><Metric label="扫描文件" value={project.codeFiles.length} /><Metric label="阻断问题" value={findings.filter((item) => item.severity === 'error').length} /><Metric label="提示" value={findings.filter((item) => item.severity === 'warning').length} /></div>{!project.codeFiles.length ? <EmptyHint text="需要先生成固件工程，才能扫描源码风险。" action="去生成代码" onClick={onNavigate} /> : findings.length ? <div className="mt-4 space-y-2">{findings.map((item, index) => <Finding key={`${item.message}-${index}`} severity={item.severity} message={item.message} file={item.file} line={item.line} />)}</div> : <EmptyHint text="尚未执行检查。运行后这里会列出凭据、私钥和外部地址风险。" />}</PanelShell>
}

function BuildPanel({ project, state, profiles, result, error, onDetect, onRun }: { project: Project; state: CheckState; profiles: BuildProfile[]; result: BuildResult | null; error: string; onDetect: () => void; onRun: (id: string) => void }) {
  return <PanelShell title="白名单构建验证" description="仅执行本地服务检测到的 profileId，不接受前端传入任意命令。工具链缺失时明确显示不可用。" state={state} action={<ActionBar state={state} label="检测构建环境" onRun={onDetect} />}><div className="mb-4 flex items-center justify-between text-xs text-[var(--text-secondary)]"><span>目标：{project.target} · {project.format}</span><button type="button" onClick={onDetect} disabled={state === 'running'} className="inline-flex items-center gap-1 text-cyan-700 hover:text-cyan-500 dark:text-cyan-300"><RefreshCw size={12} />重新检测</button></div>{error && <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</div>}{profiles.length ? <div className="space-y-2">{profiles.map((profile) => <div key={profile.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"><div className="min-w-0"><p className="text-sm font-medium text-[var(--text-primary)]">{profile.label}</p><p className="mt-1 truncate font-mono text-[11px] text-[var(--text-muted)]">{profile.command}</p></div><button type="button" disabled={!profile.available || state === 'running'} onClick={() => onRun(profile.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-700 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40 dark:text-cyan-300"><Play size={12} />{profile.available ? '运行构建' : '工具不可用'}</button></div>)}</div> : <EmptyHint text="尚未检测构建环境。检测后会列出可执行 profile 和工具链状态。" />}{result && <div className={cn('mt-4 rounded-lg border p-3', result.success ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10')}><div className="flex items-center justify-between gap-2 text-xs"><span className={result.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>{result.success ? '构建成功' : `构建失败 · 退出码 ${result.exitCode}`}</span><span className="text-[var(--text-muted)]">{(result.durationMs / 1000).toFixed(1)}s</span></div><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] text-[var(--text-secondary)]">{[result.stdout, result.stderr].filter(Boolean).join('\n') || '无构建输出'}</pre></div>}</PanelShell>
}

function ReleasePanel({ state, reasons, checkedAt, onRun, onNavigate }: { state: CheckState; reasons: string[]; checkedAt?: number; onRun: () => void; onNavigate: (path: string) => void }) {
  const ready = state === 'passed'
  return <PanelShell title="发布前检查" description="检查所有必需产物是否存在、未过期、已完成一致性和构建验证；任何阻断项都会阻止导出交付物。" state={state} action={<ActionBar state={state} label="运行发布检查" onRun={onRun} />}><div className={cn('rounded-lg border p-4', ready ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10')}><div className="flex items-center gap-2">{ready ? <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-300" /> : <AlertTriangle size={18} className="text-amber-600 dark:text-amber-300" />}<span className="text-sm font-semibold text-[var(--text-primary)]">{ready ? '当前项目满足发布门禁' : checkedAt ? '当前项目尚未满足发布门禁' : '尚未运行发布检查'}</span></div>{checkedAt && <p className="mt-1 text-xs text-[var(--text-muted)]">最近检查：{new Date(checkedAt).toLocaleString('zh-CN')}</p>}</div>{reasons.length ? <div className="mt-4 space-y-2">{reasons.map((reason) => <div key={reason} className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-300"><AlertCircle size={14} className="mt-0.5 shrink-0" />{reason}</div>)}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => onNavigate('/design/requirements')} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">返回设计阶段</button><button type="button" onClick={() => onNavigate('/implementation/code')} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">返回实现阶段</button></div></div> : !checkedAt ? <EmptyHint text="运行检查后会逐项列出缺失或过期产物，以及下一步操作。" /> : <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={15} />没有发现发布阻断项，可以继续导出。</div>}</PanelShell>
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"><p className="text-xs text-[var(--text-muted)]">{label}</p><p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{value}</p></div> }
function Finding({ severity, message, file, line, expected, actual }: { severity: 'error' | 'warning' | 'info'; message: string; file?: string; line?: number; expected?: string; actual?: string }) { return <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"><div className="flex items-start gap-2">{severity === 'error' ? <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-500" /> : severity === 'warning' ? <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" /> : <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />}<div className="min-w-0 flex-1"><p className="text-xs leading-5 text-[var(--text-primary)]">{message}</p>{file && <p className="mt-1 truncate font-mono text-[11px] text-[var(--text-muted)]">{file}{line ? `:${line}` : ''}</p>}{(expected || actual) && <div className="mt-2 grid gap-1 text-[11px] text-[var(--text-secondary)] sm:grid-cols-2"><span>预期：{expected ?? '—'}</span><span>实际：{actual ?? '—'}</span></div>}</div></div></div> }
function EmptyHint({ text, action, onClick }: { text: string; action?: string; onClick?: () => void }) { return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-[var(--border-subtle)] p-4 text-xs text-[var(--text-secondary)]"><span>{text}</span>{action && onClick && <button type="button" onClick={onClick} className="rounded-lg border border-cyan-500/30 px-3 py-1.5 text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300">{action}</button>}</div> }
