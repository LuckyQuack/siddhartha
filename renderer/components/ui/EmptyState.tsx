import * as React from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-5 max-w-sm text-center">
      {/* Icon container with subtle ambient glow */}
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/8">
        <Icon className="w-7 h-7 text-[var(--text-muted)]" />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {description}
        </p>
      </div>

      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
