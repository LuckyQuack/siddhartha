const WORD_BUDGET = 150

// Collect up to `budget` words by walking text nodes in `direction` from `node`.
function collectWords(
  node: Node,
  direction: 'backward' | 'forward',
  budget: number
): string {
  const root = node.getRootNode() as Document | ShadowRoot
  const walker = (root as Document).createTreeWalker
    ? (root as Document).createTreeWalker(root, NodeFilter.SHOW_TEXT)
    : document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  // Seek walker to the starting node
  let current: Node | null = walker.currentNode
  while (current && current !== node) {
    current = walker.nextNode()
  }

  const words: string[] = []

  if (direction === 'backward') {
    current = walker.previousNode()
    while (current && words.length < budget) {
      const text = current.textContent ?? ''
      const chunk = text.trim().split(/\s+/).filter(Boolean)
      words.unshift(...chunk)
      if (words.length >= budget) break
      current = walker.previousNode()
    }
    return words.slice(-budget).join(' ')
  } else {
    current = walker.nextNode()
    while (current && words.length < budget) {
      const text = current.textContent ?? ''
      const chunk = text.trim().split(/\s+/).filter(Boolean)
      words.push(...chunk)
      if (words.length >= budget) break
      current = walker.nextNode()
    }
    return words.slice(0, budget).join(' ')
  }
}

export function extractContext(
  range: Range,
  budget = WORD_BUDGET
): { contextBefore: string; contextAfter: string } {
  return {
    contextBefore: collectWords(range.startContainer, 'backward', budget),
    contextAfter: collectWords(range.endContainer, 'forward', budget),
  }
}

// Estimate 0-1 scroll position within a scrollable container.
export function scrollPositionPct(container: HTMLElement): number {
  const { scrollTop, scrollHeight, clientHeight } = container
  const max = scrollHeight - clientHeight
  return max > 0 ? Math.min(1, scrollTop / max) : 0
}
