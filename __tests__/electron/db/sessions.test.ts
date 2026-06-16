/**
 * @jest-environment node
 */
import { freshDb, teardown, TEST_USER_ID } from './setup'
import type Database from 'better-sqlite3'
import { createBook } from '../../../electron/db/repositories/books'
import {
  startSession,
  endSession,
  getSessionById,
} from '../../../electron/db/repositories/sessions'

let db: Database.Database
let bookId: string

beforeEach(() => {
  db = freshDb()
  bookId = createBook({ user_id: TEST_USER_ID, title: 'Session Book' }).id
})

afterEach(() => {
  teardown(db)
})

describe('startSession', () => {
  it('creates a session with started_at set', () => {
    const session = startSession({ user_id: TEST_USER_ID, book_id: bookId })
    expect(session.id).toBeTruthy()
    expect(session.user_id).toBe(TEST_USER_ID)
    expect(session.book_id).toBe(bookId)
    expect(session.started_at).toBeTruthy()
    expect(session.ended_at).toBeNull()
    expect(session.pages_read).toBeNull()
  })
})

describe('endSession', () => {
  it('sets ended_at', () => {
    const session = startSession({ user_id: TEST_USER_ID, book_id: bookId })
    const ended = endSession(session.id)
    expect(ended).not.toBeNull()
    expect(ended!.ended_at).toBeTruthy()
  })

  it('records pages_read when provided', () => {
    const session = startSession({ user_id: TEST_USER_ID, book_id: bookId })
    const ended = endSession(session.id, 12)
    expect(ended!.pages_read).toBe(12)
  })

  it('is idempotent — second call leaves ended_at unchanged', () => {
    const session = startSession({ user_id: TEST_USER_ID, book_id: bookId })
    const first = endSession(session.id)
    const second = endSession(session.id)
    expect(second!.ended_at).toBe(first!.ended_at)
  })

  it('returns null for unknown session id', () => {
    expect(endSession('no-such-id')).toBeNull()
  })
})

describe('getSessionById', () => {
  it('returns null for unknown id', () => {
    expect(getSessionById('no-such-id')).toBeNull()
  })

  it('returns the session by id', () => {
    const session = startSession({ user_id: TEST_USER_ID, book_id: bookId })
    const found = getSessionById(session.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(session.id)
  })
})
