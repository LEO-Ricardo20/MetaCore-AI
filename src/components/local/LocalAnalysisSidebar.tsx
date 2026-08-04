import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Code2,
  Cpu,
  Download,
  FolderOpen,
  Gauge,
  History,
  Info,
  Loader2,
  Package,
  Play,
  ShieldAlert,
  Sparkles,
  Terminal,
  Wifi,
  Wrench,
} from 'lucide-react'
import type {
  BackupInfo,
  BuildResult,
  LocalSystemInfo,
  WorkspaceAnalysis,
} from '@/services/local/types'
import { cn } from '@/lib/utils'

type AnalysisTab = 'overview' | 'hardware' | 'quality' | 'build'

interface Props {
  isDark: boolean
  analysis: WorkspaceAnalysis | null
  aiReport: string
  loading: string
  backups: BackupInfo[]
  buildResult: BuildResult | null
  systemInfo: LocalSystemInfo | null
  activeTab: AnalysisTab
  onTabChange: (tab: AnalysisTab) => void
  onAnalyze: () => void
  onAiJudge: () => void
  onExportReport: () => void
  onOpenPath: (path: string) => void
  onRestoreBackup: (backup: BackupInfo) => void
  onRunBuild: (profileId: string) => void
}

const tabs: Array<{ id: AnalysisTab; label: string; icon: typeof BarChart3 }> = [
  { id: 'overview', label: '总览', icon: BarChart3 },
  { id: 'hardware', label: '硬件', icon: Cpu },
  { id: 'quality', label: '质量', icon: ShieldAlert },
  { id: 'build', label: '构建', icon: Terminal },
]

export default function LocalAnalysisSidebar({
  isDark,
  analysis,
  aiReport,
  loading,
  backups,
  buildResult,
  systemInfo,
  activeTab,
  onTabChange,
  onAnalyze,
  onAiJudge,
  onExportReport,
  onOpenPath,
  onRestoreBackup,
  onRunBuild,
}: Props) {
  return (
    <aside className={cn(
      'w-[410px] flex-shrink-0 border-l flex flex-col transition-colors duration-300',
      isDark ? 'bg-slate-900/55 border-slate-700/50' : 'bg-white/55 border-indigo-100/50'
    )}>
      <div className={cn('p-3 border-b', isDark ? 'border-slate-700/50' : 'border-indigo-100/50')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench size={15} className={isDark ? 'text-emerald-400' : 'text-emerald-500'} />
            <span className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-slate-800')}>工程诊断</span>
          </div>
          <div className="flex items-center gap-2">
            {analysis && (
              <button
                onClick={onExportReport}
                disabled={loading === 'report'}
                title="导出 Markdown 诊断报告"
                className={cn('w-8 h-8 rounded-lg flex items-center justify-center', isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100')}
              >
                {loading === 'report' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              </button>
            )}
            <button
              onClick={onAnalyze}
              disabled={loading === 'analyze'}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors',
                isDark ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
              )}
            >
              {loading === 'analyze' ? <Loader2 size={13} className="animate-spin" /> : <BarChart3 size={13} />}
              扫描
            </button>
          </div>
        </div>

        {analysis && (
          <div className={cn('grid grid-cols-4 gap-1 mt-3 p-1 rounded-lg', isDark ? 'bg-slate-950/40' : 'bg-indigo-50/70')}>
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={cn(
                  'h-8 rounded-md flex items-center justify-center gap-1 text-[11px] transition-colors',
                  activeTab === id
                    ? isDark ? 'bg-slate-700 text-white' : 'bg-white text-indigo-600 shadow-sm'
                    : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                )}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!analysis ? (
          <div className={cn('flex flex-col items-center justify-center gap-3 h-56 text-center', isDark ? 'text-slate-500' : 'text-slate-400')}>
            <Gauge size={26} />
            <p className="text-xs leading-5 max-w-[260px]">扫描后会生成工程健康评分、协议与外设识别、引脚资源、依赖、安全风险和构建环境报告。</p>
          </div>
        ) : activeTab === 'overview' ? (
          <OverviewTab analysis={analysis} aiReport={aiReport} loading={loading} isDark={isDark} onAiJudge={onAiJudge} />
        ) : activeTab === 'hardware' ? (
          <HardwareTab analysis={analysis} isDark={isDark} onOpenPath={onOpenPath} />
        ) : activeTab === 'quality' ? (
          <QualityTab analysis={analysis} backups={backups} loading={loading} isDark={isDark} onOpenPath={onOpenPath} onRestoreBackup={onRestoreBackup} />
        ) : (
          <BuildTab analysis={analysis} systemInfo={systemInfo} buildResult={buildResult} loading={loading} isDark={isDark} onRunBuild={onRunBuild} />
        )}
      </div>
    </aside>
  )
}

function OverviewTab({ analysis, aiReport, loading, isDark, onAiJudge }: {
  analysis: WorkspaceAnalysis
  aiReport: string
  loading: string
  isDark: boolean
  onAiJudge: () => void
}) {
  const scoreColor = analysis.health.score >= 80 ? 'text-emerald-400' : analysis.health.score >= 60 ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="space-y-4">
      <div className={cn('border rounded-lg p-4', isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-white/70 border-indigo-100')}>
        <div className="flex items-center gap-4">
          <div className={cn('w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center flex-shrink-0', isDark ? 'border-slate-700' : 'border-indigo-100')}>
            <span className={cn('text-2xl font-bold', scoreColor)}>{analysis.health.score}</span>
            <span className={cn('text-[10px]', isDark ? 'text-slate-500' : 'text-slate-400')}>健康评分</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn('text-sm font-semibold truncate', isDark ? 'text-white' : 'text-slate-800')}>{analysis.primaryProjectType || '未识别工程类型'}</div>
            <div className={cn('text-xs mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>{analysis.chips.join(' / ') || '未识别目标芯片'}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3">
              <MiniStat label="代码行" value={analysis.statistics.codeLines} isDark={isDark} />
              <MiniStat label="分析文件" value={analysis.analyzedFiles} isDark={isDark} />
              <MiniStat label="外设" value={analysis.peripherals.length} isDark={isDark} />
              <MiniStat label="协议" value={analysis.protocols.length} isDark={isDark} />
            </div>
          </div>
        </div>
      </div>

      <Section title="维度评分" icon={<Gauge size={13} />} isDark={isDark}>
        {Object.entries(analysis.health.dimensions).map(([key, value]) => (
          <ScoreBar key={key} label={dimensionLabel(key)} value={value} isDark={isDark} />
        ))}
      </Section>

      <Section title="物联网协议" icon={<Wifi size={13} />} isDark={isDark}>
        {analysis.protocols.length ? (
          <div className="flex flex-wrap gap-1.5 py-1">
            {analysis.protocols.map((item) => (
              <span key={item.id} className={cn('px-2 py-1 rounded-md text-[11px]', isDark ? 'bg-cyan-500/10 text-cyan-300' : 'bg-cyan-50 text-cyan-700')}>{item.label}</span>
            ))}
          </div>
        ) : <EmptyLine text="未识别到通信协议" isDark={isDark} />}
      </Section>

      <Section title="改进建议" icon={<CheckCircle2 size={13} />} isDark={isDark}>
        {analysis.recommendations.map((item, index) => (
          <div key={index} className={cn('py-2 border-b last:border-b-0', isDark ? 'border-slate-800' : 'border-slate-100')}>
            <div className="flex items-center gap-2">
              <PriorityDot priority={item.priority} />
              <span className={cn('text-xs font-medium', isDark ? 'text-slate-200' : 'text-slate-700')}>{item.title}</span>
            </div>
            <p className={cn('text-[11px] leading-5 mt-1 pl-4', isDark ? 'text-slate-500' : 'text-slate-500')}>{item.detail}</p>
          </div>
        ))}
      </Section>

      <button
        onClick={onAiJudge}
        disabled={loading === 'ai'}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-50"
      >
        {loading === 'ai' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        AI 深度判断
      </button>

      {aiReport && (
        <Section title="AI 诊断意见" icon={<Sparkles size={13} />} isDark={isDark}>
          <div className={cn('whitespace-pre-wrap text-xs leading-5', isDark ? 'text-slate-300' : 'text-slate-600')}>{aiReport}</div>
        </Section>
      )}
    </div>
  )
}

function HardwareTab({ analysis, isDark, onOpenPath }: { analysis: WorkspaceAnalysis; isDark: boolean; onOpenPath: (path: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Metric icon={<Cpu size={13} />} label="目标芯片" value={analysis.chips.join(' / ') || '未识别'} isDark={isDark} />
        <Metric icon={<Code2 size={13} />} label="工程框架" value={analysis.projectTypes.join(' / ') || '未知'} isDark={isDark} />
        <Metric icon={<FolderOpen size={13} />} label="关键文件" value={`${analysis.keyFiles.length}`} isDark={isDark} />
        <Metric icon={<Wifi size={13} />} label="通信协议" value={`${analysis.protocols.length}`} isDark={isDark} />
      </div>

      <Section title="外设与总线" icon={<Cpu size={13} />} isDark={isDark}>
        {analysis.peripherals.length ? analysis.peripherals.map((item) => (
          <div key={item.id} className={cn('text-xs py-2 border-b last:border-b-0', isDark ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-600')}>
            <div className="font-medium">{item.label}</div>
            <div className={cn('truncate mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>{item.files.join(' · ')}</div>
          </div>
        )) : <EmptyLine text="未识别到外设线索" isDark={isDark} />}
      </Section>

      <Section title={`引脚资源 · ${analysis.pins.length}`} icon={<Cpu size={13} />} isDark={isDark}>
        {analysis.pins.length ? analysis.pins.slice(0, 80).map((pin, index) => (
          <button
            key={`${pin.path}-${pin.line}-${index}`}
            onClick={() => onOpenPath(pin.path)}
            className={cn('w-full text-left text-xs py-2 border-b last:border-b-0', isDark ? 'border-slate-800 text-slate-300 hover:text-cyan-300' : 'border-slate-100 text-slate-600 hover:text-cyan-600')}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{pin.name}</span>
              <span className="font-mono text-cyan-400">GPIO {pin.pin}</span>
            </div>
            <div className={cn('truncate mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>{pin.path}:{pin.line}</div>
          </button>
        )) : <EmptyLine text="未提取到明确引脚" isDark={isDark} />}
      </Section>
    </div>
  )
}

function QualityTab({ analysis, backups, loading, isDark, onOpenPath, onRestoreBackup }: {
  analysis: WorkspaceAnalysis
  backups: BackupInfo[]
  loading: string
  isDark: boolean
  onOpenPath: (path: string) => void
  onRestoreBackup: (backup: BackupInfo) => void
}) {
  return (
    <div className="space-y-4">
      <Section title="代码统计" icon={<BarChart3 size={13} />} isDark={isDark}>
        <div className="grid grid-cols-2 gap-2 py-1">
          <MiniStat label="总行数" value={analysis.statistics.totalLines} isDark={isDark} />
          <MiniStat label="有效代码" value={analysis.statistics.codeLines} isDark={isDark} />
          <MiniStat label="注释行" value={analysis.statistics.commentLines} isDark={isDark} />
          <MiniStat label="注释比例" value={`${Math.round(analysis.statistics.commentRatio * 100)}%`} isDark={isDark} />
        </div>
        <div className={cn('mt-3 pt-2 border-t', isDark ? 'border-slate-800' : 'border-slate-100')}>
          {analysis.statistics.languages.slice(0, 8).map((lang) => (
            <div key={lang.language} className="flex items-center justify-between text-[11px] py-1">
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{lang.language}</span>
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{lang.files} 文件 · {lang.lines} 行</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`风险与问题 · ${analysis.issues.length}`} icon={<ShieldAlert size={13} />} isDark={isDark}>
        {analysis.issues.length ? analysis.issues.map((issue, index) => (
          <button
            key={index}
            onClick={() => issue.path && onOpenPath(issue.path)}
            className={cn('w-full flex gap-2 text-left text-xs py-2 border-b last:border-b-0', isDark ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-600')}
          >
            {issue.severity === 'error'
              ? <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
              : issue.severity === 'warning'
                ? <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                : <Info size={13} className="text-cyan-400 flex-shrink-0 mt-0.5" />}
            <span className="leading-5">{issue.message}</span>
          </button>
        )) : <EmptyLine text="未发现明显风险" isDark={isDark} />}
      </Section>

      <Section title={`依赖摘要 · ${analysis.dependencies.length}`} icon={<Package size={13} />} isDark={isDark}>
        <div className="max-h-48 overflow-auto">
          {analysis.dependencies.length ? analysis.dependencies.map((dep) => (
            <div key={`${dep.kind}-${dep.name}`} className={cn('flex items-center justify-between gap-2 text-xs py-1.5 border-b last:border-b-0', isDark ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-600')}>
              <span className="truncate">{dep.name}</span>
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded', isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')}>{dep.kind}</span>
            </div>
          )) : <EmptyLine text="未提取到依赖" isDark={isDark} />}
        </div>
      </Section>

      <Section title={`安全备份 · ${backups.length}`} icon={<History size={13} />} isDark={isDark}>
        {backups.length ? backups.slice(0, 8).map((backup) => (
          <div key={backup.id} className={cn('flex items-center gap-2 py-2 border-b last:border-b-0', isDark ? 'border-slate-800' : 'border-slate-100')}>
            <div className="min-w-0 flex-1">
              <div className={cn('text-xs truncate', isDark ? 'text-slate-300' : 'text-slate-600')}>{backup.path}</div>
              <div className={cn('text-[10px] mt-0.5', isDark ? 'text-slate-600' : 'text-slate-400')}>{new Date(backup.createdAt).toLocaleString('zh-CN')}</div>
            </div>
            <button
              onClick={() => onRestoreBackup(backup)}
              disabled={loading === 'restore'}
              title="恢复此备份"
              className={cn('w-7 h-7 rounded-lg flex items-center justify-center', isDark ? 'bg-slate-800 text-slate-400 hover:text-cyan-300' : 'bg-slate-100 text-slate-500 hover:text-cyan-600')}
            >
              <History size={12} />
            </button>
          </div>
        )) : <EmptyLine text="保存文件后会自动生成备份" isDark={isDark} />}
      </Section>
    </div>
  )
}

function BuildTab({ analysis, systemInfo, buildResult, loading, isDark, onRunBuild }: {
  analysis: WorkspaceAnalysis
  systemInfo: LocalSystemInfo | null
  buildResult: BuildResult | null
  loading: string
  isDark: boolean
  onRunBuild: (profileId: string) => void
}) {
  return (
    <div className="space-y-4">
      <Section title="本机环境" icon={<Terminal size={13} />} isDark={isDark}>
        {systemInfo ? (
          <>
            <div className="grid grid-cols-2 gap-2 py-1">
              <MiniStat label="系统" value={`${systemInfo.platform} ${systemInfo.arch}`} isDark={isDark} />
              <MiniStat label="Node" value={systemInfo.nodeVersion} isDark={isDark} />
              <MiniStat label="CPU" value={`${systemInfo.cpuCount} 核`} isDark={isDark} />
              <MiniStat label="内存" value={`${systemInfo.memoryGB} GB`} isDark={isDark} />
            </div>
            <div className={cn('mt-3 pt-2 border-t grid grid-cols-2 gap-1', isDark ? 'border-slate-800' : 'border-slate-100')}>
              {Object.entries(systemInfo.tools).map(([tool, available]) => (
                <div key={tool} className="flex items-center gap-1.5 text-[11px] py-1">
                  {available ? <CheckCircle2 size={11} className="text-emerald-400" /> : <AlertCircle size={11} className="text-slate-500" />}
                  <span className={available ? (isDark ? 'text-slate-300' : 'text-slate-600') : (isDark ? 'text-slate-600' : 'text-slate-400')}>{tool}</span>
                </div>
              ))}
            </div>
          </>
        ) : <EmptyLine text="未读取到本机环境" isDark={isDark} />}
      </Section>

      <Section title="可用构建" icon={<Play size={13} />} isDark={isDark}>
        {analysis.buildProfiles.length ? analysis.buildProfiles.map((profile) => (
          <div key={profile.id} className={cn('flex items-center gap-3 py-2 border-b last:border-b-0', isDark ? 'border-slate-800' : 'border-slate-100')}>
            <div className="min-w-0 flex-1">
              <div className={cn('text-xs font-medium', isDark ? 'text-slate-200' : 'text-slate-700')}>{profile.label}</div>
              <div className={cn('text-[10px] font-mono truncate mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>{profile.command}</div>
            </div>
            <button
              onClick={() => onRunBuild(profile.id)}
              disabled={!profile.available || loading === 'build'}
              title={profile.available ? '执行白名单构建命令' : '本机未安装对应工具'}
              className={cn(
                'h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs disabled:opacity-40',
                isDark ? 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/20' : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'
              )}
            >
              {loading === 'build' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              构建
            </button>
          </div>
        )) : <EmptyLine text="当前工程未匹配到可执行构建配置" isDark={isDark} />}
      </Section>

      {buildResult && (
        <Section title="构建结果" icon={buildResult.success ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} isDark={isDark}>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={buildResult.success ? 'text-emerald-400' : 'text-red-400'}>{buildResult.success ? '构建成功' : `构建失败 · ${buildResult.exitCode}`}</span>
            <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{(buildResult.durationMs / 1000).toFixed(1)}s</span>
          </div>
          <pre className={cn('max-h-80 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-4 p-2 rounded-md font-mono', isDark ? 'bg-black/30 text-slate-400' : 'bg-slate-50 text-slate-600')}>
            {[buildResult.stdout, buildResult.stderr].filter(Boolean).join('\n') || '无构建输出'}
          </pre>
        </Section>
      )}
    </div>
  )
}

function Section({ title, icon, children, isDark }: { title: string; icon: React.ReactNode; children: React.ReactNode; isDark: boolean }) {
  return (
    <div>
      <div className={cn('flex items-center gap-1.5 text-[10px] font-semibold uppercase mb-2', isDark ? 'text-slate-500' : 'text-slate-400')}>{icon}{title}</div>
      <div className={cn('rounded-lg border px-3 py-2', isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-white/70 border-indigo-100')}>{children}</div>
    </div>
  )
}

function Metric({ icon, label, value, isDark }: { icon: React.ReactNode; label: string; value: string; isDark: boolean }) {
  return (
    <div className={cn('rounded-lg border p-3', isDark ? 'bg-slate-950/35 border-slate-800' : 'bg-white/70 border-indigo-100')}>
      <div className={cn('flex items-center gap-1.5 text-[10px] mb-1', isDark ? 'text-slate-500' : 'text-slate-400')}>{icon}{label}</div>
      <div className={cn('text-xs font-medium truncate', isDark ? 'text-slate-200' : 'text-slate-700')} title={value}>{value}</div>
    </div>
  )
}

function MiniStat({ label, value, isDark }: { label: string; value: string | number; isDark: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{label}</span>
      <span className={cn('font-medium truncate', isDark ? 'text-slate-300' : 'text-slate-600')}>{value}</span>
    </div>
  )
}

function ScoreBar({ label, value, isDark }: { label: string; value: number; isDark: boolean }) {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{label}</span>
        <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{value}</span>
      </div>
      <div className={cn('h-1.5 rounded-full overflow-hidden', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
        <div className={cn('h-full rounded-full', value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function PriorityDot({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  return <span className={cn('w-2 h-2 rounded-full flex-shrink-0', priority === 'high' ? 'bg-red-400' : priority === 'medium' ? 'bg-amber-400' : 'bg-cyan-400')} />
}

function EmptyLine({ text, isDark }: { text: string; isDark: boolean }) {
  return <div className={cn('text-xs py-2', isDark ? 'text-slate-600' : 'text-slate-400')}>{text}</div>
}

function dimensionLabel(key: string) {
  const map: Record<string, string> = {
    structure: '工程结构',
    hardware: '硬件资源',
    security: '安全性',
    maintainability: '可维护性',
    connectivity: '联网能力',
  }
  return map[key] ?? key
}
