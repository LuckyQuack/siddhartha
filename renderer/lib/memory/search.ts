import { prisma } from '../db/client'
import { embedText } from '../embeddings/voyage'
import type { Highlight } from '@shared/types'

// Cosine similarity threshold above which a connection is shown in the margin.
// This is intentionally higher than the connection-finding threshold (0.78)
// used in background Inngest jobs — we only surface very strong matches
// while reading to avoid distraction.
export const MARGIN_INDICATOR_THRESHOLD = 0.85

// Number of related highlights to inject into the Claude system prompt.
export const MEMORY_CONTEXT_COUNT = 3

export interface RelatedHighlight {
  highlight: Highlight
  similarity: number
}

/**
 * Find the top-N semantically similar past highlights for a given query text.
 * Uses pgvector's <=> cosine distance operator via a raw Prisma query.
 *
 * Returns results sorted by similarity descending, filtered to >= threshold.
 */
export async function findRelatedHighlights(
  queryText: string,
  userId: string,
  options: {
    limit?: number
    threshold?: number
    excludeHighlightId?: string
  } = {}
): Promise<RelatedHighlight[]> {
  const {
    limit = MEMORY_CONTEXT_COUNT,
    threshold = MARGIN_INDICATOR_THRESHOLD,
    excludeHighlightId,
  } = options

  const queryEmbedding = await embedText(queryText)
  // pgvector expects the vector as a Postgres literal: '[0.1,0.2,...]'
  const vectorLiteral = `[${queryEmbedding.join(',')}]`

  // Raw query because Prisma's type-safe query builder does not yet support
  // pgvector operators natively. The cast to ::vector is required.
  type RawRow = Highlight & { similarity: number }

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      h.*,
      1 - (he.embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM highlight_embeddings he
    JOIN highlights h ON h.id = he.highlight_id
    WHERE
      h.user_id = ${userId}
      AND he.embedding_type = 'text_context'
      ${excludeHighlightId ? prisma.$queryRaw`AND h.id != ${excludeHighlightId}` : prisma.$queryRaw``}
      AND 1 - (he.embedding <=> ${vectorLiteral}::vector) >= ${threshold}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `

  return rows.map((row) => ({
    highlight: row as Highlight,
    similarity: Number(row.similarity),
  }))
}
