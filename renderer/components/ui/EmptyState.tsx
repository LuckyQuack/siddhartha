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
    <div className="flex flex-col items-center gap-6 max-w-xs text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--surface-overlay)] border border-[var(--border-subtle)]">
        <Icon className="w-7 h-7 text-[var(--text-muted)]" strokeWidth={1.5} />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
