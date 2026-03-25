import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project, CodeFile, FlowNode, FlowEdge, HardwareScheme } from '@/types/project'
import type { ChipTarget, ProjectFormat } from '@/types/hardware'
import { useProjectsStore } from './projectsStore'

interface ProjectState {
  project: Project | null
  isGeneratingScheme: boolean
  isGeneratingCode: boolean
  isGeneratingFlow: boolean
  selectedFile: string | null
  // 同步到 projectsStore
  createProject: (requirement: string, target: ChipTarget, format: ProjectFormat, selectedDriverIds?: string[]) => void
  setScheme: (scheme: HardwareScheme) => void
  setCodeFiles: (files: CodeFile[]) => void
  setFlowData: (nodes: FlowNode[], edges: FlowEdge[]) => void
  setSelectedFile: (path: string) => void
  setGenerating: (key: 'scheme' | 'code' | 'flow', val: boolean) => void
  setSelectedDriverIds: (ids: string[]) => void
  saveProject: (updates: Partial<Project>) => void
  loadProject: (id: string) => void
  reset: () => void
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      project: null,
      isGeneratingScheme: false,
      isGeneratingCode: false,
      isGeneratingFlow: false,
      selectedFile: null,

      createProject: (requirement, target, format, selectedDriverIds) => {
        const project: Project = {
          id: Date.now().toString(),
          name: requirement.slice(0, 30) || '未命名项目',
          requirement,
          target,
          format,
          selectedDriverIds: selectedDriverIds ?? [],
          codeFiles: [],
          flowNodes: [],
          flowEdges: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        useProjectsStore.getState().addProject(project)
        set({ project, selectedFile: null })
      },

      setScheme: (scheme) =>
        set((s) => {
          if (!s.project) return s
          const updated = { ...s.project, scheme, updatedAt: Date.now() }
          useProjectsStore.getState().updateProject(updated.id, { scheme })
          return { project: updated }
        }),

      setCodeFiles: (codeFiles) =>
        set((s) => {
          if (!s.project) return s
          const updated = { ...s.project, codeFiles, updatedAt: Date.now() }
          useProjectsStore.getState().updateProject(updated.id, { codeFiles })
          return { project: updated, selectedFile: codeFiles[0]?.path ?? null }
        }),

      setFlowData: (flowNodes, flowEdges) =>
        set((s) => {
          if (!s.project) return s
          const updated = { ...s.project, flowNodes, flowEdges, updatedAt: Date.now() }
          useProjectsStore.getState().updateProject(updated.id, { flowNodes, flowEdges })
          return { project: updated }
        }),

      setSelectedFile: (selectedFile) => set({ selectedFile }),

      setSelectedDriverIds: (ids) =>
        set((s) => {
          if (!s.project) return s
          const updated = { ...s.project, selectedDriverIds: ids, updatedAt: Date.now() }
          useProjectsStore.getState().updateProject(updated.id, { selectedDriverIds: ids })
          return { project: updated }
        }),

      setGenerating: (key, val) =>
        set({
          [`isGenerating${key.charAt(0).toUpperCase() + key.slice(1)}`]: val
        } as Partial<ProjectState>),

      saveProject: (updates) =>
        set((s) => {
          if (!s.project) return s
          const updated = { ...s.project, ...updates, updatedAt: Date.now() }
          useProjectsStore.getState().updateProject(updated.id, updates)
          return { project: updated }
        }),

      loadProject: (id) => {
        const projects = useProjectsStore.getState().projects
        const proj = projects.find((p) => p.id === id)
        if (proj) {
          useProjectsStore.getState().setCurrentProject(id)
          set({ project: proj, selectedFile: proj.codeFiles[0]?.path ?? null })
        }
      },

      reset: () => set({ project: null, selectedFile: null })
    }),
    { name: 'metacore-project-state' }
  )
)
