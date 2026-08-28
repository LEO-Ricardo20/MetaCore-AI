import packageMeta from '../../package.json'

export const APP_NAME = 'MetaCore Studio'
export const APP_DESCRIPTION = 'AI 辅助的嵌入式硬件架构与工程分析平台，从需求、方案、代码和流程图延伸到本地工程诊断与构建验证。'
export const APP_VERSION = packageMeta.version
export const APP_VERSION_LABEL = `v${APP_VERSION}`
export const APP_RELEASE_DATE = '2026-08-28'

export const APP_SPONSOR = {
  name: 'VPS.Town',
  website: 'https://vps.town/',
  image: `${import.meta.env.BASE_URL}sponsor.png`,
  description: 'VPS.Town 是一家专注于 VPS 与云服务器服务的平台，为开发者、个人站长及项目团队提供稳定、灵活的云计算资源，适用于网站部署、应用托管、开发测试以及个人项目运行等场景。感谢 VPS.Town 对 MetaCore Studio 项目开发与开源工作的支持。',
} as const
