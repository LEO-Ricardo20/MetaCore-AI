import { useState, useRef, useEffect } from 'react'
import { selectCurrentProject, useProjectStore } from '@/store/projectStore'
import { useAIConfigStore } from '@/store/aiConfigStore'
import { useThemeStore } from '@/store/themeStore'
import { callAI } from '@/services/ai/client'
import { CHAT_SYSTEM_PROMPT } from '@/services/ai/prompts'
import { X, Send, Loader2, Bot, User, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AIChatPanel({ onClose }: { onClose: () => void }) {
  const project = useProjectStore(selectCurrentProject)
  const { getActive } = useAIConfigStore()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '你好！我是 MetaCore Studio 硬件工程助手。你可以问我关于硬件设计、代码逻辑、引脚配置、方案优化等问题。' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const requestController = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => () => requestController.current?.abort(), [])

  async function handleSend() {
    if (!input.trim() || loading) return
    const svc = getActive()
    if (!svc) {
      setMessages(m => [...m, { role: 'assistant', content: '请先在设置页配置并选择 AI 服务。' }])
      return
    }

    const userMsg: Message = { role: 'user', content: input.trim() }
    setMessages(m => [...m, userMsg])
    const pendingContent = input.trim()
    setInput('')
    setLoading(true)
    const controller = new AbortController()
    requestController.current?.abort()
    requestController.current = controller

    const context = project
      ? `项目：${project.name}\n芯片：${project.target}\n格式：${project.format}\n方案：${project.scheme?.description ?? '未生成'}`
      : '暂无项目'

    const history = messages.slice(-6).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    try {
      let reply = ''
      setMessages(m => [...m, { role: 'assistant', content: '' }])
      await callAI(
        svc,
        [
          { role: 'system', content: CHAT_SYSTEM_PROMPT(context) },
          ...history,
          { role: 'user', content: pendingContent }
        ],
        { signal: controller.signal, onChunk: (chunk) => {
          reply += chunk
          setMessages(m => {
            const updated = [...m]
            updated[updated.length - 1] = { role: 'assistant', content: reply }
            return updated
          })
        } }
      )
    } catch (e: any) {
      setMessages(m => {
        const updated = [...m]
        updated[updated.length - 1] = { role: 'assistant', content: `错误：${e.message}` }
        return updated
      })
    } finally {
      if (requestController.current === controller) requestController.current = null
      setLoading(false)
    }
  }

  function handleCancel() {
    requestController.current?.abort()
  }

  function handleClose() {
    requestController.current?.abort()
    onClose()
  }

  return (
    <div className={cn(
      'w-96 flex flex-col border-l h-full',
      isDark
        ? 'bg-slate-900/95 border-slate-700/50'
        : 'bg-white/95 border-indigo-100 shadow-2xl'
    )}>
      {/* 头部 */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3 border-b',
        isDark ? 'border-slate-700/50' : 'border-indigo-100'
      )}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bot size={14} className="text-white" />
          </div>
          <div>
            <span className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-slate-800')}>AI 问答</span>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className={cn('text-[10px)', isDark ? 'text-slate-500' : 'text-slate-400')}>硬件工程助手</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleClose}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            isDark ? 'text-slate-500 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-indigo-50'
          )}
        >
          <X size={16} />
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('flex gap-2 max-w-[90%]', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
              {/* 头像 */}
              <div className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-indigo-500 to-violet-500'
                  : isDark ? 'bg-slate-700' : 'bg-indigo-100'
              )}>
                {msg.role === 'user' ? <User size={13} className="text-white" /> : <Bot size={13} className={isDark ? 'text-slate-300' : 'text-indigo-500'} />}
              </div>

              {/* 气泡 */}
              <div>
                <div className={cn(
                  'px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'chat-bubble-user shadow-lg shadow-indigo-500/15'
                    : cn(
                        isDark
                          ? 'bg-slate-800/90 border border-slate-700/50 text-slate-200'
                          : 'bg-white border border-indigo-100 text-slate-700 shadow-sm'
                      )
                )}>
                  {msg.content || <span className="opacity-50 flex items-center gap-1"><Loader2 size={12} className="animate-spin" />思考中...</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 输入框 */}
      <div className={cn('p-3 border-t', isDark ? 'border-slate-700/50' : 'border-indigo-100')}>
        <div className={cn(
          'flex items-end gap-2 rounded-xl px-3 py-2 border transition-all focus-within:ring-2 focus-within:ring-indigo-500/30',
          isDark
            ? 'bg-slate-800/80 border-slate-700/50'
            : 'bg-indigo-50/80 border-indigo-200/60'
        )}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="问关于硬件方案的问题..."
            rows={2}
            className={cn(
              'flex-1 bg-transparent text-[13px] placeholder-slate-500 outline-none resize-none',
              isDark ? 'text-white' : 'text-slate-700'
            )}
          />
          <button
            onClick={loading ? handleCancel : handleSend}
            disabled={!loading && !input.trim()}
            className={cn(
              'p-2 rounded-lg transition-all flex-shrink-0',
              input.trim() && !loading
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-105 active:scale-95'
                : isDark ? 'bg-slate-700 text-slate-500' : 'bg-indigo-100 text-indigo-300'
            )}
          >
            {loading ? <Square size={13} /> : <Send size={15} />}
          </button>
        </div>
        <p className={cn('text-[10px] text-center mt-1.5', isDark ? 'text-slate-600' : 'text-slate-400')}>
          按 Enter 发送，Shift+Enter 换行
        </p>
      </div>
    </div>
  )
}
