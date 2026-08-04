import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project, CodeFile, FlowNode, FlowEdge, HardwareScheme } from '@/types/project'
import type { ChipTarget, ProjectFormat } from '@/types/hardware'

type GenerationKey = 'scheme' | 'code' | 'flow'

export interface ProjectState {
  projects: Project[]
  currentProjectId: string | null
  isGeneratingScheme: boolean
  isGeneratingCode: boolean
  isGeneratingFlow: boolean
  selectedFile: string | null
  createProject: (requirement: string, target: ChipTarget, format: ProjectFormat, selectedDriverIds?: string[]) => Project
  importProject: (project: Project) => Project
  deleteProject: (id: string) => void
  loadProject: (id: string) => void
  getCurrentProject: () => Project | null
  setScheme: (scheme: HardwareScheme) => void
  setCodeFiles: (files: CodeFile[]) => void
  setFlowData: (nodes: FlowNode[], edges: FlowEdge[]) => void
  setSelectedFile: (path: string) => void
  setGenerating: (key: GenerationKey, value: boolean) => void
  setSelectedDriverIds: (ids: string[]) => void
  saveProject: (updates: Partial<Project>) => void
  reset: () => void
}

function createProjectId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function uniqueProjectId(projects: Project[], preferredId: string) {
  if (!projects.some((project) => project.id === preferredId)) return preferredId
  let id = createProjectId()
  while (projects.some((project) => project.id === id)) id = createProjectId()
  return id
}

function updateCurrentProject(state: ProjectState, updates: Partial<Project>) {
  if (!state.currentProjectId) return null
  const updatedAt = Date.now()
  let current: Project | null = null
  const projects = state.projects.map((project) => {
    if (project.id !== state.currentProjectId) return project
    current = { ...project, ...updates, updatedAt }
    return current
  })
  return current ? { projects, current } : null
}

export const selectCurrentProject = (state: Pick<ProjectState, 'projects' | 'currentProjectId'>) =>
  state.projects.find((project) => project.id === state.currentProjectId) ?? null

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,
      isGeneratingScheme: false,
      isGeneratingCode: false,
      isGeneratingFlow: false,
      selectedFile: null,

      createProject: (requirement, target, format, selectedDriverIds) => {
        const now = Date.now()
        const project: Project = {
          id: createProjectId(),
          name: requirement.slice(0, 30) || '未命名项目',
          requirement,
          target,
          format,
          selectedDriverIds: selectedDriverIds ?? [],
          codeFiles: [],
          flowNodes: [],
          flowEdges: [],
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({
          projects: [...state.projects, project],
          currentProjectId: project.id,
          selectedFile: null,
        }))
        return project
      },

      importProject: (project) => {
        let imported = project
        set((state) => {
          const id = uniqueProjectId(state.projects, project.id)
          imported = { ...project, id, updatedAt: Date.now() }
          return {
            projects: [...state.projects, imported],
            currentProjectId: id,
            selectedFile: imported.codeFiles[0]?.path ?? null,
          }
        })
        return imported
      },

      deleteProject: (id) => set((state) => {
        const deletingCurrent = state.currentProjectId === id
        return {
          projects: state.projects.filter((project) => project.id !== id),
          currentProjectId: deletingCurrent ? null : state.currentProjectId,
          selectedFile: deletingCurrent ? null : state.selectedFile,
        }
      }),

      loadProject: (id) => set((state) => {
        const project = state.projects.find((item) => item.id === id)
        if (!project) return state
        return {
          currentProjectId: id,
          selectedFile: project.codeFiles[0]?.path ?? null,
        }
      }),

      getCurrentProject: () => selectCurrentProject(get()),

      setScheme: (scheme) => set((state) => {
        const result = updateCurrentProject(state, { scheme })
        return result ? { projects: result.projects } : state
      }),

      setCodeFiles: (codeFiles) => set((state) => {
        const result = updateCurrentProject(state, { codeFiles })
        return result
          ? { projects: result.projects, selectedFile: codeFiles[0]?.path ?? null }
          : state
      }),

      setFlowData: (flowNodes, flowEdges) => set((state) => {
        const result = updateCurrentProject(state, { flowNodes, flowEdges })
        return result ? { projects: result.projects } : state
      }),

      setSelectedFile: (selectedFile) => set({ selectedFile }),

      setSelectedDriverIds: (selectedDriverIds) => set((state) => {
        const result = updateCurrentProject(state, { selectedDriverIds })
        return result ? { projects: result.projects } : state
      }),

      setGenerating: (key, value) => set({
        [`isGenerating${key.charAt(0).toUpperCase() + key.slice(1)}`]: value,
      } as Partial<ProjectState>),

      saveProject: (updates) => set((state) => {
        const result = updateCurrentProject(state, updates)
        return result ? { projects: result.projects } : state
      }),

      reset: () => set({ currentProjectId: null, selectedFile: null }),
    }),
    {
      name: 'metacore-projects',
      partialize: (state) => ({
        projects: state.projects,
        currentProjectId: state.currentProjectId,
      }),
    },
  ),
)
