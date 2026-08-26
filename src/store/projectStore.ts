import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ArtifactKey,
  ArtifactStatus,
  CodeFile,
  FlowEdge,
  FlowNode,
  HardwareScheme,
  PipelineStage,
  PipelineStageState,
  Project,
  ProjectRun,
  StageRunStatus,
  HardwareModelSelection,
} from '@/types/project'
import { PROJECT_SCHEMA_VERSION } from '@/types/project'
import type { ChipTarget, ProjectFormat } from '@/types/hardware'
import type { Esp32ProjectConfig } from '@/types/esp32'
import { normalizeEsp32ProjectConfig } from '@/services/esp32/esp32Config'
import {
  createProjectArtifacts,
  createProjectRun,
  markArtifactsStale,
  normalizeProject,
  updateArtifact,
  validationFromArtifacts,
} from '@/services/projects/projectLifecycle'

type GenerationKey = 'scheme' | 'code' | 'flow'
type ProjectCreateMode = 'update-current' | 'new-project' | 'new-version'

interface ProjectInput {
  requirement: string
  target: ChipTarget
  format: ProjectFormat
  selectedDriverIds?: string[]
  esp32?: Esp32ProjectConfig
  modelSelection?: HardwareModelSelection
}

export interface ProjectState {
  projects: Project[]
  currentProjectId: string | null
  isGeneratingScheme: boolean
  isGeneratingCode: boolean
  isGeneratingFlow: boolean
  selectedFile: string | null
  createProject: (requirement: string, target: ChipTarget, format: ProjectFormat, selectedDriverIds?: string[], esp32?: Esp32ProjectConfig) => Project
  ensureProject: (input: ProjectInput, mode?: ProjectCreateMode) => Project
  createProjectVersion: (label?: string) => Project | null
  importProject: (project: Project) => Project
  deleteProject: (id: string) => void
  loadProject: (id: string) => void
  getCurrentProject: () => Project | null
  setScheme: (scheme: HardwareScheme) => void
  setPendingClarification: (clarification: Project['pendingClarification']) => void
  clearPendingClarification: () => void
  setCodeFiles: (files: CodeFile[]) => void
  setFlowData: (nodes: FlowNode[], edges: FlowEdge[]) => void
  setSelectedFile: (path: string) => void
  setGenerating: (key: GenerationKey, value: boolean) => void
  setSelectedDriverIds: (ids: string[]) => void
  setArtifactStatus: (key: ArtifactKey, status: ArtifactStatus, staleReason?: string) => void
  startPipeline: (fromStage?: PipelineStage, sessionId?: string) => ProjectRun | null
  pausePipelineForClarification: (runId: string, message: string) => void
  updatePipelineStage: (runId: string, stage: PipelineStage, updates: Partial<PipelineStageState>) => void
  finishPipeline: (runId: string, status: Extract<StageRunStatus, 'succeeded' | 'failed' | 'cancelled'>) => void
  retryPipeline: (runId: string, fromStage: PipelineStage) => void
  saveProject: (updates: Partial<Project>) => void
  saveVerification: (verification: Project['verification']) => void
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

function createProjectRecord(input: ProjectInput, source?: Project): Project {
  const now = Date.now()
  const base: Project = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: createProjectId(),
    name: input.requirement.slice(0, 30) || '未命名项目',
    requirement: input.requirement,
    target: input.target,
    format: input.format,
    esp32: input.esp32,
    selectedDriverIds: input.selectedDriverIds ?? [],
    modelSelection: input.modelSelection,
    codeFiles: source?.codeFiles ?? [],
    flowNodes: source?.flowNodes ?? [],
    flowEdges: source?.flowEdges ?? [],
    scheme: source?.scheme,
    currentStage: source ? source.currentStage : input.requirement ? 'requirements-ready' : 'draft',
    artifacts: createProjectArtifacts(source ?? { requirement: input.requirement, updatedAt: now }),
    runs: [],
    versions: source?.versions ?? [],
    validation: source?.validation ?? { status: 'unchecked', issueCount: 0, blockingCount: 0 },
    verification: source?.verification,
    createdAt: now,
    updatedAt: now,
  }
  return normalizeProject(base)
}

function updateCurrentProject(state: ProjectState, updater: Partial<Project> | ((project: Project) => Project)) {
  if (!state.currentProjectId) return null
  const updatedAt = Date.now()
  let current: Project | null = null
  const projects = state.projects.map((project) => {
    if (project.id !== state.currentProjectId) return project
    current = normalizeProject(typeof updater === 'function'
      ? { ...updater(project), updatedAt }
      : { ...project, ...updater, updatedAt })
    return current
  })
  return current ? { projects, current } : null
}

function withRun(project: Project, runId: string, updater: (run: ProjectRun) => ProjectRun) {
  return { ...project, runs: project.runs.map((run) => run.id === runId ? updater(run) : run) }
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

      createProject: (requirement, target, format, selectedDriverIds, esp32) => (
        get().ensureProject({ requirement, target, format, selectedDriverIds, esp32 }, 'new-project')
      ),

      ensureProject: (input, mode = 'update-current') => {
        const state = get()
        const current = selectCurrentProject(state)
        if (!current || mode === 'new-project' || mode === 'new-version') {
          const created = createProjectRecord(input, mode === 'new-version' ? current ?? undefined : undefined)
          if (current && mode === 'new-version') {
            created.versions = [...current.versions, {
              id: created.id,
              label: `版本 ${current.versions.length + 1}`,
              createdAt: created.createdAt,
              sourceProjectId: current.id,
              schemeVersion: current.artifacts.scheme.version,
              codeVersion: current.artifacts.code.version,
            }]
          }
          set((currentState) => ({
            projects: [...currentState.projects, created],
            currentProjectId: created.id,
            selectedFile: created.codeFiles[0]?.path ?? null,
          }))
          return created
        }

        let updated = current
        set((currentState) => {
          const result = updateCurrentProject(currentState, (project) => {
            const requirementChanged = project.requirement !== input.requirement
            const targetChanged = project.target !== input.target
            const formatChanged = project.format !== input.format
            const nextEsp32 = normalizeEsp32ProjectConfig(input.esp32, input.target)
            const esp32Changed = JSON.stringify(project.esp32) !== JSON.stringify(nextEsp32)
            const driversChanged = JSON.stringify(project.selectedDriverIds ?? []) !== JSON.stringify(input.selectedDriverIds ?? [])
            const modelSelectionChanged = JSON.stringify(project.modelSelection ?? null) !== JSON.stringify(input.modelSelection ?? null)
            let artifacts = project.artifacts
            if (requirementChanged || driversChanged || modelSelectionChanged) artifacts = markArtifactsStale(artifacts, 'requirements')
            if (targetChanged || esp32Changed) artifacts = markArtifactsStale(artifacts, 'target')
            if (formatChanged) artifacts = markArtifactsStale(artifacts, 'format')
            if (requirementChanged) artifacts = updateArtifact(artifacts, 'requirements', 'fresh')
            updated = {
              ...project,
              requirement: input.requirement,
              target: input.target,
              format: input.format,
              esp32: nextEsp32,
              selectedDriverIds: input.selectedDriverIds ?? [],
              modelSelection: input.modelSelection,
              currentStage: 'requirements-ready',
              artifacts,
              validation: validationFromArtifacts(artifacts),
            }
            return updated
          })
          return result ? { projects: result.projects } : currentState
        })
        return updated
      },

      createProjectVersion: (label) => {
        const current = get().getCurrentProject()
        if (!current) return null
        const created = get().ensureProject({
          requirement: current.requirement,
          target: current.target,
          format: current.format,
          selectedDriverIds: current.selectedDriverIds,
          esp32: current.esp32,
          modelSelection: current.modelSelection,
        }, 'new-version')
        if (label) {
          get().saveProject({
            versions: created.versions.map((version, index) => index === created.versions.length - 1 ? { ...version, label } : version),
          })
        }
        return get().getCurrentProject()
      },

      importProject: (project) => {
        let imported = normalizeProject(project)
        set((state) => {
          const id = uniqueProjectId(state.projects, imported.id)
          imported = { ...imported, id, updatedAt: Date.now() }
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
        return { currentProjectId: id, selectedFile: project.codeFiles[0]?.path ?? null }
      }),

      getCurrentProject: () => selectCurrentProject(get()),

      setScheme: (scheme) => set((state) => {
        const result = updateCurrentProject(state, (project) => {
          let artifacts = markArtifactsStale(project.artifacts, 'scheme')
          artifacts = updateArtifact(artifacts, 'scheme', 'fresh')
          artifacts = updateArtifact(artifacts, 'pinMap', scheme.pins.length ? 'fresh' : 'missing')
          artifacts = updateArtifact(artifacts, 'bom', scheme.bom.length ? 'fresh' : 'missing')
          artifacts = updateArtifact(artifacts, 'wiring', scheme.wiring.length ? 'fresh' : 'missing')
          return { ...project, scheme, currentStage: 'design-review', artifacts, validation: validationFromArtifacts(artifacts) }
        })
        return result ? { projects: result.projects } : state
      }),

      setPendingClarification: (pendingClarification) => set((state) => {
        const result = updateCurrentProject(state, (project) => ({ ...project, pendingClarification }))
        return result ? { projects: result.projects } : state
      }),

      clearPendingClarification: () => set((state) => {
        const result = updateCurrentProject(state, (project) => {
          const next = { ...project }
          delete next.pendingClarification
          return next
        })
        return result ? { projects: result.projects } : state
      }),

      setCodeFiles: (codeFiles) => set((state) => {
        const result = updateCurrentProject(state, (project) => {
          let artifacts = markArtifactsStale(project.artifacts, 'code')
          artifacts = updateArtifact(artifacts, 'code', codeFiles.length ? 'fresh' : 'missing')
          return { ...project, codeFiles, currentStage: 'implementation', artifacts, validation: validationFromArtifacts(artifacts) }
        })
        return result ? { projects: result.projects, selectedFile: codeFiles[0]?.path ?? null } : state
      }),

      setFlowData: (flowNodes, flowEdges) => set((state) => {
        const result = updateCurrentProject(state, (project) => ({
          ...project,
          flowNodes,
          flowEdges,
          currentStage: 'verification',
          artifacts: updateArtifact(project.artifacts, 'flow', flowNodes.length ? 'fresh' : 'missing'),
        }))
        return result ? { projects: result.projects } : state
      }),

      setSelectedFile: (selectedFile) => set({ selectedFile }),

      setSelectedDriverIds: (selectedDriverIds) => set((state) => {
        const result = updateCurrentProject(state, (project) => {
          const artifacts = markArtifactsStale(project.artifacts, 'requirements')
          return { ...project, selectedDriverIds, artifacts, validation: validationFromArtifacts(artifacts) }
        })
        return result ? { projects: result.projects } : state
      }),

      setGenerating: (key, value) => set((state) => {
        const property = `isGenerating${key.charAt(0).toUpperCase() + key.slice(1)}`
        const result = updateCurrentProject(state, (project) => {
          if (value) return { ...project, artifacts: updateArtifact(project.artifacts, key, 'generating') }
          const current = project.artifacts[key]
          if (current.status !== 'generating') return project
          const hasArtifact = key === 'scheme' ? Boolean(project.scheme)
            : key === 'code' ? project.codeFiles.length > 0
              : key === 'flow' ? project.flowNodes.length > 0
                : false
          return { ...project, artifacts: updateArtifact(project.artifacts, key, hasArtifact ? 'stale' : 'missing', Date.now()) }
        })
        return { [property]: value, ...(result ? { projects: result.projects } : {}) } as Partial<ProjectState>
      }),

      setArtifactStatus: (key, status, staleReason) => set((state) => {
        const result = updateCurrentProject(state, (project) => {
          const artifacts = updateArtifact(project.artifacts, key, status)
          return { ...project, artifacts: { ...artifacts, [key]: { ...artifacts[key], staleReason } } }
        })
        return result ? { projects: result.projects } : state
      }),

      startPipeline: (fromStage = 'requirements', sessionId) => {
        const current = get().getCurrentProject()
        if (!current) return null
        const run = createProjectRun(createProjectId(), fromStage)
        run.sessionId = sessionId
        run.status = 'running'
        run.startedAt = Date.now()
        set((state) => {
          const result = updateCurrentProject(state, (project) => ({
            ...project,
            currentStage: 'planning',
            lastSessionId: sessionId ?? project.lastSessionId,
            runs: [...project.runs, run],
          }))
          return result ? { projects: result.projects } : state
        })
        return run
      },

      pausePipelineForClarification: (runId, message) => set((state) => {
        const result = updateCurrentProject(state, (project) => ({
          ...withRun(project, runId, (run) => ({
            ...run,
            status: 'waiting',
            currentStage: 'clarification',
            stages: run.stages.map((stage) => stage.id === 'clarification'
              ? { ...stage, status: 'waiting', progress: 0, currentAction: message, startedAt: undefined, finishedAt: undefined, errorCode: undefined, errorMessage: undefined }
              : stage),
          })),
          currentStage: 'planning',
        }))
        return result ? { projects: result.projects } : state
      }),

      updatePipelineStage: (runId, stage, updates) => set((state) => {
        const result = updateCurrentProject(state, (project) => withRun(project, runId, (run) => ({
          ...run,
          currentStage: stage,
          stages: run.stages.map((item) => item.id === stage ? { ...item, ...updates } : item),
        })))
        return result ? { projects: result.projects } : state
      }),

      finishPipeline: (runId, status) => set((state) => {
        const result = updateCurrentProject(state, (project) => ({
          ...withRun(project, runId, (run) => ({ ...run, status, finishedAt: Date.now() })),
          // 各产物 setter 已经推进到准确阶段；完成流水线时不要无条件跳到验证页。
          currentStage: status === 'cancelled' ? 'cancelled' : status === 'failed' ? 'failed' : project.currentStage,
        }))
        return result ? { projects: result.projects } : state
      }),

      retryPipeline: (runId, fromStage) => set((state) => {
        const result = updateCurrentProject(state, (project) => withRun(project, runId, (run) => {
          const start = run.stages.findIndex((stage) => stage.id === fromStage)
          return {
            ...run,
            status: 'running',
            currentStage: fromStage,
            finishedAt: undefined,
            stages: run.stages.map((stage, index) => index < start ? stage : {
              ...stage,
              status: 'waiting',
              progress: 0,
              currentAction: '',
              startedAt: undefined,
              finishedAt: undefined,
              errorCode: undefined,
              errorMessage: undefined,
              retryCount: stage.retryCount + (index === start ? 1 : 0),
            }),
          }
        }))
        return result ? { projects: result.projects } : state
      }),

      saveProject: (updates) => set((state) => {
        const result = updateCurrentProject(state, updates)
        return result ? { projects: result.projects } : state
      }),

      saveVerification: (verification) => set((state) => {
        const result = updateCurrentProject(state, (project) => ({ ...project, verification }))
        return result ? { projects: result.projects } : state
      }),

      reset: () => set({ currentProjectId: null, selectedFile: null }),
    }),
    {
      name: 'metacore-projects',
      version: 3,
      migrate: (persisted) => {
        const state = persisted as Partial<ProjectState> | undefined
        return {
          ...state,
          projects: Array.isArray(state?.projects) ? state.projects.map((project) => normalizeProject(project)) : [],
        } as ProjectState
      },
      partialize: (state) => ({ projects: state.projects, currentProjectId: state.currentProjectId }),
    },
  ),
)
