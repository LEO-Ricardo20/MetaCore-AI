import type { ArtifactKey, Project } from '@/types/project'

const artifactMeta: Record<ArtifactKey, { label: string; route: string }> = {
  requirements: { label: '需求', route: '/design/requirements' },
  scheme: { label: '硬件方案', route: '/design/scheme' },
  pinMap: { label: '引脚映射', route: '/design/pins' },
  bom: { label: 'BOM', route: '/design/bom' },
  wiring: { label: '接线', route: '/design/wiring' },
  code: { label: '固件工程', route: '/implementation/code' },
  flow: { label: '执行流程', route: '/verification/flow' },
  localAnalysis: { label: '本地分析', route: '/verification/local' },
  consistencyReport: { label: '一致性检查', route: '/verification/consistency' },
  buildResult: { label: '构建验证', route: '/verification/build' },
  releaseReport: { label: '发布检查', route: '/verification/release' },
}

export function getPendingIssues(project?: Project | null) {
  if (!project) return []
  return (Object.entries(project.artifacts) as Array<[ArtifactKey, Project['artifacts'][ArtifactKey]]>)
    .filter(([, artifact]) => artifact.status === 'stale' || artifact.status === 'invalid')
    .map(([key, artifact]) => ({ key, ...artifactMeta[key], artifact }))
}

export function getFirstPendingRoute(project?: Project | null) {
  return getPendingIssues(project)[0]?.route ?? '/verification/consistency'
}
