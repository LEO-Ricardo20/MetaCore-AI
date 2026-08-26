import { beforeEach, describe, expect, it } from 'vitest'
import type { Project } from '@/types/project'
import { normalizeProject } from '@/services/projects/projectLifecycle'
import { selectCurrentProject, useProjectStore } from './projectStore'

const importedProject: Project = normalizeProject({
  id: 'imported-project',
  name: 'Imported ESP32',
  requirement: 'MQTT sensor',
  target: 'ESP32',
  format: 'platformio',
  codeFiles: [{ path: 'src/main.cpp', content: 'void setup() {}', language: 'cpp' }],
  flowNodes: [],
  flowEdges: [],
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_100,
})

beforeEach(() => {
  useProjectStore.setState({
    projects: [],
    currentProjectId: null,
    isGeneratingScheme: false,
    isGeneratingCode: false,
    isGeneratingFlow: false,
    selectedFile: null,
  })
})

describe('project store', () => {
  it('updates the current project instead of creating a duplicate during regeneration', () => {
    const first = useProjectStore.getState().ensureProject({
      requirement: 'Weather station',
      target: 'ESP32',
      format: 'platformio',
    })
    const second = useProjectStore.getState().ensureProject({
      requirement: 'Weather station',
      target: 'ESP32',
      format: 'platformio',
    })

    expect(second.id).toBe(first.id)
    expect(useProjectStore.getState().projects).toHaveLength(1)
  })

  it('creates an independent record only when a new version is requested', () => {
    const first = useProjectStore.getState().ensureProject({
      requirement: 'Weather station',
      target: 'ESP32',
      format: 'platformio',
    })
    const version = useProjectStore.getState().createProjectVersion('Design review')

    expect(version?.id).not.toBe(first.id)
    expect(version?.versions.at(-1)?.label).toBe('Design review')
    expect(useProjectStore.getState().projects).toHaveLength(2)
  })

  it('updates the canonical project list when generated data changes', () => {
    const created = useProjectStore.getState().createProject('Weather station', 'ESP32', 'platformio')
    useProjectStore.getState().setCodeFiles([{ path: 'src/main.cpp', content: 'main', language: 'cpp' }])

    const state = useProjectStore.getState()
    expect(state.projects).toHaveLength(1)
    expect(state.projects[0].id).toBe(created.id)
    expect(selectCurrentProject(state)?.codeFiles[0].path).toBe('src/main.cpp')
    expect(state.selectedFile).toBe('src/main.cpp')
  })

  it('assigns a new id when the same project is imported twice', () => {
    const first = useProjectStore.getState().importProject(importedProject)
    const second = useProjectStore.getState().importProject(importedProject)

    expect(first.id).toBe('imported-project')
    expect(second.id).not.toBe(first.id)
    expect(useProjectStore.getState().projects).toHaveLength(2)
  })

  it('clears the active selection when the current project is deleted', () => {
    const project = useProjectStore.getState().importProject(importedProject)
    useProjectStore.getState().deleteProject(project.id)

    const state = useProjectStore.getState()
    expect(state.currentProjectId).toBeNull()
    expect(state.selectedFile).toBeNull()
    expect(state.projects).toHaveLength(0)
  })

  it('marks code and flow stale when the scheme is regenerated', () => {
    useProjectStore.getState().createProject('Weather station', 'ESP32', 'platformio')
    useProjectStore.getState().setScheme({ description: 'v1', pins: [], bom: [], wiring: [] })
    useProjectStore.getState().setCodeFiles([{ path: 'src/main.cpp', content: 'main', language: 'cpp' }])
    useProjectStore.getState().setFlowData([{ id: 'main', label: 'main', position: { x: 0, y: 0 } }], [])
    useProjectStore.getState().setScheme({ description: 'v2', pins: [], bom: [], wiring: [] })

    const project = useProjectStore.getState().getCurrentProject()!
    expect(project.artifacts.code.status).toBe('stale')
    expect(project.artifacts.flow.status).toBe('stale')
  })

  it('persists cancelled pipeline state and can retry from a failed stage', () => {
    useProjectStore.getState().createProject('Weather station', 'ESP32', 'platformio')
    const run = useProjectStore.getState().startPipeline('scheme-generation')!
    useProjectStore.getState().updatePipelineStage(run.id, 'scheme-generation', {
      status: 'failed',
      errorCode: 'AI_TIMEOUT',
      errorMessage: 'timeout',
    })
    useProjectStore.getState().finishPipeline(run.id, 'cancelled')

    let project = useProjectStore.getState().getCurrentProject()!
    expect(project.runs[0].status).toBe('cancelled')
    expect(project.currentStage).toBe('cancelled')

    useProjectStore.getState().retryPipeline(run.id, 'scheme-generation')
    project = useProjectStore.getState().getCurrentProject()!
    expect(project.runs[0].status).toBe('running')
    expect(project.runs[0].stages.find((stage) => stage.id === 'scheme-generation')?.retryCount).toBe(1)
  })

  it('persists verification results on the canonical project', () => {
    useProjectStore.getState().createProject('Weather station', 'ESP32', 'platformio')
    useProjectStore.getState().saveVerification({
      consistency: { status: 'passed', findings: [], updatedAt: 1_700_000_000_300 },
      build: { status: 'idle', profiles: [], error: '没有本地构建配置', updatedAt: 1_700_000_000_301 },
    })

    const project = useProjectStore.getState().getCurrentProject()!
    expect(project.verification?.consistency?.status).toBe('passed')
    expect(project.verification?.build?.error).toBe('没有本地构建配置')
  })
})
