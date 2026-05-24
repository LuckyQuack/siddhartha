// Voyage AI embedding client.
// Model: voyage-3, which outputs 1024-dimensional vectors — matching the
// pgvector column definition in the schema.
//
// Fallback: if VOYAGE_API_KEY is absent, the caller should switch to
// OpenAI text-embedding-3-small (also 1024-dim with dimensions param).

export const VOYAGE_MODEL = 'voyage-3'
export const EMBEDDING_DIMENSIONS = 1024

interface VoyageEmbedResponse {
  data: Array<{ embedding: number[]; index: number }>
  model: string
  usage: { total_tokens: number }
}

/**
 * Embed one or more texts using Voyage AI.
 * Returns an array of 1024-dimensional float vectors in the same order
 * as the input texts.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new Error(
      'VOYAGE_API_KEY is not set. Add it to .env.local to enable embeddings.'
    )
  }

  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
      // voyage-3 default output dimension is 1024 — explicit for clarity.
      output_dimension: EMBEDDING_DIMENSIONS,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Voyage AI error ${response.status}: ${error}`)
  }

  const body = (await response.json()) as VoyageEmbedResponse

  // Re-sort by index in case the API returns them out of order.
  return body.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding)
}

/**
 * Embed a single text. Convenience wrapper around embedTexts.
 */
export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text])
  if (!embedding) throw new Error('Voyage AI returned no embedding')
  return embedding
}
