import { useEffect, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Code2,
  Download,
  Edit3,
  File,
  FileCode,
  FileText,
  FolderOpen,
  HardDrive,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Server,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'
import { useAIConfigStore } from '@/store/aiConfigStore'
import { callAI } from '@/services/ai/client'
import {
  analyzeWorkspace,
  checkLocalHealth,
  generateLocalReport,
  getCurrentWorkspace,
  getLocalSystemInfo,
  listBackups,
  listDirectory,
  readLocalFile,
  restoreBackup,
  runBuild,
  searchLocalFiles,
  setWorkspace,
  writeLocalFile,
} from '@/services/local/localClient'
import type {
  BackupInfo,
  BuildResult,
  DirectoryListing,
  LocalFileContent,
  LocalFileItem,
  LocalSystemInfo,
  SearchResponse,
  WorkspaceAnalysis,
} from '@/services/local/types'
import { cn } from '@/lib/utils'
import LocalAnalysisSidebar from './LocalAnalysisSidebar'

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtTime(ms: number) {
  if (!ms) return ''
  return new Date(ms).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function itemIcon(item: LocalFileItem, isDark: boolean) {
  const dim = isDark ? 'text-slate-400' : 'text-slate-500'
  if (item.type === 'directory') return <FolderOpen size={14} className={dim} />
  if (/\.(c|cc|cpp|cxx|h|hpp|ino|ts|tsx|js|jsx)$/i.test(item.name)) {
    return <FileCode size={14} className={dim} />
  }
  if (/\.(md|txt|json|ini|yaml|yml|cmake|ioc)$/i.test(item.name) || item.name === 'CMakeLists.txt') {
    return <FileText size={14} className={dim} />
  }
  return <File size={14} className={dim} />
}

function compactAnalysis(analysis: WorkspaceAnalysis) {
  return {
    projectTypes: analysis.projectTypes,
    chips: analysis.chips,
    peripherals: analysis.peripherals.map((p) => ({ label: p.label, files: p.files.slice(0, 4) })),
    protocols: analysis.protocols,
    dependencies: analysis.dependencies.slice(0, 60),
    statistics: analysis.statistics,
    pins: analysis.pins.slice(0, 80),
    keyFiles: analysis.keyFiles.slice(0, 40),
    issues: analysis.issues,
    totalFiles: analysis.totalFiles,
    analyzedFiles: analysis.analyzedFiles,
    health: analysis.health,
    recommendations: analysis.recommendations,
  }
}

export default function LocalWorkspacePage() {
  const { theme } = useThemeStore()
  const { getActive } = useAIConfigStore()
  const isDark = theme === 'dark'

  const [serverOnline, setServerOnline] = useState(false)
  const [booting, setBooting] = useState(true)
  const [workspaceRoot, setWorkspaceRoot] = useState('')
  const [workspaceInput, setWorkspaceInput] = useState('')
  const [listing, setListing] = useState<DirectoryListing | null>(null)
  const [currentDir, setCurrentDir] = useState('')
  const [selectedFile, setSelectedFile] = useState<LocalFileContent | null>(null)
  const [searchText, setSearchText] = useState('')
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null)
  const [analysis, setAnalysis] = useState<WorkspaceAnalysis | null>(null)
  const [aiReport, setAiReport] = useState('')
  const [systemInfo, setSystemInfo] = useState<LocalSystemInfo | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null)
  const [analysisTab, setAnalysisTab] = useState<'overview' | 'hardware' | 'quality' | 'build'>('overview')
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const isDirty = Boolean(selectedFile && draftContent !== selectedFile.content)

  const breadcrumbs = useMemo(() => (
    currentDir ? currentDir.split('/').filter(Boolean) : []
  ), [currentDir])

  function applyLoadedFile(file: LocalFileContent) {
    setSelectedFile(file)
    setDraftContent(file.content)
    setIsEditing(false)
  }

  async function refreshBackups() {
    try {
      const result = await listBackups()
      setBackups(result.backups)
    } catch {
      setBackups([])
    }
  }

  async function loadDir(dir = '') {
    setLoading('list')
    setError('')
    try {
      const data = await listDirectory(dir)
      setListing(data)
      setCurrentDir(data.dir)
    } catch (e: any) {
      setError(e.message ?? '读取目录失败')
    } finally {
      setLoading('')
    }
  }

  async function boot() {
    setBooting(true)
    setError('')
    try {
      const [, info] = await Promise.all([checkLocalHealth(), getLocalSystemInfo()])
      setSystemInfo(info)
      setServerOnline(true)
      const workspace = await getCurrentWorkspace()
      setWorkspaceRoot(workspace.workspaceRoot)
      setWorkspaceInput(workspace.workspaceRoot)
      if (workspace.workspaceRoot) {
        await Promise.all([loadDir(''), refreshBackups()])
      }
    } catch (e: any) {
      setServerOnline(false)
      setError(e.message === 'Failed to fetch' ? '本地后端未启动' : (e.message ?? '无法连接本地后端'))
    } finally {
      setBooting(false)
    }
  }

  useEffect(() => {
    void boot()
    // This startup probe intentionally runs once for the localhost service.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSetWorkspace() {
    setLoading('workspace')
    setError('')
    setSelectedFile(null)
    setDraftContent('')
    setIsEditing(false)
    setAnalysis(null)
    setAiReport('')
    setBuildResult(null)
    setNotice('')
    try {
      const workspace = await setWorkspace(workspaceInput.trim())
      setWorkspaceRoot(workspace.workspaceRoot)
      await Promise.all([loadDir(''), refreshBackups()])
    } catch (e: any) {
      setError(e.message ?? '设置工作区失败')
    } finally {
      setLoading('')
    }
  }

  async function handleOpenItem(item: LocalFileItem) {
    if (isDirty && !window.confirm('当前文件有未保存修改，确定要放弃并打开其他内容吗？')) return
    if (item.type === 'directory') {
      setSelectedFile(null)
      setDraftContent('')
      setIsEditing(false)
      setSearchResult(null)
      await loadDir(item.path)
      return
    }
    if (!item.readable) {
      setError('当前只允许预览文本类文件')
      return
    }
    setLoading('file')
    setError('')
    try {
      const file = await readLocalFile(item.path)
      applyLoadedFile(file)
    } catch (e: any) {
      setError(e.message ?? '读取文件失败')
    } finally {
      setLoading('')
    }
  }

  async function handleSearch() {
    if (!searchText.trim()) return
    setLoading('search')
    setError('')
    try {
      const result = await searchLocalFiles(searchText.trim())
      setSearchResult(result)
    } catch (e: any) {
      setError(e.message ?? '搜索失败')
    } finally {
      setLoading('')
    }
  }

  async function handleOpenPath(path: string) {
    if (isDirty && !window.confirm('当前文件有未保存修改，确定要放弃并打开其他文件吗？')) return
    setLoading('file')
    setError('')
    try {
      const file = await readLocalFile(path)
      applyLoadedFile(file)
    } catch (e: any) {
      setError(e.message ?? '读取文件失败')
    } finally {
      setLoading('')
    }
  }

  async function handleSaveFile() {
    if (!selectedFile || !isDirty) return
    if (!window.confirm(`确认保存 ${selectedFile.path}？系统会先自动创建备份。`)) return
    setLoading('save')
    setError('')
    setNotice('')
    try {
      const result = await writeLocalFile(selectedFile.path, draftContent, selectedFile.modifiedAt)
      applyLoadedFile(result.file)
      await refreshBackups()
      setNotice(`保存成功，备份编号：${result.backup.id}`)
    } catch (e: any) {
      setError(e.message ?? '保存文件失败')
    } finally {
      setLoading('')
    }
  }

  function handleCancelEdit() {
    if (!selectedFile) return
    setDraftContent(selectedFile.content)
    setIsEditing(false)
  }

  async function handleRestoreBackup(backup: BackupInfo) {
    if (!window.confirm(`确认将 ${backup.path} 恢复到该备份版本？当前版本也会先自动备份。`)) return
    setLoading('restore')
    setError('')
    setNotice('')
    try {
      const result = await restoreBackup(backup.id)
      if (selectedFile?.path === result.file.path) applyLoadedFile(result.file)
      await refreshBackups()
      setNotice(`已恢复 ${result.file.path}`)
    } catch (e: any) {
      setError(e.message ?? '恢复备份失败')
    } finally {
      setLoading('')
    }
  }

  async function handleRunBuild(profileId: string) {
    if (!window.confirm('构建命令只在当前工作区运行，确认开始构建吗？')) return
    setLoading('build')
    setError('')
    setBuildResult(null)
    try {
      const result = await runBuild(profileId)
      setBuildResult(result)
      setNotice(result.success ? '构建成功' : `构建结束，退出码 ${result.exitCode}`)
    } catch (e: any) {
      setError(e.message ?? '构建失败')
    } finally {
      setLoading('')
    }
  }

  async function handleExportReport() {
    setLoading('report')
    setError('')
    try {
      const result = await generateLocalReport()
      setAnalysis(result.analysis)
      const blob = new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `MetaCore-工程诊断报告-${new Date().toISOString().slice(0, 10)}.md`
      a.click()
      URL.revokeObjectURL(url)
      setNotice('诊断报告已导出')
    } catch (e: any) {
      setError(e.message ?? '导出报告失败')
    } finally {
      setLoading('')
    }
  }

  async function handleAnalyze() {
    setLoading('analyze')
    setError('')
    setNotice('')
    setAiReport('')
    try {
      const result = await analyzeWorkspace()
      setAnalysis(result)
      setAnalysisTab('overview')
      await refreshBackups()
    } catch (e: any) {
      setError(e.message ?? '扫描工程失败')
    } finally {
      setLoading('')
    }
  }

  async function handleAiJudge() {
    if (!analysis) return
    const svc = getActive()
    if (!svc) {
      setError('请先在设置页配置并选择 AI 服务')
      return
    }
    setLoading('ai')
    setError('')
    setAiReport('')
    try {
      const report = await callAI(svc, [
        {
          role: 'system',
          content: '你是嵌入式硬件与固件工程诊断专家。请基于结构化扫描结果判断工程风险，输出精简、可执行的中文建议。',
        },
        {
          role: 'user',
          content: [
            '请分析这个本地工程扫描结果，重点判断：工程类型、芯片/外设匹配、引脚冲突、依赖缺失、下一步操作建议。',
            '不要臆测未提供的文件内容；不需要写代码；按严重程度排序。',
            JSON.stringify(compactAnalysis(analysis), null, 2),
          ].join('\n\n'),
        },
      ], { temperature: 0.2 })
      setAiReport(report)
    } catch (e: any) {
      setError(e.message ?? 'AI 判断失败')
    } finally {
      setLoading('')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className={cn(
        'flex items-center justify-between px-5 py-3 border-b transition-colors duration-300',
        isDark ? 'border-slate-700/50 bg-slate-900/50' : 'border-indigo-100/50 bg-white/50'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center',
            isDark ? 'bg-cyan-500/15' : 'bg-cyan-50'
          )}>
            <HardDrive size={15} className={isDark ? 'text-cyan-400' : 'text-cyan-500'} />
          </div>
          <div>
            <div className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-slate-800')}>
              本地工程
            </div>
            <div className={cn('text-xs truncate max-w-[56vw]', isDark ? 'text-slate-500' : 'text-slate-400')}>
              {workspaceRoot || '未设置工作区'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <div className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg max-w-md',
              isDark ? 'bg-red-950/30 text-red-400 border border-red-900/30' : 'bg-red-50 text-red-600 border border-red-200'
            )}>
              <AlertCircle size={13} className="flex-shrink-0" />
              <span className="truncate" title={error}>{error}</span>
            </div>
          )}
          {notice && !error && (
            <div className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg max-w-md',
              isDark ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            )}>
              <CheckCircle2 size={13} className="flex-shrink-0" />
              <span className="truncate" title={notice}>{notice}</span>
            </div>
          )}
          {analysis && (
            <button
              onClick={handleExportReport}
              disabled={loading === 'report'}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-xs rounded-xl transition-colors',
                isDark ? 'bg-slate-800/70 text-slate-300 hover:bg-slate-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
              )}
            >
              {loading === 'report' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              导出报告
            </button>
          )}
          <button
            onClick={boot}
            disabled={booting}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-xs rounded-xl transition-colors',
              isDark ? 'bg-slate-800/70 text-slate-300 hover:bg-slate-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
            )}
          >
            {booting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            刷新连接
          </button>
        </div>
      </div>

      {booting ? (
        <div className={cn('flex-1 flex items-center justify-center gap-3 text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
          <Loader2 size={18} className="animate-spin text-cyan-400" />
          正在连接本地服务...
        </div>
      ) : !serverOnline ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className={cn(
            'w-full max-w-xl border rounded-2xl p-6',
            isDark ? 'bg-slate-900/70 border-slate-700/60' : 'bg-white/70 border-indigo-100'
          )}>
            <div className="flex items-center gap-3 mb-4">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', isDark ? 'bg-cyan-500/15' : 'bg-cyan-50')}>
                <Server size={18} className={isDark ? 'text-cyan-400' : 'text-cyan-500'} />
              </div>
              <div>
                <div className={cn('font-semibold', isDark ? 'text-white' : 'text-slate-800')}>本地后端未运行</div>
                <div className={cn('text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>本地工程服务需要在本机启动</div>
              </div>
            </div>
            <div className={cn(
              'font-mono text-xs px-3 py-2 rounded-xl border',
              isDark ? 'bg-slate-950 text-cyan-300 border-slate-800' : 'bg-slate-50 text-cyan-700 border-slate-200'
            )}>
              npm run dev:server
            </div>
            <p className={cn('text-xs mt-3 leading-5', isDark ? 'text-slate-500' : 'text-slate-500')}>
              服务只监听 127.0.0.1，文件读写、备份和构建都限定在你设置的工作区目录。
            </p>
          </div>
        </div>
      ) : !workspaceRoot ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className={cn(
            'w-full max-w-2xl border rounded-2xl p-6',
            isDark ? 'bg-slate-900/70 border-slate-700/60' : 'bg-white/70 border-indigo-100'
          )}>
            <div className="flex items-center gap-3 mb-5">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', isDark ? 'bg-emerald-500/15' : 'bg-emerald-50')}>
                <ShieldCheck size={18} className={isDark ? 'text-emerald-400' : 'text-emerald-500'} />
              </div>
              <div>
                <div className={cn('font-semibold', isDark ? 'text-white' : 'text-slate-800')}>设置本地工作区</div>
                <div className={cn('text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>后端只允许访问这个目录及其子目录</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                value={workspaceInput}
                onChange={(e) => setWorkspaceInput(e.target.value)}
                placeholder="例如 D:\MetaCore Workspace"
                className={cn(
                  'flex-1 h-10 rounded-xl px-3 text-sm outline-none border font-mono',
                  isDark ? 'bg-slate-950/70 border-slate-700 text-slate-200 placeholder:text-slate-600' : 'bg-white border-indigo-100 text-slate-700 placeholder:text-slate-400'
                )}
              />
              <button
                onClick={handleSetWorkspace}
                disabled={loading === 'workspace' || !workspaceInput.trim()}
                className="btn-primary h-10 px-4 text-sm"
              >
                {loading === 'workspace' ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
                启用
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <aside className={cn(
            'w-80 flex-shrink-0 border-r flex flex-col transition-colors duration-300',
            isDark ? 'bg-slate-900/50 border-slate-700/50' : 'bg-white/50 border-indigo-100/50'
          )}>
            <div className={cn('p-3 border-b', isDark ? 'border-slate-700/50' : 'border-indigo-100/50')}>
              <div className="flex items-center gap-2">
                <input
                  value={workspaceInput}
                  onChange={(e) => setWorkspaceInput(e.target.value)}
                  className={cn(
                    'min-w-0 flex-1 h-8 rounded-lg px-2 text-xs outline-none border font-mono',
                    isDark ? 'bg-slate-950/60 border-slate-700 text-slate-300' : 'bg-white border-indigo-100 text-slate-600'
                  )}
                />
                <button
                  onClick={handleSetWorkspace}
                  title="切换工作区"
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100'
                  )}
                >
                  <ShieldCheck size={14} />
                </button>
              </div>
              <div className="flex items-center gap-1 mt-3 overflow-hidden">
                <button
                  onClick={() => loadDir('')}
                  className={cn('text-xs px-2 py-1 rounded-lg flex-shrink-0', isDark ? 'text-cyan-400 hover:bg-slate-800' : 'text-cyan-600 hover:bg-cyan-50')}
                >
                  根目录
                </button>
                {breadcrumbs.map((part, index) => {
                  const dir = breadcrumbs.slice(0, index + 1).join('/')
                  return (
                    <button
                      key={dir}
                      onClick={() => loadDir(dir)}
                      className={cn('text-xs px-2 py-1 rounded-lg truncate', isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-indigo-50')}
                    >
                      / {part}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={cn('p-3 border-b', isDark ? 'border-slate-700/50' : 'border-indigo-100/50')}>
              <div className="flex items-center gap-2">
                <div className={cn(
                  'flex-1 flex items-center gap-2 h-8 rounded-lg px-2 border',
                  isDark ? 'bg-slate-950/60 border-slate-700 text-slate-300' : 'bg-white border-indigo-100 text-slate-600'
                )}>
                  <Search size={13} />
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                    placeholder="搜索文件或文本"
                    className="min-w-0 flex-1 bg-transparent outline-none text-xs"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={loading === 'search' || !searchText.trim()}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100'
                  )}
                >
                  {loading === 'search' ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto py-2">
              {currentDir && (
                <button
                  onClick={() => loadDir(listing?.parent ?? '')}
                  className={cn(
                    'w-[calc(100%-0.5rem)] mx-1 mb-1 flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-left',
                    isDark ? 'text-slate-400 hover:bg-slate-800/70' : 'text-slate-500 hover:bg-indigo-50'
                  )}
                >
                  <ChevronLeft size={13} />
                  上一级
                </button>
              )}
              {loading === 'list' ? (
                <div className={cn('flex items-center justify-center gap-2 py-8 text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                  <Loader2 size={14} className="animate-spin" />
                  读取目录...
                </div>
              ) : (
                listing?.items.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleOpenItem(item)}
                    className={cn(
                      'w-[calc(100%-0.5rem)] mx-1 flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-left transition-colors',
                      selectedFile?.path === item.path
                        ? isDark ? 'bg-cyan-600/20 text-cyan-200 border border-cyan-500/30' : 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                        : isDark ? 'text-slate-300 hover:bg-slate-800/70' : 'text-slate-600 hover:bg-indigo-50'
                    )}
                  >
                    {itemIcon(item, isDark)}
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    {item.type === 'file' && (
                      <span className={cn('text-[10px] flex-shrink-0', isDark ? 'text-slate-600' : 'text-slate-400')}>
                        {fmtSize(item.size)}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            {searchResult && (
              <div className={cn('max-h-56 overflow-auto border-t p-2', isDark ? 'border-slate-700/50' : 'border-indigo-100/50')}>
                <div className={cn('text-[10px] font-semibold px-2 py-1', isDark ? 'text-slate-500' : 'text-slate-400')}>
                  搜索结果 · {searchResult.results.length}
                </div>
                {searchResult.results.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleOpenPath(item.path)}
                    className={cn(
                      'w-full text-left rounded-lg px-2 py-1.5 text-xs',
                      isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-indigo-50'
                    )}
                  >
                    <div className="truncate">{item.path}</div>
                    {item.matches[0] && (
                      <div className={cn('truncate text-[10px] mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
                        {item.matches[0].lineNumber}: {item.matches[0].line.trim()}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="flex-1 min-w-0 flex flex-col">
            {selectedFile ? (
              <>
                <div className={cn(
                  'flex items-center justify-between px-4 py-2 border-b text-xs',
                  isDark ? 'bg-slate-800/60 border-slate-700/50 text-slate-400' : 'bg-indigo-50/60 border-indigo-100/50 text-indigo-500'
                )}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                    <span className="font-mono truncate">{selectedFile.path}</span>
                    {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="有未保存修改" />}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn(isDark ? 'text-slate-500' : 'text-slate-400')}>
                      {fmtSize(selectedFile.size)} · {fmtTime(selectedFile.modifiedAt)}
                    </span>
                    {!isEditing ? (
                      <button
                        onClick={() => setIsEditing(true)}
                        title="编辑文件"
                        className={cn('w-7 h-7 rounded-lg flex items-center justify-center', isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-indigo-500 hover:bg-indigo-50')}
                      >
                        <Edit3 size={13} />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleSaveFile}
                          disabled={!isDirty || loading === 'save'}
                          title="保存并创建备份"
                          className={cn('w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-40', isDark ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100')}
                        >
                          {loading === 'save' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          title="放弃修改"
                          className={cn('w-7 h-7 rounded-lg flex items-center justify-center', isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-slate-500 hover:bg-slate-100')}
                        >
                          <X size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  {loading === 'file' ? (
                    <div className={cn('h-full flex items-center justify-center gap-2 text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
                      <Loader2 size={16} className="animate-spin" />
                      读取文件...
                    </div>
                  ) : (
                    <Editor
                      height="100%"
                      language={selectedFile.language}
                      value={draftContent}
                      onChange={(value) => setDraftContent(value ?? '')}
                      theme={isDark ? 'vs-dark' : 'light'}
                      options={{
                        readOnly: !isEditing,
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        renderLineHighlight: 'none',
                        overviewRulerBorder: false,
                        hideCursorInOverviewRuler: true,
                        scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                      }}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className={cn('flex-1 flex flex-col items-center justify-center gap-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
                <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center', isDark ? 'bg-slate-800/60' : 'bg-indigo-50')}>
                  <Code2 size={28} className={isDark ? 'text-slate-600' : 'text-indigo-300'} />
                </div>
                <p className="text-sm">选择左侧文件查看内容</p>
              </div>
            )}
          </section>

          <LocalAnalysisSidebar
            isDark={isDark}
            analysis={analysis}
            aiReport={aiReport}
            loading={loading}
            backups={backups}
            buildResult={buildResult}
            systemInfo={systemInfo}
            activeTab={analysisTab}
            onTabChange={setAnalysisTab}
            onAnalyze={handleAnalyze}
            onAiJudge={handleAiJudge}
            onExportReport={handleExportReport}
            onOpenPath={handleOpenPath}
            onRestoreBackup={handleRestoreBackup}
            onRunBuild={handleRunBuild}
          />
        </div>
      )}
    </div>
  )
}
