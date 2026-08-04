import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Loader2 } from 'lucide-react'

export default function MainLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
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
