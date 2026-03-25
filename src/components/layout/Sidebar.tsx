/** 侧边栏导航 — 包含路由链接、主题切换和版本号 */

import { NavLink } from 'react-router-dom'
import { Cpu, Code2, GitBranch, Settings, Zap, FolderOpen, BookOpen, Info, CircuitBoard, Sun, Moon, Layers } from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/projects', icon: FolderOpen, label: '项目', color: 'cyan' },
  { to: '/requirement', icon: Cpu, label: '方案', color: 'indigo' },
  { to: '/codegen', icon: Code2, label: '代码', color: 'violet' },
  { to: '/flow', icon: GitBranch, label: '流程', color: 'fuchsia' },
  { to: '/chips', icon: CircuitBoard, label: '芯片', color: 'rose' },
  { to: '/drivers', icon: Layers, label: '外设库', color: 'orange' },
  { to: '/settings', icon: Settings, label: '设置', color: 'slate' },
  { to: '/help', icon: BookOpen, label: '帮助', color: 'amber' },
  { to: '/about', icon: Info, label: '关于', color: 'emerald' },
]

const colorMap: Record<string, { active: string; dot: string }> = {
  cyan: { active: 'bg-cyan-500/15 text-cyan-400', dot: 'bg-cyan-400' },
  indigo: { active: 'bg-indigo-500/15 text-indigo-400', dot: 'bg-indigo-400' },
  violet: { active: 'bg-violet-500/15 text-violet-400', dot: 'bg-violet-400' },
  fuchsia: { active: 'bg-fuchsia-500/15 text-fuchsia-400', dot: 'bg-fuchsia-400' },
  rose: { active: 'bg-rose-500/15 text-rose-400', dot: 'bg-rose-400' },
  orange: { active: 'bg-orange-500/15 text-orange-400', dot: 'bg-orange-400' },
  slate: { active: 'bg-slate-500/15 text-slate-400', dot: 'bg-slate-400' },
  amber: { active: 'bg-amber-500/15 text-amber-400', dot: 'bg-amber-400' },
  emerald: { active: 'bg-emerald-500/15 text-emerald-400', dot: 'bg-emerald-400' },
}

export default function Sidebar() {
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'

  return (
    <aside className={cn(
      'w-[72px] flex flex-col items-center py-5 gap-1 border-r relative transition-colors duration-300',
      isDark ? 'bg-[#080c14] border-slate-800/40' : 'bg-[#e8effe] border-indigo-100/50'
    )}>
      {/* Logo */}
      <div className="mb-5 flex flex-col items-center gap-1">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-cyan-500 to-indigo-400 flex items-center justify-center shadow-lg logo-glow">
          <Zap size={18} className="text-white" />
        </div>
      </div>

      {/* Nav */}
      <div className="flex flex-col gap-1 w-full px-2">
        {nav.map(({ to, icon: Icon, label, color }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs transition-all duration-200 relative group',
                isActive
                  ? colorMap[color].active
                  : isDark
                    ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-indigo-100/50'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <>
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-to-b from-transparent via-current to-transparent rounded-r-full opacity-60" />
                    <span className={cn('absolute -left-0.5 top-1.5 w-1 h-1 rounded-full', colorMap[color].dot)} />
                  </>
                )}
                <Icon size={17} className={isActive ? 'drop-shadow-lg' : ''} />
                <span className="text-[10px] leading-none">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* 主题切换 */}
      <button
        onClick={toggleTheme}
        title={isDark ? '切换亮色模式' : '切换暗色模式'}
        className={cn(
          'mt-2 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200',
          isDark
            ? 'bg-slate-800/60 text-slate-400 hover:text-amber-300 hover:bg-slate-700/80 hover:shadow-lg hover:shadow-amber-500/10'
            : 'bg-indigo-100/60 text-indigo-400 hover:text-amber-500 hover:bg-indigo-200/60 hover:shadow-lg hover:shadow-amber-500/10'
        )}
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* 底部版本 */}
      <div className={cn('mt-2 text-[9px] font-mono', isDark ? 'text-slate-700' : 'text-indigo-300')}>v1.5.6</div>
    </aside>
  )
}
