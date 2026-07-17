import type { HTMLAttributes } from 'react'
import { Zap } from 'lucide-react'
import { APP_NAME } from '@/config/app'
import { cn } from '@/lib/utils'

type LogoSize = 'sm' | 'md' | 'lg'

interface MetaCoreLogoProps extends HTMLAttributes<HTMLDivElement> {
  size?: LogoSize
  animated?: boolean
}

const sizeClasses: Record<LogoSize, string> = {
  sm: 'h-9 w-9 rounded-xl',
  md: 'h-14 w-14 rounded-2xl',
  lg: 'h-16 w-16 rounded-2xl',
}

const iconSizes: Record<LogoSize, number> = {
  sm: 18,
  md: 24,
  lg: 28,
}

export default function MetaCoreLogo({
  size = 'sm',
  animated = false,
  className,
  ...props
}: MetaCoreLogoProps) {
  return (
    <div
      {...props}
      role="img"
      aria-label={APP_NAME}
      className={cn(
        'inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-indigo-600 via-cyan-500 to-blue-400 shadow-lg shadow-indigo-500/25',
        sizeClasses[size],
        animated && 'logo-glow',
        className
      )}
    >
      <Zap size={iconSizes[size]} strokeWidth={2.4} className="text-slate-950" />
    </div>
  )
}
