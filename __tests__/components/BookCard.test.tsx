/**
 * @jest-environment jsdom
 *
 * Bug: BookCard renders <img src={cover_url}> when cover_url is set but has no
 * onError handler. If the cover URL is inaccessible (private Supabase bucket,
 * or extraction failed and URL is stale), the broken image shows — the gradient
 * fallback never renders.
 *
 * Expected: when the img fires an error event, the gradient fallback renders
 * instead (cover_url treated as unavailable).
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { BookCard } from '../../renderer/components/library/BookCard'
import type { Book } from '../../shared/types'

const mockBook: Book = {
  id: 'book-1',
  user_id: 'user-1',
  title: 'The Trial',
  author: 'Franz Kafka',
  file_path: 'user-1/trial.epub',
  file_type: 'epub',
  cover_url: 'https://cdn.example.com/cover.jpg',
  total_pages: null,
  created_at: new Date().toISOString(),
  last_opened: null,
}

describe('BookCard', () => {
  it('shows gradient fallback when cover image fails to load', () => {
    const { container, queryByRole } = render(
      <BookCard book={mockBook} onClick={jest.fn()} />
    )

    const img = container.querySelector('img')
    expect(img).toBeInTheDocument()

    // Simulate network error loading the cover
    fireEvent.error(img!)

    // FAILS currently: no onError handler, img stays in DOM
    // After fix: img should be gone, gradient div should render
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders gradient immediately when cover_url is null', () => {
    const bookWithoutCover: Book = { ...mockBook, cover_url: null }
    const { container } = render(
      <BookCard book={bookWithoutCover} onClick={jest.fn()} />
    )
    expect(container.querySelector('img')).toBeNull()
    // Gradient container uses a linear-gradient background style
    const gradient = container.querySelector('[style*="linear-gradient"]')
    expect(gradient).toBeInTheDocument()
  })
})
