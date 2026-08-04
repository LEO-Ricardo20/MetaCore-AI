import { useState, useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  BackgroundVariant,
  Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { selectCurrentProject, useProjectStore } from '@/store/projectStore'
import { useThemeStore } from '@/store/themeStore'
import type { FlowNode } from '@/types/project'
import { cn } from '@/lib/utils'
import { FileCode, GitBranch } from 'lucide-react'

const EDGE_STYLE = { stroke: '#6366f1', strokeWidth: 2.5 }

const NODE_CATEGORIES: Record<string, { bg: string; border: string; text: string; label: string; icon: string; badge: string }> = {
  init: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/40', text: 'text-indigo-300', label: '初始化', icon: '⚡', badge: 'bg-indigo-500/30' },
  sensor: { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-300', label: '传感器', icon: '📡', badge: 'bg-green-500/30' },
  comm: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', text: 'text-cyan-300', label: '通信', icon: '📶', badge: 'bg-cyan-500/30' },
  display: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-300', label: '显示', icon: '🖥', badge: 'bg-amber-500/30' },
  error: { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-300', label: '错误处理', icon: '⚠', badge: 'bg-red-500/30' },
  logic: { bg: 'bg-violet-500/20', border: 'border-violet-500/40', text: 'text-violet-300', label: '逻辑', icon: '🔧', badge: 'bg-violet-500/30' },
  default: { bg: 'bg-slate-500/20', border: 'border-slate-500/40', text: 'text-slate-300', label: '其他', icon: '📦', badge: 'bg-slate-500/30' },
}

function detectCategory(label: string, style?: string) {
  const s = (label + (style || '')).toLowerCase()
  if (s.includes('init') || s.includes('初始化') || s.includes('setup') || s.includes('启动') || s.includes('config')) return 'init'
  if (s.includes('sensor') || s.includes('传感') || s.includes('读取') || s.includes('adc') || s.includes('dht') || s.includes('温度') || s.includes('超声') || s.includes('humid')) return 'sensor'
  if (s.includes('comm') || s.includes('通信') || s.includes('mqtt') || s.includes('http') || s.includes('wifi') || s.includes('蓝牙') || s.includes('发送') || s.includes('post') || s.includes('get')) return 'comm'
  if (s.includes('display') || s.includes('显示') || s.includes('screen') || s.includes('oled') || s.includes('lcd') || s.includes('打印') || s.includes('render')) return 'display'
  if (s.includes('error') || s.includes('错误') || s.includes('异常') || s.includes('fail')) return 'error'
  if (s.includes('logic') || s.includes('逻辑') || s.includes('判断') || s.includes('条件') || s.includes('if') || s.includes('when') || s.includes('分支')) return 'logic'
  return style || 'default'
}

function CodeNodeComponent({ data, selected }: NodeProps<FlowNode & { category?: string }>) {
  const [expanded, setExpanded] = useState(false)
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const catKey = detectCategory(data.label, data.nodeStyle)
  const cat = NODE_CATEGORIES[catKey] ?? NODE_CATEGORIES.default

  return (
    <div
      className={cn(
        'relative rounded-2xl transition-all duration-200 cursor-pointer',
        selected ? 'scale-105 shadow-2xl z-50' : 'hover:scale-[1.03] hover:shadow-xl',
        'shadow-lg'
      )}
      style={{ minWidth: 220, maxWidth: 320 }}
      onClick={() => setExpanded(e => !e)}
    >
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-indigo-400 !border !border-indigo-300 !-top-1.5" />

      {/* 卡片主体 */}
      <div className={cn(
        'rounded-2xl border-2 transition-all backdrop-blur-xl',
        cat.bg, cat.border,
        isDark ? 'bg-slate-800/90' : 'bg-white/95',
        selected ? 'ring-2 ring-indigo-400/60' : '',
        expanded ? 'rounded-b-none' : ''
      )}>
        {/* 顶部标签行 */}
        <div className={cn('flex items-center justify-between px-4 pt-3 pb-1.5', cat.bg)}>
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{cat.icon}</span>
            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider', cat.bg, cat.border, cat.text)}>
              {cat.label}
            </span>
          </div>
          {data.codeSnippet && (
            <span className={cn('text-[9px]', isDark ? 'text-slate-500' : 'text-slate-400')}>
              {expanded ? '▲' : '▼'}
            </span>
          )}
        </div>

        {/* 节点标题 */}
        <div className={cn(
          'px-4 pb-3',
          isDark ? 'bg-slate-800/80' : 'bg-white/80'
        )}>
          <div className={cn(
            'text-[14px] font-bold leading-tight',
            isDark ? 'text-white' : 'text-slate-800'
          )}>
            {data.label}
          </div>
          {data.codeFileRef && (
            <div className="flex items-center gap-1 mt-1">
              <FileCode size={10} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
              <span className={cn(
                'text-[10px] font-mono truncate',
                isDark ? 'text-slate-500' : 'text-slate-400'
              )}>
                {data.codeFileRef}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 代码展开区 */}
      {expanded && data.codeSnippet && (
        <div className={cn(
          'rounded-b-2xl border-t-0 px-4 py-3 -mt-px',
          isDark ? 'bg-slate-800/95 border-slate-600' : 'bg-white/95 border-slate-200 shadow-xl'
        )}>
          <pre className={cn(
            'text-[11px] leading-relaxed overflow-auto max-h-52 font-mono whitespace-pre-wrap',
            isDark ? 'text-emerald-300' : 'text-emerald-600'
          )}>
            {data.codeSnippet}
          </pre>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-indigo-400 !border !border-indigo-300 !-bottom-1.5" />
    </div>
  )
}

const nodeTypes: NodeTypes = { custom: CodeNodeComponent }

export default function FlowCanvas() {
  const project = useProjectStore(selectCurrentProject)
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const flowNodes = project?.flowNodes
  const flowEdges = project?.flowEdges

  const initialNodes: Node[] = useMemo(() => {
    if (!flowNodes) return []
    return flowNodes.map(n => ({
      id: n.id,
      type: 'custom',
      position: n.position,
      draggable: true,
      data: { ...n, category: detectCategory(n.label, n.nodeStyle) }
    }))
  }, [flowNodes])

  const initialEdges: Edge[] = useMemo(() => {
    if (!flowEdges) return []
    return flowEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: true,
      style: EDGE_STYLE,
      labelStyle: {
        fill: isDark ? '#94a3b8' : '#64748b',
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'Inter, sans-serif'
      },
      labelBgStyle: {
        fill: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)',
        rx: 6, ry: 6
      },
      labelBgPadding: [6, 10] as [number, number],
      labelBgBorderRadius: 8,
    }))
  }, [flowEdges, isDark])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges] = useEdgesState(initialEdges)

  useEffect(() => { setNodes(initialNodes) }, [initialNodes, setNodes])
  useEffect(() => { setEdges(initialEdges) }, [initialEdges, setEdges])

  if (!project) return null

  const nodeColors: Record<string, string> = {
    init: '#6366f1', sensor: '#22c55e', comm: '#06b6d4',
    display: '#f59e0b', error: '#ef4444', logic: '#8b5cf6', default: '#64748b'
  }

  return (
    <div className="flex-1 h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
        className="transition-colors duration-300"
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        {/* 装饰性渐变 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isDark
              ? 'radial-gradient(ellipse 60% 50% at 30% 30%, rgba(99,102,241,0.05), transparent), radial-gradient(ellipse 40% 30% at 70% 70%, rgba(6,182,212,0.03), transparent)'
              : 'radial-gradient(ellipse 60% 50% at 30% 30%, rgba(99,102,241,0.06), transparent), radial-gradient(ellipse 40% 30% at 70% 70%, rgba(6,182,212,0.04), transparent)',
          }}
        />

        <Background
          color={isDark ? '#1e293b' : '#c7d2fe'}
          gap={24}
          variant={BackgroundVariant.Dots}
          style={{ transition: 'color 0.3s' }}
          size={1.5}
        />

        <Controls
          className={cn(
            '!rounded-xl !border overflow-hidden !shadow-xl',
            isDark ? '!bg-slate-800/90 !border-slate-700' : '!bg-white/90 !border-slate-200 !shadow-lg'
          )}
          style={{ transition: 'all 0.3s' }}
          showZoom
          showFitView
          showInteractive={false}
        />

        <MiniMap
          nodeColor={(node) => {
            const cat = detectCategory((node.data as FlowNode).label, (node.data as FlowNode).nodeStyle)
            return nodeColors[cat] || nodeColors.default
          }}
          maskColor={isDark ? 'rgba(5,8,16,0.7)' : 'rgba(240,244,255,0.7)'}
          className={cn(
            '!rounded-xl !border overflow-hidden !shadow-xl',
            isDark ? '!bg-slate-800/90 !border-slate-700' : '!bg-white/90 !border-slate-200'
          )}
          style={{ transition: 'all 0.3s' }}
          pannable
          zoomable
        />

        {/* 左下角统计 */}
        <Panel position="bottom-left" className="!m-4">
          <div className={cn(
            'flex items-center gap-3 px-4 py-2 rounded-xl text-xs shadow-xl border backdrop-blur-xl',
            isDark
              ? 'bg-slate-800/90 border-slate-700 text-slate-400'
              : 'bg-white/90 border-slate-200 text-slate-500 shadow-slate-200/50'
          )}>
            <GitBranch size={12} className="text-indigo-400" />
            <span className="font-medium">
              {project.flowNodes.length} 节点 · {project.flowEdges.length} 连接
            </span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}
