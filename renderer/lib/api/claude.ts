// Claude API client — all calls are streamed via ReadableStream.
// Never block waiting for a full completion; always use the streaming path.
//
// Model is pinned here as the single source of truth. Update this constant
// when Anthropic releases a newer model we want to adopt.

export const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

// Maximum tokens for an in-reader explanation. Keep responses concise so
// the AI panel doesn't dominate the reading experience.
export const EXPLANATION_TOKEN_BUDGET = 500

export interface ExplainParams {
  selectedText: string
  contextBefore: string
  contextAfter: string
  bookTitle: string
  chapter: string | null
  /** Top-3 semantically similar past highlights from the memory engine. */
  relatedHighlights: Array<{ text: string; bookTitle: string }>
  userQuestion?: string
}

/**
 * Stream an explanation of a highlighted passage from Claude.
 * Returns a ReadableStream<string> of text chunks.
 *
 * Callers must have ANTHROPIC_API_KEY set in the environment.
 * This function is safe to call from Next.js API routes (server-side only).
 */
export async function explainHighlight(params: ExplainParams): Promise<ReadableStream<string>> {
  const systemPrompt = buildSystemPrompt(params)
  const userMessage = params.userQuestion ?? 'Explain this passage and why it matters.'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: EXPLANATION_TOKEN_BUDGET,
      stream: true,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API error ${response.status}: ${error}`)
  }

  if (!response.body) {
    throw new Error('Claude API returned no body')
  }

  // Transform the raw SSE stream into a stream of text delta strings.
  return response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(sseToTextDeltas())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSystemPrompt(params: ExplainParams): string {
  const memory =
    params.relatedHighlights.length > 0
      ? params.relatedHighlights
          .map((h, i) => `${i + 1}. "${h.text}" — from ${h.bookTitle}`)
          .join('\n')
      : 'None yet.'

  return [
    `You are a thoughtful reading companion helping a reader understand and connect ideas.`,
    ``,
    `CURRENT BOOK: ${params.bookTitle}`,
    params.chapter ? `CURRENT CHAPTER: ${params.chapter}` : '',
    ``,
    `SURROUNDING PASSAGE:`,
    `[before] ${params.contextBefore}`,
    `[selected] ${params.selectedText}`,
    `[after] ${params.contextAfter}`,
    ``,
    `READER'S PAST RELATED HIGHLIGHTS:`,
    memory,
    ``,
    `Respond in 2-4 paragraphs. Be intellectually generous but concise. ` +
      `If the reader has related past highlights, briefly note the connection — ` +
      `this is how memory surfaces meaning across years of reading.`,
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * TransformStream that parses Anthropic's SSE format and emits only
 * the text_delta string values.
 */
function sseToTextDeltas(): TransformStream<string, string> {
  return new TransformStream({
    transform(chunk, controller) {
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const json = line.slice(6).trim()
        if (json === '[DONE]') continue

        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const event = JSON.parse(json)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (event?.type === 'content_block_delta' && event?.delta?.type === 'text_delta') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            controller.enqueue(event.delta.text as string)
          }
        } catch {
          // Malformed SSE line — skip silently. Partial chunks are normal
          // when the HTTP response arrives in multiple TCP segments.
        }
      }
    },
  })
}
