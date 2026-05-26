/**
 * @jest-environment jsdom
 *
 * Bug: BookGrid uses gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))'
 * The 1fr has no upper bound, so with 1–2 books the card can grow to 600px+ wide,
 * making long titles dominate the layout ("takes up entire library").
 *
 * Expected: grid columns have a maximum of 160px so cards stay book-sized.
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render } from '@testing-library/react'
import { BookGrid } from '../../renderer/components/library/BookGrid'
import type { Book } from '../../shared/types'

const mockBook: Book = {
  id: 'book-1',
  user_id: 'user-1',
  title: 'A Very Long Title That Would Normally Expand The Entire Grid Layout',
  author: 'Author Name',
  file_path: 'user-1/book.epub',
  file_type: 'epub',
  cover_url: null,
  total_pages: null,
  created_at: new Date().toISOString(),
  last_opened: null,
}

describe('BookGrid', () => {
  it('caps column width so cards do not expand beyond 160px with few books', () => {
    const { container } = render(
      <BookGrid books={[mockBook]} onBookClick={jest.fn()} />
    )

    const grid = container.querySelector('[style]') as HTMLElement | null
    const style = grid?.style.gridTemplateColumns ?? ''

    // FAILS currently: style contains '1fr' which has no upper bound
    // After fix: should use minmax(120px, 160px) or similar fixed max
    expect(style).not.toContain('1fr')
    expect(style).toContain('160px')
  })
})
