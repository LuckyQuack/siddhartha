import type { Highlight } from '@shared/types'
import { supabase } from './supabase'

export type CreateHighlightInput = {
  user_id: string
  book_id: string
  selected_text: string
  context_before: string
  context_after: string
  user_note?: string | null
  chapter?: string | null
  page_number?: number | null
  position_pct?: number | null
  session_id?: string | null
}

export async function createHighlight(input: CreateHighlightInput): Promise<Highlight> {
  const { data, error } = await supabase
    .from('highlights')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`createHighlight: ${error.message}`)
  return data as Highlight
}

export async function getHighlightsByBook(bookId: string, userId: string): Promise<Highlight[]> {
  const { data, error } = await supabase
    .from('highlights')
    .select('*')
    .eq('book_id', bookId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`getHighlightsByBook: ${error.message}`)
  return (data ?? []) as Highlight[]
}
