'use client'

interface SelectionToolbarProps {
  rect: DOMRect
  onHighlight: () => void
  onDismiss: () => void
  saving?: boolean
}

const TOOLBAR_HEIGHT = 40

export function SelectionToolbar({ rect, onHighlight, onDismiss, saving }: SelectionToolbarProps) {
  const centerX = rect.left + rect.width / 2

  // Flip below if not enough space above
  const showAbove = rect.top > TOOLBAR_HEIGHT + 16
  const top = showAbove ? rect.top - TOOLBAR_HEIGHT - 10 : rect.bottom + 10

  return (
    <>
      {/* Invisible backdrop — click anywhere outside toolbar to dismiss */}
      <div className="fixed inset-0 z-40" onMouseDown={onDismiss} />
      <div
        className="fixed z-50 flex items-center bg-[var(--accent-primary)] rounded-lg shadow-2xl overflow-hidden"
        style={{ left: centerX, top, transform: 'translateX(-50%)' }}
      >
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onHighlight() }}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#f5efe6] hover:bg-white/10 transition-colors disabled:opacity-50 font-serif"
        >
          <span className="text-[var(--accent-highlight)]">✦</span>
          {saving ? 'Saving…' : 'Highlight'}
        </button>
        <div className="w-px h-4 bg-white/20" />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss() }}
          className="px-3 py-2 text-xs text-white/60 hover:text-white/90 transition-colors"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </>
  )
}
