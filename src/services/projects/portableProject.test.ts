import { describe, expect, it } from 'vitest'
import type { Project } from '@/types/project'
import { createPortableProject, parsePortableProject, serializePortableProject } from './portableProject'
import { normalizeProject } from './projectLifecycle'

const project: Project = normalizeProject({
  id: 'project-1',
  name: 'ESP32 环境监测',
  requirement: '读取温湿度并通过 MQTT 上报',
  target: 'ESP32',
  format: 'platformio',
  scheme: {
    description: 'ESP32 + DHT22',
    pins: [{ pinNumber: 'GPIO4', pinName: 'DATA', function: '传感器数据', connectedTo: 'DHT22 DATA', voltage: '3.3V' }],
    bom: [{ name: '温湿度传感器', model: 'DHT22', quantity: 1, unitPrice: 20 }],
    wiring: [{ from: 'GPIO4', to: 'DHT22 DATA' }],
  },
  selectedDriverIds: ['dht'],
  codeFiles: [{ path: 'src/main.cpp', content: 'void setup() {}', language: 'cpp' }],
  flowNodes: [{ id: 'start', label: '启动', position: { x: 0, y: 0 } }],
  flowEdges: [],
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_100,
})

describe('portable project files', () => {
  it('round-trips a complete project', () => {
    const parsed = parsePortableProject(serializePortableProject(project))
    expect(parsed.name).toBe(project.name)
    expect(parsed.codeFiles[0].path).toBe('src/main.cpp')
    expect(parsed.scheme?.pins[0].pinNumber).toBe('GPIO4')
    expect(parsed.esp32?.boardId).toBe('esp32-dev-module')
    expect(parsed.esp32?.platformioBoard).toBe('esp32dev')
  })

  it('rejects unsafe generated file paths', () => {
    const archive = createPortableProject(project)
    archive.project.codeFiles[0].path = '../../secret.txt'
    expect(() => parsePortableProject(JSON.stringify(archive))).toThrow(/不安全的工程文件路径/)
  })

  it('rejects flow edges that reference missing nodes', () => {
    const archive = createPortableProject(project)
    archive.project.flowEdges = [{ id: 'bad-edge', source: 'start', target: 'missing' }]
    expect(() => parsePortableProject(JSON.stringify(archive))).toThrow(/不存在的节点/)
  })

  it('rejects unknown archive schemas', () => {
    const archive = { ...createPortableProject(project), schemaVersion: 99 }
    expect(() => parsePortableProject(JSON.stringify(archive))).toThrow(/不支持的项目文件版本/)
  })

  it('rejects unknown ESP32 board profiles instead of silently changing the board', () => {
    const archive = createPortableProject(project)
    archive.project.esp32 = { ...archive.project.esp32!, boardId: 'unknown-board' }
    expect(() => parsePortableProject(JSON.stringify(archive))).toThrow(/未知 ESP32 开发板/)
  })

  it('preserves lifecycle metadata without exporting session references or raw responses', () => {
    const lifecycleProject: Project = {
      ...project,
      currentStage: 'verification',
      lastSessionId: 'local-session',
      versions: [{ id: 'v2', label: 'Review', createdAt: 1_700_000_000_200, sourceProjectId: project.id, schemeVersion: 1, codeVersion: 1 }],
      runs: [{
        id: 'run-1',
        status: 'succeeded',
        createdAt: 1_700_000_000_200,
        sessionId: 'local-session',
        currentStage: 'code-generation',
        stages: [{ id: 'code-generation', status: 'succeeded', progress: 100, currentAction: 'done', retryCount: 0, rawResponse: 'sensitive raw output' }],
      }],
    }
    const serialized = serializePortableProject(lifecycleProject)
    const parsed = parsePortableProject(serialized)

    expect(serialized).not.toContain('local-session')
    expect(serialized).not.toContain('sensitive raw output')
    expect(parsed.currentStage).toBe('verification')
    expect(parsed.versions[0].label).toBe('Review')
    expect(parsed.runs[0].stages[0].status).toBe('succeeded')
  })
})
