import { Suspense, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Loader2, Menu } from 'lucide-react'

export default function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <div className="app-shell flex h-screen w-screen overflow-hidden bg-[var(--surface-base)]">
      <button type="button" className="fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-glass)] text-[var(--text-primary)] shadow-[var(--shadow-floating)] backdrop-blur-[18px] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="打开导航" title="打开导航"><Menu size={18} /></button>
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <main className="min-w-0 flex-1 overflow-auto bg-gradient-base">
        <Suspense fallback={(
          <div className="flex h-full items-center justify-center" role="status" aria-label="页面加载中">
            <Loader2 className="animate-spin text-indigo-400" size={24} />
          </div>
        )}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
