import Editor from '@monaco-editor/react'
import { selectCurrentProject, useProjectStore } from '@/store/projectStore'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/lib/utils'

const LANG_MAP: Record<string, string> = {
  c: 'c', h: 'c', cpp: 'cpp', cmake: 'cmake',
  ini: 'ini', ino: 'cpp', makefile: 'makefile', other: 'plaintext'
}

export default function CodePreview() {
  const project = useProjectStore(selectCurrentProject)
  const selectedFile = useProjectStore((state) => state.selectedFile)
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const file = project?.codeFiles.find(f => f.path === selectedFile)

  if (!file) return (
    <div className={cn(
      'flex-1 flex items-center justify-center text-sm',
      isDark ? 'text-slate-500' : 'text-slate-400'
    )}>
      选择左侧文件查看代码
    </div>
  )

  return (
    <div className={cn(
      'flex-1 overflow-hidden flex flex-col transition-colors duration-300',
      isDark ? 'border-l border-slate-700/50' : 'border-l border-indigo-100/50'
    )}>
      {/* 文件路径栏 */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2 border-b text-xs font-mono transition-colors duration-300',
        isDark
          ? 'bg-slate-800/60 border-slate-700/50 text-slate-400'
          : 'bg-indigo-50/60 border-indigo-100/50 text-indigo-500'
      )}>
        <span className={cn('w-1.5 h-1.5 rounded-full', isDark ? 'bg-indigo-400' : 'bg-indigo-400')} />
        {file.path}
      </div>
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={LANG_MAP[file.language] ?? 'plaintext'}
          value={file.content}
          theme={isDark ? 'vs-dark' : 'light'}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            renderLineHighlight: 'none',
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 }
          }}
        />
      </div>
    </div>
  )
}
