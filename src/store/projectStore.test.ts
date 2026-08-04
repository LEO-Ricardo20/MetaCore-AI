import { beforeEach, describe, expect, it } from 'vitest'
import type { Project } from '@/types/project'
import { selectCurrentProject, useProjectStore } from './projectStore'

const importedProject: Project = {
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
}

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
})
