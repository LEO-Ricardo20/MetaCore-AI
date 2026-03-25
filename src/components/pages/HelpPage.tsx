import { useState } from 'react'
import { BookOpen, Zap, FileCode, GitBranch, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'

const SECTIONS = [
  {
    id: 'quickstart',
    icon: Zap,
    color: 'cyan',
    title: '快速开始',
    steps: [
      { title: '配置 AI 服务', desc: '在「设置」页面添加你的 API Key，支持 DeepSeek、硅基流动、通义千问、OpenAI、Ollama。配置完成后点击「测试」验证连接。' },
      { title: '输入硬件需求', desc: '在「方案」页面输入你想要实现的硬件功能。例如：「做一个 AI 桌宠，需要 OLED 显示表情、播放声音、检测温湿度」。' },
      { title: '生成硬件方案', desc: '选择目标芯片（支持预置和自定义芯片）和工程格式（ESP-IDF/Arduino/PlatformIO），点击「生成方案」。AI 基于芯片完整技术规格（引脚/外设/限制）生成精准方案。' },
      { title: '生成代码工程', desc: '点击「生成工程代码」，AI 根据方案和芯片规格生成模块化代码，生成后自动进行一致性自检。当方案中包含 SSD1306 OLED 或 DHT 温湿度传感器时，系统会自动注入经验证的驱动模板，代码页顶栏会显示绿色「驱动已注入」标签，生成的驱动代码可直接上板编译。' },
      { title: '导出使用', desc: '点击「导出 ZIP」下载完整工程包，或点击「导出 PDF」获取方案文档。BOM 价格仅供参考。' },
      { title: '自定义芯片', desc: '点击侧边栏「芯片」进入芯片管理，支持三种方式添加自定义芯片：AI 识图（上传 PDF）、AI 助填、手动配置。' },
      { title: '了解更多', desc: '点击侧边栏「关于」查看平台功能特性、技术栈、版权信息及免责声明。' },
    ],
  },
  {
    id: 'chips',
    icon: FileCode,
    color: 'indigo',
    title: '芯片平台',
    steps: [
      { title: 'ESP32', desc: '乐鑫科技双核 WiFi+BT 芯片，主频 240MHz，520KB SRAM，适合大多数物联网项目。' },
      { title: 'ESP32-S3', desc: 'ESP32 升级版，增加向量指令（用于 AI 推理）、更大 SRAM (512KB)，支持更大模型部署。' },
      { title: 'STM32F103', desc: '意法半导体 32位 ARM Cortex-M3 芯片，主频 72MHz，低成本高可靠性，适合工业控制。' },
      { title: 'STM32F4', desc: '高性能系列，ARM Cortex-M4，FPU，168MHz，适合需要 DSP 和浮点运算的项目。' },
      { title: '自定义芯片', desc: '支持通过 AI 识图（上传 PDF）、AI 助填或手动配置添加任意芯片。自定义芯片的引脚/外设/限制信息会自动注入 AI 方案生成流程。' },
    ],
  },
  {
    id: 'format',
    icon: Settings,
    color: 'violet',
    title: '工程格式',
    steps: [
      { title: 'ESP-IDF', desc: '乐鑫官方开发框架，CMake 构建，支持多核、低功耗、WiFi/BT 协议栈完整功能。适合需要深度定制和性能优化的项目。' },
      { title: 'Arduino', desc: '最易上手的框架，生态丰富，适合初学者和快速原型。代码放在单个 .ino 文件或分文件。' },
      { title: 'PlatformIO', desc: '跨平台构建系统，支持多框架多芯片，VS Code 插件优秀，适合喜欢现代 IDE 的开发者。' },
    ],
  },
  {
    id: 'workflow',
    icon: GitBranch,
    color: 'fuchsia',
    title: '工作流程',
    steps: [
      { title: '需求 → 方案', desc: 'AI 分析需求，输出硬件方案、引脚分配、BOM 清单、接线表。引脚可视化支持悬停查看详情。' },
      { title: '方案 → 代码', desc: '基于硬件方案生成模块化代码，每个外设独立模块，包含完整驱动代码和中文注释。' },
      { title: '代码 → 流程图', desc: 'AI 分析代码执行逻辑，生成可视化流程图，点击节点可查看关联代码。节点支持自由拖动调整布局，连线关系保持不变。' },
      { title: 'AI 问答', desc: '在流程图页面打开 AI 问答，可针对当前项目代码进行提问，AI 携带完整上下文提供专业解答。' },
    ],
  },
]

const CHANGELOG = [
  {
    version: 'v1.5.6',
    date: '2026-03-25',
    badge: 'cyan',
    changes: [
      '修复：手动预选驱动在点击「生成方案」后丢失的 bug（createProject 现在保留 selectedDriverIds）',
      '新增：一键式生成开关 — 开启后点「生成方案」自动串行完成 方案→代码→流程图 三步无需逐步手动点击，开关状态跨会话记忆',
    ],
  },
  {
    version: 'v1.5.5',
    date: '2026-03-25',
    badge: 'violet',
    changes: [
      '新增：STM32CubeIDE 工程格式支持 — 生成 .ioc / HAL 标准骨架，适合在 STM32CubeIDE 内 debug',
      '新增：OpenAI Responses API 双协议适配 — 服务商为 OpenAI 时自动切换新协议，其余服务商保持 Chat Completions 兼容',
    ],
  },
  {
    version: 'v1.5.4',
    date: '2026-03-25',
    badge: 'orange',
    changes: [
      '新增：方案页「手动预选驱动」折叠面板 — 生成方案前可手动勾选外设驱动，代码生成时与自动匹配结果去重合并',
      '新增：驱动选择计数徽章，选中驱动数实时显示在折叠标题',
    ],
  },
  {
    version: 'v1.5.3',
    date: '2026-03-25',
    badge: 'rose',
    changes: [
      '新增：STM32F103-KIT 预置芯片（KEYSKING 学习板，STM32F103C8T6 LQFP-48），含完整外设引脚分配',
      '新增：6 个外设驱动模板 — AHT20 温湿度、WS2812 RGB LED、HC-SR04 超声波、无源蜂鸣器、舵机 PWM、DRV8833 电机驱动',
      '新增：外设驱动库浏览页（侧边栏「外设库」），支持按接口类型筛选、折叠展开查看代码',
    ],
  },
  {
    version: 'v1.5.2',
    date: '2026-03-24',
    badge: 'emerald',
    changes: [
      '新增：SSD1306 OLED 驱动模板库 — ESP-IDF/Arduino/PlatformIO 三框架完整驱动（I2C 初始化、6x8 字模渲染、flush 机制）',
      '新增：DHT11/DHT22 驱动模板库 — ESP-IDF 手写单总线时序，Arduino/PlatformIO 使用 Adafruit DHT 库，含 NaN 保护与采样间隔约束',
      '新增：代码页顶栏驱动模板指示器 — 自动检测方案中的 OLED/DHT 外设，显示绿色「驱动已注入」标签',
      '优化：代码生成 Prompt 自动注入匹配驱动模板，AI 基于验证代码组装而非自由编写，大幅提升生成代码可用性',
    ],
  },
  {
    version: 'v1.5.1',
    date: '2026-03-21',
    badge: 'indigo',
    changes: [
      '修复：PDF 导出中文乱码，注册本地中文字体（SimHei）替代默认 Helvetica',
      '优化：引脚图布局重构 — 加大字号、加宽间距、文字不再被芯片主体遮挡',
      '优化：引脚图 Tooltip 支持暗色/亮色主题',
      '优化：start.bat 升级 — 自动检测依赖、自动打开浏览器、显示启动 Banner',
      '优化：.gitignore 补全（dist/、.env*、IDE 配置、OS 文件等）',
    ],
  },
  {
    version: 'v1.5.0',
    date: '2026-03-21',
    badge: 'cyan',
    changes: [
      '新增：自定义芯片管理，支持三种模式 — AI 识图（上传 PDF）、AI 助填、手动配置',
      '新增：芯片知识库，预置 ESP32/ESP32-S3/STM32F103/STM32F4 完整技术规格',
      '新增：代码生成后 AI 自动自检，检查代码与硬件方案的一致性',
      '新增：关于页面增加完整免责声明（AI 内容、价格、安全合规、隐私、知识产权）',
      '新增：BOM 清单下方增加价格仅供参考提示',
      '优化：AI Prompt 全面重构，注入芯片引脚/外设/限制参数，大幅提升生成精准度',
      '优化：方案生成/代码生成/流程图均使用 system + user 双消息结构',
      '优化：代码生成 temperature 降至 0.15，提高确定性',
      '优化：引脚图颜色修复 — 电源绿色、GND 红色、已分配蓝色、未分配灰色',
      '优化：引脚图匹配逻辑增强，同时支持 pinNumber 和 pinName 匹配',
    ],
  },
  {
    version: 'v1.4.0',
    date: '2026-03-19',
    badge: 'fuchsia',
    changes: [
      '新增：流程图节点支持自由拖动，可手动调整布局，连线关系保持不变',
    ],
  },
  {
    version: 'v1.3.0',
    date: '2026-03-19',
    badge: 'emerald',
    changes: [
      '新增：「关于」页面，展示平台功能特性、支持芯片、技术栈、AI 服务商及版权信息',
      '新增：侧边栏新增「关于」导航入口',
      '优化：全局亮色主题文字/背景/边框颜色适配，解决白底白字问题',
      '优化：项目管理器、帮助页等组件全面支持暗色/亮色主题',
      '优化：流程图画布节点尺寸加大、圆角优化、间距更舒适',
      '修复：亮色模式下多处文字颜色未跟随主题切换的问题',
    ],
  },
  {
    version: 'v1.2.0',
    date: '2026-03-18',
    badge: 'cyan',
    changes: [
      '新增：暗色/亮色主题切换（侧边栏太阳/月亮按钮）',
      '新增：流程图节点大幅升级，按类别彩色区分（初始化/传感器/通信/显示/错误处理）',
      '新增：流程图节点点击展开代码片段，渐变卡片样式',
      '新增：AI 问答面板全新设计，消息气泡、头像、流式打字效果',
      '优化：流程图页面 UI 全面重做，加载动画、空状态提示',
      '优化：所有组件支持暗色/亮色主题平滑过渡',
    ],
  },
  {
    version: 'v1.1.0',
    date: '2026-03-18',
    badge: 'indigo',
    changes: [
      '新增：项目管理器，支持项目列表/新建/加载/删除',
      '新增：芯片引脚可视化，支持 SVG 3D 悬停效果',
      '新增：PDF 专业导出（封面 + 引脚表 + BOM + 接线表）',
      '新增：硅基流动 AI 服务商（免费额度）',
      '优化：UI 全面升级，融合风格设计语言',
      '优化：AI Prompt 模板大幅增强',
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-03-17',
    badge: 'slate',
    changes: [
      '初始版本发布',
      '需求页：AI 生成硬件方案（引脚/BOM/接线）',
      '代码页：AI 生成模块化工程代码 + Monaco 编辑器',
      '流程图页：ReactFlow 可视化 + AI 问答',
      '设置页：多 AI 服务商配置',
    ],
  },
]

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState('quickstart')
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const currentSection = SECTIONS.find(s => s.id === activeSection) ?? SECTIONS[0]

  const colorMap: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', dot: 'bg-cyan-400' },
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', dot: 'bg-indigo-400' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', dot: 'bg-violet-400' },
    fuchsia: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/20', dot: 'bg-fuchsia-400' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
    slate: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', dot: 'bg-slate-400' },
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 页头 */}
        <div className="mb-8 slide-in-left">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <BookOpen size={13} className="text-cyan-400" />
            </div>
            <span className="text-xs text-cyan-400 font-medium tracking-wide uppercase">Documentation</span>
          </div>
          <h1 className={cn('text-2xl font-bold mb-1', isDark ? 'text-white' : 'text-slate-800')}>使用教程 & 更新日志</h1>
          <p className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>快速上手 MetaCore AI，了解所有功能和使用方法</p>
        </div>

        <div className="flex gap-6">
          {/* 左侧导航 */}
          <div className="w-48 flex-shrink-0">
            <div className="sticky top-0 space-y-1">
              {SECTIONS.map(s => {
                const Icon = s.icon
                const colors = colorMap[s.color]
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all duration-150',
                      activeSection === s.id
                        ? `${colors.bg} ${colors.text} font-medium`
                        : isDark
                          ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    <Icon size={14} />
                    {s.title}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 右侧内容 */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* 教程内容 */}
            <div className="slide-in-right">
              <h2 className={cn('text-lg font-bold mb-4 flex items-center gap-2', isDark ? 'text-white' : 'text-slate-800')}>
                <currentSection.icon size={18} className={colorMap[currentSection.color].text} />
                {currentSection.title}
              </h2>
              <div className="space-y-3">
                {currentSection.steps.map((step, i) => (
                  <div key={i} className="glass-card p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5',
                        colorMap[currentSection.color].bg,
                        colorMap[currentSection.color].text
                      )}>
                        {i + 1}
                      </div>
                      <div>
                        <h3 className={cn('text-sm font-semibold mb-1', isDark ? 'text-white' : 'text-slate-800')}>{step.title}</h3>
                        <p className={cn('text-xs leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-500')}>{step.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 更新日志 */}
            <div className="glass-card p-5 slide-in-right" style={{ animationDelay: '100ms' }}>
              <h3 className={cn('text-sm font-semibold mb-4 flex items-center gap-2', isDark ? 'text-white' : 'text-slate-800')}>
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                更新日志
              </h3>
              <div className="space-y-4">
                {CHANGELOG.map((release) => (
                  <div key={release.version} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-xs font-mono font-bold px-2 py-0.5 rounded-md',
                        colorMap[release.badge]?.bg ?? 'bg-slate-500/10',
                        colorMap[release.badge]?.text ?? 'text-slate-400'
                      )}>
                        {release.version}
                      </span>
                      <span className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>{release.date}</span>
                    </div>
                    <ul className="space-y-1.5">
                      {release.changes.map((change, i) => (
                        <li key={i} className={cn('flex items-start gap-2 text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                          <span className={cn('w-1 h-1 rounded-full mt-1.5 flex-shrink-0', isDark ? 'bg-slate-500' : 'bg-slate-400')} />
                          {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* 技巧提示 */}
            <div className="glass-card p-5 border-cyan-500/10 slide-in-right" style={{ animationDelay: '150ms' }}>
              <h3 className={cn('text-sm font-semibold mb-2 flex items-center gap-2', isDark ? 'text-white' : 'text-slate-800')}>
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                使用技巧
              </h3>
              <ul className={cn('space-y-1.5 text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                <li className="flex items-start gap-2"><span className="text-cyan-400 mt-0.5">→</span> 需求描述越详细，AI 生成的方案越精准</li>
                <li className="flex items-start gap-2"><span className="text-cyan-400 mt-0.5">→</span> 硅基流动提供免费额度，适合日常测试使用</li>
                <li className="flex items-start gap-2"><span className="text-cyan-400 mt-0.5">→</span> ESP-IDF 格式生成的代码最完整，包含 CMakeLists</li>
                <li className="flex items-start gap-2"><span className="text-cyan-400 mt-0.5">→</span> 引脚图悬停可查看详细连接信息</li>
                <li className="flex items-start gap-2"><span className="text-cyan-400 mt-0.5">→</span> 项目数据保存在本地浏览器，换设备需导出</li>
                <li className="flex items-start gap-2"><span className="text-cyan-400 mt-0.5">→</span> 包含 SSD1306 OLED 或 DHT 温湿度的方案会自动注入驱动模板，生成代码可直接上板编译</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
