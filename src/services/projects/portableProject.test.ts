import { describe, expect, it } from 'vitest'
import type { Project } from '@/types/project'
import { createPortableProject, parsePortableProject, serializePortableProject } from './portableProject'

const project: Project = {
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
}

describe('portable project files', () => {
  it('round-trips a complete project', () => {
    const parsed = parsePortableProject(serializePortableProject(project))
    expect(parsed.name).toBe(project.name)
    expect(parsed.codeFiles[0].path).toBe('src/main.cpp')
    expect(parsed.scheme?.pins[0].pinNumber).toBe('GPIO4')
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
})
