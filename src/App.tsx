/** 应用路由配置 */

import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import RequirementPage from '@/components/pages/RequirementPage'
import CodegenPage from '@/components/pages/CodegenPage'
import FlowPage from '@/components/pages/FlowPage'
import SettingsPage from '@/components/pages/SettingsPage'
import ProjectManager from '@/components/project/ProjectManager'
import HelpPage from '@/components/pages/HelpPage'
import AboutPage from '@/components/pages/AboutPage'
import ChipManager from '@/components/chips/ChipManager'
import DriversPage from '@/components/drivers/DriversPage'

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
