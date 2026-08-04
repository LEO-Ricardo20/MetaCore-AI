import { lazy } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'

const RequirementPage = lazy(() => import('@/components/pages/RequirementPage'))
const CodegenPage = lazy(() => import('@/components/pages/CodegenPage'))
const FlowPage = lazy(() => import('@/components/pages/FlowPage'))
const SettingsPage = lazy(() => import('@/components/pages/SettingsPage'))
const ProjectManager = lazy(() => import('@/components/project/ProjectManager'))
const HelpPage = lazy(() => import('@/components/pages/HelpPage'))
const AboutPage = lazy(() => import('@/components/pages/AboutPage'))
const ChipManager = lazy(() => import('@/components/chips/ChipManager'))
const DriversPage = lazy(() => import('@/components/drivers/DriversPage'))
const LocalWorkspacePage = lazy(() => import('@/components/local/LocalWorkspacePage'))

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/requirement" replace />} />
          <Route path="projects" element={<ProjectManager />} />
          <Route path="requirement" element={<RequirementPage />} />
          <Route path="codegen" element={<CodegenPage />} />
          <Route path="flow" element={<FlowPage />} />
          <Route path="local" element={<LocalWorkspacePage />} />
          <Route path="chips" element={<ChipManager />} />
          <Route path="drivers" element={<DriversPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
