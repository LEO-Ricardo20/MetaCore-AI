import { selectCurrentProject, useProjectStore } from '@/store/projectStore'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/lib/utils'
import { FileCode, FileText, File, Folder } from 'lucide-react'

function getIcon(path: string, isDark: boolean) {
  const dim = isDark ? 'opacity-60' : 'opacity-50'
  if (path.endsWith('.c') || path.endsWith('.cpp')) return <FileCode size={13} className={cn('flex-shrink-0', dim)} />
  if (path.endsWith('.h')) return <FileCode size={13} className={cn('flex-shrink-0', dim)} />
  if (path.endsWith('.cmake') || path.endsWith('CMakeLists.txt') || path.endsWith('platformio.ini')) return <FileText size={13} className={cn('flex-shrink-0', dim)} />
  if (path.endsWith('.ini') || path.endsWith('.ino')) return <FileText size={13} className={cn('flex-shrink-0', dim)} />
  return <File size={13} className={cn('flex-shrink-0', dim)} />
}

export default function FileTree() {
  const project = useProjectStore(selectCurrentProject)
  const { selectedFile, setSelectedFile } = useProjectStore()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  if (!project) return null

  // 按目录分组
  const groups: Record<string, string[]> = {}
  for (const f of project.codeFiles) {
    const parts = f.path.split('/')
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.'
    if (!groups[dir]) groups[dir] = []
    groups[dir].push(f.path)
  }

  const sortedDirs = Object.keys(groups).sort((a, b) => (a === '.' ? -1 : b === '.' ? 1 : a.localeCompare(b)))

  return (
    <div className={cn(
      'w-56 flex-shrink-0 border-r flex flex-col py-2 transition-colors duration-300',
      isDark
        ? 'bg-slate-900/50 border-slate-700/50'
        : 'bg-white/50 border-indigo-100/50'
    )}>
      {sortedDirs.map(dir => (
        <div key={dir}>
          {dir !== '.' && (
            <div className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider',
              isDark ? 'text-slate-500' : 'text-indigo-400'
            )}>
              <Folder size={11} />
              {dir}
            </div>
          )}
          {groups[dir].map(path => {
            const name = path.split('/').pop()!
            return (
              <button
                key={path}
                onClick={() => setSelectedFile(path)}
                className={cn(
                  'w-full flex items-center gap-2 px-4 py-1.5 text-xs text-left transition-all duration-150 rounded-lg mx-1',
                  selectedFile === path
                    ? isDark
                      ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/30 shadow-sm shadow-indigo-500/10'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm shadow-indigo-500/5'
                    : isDark
                      ? 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                      : 'text-slate-600 hover:bg-indigo-50/60 hover:text-indigo-600'
                )}
              >
                {getIcon(path, isDark)}
                <span className="truncate">{name}</span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
