import { Zap, Cpu, Code2, GitBranch, Download, MessageSquare, Palette, FolderOpen, Shield, Heart, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'

const FEATURES = [
  { icon: Cpu, color: 'indigo', title: '硬件方案生成', desc: '自然语言描述需求，AI 自动生成引脚分配、BOM 清单、接线对照表' },
  { icon: Code2, color: 'violet', title: '模块化代码生成', desc: '支持 ESP-IDF / Arduino / PlatformIO 三种工程格式，生成可编译代码' },
  { icon: GitBranch, color: 'fuchsia', title: '流程图可视化', desc: '自动分析代码执行流程，生成可交互节点图，按类别彩色区分' },
  { icon: MessageSquare, color: 'cyan', title: 'AI 工程顾问', desc: '基于项目上下文的智能问答，硬件选型、调试建议一问即答' },
  { icon: Download, color: 'emerald', title: '一键导出', desc: 'ZIP 工程包 + PDF 专业文档，浏览器端生成无需服务器' },
  { icon: FolderOpen, color: 'amber', title: '项目管理', desc: '多项目创建、加载、删除，数据本地持久化自动保存' },
  { icon: Palette, color: 'rose', title: '主题切换', desc: '暗色 / 亮色主题一键切换，偏好自动记忆' },
  { icon: Shield, color: 'teal', title: '隐私安全', desc: '所有数据保存在本地浏览器，AI 调用直连服务商，无中间服务器' },
]

const CHIPS = [
  { name: 'ESP32', pins: 38, core: '双核 Xtensa LX6', freq: '240MHz', feature: 'WiFi + Bluetooth' },
  { name: 'ESP32-S3', pins: 38, core: '双核 Xtensa LX7', freq: '240MHz', feature: 'WiFi + BLE + AI 加速 + 16MB Flash + 8MB PSRAM' },
  { name: 'STM32F103', pins: 48, core: 'ARM Cortex-M3', freq: '72MHz', feature: '低成本工业控制' },
  { name: 'STM32F4', pins: 64, core: 'ARM Cortex-M4 + FPU', freq: '168MHz', feature: 'DSP + 浮点运算' },
  { name: 'STM32F103-KIT', pins: 48, core: 'ARM Cortex-M3', freq: '72MHz', feature: 'KEYSKING学习板，含OLED/AHT20/蜂鸣器/电机等全套外设' },
]

const TECH_STACK = [
  { name: 'React 18', desc: 'UI 框架' },
  { name: 'TypeScript', desc: '类型安全' },
  { name: 'Vite 5', desc: '构建工具' },
  { name: 'Tailwind CSS', desc: '原子化样式' },
  { name: 'Zustand', desc: '状态管理' },
  { name: 'ReactFlow', desc: '流程图引擎' },
  { name: 'Monaco Editor', desc: '代码编辑器' },
  { name: '@react-pdf/renderer', desc: 'PDF 生成' },
  { name: 'JSZip', desc: 'ZIP 打包' },
]

const AI_PROVIDERS = [
  { name: 'DeepSeek', desc: '国产大模型，性价比高' },
  { name: '硅基流动', desc: '模型聚合平台，免费额度' },
  { name: '通义千问', desc: '阿里云大模型' },
  { name: 'OpenAI', desc: 'GPT-4o 系列' },
  { name: 'Ollama', desc: '本地部署，完全离线' },
]

export default function AboutPage() {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* 头部 */}
        <div className="text-center space-y-4 fade-in-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-cyan-500 to-indigo-400 shadow-lg shadow-indigo-500/25">
            <Zap size={28} className="text-white" />
          </div>
          <h1 className={cn('text-3xl font-bold', isDark ? 'text-white' : 'text-slate-800')}>
            MetaCore AI
          </h1>
          <p className={cn('text-sm max-w-lg mx-auto leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-500')}>
            AI 驱动的嵌入式硬件架构工程师平台，从需求描述到硬件方案、工程代码、执行流程图，全链路自动化。
          </p>
          <div className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono',
            isDark ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
          )}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            v1.5.6
          </div>
        </div>

        {/* 功能特性 */}
        <div className="space-y-3 fade-in-up" style={{ animationDelay: '50ms' }}>
          <h2 className={cn('text-sm font-semibold flex items-center gap-2', isDark ? 'text-slate-300' : 'text-slate-700')}>
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            功能特性
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.title} className={cn(
                'glass-card p-4 flex items-start gap-3 group hover:scale-[1.01] transition-transform duration-200',
                isDark ? '' : 'bg-white/80 border-slate-200/60'
              )}>
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  `bg-${f.color}-500/15`
                )}>
                  <f.icon size={15} className={`text-${f.color}-400`} />
                </div>
                <div>
                  <div className={cn('text-xs font-semibold mb-0.5', isDark ? 'text-white' : 'text-slate-800')}>{f.title}</div>
                  <div className={cn('text-[11px] leading-relaxed', isDark ? 'text-slate-500' : 'text-slate-500')}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 支持芯片 */}
        <div className="space-y-3 fade-in-up" style={{ animationDelay: '100ms' }}>
          <h2 className={cn('text-sm font-semibold flex items-center gap-2', isDark ? 'text-slate-300' : 'text-slate-700')}>
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            支持芯片
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {CHIPS.map((chip) => (
              <div key={chip.name} className={cn(
                'glass-card p-4 hover:scale-[1.01] transition-transform duration-200',
                isDark ? '' : 'bg-white/80 border-slate-200/60'
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className={cn('text-sm font-bold', isDark ? 'text-white' : 'text-slate-800')}>{chip.name}</span>
                  <span className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-mono',
                    isDark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-600'
                  )}>{chip.pins} pins</span>
                </div>
                <div className={cn('text-[11px] space-y-0.5', isDark ? 'text-slate-500' : 'text-slate-500')}>
                  <div>内核：{chip.core}</div>
                  <div>主频：{chip.freq}</div>
                  <div>特性：{chip.feature}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 技术栈 + AI 服务 并排 */}
        <div className="grid grid-cols-2 gap-4 fade-in-up" style={{ animationDelay: '150ms' }}>
          {/* 技术栈 */}
          <div className={cn(
            'glass-card p-4',
            isDark ? '' : 'bg-white/80 border-slate-200/60'
          )}>
            <h2 className={cn('text-sm font-semibold mb-3 flex items-center gap-2', isDark ? 'text-slate-300' : 'text-slate-700')}>
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              技术栈
            </h2>
            <div className="space-y-1.5">
              {TECH_STACK.map((t) => (
                <div key={t.name} className="flex items-center justify-between">
                  <span className={cn('text-xs font-medium', isDark ? 'text-slate-300' : 'text-slate-700')}>{t.name}</span>
                  <span className={cn('text-[10px]', isDark ? 'text-slate-600' : 'text-slate-400')}>{t.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI 服务商 */}
          <div className={cn(
            'glass-card p-4',
            isDark ? '' : 'bg-white/80 border-slate-200/60'
          )}>
            <h2 className={cn('text-sm font-semibold mb-3 flex items-center gap-2', isDark ? 'text-slate-300' : 'text-slate-700')}>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              AI 服务支持
            </h2>
            <div className="space-y-1.5">
              {AI_PROVIDERS.map((p) => (
                <div key={p.name} className="flex items-center justify-between">
                  <span className={cn('text-xs font-medium', isDark ? 'text-slate-300' : 'text-slate-700')}>{p.name}</span>
                  <span className={cn('text-[10px]', isDark ? 'text-slate-600' : 'text-slate-400')}>{p.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 版权信息 */}
        <div className="fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className={cn(
            'glass-card p-5 text-center space-y-3',
            isDark
              ? 'border-indigo-500/10 bg-gradient-to-r from-indigo-500/5 via-cyan-500/5 to-indigo-500/5'
              : 'border-indigo-200/60 bg-gradient-to-r from-indigo-50/80 via-cyan-50/80 to-indigo-50/80'
          )}>
            <div className="flex items-center justify-center gap-1.5">
              <Heart size={13} className="text-rose-400" />
              <span className={cn('text-xs font-medium', isDark ? 'text-slate-300' : 'text-slate-700')}>
                版权声明
              </span>
            </div>
            <p className={cn('text-xs leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-600')}>
              MetaCore AI 平台由开发者 <span className={cn('font-semibold', isDark ? 'text-indigo-400' : 'text-indigo-600')}>Leo</span> 独立设计与开发。
              <br />
              本平台所有代码、设计、文档及相关知识产权均归 Leo 所有。
            </p>
            <div className={cn('text-[10px] font-mono', isDark ? 'text-slate-600' : 'text-slate-400')}>
              © 2026 Leo. All rights reserved.
            </div>
          </div>
        </div>

        {/* 免责声明 */}
        <div className="fade-in-up" style={{ animationDelay: '250ms' }}>
          <div className={cn(
            'glass-card p-5 space-y-3',
            isDark
              ? 'border-amber-500/10 bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5'
              : 'border-amber-200/60 bg-gradient-to-r from-amber-50/80 via-transparent to-amber-50/80'
          )}>
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-amber-400" />
              <span className={cn('text-xs font-medium', isDark ? 'text-slate-300' : 'text-slate-700')}>
                免责声明
              </span>
            </div>
            <div className={cn('text-[11px] leading-relaxed space-y-2', isDark ? 'text-slate-400' : 'text-slate-500')}>
              <p>
                <strong className={isDark ? 'text-slate-300' : 'text-slate-600'}>1. AI 生成内容</strong><br />
                本平台所有硬件方案、引脚分配、BOM 清单、工程代码及流程图均由 AI 自动生成，仅供学习和参考使用。
                AI 生成的内容可能存在错误、遗漏或不适用于特定场景的情况，用户在实际应用前应自行验证其准确性和安全性。
                <strong>生成结果的准确性与所选 AI 模型的能力以及芯片参数的完整度直接相关</strong>，建议使用高性能 AI 模型并补充完善芯片技术规格以获得最佳效果。
              </p>
              <p>
                <strong className={isDark ? 'text-slate-300' : 'text-slate-600'}>2. 价格信息</strong><br />
                BOM 清单中的价格均为 AI 预估参考价，不构成任何报价或采购承诺。实际采购价格受供应商、数量、时间等因素影响，请以实际询价为准。
              </p>
              <p>
                <strong className={isDark ? 'text-slate-300' : 'text-slate-600'}>3. 安全与合规</strong><br />
                本平台生成的硬件方案和代码未经过安全认证或合规审查。
                用户将生成内容用于商业产品、医疗设备、车载系统等安全关键领域前，必须进行专业的安全评审和合规认证。
                因使用本平台生成内容导致的任何直接或间接损失，开发者不承担法律责任。
              </p>
              <p>
                <strong className={isDark ? 'text-slate-300' : 'text-slate-600'}>4. 数据隐私</strong><br />
                本平台所有数据保存在用户本地浏览器中，不经过任何中间服务器。AI 调用直接发送至用户配置的 AI 服务商，
                平台开发者不收集、存储或处理任何用户数据。用户应自行评估所选 AI 服务商的数据隐私政策。
              </p>
              <p>
                <strong className={isDark ? 'text-slate-300' : 'text-slate-600'}>5. 知识产权</strong><br />
                AI 生成的代码和方案的知识产权归用户所有。但用户应注意，AI 生成的内容可能无意中包含与第三方知识产权相似的部分，
                用户在商业使用前应自行进行知识产权审查。
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
