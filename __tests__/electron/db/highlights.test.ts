/**
 * @jest-environment node
 */
import { freshDb, teardown, TEST_USER_ID } from './setup'
import type Database from 'better-sqlite3'
import { createBook } from '../../../electron/db/repositories/books'
import {
  createHighlight,
  getHighlightById,
  listHighlightsByBook,
  listHighlightsBySession,
} from '../../../electron/db/repositories/highlights'

let db: Database.Database
let bookId: string

const BASE_INPUT = {
  user_id: TEST_USER_ID,
  selected_text: 'A passage worth keeping.',
  context_before: 'Words before.',
  context_after: 'Words after.',
}

beforeEach(() => {
  db = freshDb()
  bookId = createBook({ user_id: TEST_USER_ID, title: 'Test Book' }).id
})

afterEach(() => {
  teardown(db)
})

describe('createHighlight', () => {
  it('creates a highlight with required fields', () => {
    const hl = createHighlight({ ...BASE_INPUT, book_id: bookId })
    expect(hl.id).toBeTruthy()
    expect(hl.selected_text).toBe(BASE_INPUT.selected_text)
    expect(hl.context_before).toBe(BASE_INPUT.context_before)
    expect(hl.context_after).toBe(BASE_INPUT.context_after)
    expect(hl.user_note).toBeNull()
    expect(hl.session_id).toBeNull()
  })

  it('stores optional metadata', () => {
    const hl = createHighlight({
      ...BASE_INPUT,
      book_id: bookId,
      user_note: 'Interesting idea',
      chapter: 'Chapter 3',
      page_number: 42,
      position_pct: 0.35,
      session_id: 'sess-abc',
    })
    expect(hl.user_note).toBe('Interesting idea')
    expect(hl.chapter).toBe('Chapter 3')
    expect(hl.page_number).toBe(42)
    expect(hl.position_pct).toBeCloseTo(0.35)
    expect(hl.session_id).toBe('sess-abc')
  })
})

describe('getHighlightById', () => {
  it('returns null for unknown id', () => {
    expect(getHighlightById('no-such-id')).toBeNull()
  })

  it('returns the highlight by id', () => {
    const created = createHighlight({ ...BASE_INPUT, book_id: bookId })
    const found = getHighlightById(created.id)
    expect(found).not.toBeNull()
    expect(found!.selected_text).toBe(BASE_INPUT.selected_text)
  })
})

describe('listHighlightsByBook', () => {
  it('returns empty array when book has no highlights', () => {
    expect(listHighlightsByBook(bookId, TEST_USER_ID)).toEqual([])
  })

  it('returns only highlights for the given book', () => {
    const otherBook = createBook({ user_id: TEST_USER_ID, title: 'Other' }).id
    createHighlight({ ...BASE_INPUT, book_id: bookId })
    createHighlight({ ...BASE_INPUT, book_id: otherBook })

    const results = listHighlightsByBook(bookId, TEST_USER_ID)
    expect(results).toHaveLength(1)
    expect(results[0].book_id).toBe(bookId)
  })

  it('filters by user_id', () => {
    createHighlight({ ...BASE_INPUT, book_id: bookId })
    expect(listHighlightsByBook(bookId, 'other-user')).toHaveLength(0)
  })
})

describe('listHighlightsBySession', () => {
  it('returns highlights grouped by session_id', () => {
    createHighlight({ ...BASE_INPUT, book_id: bookId, session_id: 'session-1' })
    createHighlight({ ...BASE_INPUT, book_id: bookId, session_id: 'session-1' })
    createHighlight({ ...BASE_INPUT, book_id: bookId, session_id: 'session-2' })

    expect(listHighlightsBySession('session-1')).toHaveLength(2)
    expect(listHighlightsBySession('session-2')).toHaveLength(1)
    expect(listHighlightsBySession('session-3')).toHaveLength(0)
  })
})
