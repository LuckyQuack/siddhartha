import type { Book } from '@shared/types'
import { supabase } from './supabase'

export type CreateBookInput = {
  user_id: string
  title: string
  author?: string | null
  file_path?: string | null
  file_type?: 'pdf' | 'epub' | null
  cover_url?: string | null
  total_pages?: number | null
}

export async function getBooks(userId: string): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('user_id', userId)
    .order('last_opened', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getBooks: ${error.message}`)
  return (data ?? []) as Book[]
}

export async function createBook(input: CreateBookInput): Promise<Book> {
  const { data, error } = await supabase
    .from('books')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`createBook: ${error.message}`)
  return data as Book
}

export async function updateLastOpened(bookId: string): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ last_opened: new Date().toISOString() })
    .eq('id', bookId)

  if (error) throw new Error(`updateLastOpened: ${error.message}`)
}

export async function deleteBook(bookId: string): Promise<void> {
  const { error } = await supabase.from('books').delete().eq('id', bookId)
  if (error) throw new Error(`deleteBook: ${error.message}`)
}
