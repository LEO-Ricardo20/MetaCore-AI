import { Suspense, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Bot, Loader2, Menu } from 'lucide-react'
import AgentTaskDrawer from '@/components/agent/AgentTaskDrawer'

export default function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)
  const [agentGoal, setAgentGoal] = useState('')

  useEffect(() => {
    const handleAgentTask = (event: Event) => {
      const goal = (event as CustomEvent<{ goal?: string }>).detail?.goal?.trim()
      if (!goal) return
      setAgentGoal(goal)
      setAgentOpen(true)
    }
    window.addEventListener('metacore:agent-task', handleAgentTask)
    return () => window.removeEventListener('metacore:agent-task', handleAgentTask)
  }, [])
  return (
    <div className="app-shell flex h-screen w-screen overflow-hidden">
      <button type="button" className="fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-glass)] text-[var(--text-primary)] shadow-[var(--shadow-floating)] backdrop-blur-[18px] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="打开导航" title="打开导航"><Menu size={18} /></button>
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <main className="workspace-canvas min-w-0 flex-1 overflow-auto bg-gradient-base">
        <Suspense fallback={(
          <div className="flex h-full items-center justify-center" role="status" aria-label="页面加载中">
            <Loader2 className="animate-spin text-indigo-400" size={24} />
          </div>
        )}>
          <Outlet />
        </Suspense>
      </main>
      <button type="button" onClick={() => setAgentOpen(true)} className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full border border-cyan-400 bg-cyan-600 px-4 py-3 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(8,145,178,0.32)] ring-4 ring-cyan-500/10 transition hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/50" aria-label="打开 Agent 任务" title="打开 Agent 任务"><Bot size={17} /><span>打开 Agent</span></button>
      <AgentTaskDrawer open={agentOpen} initialGoal={agentGoal} onClose={() => setAgentOpen(false)} />
    </div>
  )
}
