import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function MainLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto bg-gradient-base">
        <Outlet />
      </main>
    </div>
  )
}
