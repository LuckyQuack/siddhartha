import * as React from 'react'

type Variant = 'primary' | 'ghost' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

// Base classes shared across all variants.
const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ' +
  'disabled:pointer-events-none disabled:opacity-40 select-none'

const variants: Record<Variant, string> = {
  primary:
    'bg-amber-400 text-slate-900 hover:bg-amber-300 active:bg-amber-500',
  ghost:
    'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] active:bg-white/10',
  outline:
    'border border-white/10 text-[var(--text-secondary)] hover:border-white/20 hover:text-[var(--text-primary)] active:bg-white/5',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
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
    <button
      className={[base, variants[variant], sizes[size], className].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
