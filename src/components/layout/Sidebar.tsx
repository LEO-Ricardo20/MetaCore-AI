import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Activity, Boxes, ChevronLeft, ChevronRight, Code2, FolderKanban, HelpCircle, Info, LayoutDashboard, Menu, Moon, Settings, ShieldCheck, Sun, X } from 'lucide-react'
import MetaCoreLogo from '@/components/brand/MetaCoreLogo'
import { useThemeStore } from '@/store/themeStore'
import { selectCurrentProject, useProjectStore } from '@/store/projectStore'
import { useAIConfigStore } from '@/store/aiConfigStore'
import { checkLocalHealth } from '@/services/local/localClient'
import { cn } from '@/lib/utils'
import { APP_NAME, APP_VERSION_LABEL } from '@/config/app'

const SIDEBAR_KEY = 'metacore-sidebar-collapsed'

const primaryNav = [
  { to: '/workspace', icon: LayoutDashboard, label: '工作台' },
  { to: '/design', icon: Boxes, label: '设计' },
  { to: '/implementation', icon: Code2, label: '实现' },
  { to: '/verification', icon: ShieldCheck, label: '验证' },
  { to: '/projects', icon: FolderKanban, label: '项目' },
]

const systemNav = [
  { to: '/settings', icon: Settings, label: '设置' },
  { to: '/help', icon: HelpCircle, label: '帮助' },
  { to: '/about', icon: Info, label: '关于' },
]

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const { theme, toggleTheme } = useThemeStore()
  const projects = useProjectStore((state) => state.projects)
  const currentProjectId = useProjectStore((state) => state.currentProjectId)
  const current = useProjectStore(selectCurrentProject)
  const loadProject = useProjectStore((state) => state.loadProject)
  const activeAI = useAIConfigStore((state) => state.getActive())
  const [localOnline, setLocalOnline] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === 'true')
  const unresolved = current ? Object.values(current.artifacts).filter((item) => item.status === 'invalid' || item.status === 'stale').length : 0

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, String(collapsed))
  }, [collapsed])

  useEffect(() => {
    let alive = true
    const update = () => checkLocalHealth().then(() => alive && setLocalOnline(true)).catch(() => alive && setLocalOnline(false))
    update()
    const timer = window.setInterval(update, 30_000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [])

  const desktopWidth = collapsed ? 'lg:w-16' : 'lg:w-[220px]'
  return (
    <>
      {mobileOpen && <button type="button" className="fixed inset-0 z-40 bg-black/55 lg:hidden" aria-label="关闭导航遮罩" onClick={onMobileClose} />}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-[min(86vw,260px)] -translate-x-full flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-glass)] shadow-[var(--shadow-floating)] backdrop-blur-[18px] transition-[width,transform] duration-200 lg:static lg:z-20 lg:translate-x-0 lg:shadow-none',
        desktopWidth,
        mobileOpen && 'translate-x-0',
      )} aria-label="主导航">
        <div className={cn('flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] px-3', collapsed && 'lg:justify-center lg:px-2')}>
          <MetaCoreLogo size="sm" title={APP_NAME} />
          <div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}><p className="truncate text-sm font-semibold text-[var(--text-primary)]">{APP_NAME}</p><p className="text-[10px] text-[var(--text-muted)]">Embedded AI Workspace</p></div>
          <button type="button" className="icon-button lg:hidden" onClick={onMobileClose} aria-label="关闭导航" title="关闭导航"><X size={17} /></button>
        </div>

        <div className={cn('border-b border-[var(--border-subtle)] p-3', collapsed && 'lg:px-2')}>
          <label className={cn('block text-[10px] font-semibold uppercase text-[var(--text-muted)]', collapsed && 'lg:sr-only')} htmlFor="current-project-switcher">当前项目</label>
          <select id="current-project-switcher" value={currentProjectId ?? ''} onChange={(event) => event.target.value && loadProject(event.target.value)} className={cn('mt-1.5 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-2 text-xs text-[var(--text-primary)] focus-visible:border-cyan-400', collapsed && 'lg:hidden')} aria-label="切换当前项目">
            <option value="">未选择项目</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          {collapsed && <div className="hidden h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-cyan-300 lg:flex" title={current?.name ?? '未选择项目'}><FolderKanban size={16} /></div>}
          {!collapsed && current && <div className="mt-2 hidden min-w-0 lg:block"><p className="truncate text-[11px] text-[var(--text-secondary)]">{current.target} · {current.format}</p><div className="mt-1 flex items-center justify-between gap-2 text-[10px]"><span className="truncate text-[var(--text-muted)]">{current.currentStage}</span>{unresolved > 0 && <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-0.5 text-red-300">{unresolved} 错误</span>}</div></div>}
        </div>

        <nav className="flex-1 overflow-y-auto p-2" aria-label="研发工作流">
          <p className={cn('px-2 pb-1 pt-2 text-[10px] font-semibold uppercase text-[var(--text-muted)]', collapsed && 'lg:sr-only')}>工作流</p>
          <div className="space-y-1">{primaryNav.map((item) => <NavigationItem key={item.to} {...item} collapsed={collapsed} onNavigate={onMobileClose} badge={item.to === '/verification' && unresolved ? unresolved : undefined} />)}</div>
          <p className={cn('mt-4 px-2 pb-1 pt-2 text-[10px] font-semibold uppercase text-[var(--text-muted)]', collapsed && 'lg:sr-only')}>系统</p>
          <div className="space-y-1">{systemNav.map((item) => <NavigationItem key={item.to} {...item} collapsed={collapsed} onNavigate={onMobileClose} />)}</div>
        </nav>

        <div className={cn('border-t border-[var(--border-subtle)] p-2', collapsed && 'lg:px-2')}>
          <div className={cn('mb-2 space-y-1 rounded-[var(--radius-control)] bg-[var(--surface-raised)] p-2', collapsed && 'lg:flex lg:flex-col lg:items-center')}>
            <StatusRow label="AI" online={Boolean(activeAI)} collapsed={collapsed} title={activeAI ? `${activeAI.name} · ${activeAI.model}` : 'AI 服务未配置'} />
            <StatusRow label="本地" online={localOnline} collapsed={collapsed} title={localOnline ? '本地服务在线' : '本地服务离线'} />
          </div>
          <button type="button" onClick={toggleTheme} className={cn('nav-button w-full', collapsed && 'lg:justify-center lg:px-0')} aria-label={theme === 'dark' ? '切换亮色主题' : '切换深色主题'} title={theme === 'dark' ? '切换亮色主题' : '切换深色主题'}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span className={cn(collapsed && 'lg:hidden')}>{theme === 'dark' ? '亮色主题' : '深色主题'}</span></button>
          <button type="button" onClick={() => setCollapsed((value) => !value)} className={cn('nav-button mt-1 hidden w-full lg:flex', collapsed && 'justify-center px-0')} aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'} title={collapsed ? '展开侧边栏' : '折叠侧边栏'}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}<span className={cn(collapsed && 'hidden')}>折叠侧边栏</span></button>
          <div className={cn('mt-2 flex items-center justify-between px-2 text-[9px] text-[var(--text-muted)]', collapsed && 'lg:justify-center')}><span className={cn(collapsed && 'lg:hidden')}>{APP_NAME}</span><span>{APP_VERSION_LABEL}</span></div>
        </div>
      </aside>
    </>
  )
}

function NavigationItem({ to, icon: Icon, label, collapsed, onNavigate, badge }: { to: string; icon: typeof Menu; label: string; collapsed: boolean; onNavigate?: () => void; badge?: number }) {
  return <NavLink to={to} onClick={onNavigate} aria-label={label} title={label} className={({ isActive }) => cn('nav-button relative', collapsed && 'lg:justify-center lg:px-0', isActive && 'nav-button-active')}><Icon size={17} /><span className={cn('truncate', collapsed && 'lg:hidden')}>{label}</span>{badge ? <span className={cn('ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white', collapsed && 'lg:absolute lg:right-0 lg:top-0 lg:h-2 lg:w-2 lg:p-0 lg:text-transparent')}>{badge}</span> : null}</NavLink>
}

function StatusRow({ label, online, collapsed, title }: { label: string; online: boolean; collapsed: boolean; title: string }) {
  return <div className={cn('flex items-center justify-between gap-2 text-[10px]', collapsed && 'lg:justify-center')} title={title}><span className={cn('text-[var(--text-muted)]', collapsed && 'lg:hidden')}>{label}</span><span className={cn('flex items-center gap-1.5', online ? 'text-emerald-300' : 'text-slate-500')}><Activity size={11} /><span className={cn(collapsed && 'lg:hidden')}>{online ? '在线' : '离线'}</span></span></div>
}
