import { useRef, useState } from 'react'
import { selectCurrentProject, useProjectStore } from '@/store/projectStore'
import { useThemeStore } from '@/store/themeStore'
import type { Project } from '@/types/project'
import type { ChipTarget, ProjectFormat } from '@/types/hardware'
import { Clock, Cpu, Download, FileUp, FolderOpen, Plus, Sparkles, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parsePortableProject, portableProjectFilename, serializePortableProject } from '@/services/projects/portableProject'

const CHIPS: ChipTarget[] = ['ESP32', 'ESP32-S3', 'STM32F103', 'STM32F4']
const FORMATS: { value: ProjectFormat; label: string }[] = [
  { value: 'espidf', label: 'ESP-IDF' },
  { value: 'arduino', label: 'Arduino' },
  { value: 'platformio', label: 'PlatformIO' },
]

export default function ProjectManager() {
  const currentProject = useProjectStore(selectCurrentProject)
  const { projects, deleteProject, loadProject, createProject, importProject } = useProjectStore()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const importInputRef = useRef<HTMLInputElement>(null)

  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newChip, setNewChip] = useState<ChipTarget>('ESP32')
  const [newFormat, setNewFormat] = useState<ProjectFormat>('espidf')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function handleCreate() {
    if (!newName.trim()) return
    createProject(newName, newChip, newFormat)
    setShowNewForm(false)
    setNewName('')
  }

  function handleDelete(id: string) {
    deleteProject(id)
    setConfirmDelete(null)
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const imported = importProject(parsePortableProject(await file.text()))
      setNotice({ type: 'success', message: `已导入项目：${imported.name}` })
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  function handleExport(project: Project) {
    const blob = new Blob([serializePortableProject(project)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = portableProjectFilename(project)
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice({ type: 'success', message: `已导出项目：${project.name}` })
  }

  const sortedProjects = [...projects].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="h-full overflow-y-auto">
      <div className="tone-workspace mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* 页头 */}
        <div className="mb-8 flex flex-col gap-4 slide-in-left sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center',
                isDark ? 'bg-cyan-500/20' : 'bg-cyan-100'
              )}>
                <FolderOpen size={14} className={isDark ? 'text-cyan-400' : 'text-cyan-600'} />
              </div>
              <span className={cn(
                'text-xs font-semibold tracking-wide uppercase',
                isDark ? 'text-cyan-400' : 'text-cyan-600'
              )}>Projects</span>
            </div>
            <h1 className={cn('text-2xl font-bold mb-1', isDark ? 'text-white' : 'text-slate-800')}>项目管理</h1>
            <p className={cn('text-sm mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>创建和管理你的硬件方案项目</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,.metacore.json,application/json"
              className="hidden"
              onChange={handleImport}
            />
            <button
              onClick={() => importInputRef.current?.click()}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border transition-colors',
                isDark
                  ? 'border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              <FileUp size={16} />
              导入项目
            </button>
            <button
              onClick={() => setShowNewForm(true)}
              className="btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus size={16} />
              新建项目
            </button>
          </div>
        </div>

        {notice && (
          <div className={cn(
            'mb-5 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm',
            notice.type === 'success'
              ? isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : isDark ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'
          )}>
            <span>{notice.message}</span>
            <button onClick={() => setNotice(null)} className="text-xs opacity-70 hover:opacity-100">关闭</button>
          </div>
        )}

        {/* 新建表单 */}
        {showNewForm && (
          <div className={cn(
            'mb-6 p-5 rounded-2xl border shadow-lg fade-in-up',
            isDark
              ? 'border-cyan-500/20 bg-slate-800/80 shadow-cyan-500/5'
              : 'border-cyan-200 bg-white/80 shadow-cyan-500/5'
          )}>
            <h3 className={cn('text-sm font-semibold mb-4', isDark ? 'text-white' : 'text-slate-800')}>创建新项目</h3>
            <div className="flex flex-col gap-3">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="项目名称，如：AI桌宠_v1"
                className={cn(
                  'w-full px-4 py-2.5 text-sm rounded-xl outline-none transition-all',
                  isDark
                    ? 'bg-slate-700/80 border border-slate-600 text-white placeholder-slate-500 focus:border-cyan-500'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-cyan-500'
                )}
              />
              <div className="flex gap-3 flex-wrap">
                <div className={cn(
                  'flex gap-1 rounded-xl p-1',
                  isDark ? 'bg-slate-700/50' : 'bg-slate-100'
                )}>
                  {CHIPS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewChip(c)}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-lg font-medium transition-all',
                        newChip === c
                          ? 'bg-cyan-600 text-white shadow'
                          : isDark
                            ? 'text-slate-400 hover:text-white'
                            : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className={cn(
                  'flex gap-1 rounded-xl p-1',
                  isDark ? 'bg-slate-700/50' : 'bg-slate-100'
                )}>
                  {FORMATS.map(f => (
                    <button
                      key={f.value}
                      onClick={() => setNewFormat(f.value)}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-lg font-medium transition-all',
                        newFormat === f.value
                          ? 'bg-indigo-600 text-white shadow'
                          : isDark
                            ? 'text-slate-400 hover:text-white'
                            : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowNewForm(false)}
                className={cn(
                  'px-4 py-2 text-sm rounded-xl transition-colors',
                  isDark
                    ? 'text-slate-300 bg-slate-700 hover:bg-slate-600'
                    : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                )}
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="btn-primary flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                <Sparkles size={14} />
                创建并跳转
              </button>
            </div>
          </div>
        )}

        {/* 项目列表 */}
        {sortedProjects.length === 0 ? (
          <div className={cn(
            'flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed',
            isDark ? 'border-slate-700/50 text-slate-500' : 'border-slate-200 text-slate-400'
          )}>
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center mb-4',
              isDark ? 'bg-slate-800/80' : 'bg-slate-100'
            )}>
              <FolderOpen size={28} className={isDark ? 'opacity-30' : 'opacity-50'} />
            </div>
            <p className={cn('text-sm font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>还没有项目</p>
            <p className={cn('text-sm mt-1', isDark ? 'text-slate-600' : 'text-slate-400')}>点击上方「新建项目」开始</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedProjects.map((proj) => (
              <ProjectCard
                key={proj.id}
                project={proj}
                isActive={currentProject?.id === proj.id}
                onLoad={() => loadProject(proj.id)}
                onExport={() => handleExport(proj)}
                onDelete={() => setConfirmDelete(proj.id)}
              />
            ))}
          </div>
        )}

        {/* 删除确认 */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 fade-in-up">
            <div className={cn(
              'rounded-2xl p-6 w-full max-w-sm shadow-2xl',
              isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'
            )}>
              <h3 className={cn('font-semibold mb-2', isDark ? 'text-white' : 'text-slate-800')}>确认删除</h3>
              <p className={cn('text-sm mb-5', isDark ? 'text-slate-400' : 'text-slate-500')}>删除后无法恢复，确定要删除这个项目吗？</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className={cn(
                    'flex-1 py-2 text-sm rounded-xl transition-colors',
                    isDark ? 'text-slate-300 bg-slate-700 hover:bg-slate-600' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                  )}
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  className="flex-1 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectCard({ project, isActive, onLoad, onExport, onDelete }: {
  project: Project
  isActive: boolean
  onLoad: () => void
  onExport: () => void
  onDelete: () => void
}) {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const hasScheme = !!project.scheme
  const hasCode = project.codeFiles.length > 0
  const hasFlow = project.flowNodes.length > 0

  return (
    <div
      className={cn(
        'group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer hover:-translate-y-1',
        isActive
          ? isDark
            ? 'bg-gradient-to-br from-cyan-950/40 to-indigo-950/40 border-cyan-500/40 shadow-lg shadow-cyan-500/10'
            : 'bg-gradient-to-br from-cyan-50 to-indigo-50 border-cyan-300 shadow-lg shadow-cyan-500/10'
          : isDark
            ? 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600 hover:shadow-lg hover:shadow-slate-900/50'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50'
      )}
      onClick={onLoad}
    >
      {isActive && (
        <div className={cn(
          'absolute -top-px left-6 right-6 h-px',
          isDark
            ? 'bg-gradient-to-r from-transparent via-cyan-400 to-transparent'
            : 'bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60'
        )} />
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
            isActive
              ? isDark ? 'bg-cyan-500/20' : 'bg-cyan-100'
              : isDark ? 'bg-slate-700/80 group-hover:bg-slate-700' : 'bg-slate-100 group-hover:bg-slate-200'
          )}>
            <Cpu size={14} className={isActive ? (isDark ? 'text-cyan-400' : 'text-cyan-600') : (isDark ? 'text-slate-400' : 'text-slate-500')} />
          </div>
          <div>
            <div className={cn('text-sm font-semibold leading-tight', isDark ? 'text-white' : 'text-slate-800')}>{project.name}</div>
            <div className={cn('text-[10px] mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>{project.target} · {project.format}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button
            type="button"
            title="导出项目"
            onClick={(event) => { event.stopPropagation(); onExport() }}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              isDark
                ? 'text-slate-500 hover:text-cyan-300 hover:bg-cyan-950/30'
                : 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50'
            )}
          >
            <Download size={13} />
          </button>
          <button
            type="button"
            title="删除项目"
            onClick={(event) => { event.stopPropagation(); onDelete() }}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              isDark
                ? 'text-slate-600 hover:text-red-400 hover:bg-red-950/30'
                : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
            )}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        <StatusDot active={hasScheme} label="方案" isDark={isDark} />
        <StatusDot active={hasCode} label="代码" isDark={isDark} />
        <StatusDot active={hasFlow} label="流程" isDark={isDark} />
      </div>

      {project.requirement && (
        <p className={cn('text-xs leading-relaxed line-clamp-2 mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
          {project.requirement}
        </p>
      )}

      <div className={cn('flex items-center gap-1.5 text-[10px]', isDark ? 'text-slate-600' : 'text-slate-400')}>
        <Clock size={10} />
        {new Date(project.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        {isActive && (
          <span className={cn('ml-auto font-medium', isDark ? 'text-cyan-400' : 'text-cyan-600')}>使用中</span>
        )}
      </div>
    </div>
  )
}

function StatusDot({ active, label, isDark }: { active: boolean; label: string; isDark: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <div className={cn('w-1.5 h-1.5 rounded-full', active ? 'bg-cyan-400' : isDark ? 'bg-slate-700' : 'bg-slate-300')} />
      <span className={cn('text-[10px]', active ? (isDark ? 'text-slate-300' : 'text-slate-600') : (isDark ? 'text-slate-600' : 'text-slate-400'))}>
        {label}
      </span>
    </div>
  )
}
