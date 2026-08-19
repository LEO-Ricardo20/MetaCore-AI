import { describe, expect, it } from 'vitest'
import { createProjectArtifacts, markArtifactsStale, normalizeProject } from './projectLifecycle'

describe('project lifecycle', () => {
  it('migrates a legacy project without dropping generated output', () => {
    const project = normalizeProject({
      id: 'legacy',
      name: 'Legacy',
      requirement: 'sensor',
      target: 'ESP32',
      format: 'platformio',
      scheme: { description: 'scheme', pins: [], bom: [], wiring: [] },
      codeFiles: [{ path: 'src/main.cpp', content: 'void loop() {}', language: 'cpp' }],
      flowNodes: [],
      flowEdges: [],
      createdAt: 1,
      updatedAt: 2,
    })

    expect(project.schemaVersion).toBe(2)
    expect(project.scheme?.description).toBe('scheme')
    expect(project.codeFiles).toHaveLength(1)
    expect(project.artifacts.code.status).toBe('fresh')
  })

  it('marks all downstream artifacts stale after a requirement change', () => {
    const artifacts = createProjectArtifacts({
      requirement: 'sensor',
      scheme: { description: 'scheme', pins: [], bom: [], wiring: [] },
      codeFiles: [{ path: 'main.cpp', content: 'main', language: 'cpp' }],
      flowNodes: [{ id: 'start', label: 'start', position: { x: 0, y: 0 } }],
      updatedAt: 1,
    })
    const stale = markArtifactsStale(artifacts, 'requirements', 2)

    expect(stale.scheme.status).toBe('stale')
    expect(stale.code.status).toBe('stale')
    expect(stale.flow.status).toBe('stale')
  })

  it('marks code and flow stale after a scheme change', () => {
    const artifacts = createProjectArtifacts({
      requirement: 'sensor',
      scheme: { description: 'scheme', pins: [], bom: [], wiring: [] },
      codeFiles: [{ path: 'main.cpp', content: 'main', language: 'cpp' }],
      flowNodes: [{ id: 'start', label: 'start', position: { x: 0, y: 0 } }],
      updatedAt: 1,
    })
    const stale = markArtifactsStale(artifacts, 'scheme', 2)

    expect(stale.code.status).toBe('stale')
    expect(stale.flow.status).toBe('stale')
  })
})
