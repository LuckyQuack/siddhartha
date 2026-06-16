'use client'

interface HighlightTooltipProps {
  position: { x: number; y: number }
  onHighlight: () => void
  onDismiss: () => void
  saving?: boolean
}

export function HighlightTooltip({ position, onHighlight, onDismiss, saving }: HighlightTooltipProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onDismiss} />
      <div
        className="fixed z-50 flex items-center bg-[var(--surface-raised)] border border-white/10 rounded-lg shadow-2xl overflow-hidden"
        style={{ left: position.x, top: position.y, transform: 'translateY(-50%)' }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onHighlight() }}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-[var(--accent-highlight)] hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <span>✦</span>
          {saving ? 'Saving…' : 'Highlight'}
        </button>
      </div>
    </>
  )
}
