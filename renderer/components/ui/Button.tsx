import * as React from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const base =
  'inline-flex items-center justify-center gap-2 rounded font-serif font-semibold ' +
  'transition-all duration-[120ms] select-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-teal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] ' +
  'disabled:pointer-events-none disabled:opacity-40'

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--accent-primary)] text-parchment-100 hover:bg-ink-deep/90 active:scale-[0.98] shadow-sm',
  secondary:
    'bg-[var(--accent-teal)] text-parchment-100 hover:bg-teal-dark active:scale-[0.98] shadow-sm',
  ghost:
    'text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)]',
  outline:
    'border border-[var(--border-soft)] text-[var(--text-secondary)] bg-[var(--surface-raised)] hover:border-[var(--accent-teal)] hover:text-[var(--text-primary)]',
}

const sizes: Record<Size, string> = {
  sm: 'h-8  px-3 text-xs',
  md: 'h-9  px-4 text-sm',
  lg: 'h-11 px-6 text-base',
}

export function Button({
  variant = 'ghost',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={[base, variants[variant], sizes[size], className].join(' ')} {...props}>
      {children}
    </button>
  )
}
