import { lazy } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'

const WorkspacePage = lazy(() => import('@/components/pages/WorkspacePage'))
const DesignWorkspacePage = lazy(() => import('@/components/pages/DesignWorkspacePage'))
const ImplementationWorkspacePage = lazy(() => import('@/components/pages/ImplementationWorkspacePage'))
const VerificationWorkspacePage = lazy(() => import('@/components/pages/VerificationWorkspacePage'))
const SettingsPage = lazy(() => import('@/components/pages/SettingsPage'))
const ProjectManager = lazy(() => import('@/components/project/ProjectManager'))
const HelpPage = lazy(() => import('@/components/pages/HelpPage'))
const AboutPage = lazy(() => import('@/components/pages/AboutPage'))

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/workspace" replace />} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="design/*" element={<DesignWorkspacePage />} />
          <Route path="implementation/*" element={<ImplementationWorkspacePage />} />
          <Route path="verification/*" element={<VerificationWorkspacePage />} />
          <Route path="projects" element={<ProjectManager />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="requirement" element={<Navigate to="/design/requirements" replace />} />
          <Route path="codegen" element={<Navigate to="/implementation/code" replace />} />
          <Route path="flow" element={<Navigate to="/verification/flow" replace />} />
          <Route path="local" element={<Navigate to="/verification/local" replace />} />
          <Route path="chips" element={<Navigate to="/design/chips" replace />} />
          <Route path="drivers" element={<Navigate to="/design/peripherals" replace />} />
          <Route path="*" element={<Navigate to="/workspace" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
