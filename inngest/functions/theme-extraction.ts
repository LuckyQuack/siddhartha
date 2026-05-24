import { inngest } from '../client'
import { CLAUDE_MODEL } from '../../renderer/lib/api/claude'

// Inngest job: extract 2-4 themes from each new highlight using Claude.
// Runs after a reading session ends. Must be idempotent — if a highlight
// already has themes, skip it rather than duplicating rows.

export const extractThemes = inngest.createFunction(
  { id: 'extract-themes', name: 'Extract highlight themes' },
  { event: 'highlight/session.ended' },
  async ({ event, step }) => {
    const { highlightIds, userId } = event.data as {
      highlightIds: string[]
      userId: string
    }

    for (const highlightId of highlightIds) {
      await step.run(`extract-themes-${highlightId}`, async () => {
        // Idempotency: check if themes already exist for this highlight.
        const existing = await fetchExistingThemes(highlightId)
        if (existing > 0) return { skipped: true, highlightId }

        const highlight = await fetchHighlight(highlightId, userId)
        if (!highlight) return { skipped: true, highlightId, reason: 'not found' }

        const themes = await callClaudeForThemes(highlight.selected_text, highlight.context_before, highlight.context_after)

        await persistThemes(highlightId, themes)
        return { highlightId, themes }
      })
    }
  }
)

// ─── Helpers (implemented in later steps when Prisma schema is wired) ─────────

async function fetchExistingThemes(highlightId: string): Promise<number> {
  // TODO step 8: prisma.highlight_theme.count({ where: { highlight_id: highlightId } })
  void highlightId
  return 0
}

async function fetchHighlight(
  highlightId: string,
  userId: string
): Promise<{ selected_text: string; context_before: string; context_after: string } | null> {
  // TODO step 8: prisma.highlight.findFirst(...)
  void highlightId
  void userId
  return null
}

async function callClaudeForThemes(
  selectedText: string,
  contextBefore: string,
  contextAfter: string
): Promise<Array<{ theme: string; confidence: number }>> {
  const prompt = [
    'Extract 2-4 intellectual themes from this highlighted passage.',
    'Return a JSON array: [{"theme": "...", "confidence": 0.0-1.0}]',
    'Themes should be concise (2-5 words), conceptual, and reusable across books.',
    '',
    `Context before: ${contextBefore}`,
    `Highlighted: ${selectedText}`,
    `Context after: ${contextAfter}`,
  ].join('\n')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) throw new Error(`Claude theme extraction failed: ${response.status}`)

  type ClaudeResponse = { content: Array<{ type: string; text: string }> }
  const body = (await response.json()) as ClaudeResponse
  const text = body.content.find((c) => c.type === 'text')?.text ?? '[]'

  // Extract the JSON array from Claude's response — it may include prose.
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []

  return JSON.parse(match[0]) as Array<{ theme: string; confidence: number }>
}

async function persistThemes(
  highlightId: string,
  themes: Array<{ theme: string; confidence: number }>
): Promise<void> {
  // TODO step 8: prisma.highlight_theme.createMany(...)
  void highlightId
  void themes
}
