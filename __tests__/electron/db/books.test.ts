/**
 * @jest-environment node
 */
import { freshDb, teardown, TEST_USER_ID } from './setup'
import type Database from 'better-sqlite3'
import {
  listBooks,
  getBookById,
  createBook,
  updateBook,
  touchLastOpened,
  deleteBook,
} from '../../../electron/db/repositories/books'

let db: Database.Database

beforeEach(() => {
  db = freshDb()
})

afterEach(() => {
  teardown(db)
})

describe('listBooks', () => {
  it('returns empty array when user has no books', () => {
    expect(listBooks(TEST_USER_ID)).toEqual([])
  })

  it('returns only books belonging to the user', () => {
    createBook({ user_id: TEST_USER_ID, title: 'Mine' })
    expect(listBooks('other-user')).toHaveLength(0)
    expect(listBooks(TEST_USER_ID)).toHaveLength(1)
  })
})

describe('createBook', () => {
  it('creates a book with required fields', () => {
    const book = createBook({ user_id: TEST_USER_ID, title: 'Dune' })
    expect(book.id).toBeTruthy()
    expect(book.title).toBe('Dune')
    expect(book.user_id).toBe(TEST_USER_ID)
    expect(book.author).toBeNull()
    expect(book.file_type).toBeNull()
  })

  it('creates a book with optional fields', () => {
    const book = createBook({
      user_id: TEST_USER_ID,
      title: 'Dune',
      author: 'Frank Herbert',
      file_type: 'epub',
    })
    expect(book.author).toBe('Frank Herbert')
    expect(book.file_type).toBe('epub')
  })
})

describe('getBookById', () => {
  it('returns null for unknown id', () => {
    expect(getBookById('no-such-id', TEST_USER_ID)).toBeNull()
  })

  it('returns the book when id and user_id match', () => {
    const created = createBook({ user_id: TEST_USER_ID, title: 'Foundation' })
    const found = getBookById(created.id, TEST_USER_ID)
    expect(found).not.toBeNull()
    expect(found!.title).toBe('Foundation')
  })

  it('returns null when user_id does not match', () => {
    const created = createBook({ user_id: TEST_USER_ID, title: 'Foundation' })
    expect(getBookById(created.id, 'wrong-user')).toBeNull()
  })
})

describe('updateBook', () => {
  it('patches only provided fields', () => {
    const book = createBook({ user_id: TEST_USER_ID, title: 'Original', author: 'Old Author' })
    const updated = updateBook(book.id, TEST_USER_ID, { title: 'Updated' })
    expect(updated.title).toBe('Updated')
    expect(updated.author).toBe('Old Author')
  })

  it('returns unchanged book when patch is empty', () => {
    const book = createBook({ user_id: TEST_USER_ID, title: 'Steady' })
    const result = updateBook(book.id, TEST_USER_ID, {})
    expect(result.title).toBe('Steady')
  })
})

describe('touchLastOpened', () => {
  it('sets last_opened on the book', () => {
    const book = createBook({ user_id: TEST_USER_ID, title: 'Touchable' })
    expect(book.last_opened).toBeNull()
    touchLastOpened(book.id, TEST_USER_ID)
    const after = getBookById(book.id, TEST_USER_ID)!
    expect(after.last_opened).not.toBeNull()
  })
})

describe('deleteBook', () => {
  it('removes the book', () => {
    const book = createBook({ user_id: TEST_USER_ID, title: 'Temporary' })
    deleteBook(book.id, TEST_USER_ID)
    expect(getBookById(book.id, TEST_USER_ID)).toBeNull()
  })

  it('is a no-op for unknown id', () => {
    expect(() => deleteBook('no-such-id', TEST_USER_ID)).not.toThrow()
  })
})
