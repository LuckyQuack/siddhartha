/**
 * @jest-environment jsdom
 *
 * EpubReader fetches the blob URL as an ArrayBuffer and passes it directly
 * to ePub() — this avoids the epub.js bug where blob: URLs were treated as
 * directory paths and caused 404s on sub-resource fetches.
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, waitFor } from '@testing-library/react'

// Mock fetch so jsdom doesn't error on network calls
const mockArrayBuffer = new ArrayBuffer(8)
global.fetch = jest.fn().mockResolvedValue({
  arrayBuffer: () => Promise.resolve(mockArrayBuffer),
}) as jest.Mock

jest.mock('epubjs', () => {
  const mockRendition = {
    display: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    destroy: jest.fn(),
    hooks: { content: { register: jest.fn() } },
  }
  const mockBook = {
    loaded: { navigation: Promise.resolve() },
    renderTo: jest.fn().mockReturnValue(mockRendition),
    destroy: jest.fn(),
  }
  const ePub = jest.fn().mockReturnValue(mockBook)
  return { __esModule: true, default: ePub }
})

import { EpubReader } from '../../renderer/components/reader/EpubReader'

describe('EpubReader', () => {
  it('fetches the URL and passes ArrayBuffer to epub.js (avoids blob URL sub-resource bug)', async () => {
    const blobUrl = 'blob:http://localhost:3000/test-uuid-1234'
    render(<EpubReader url={blobUrl} bookId="test-book" userId="test-user" />)

    const ePub = (jest.requireMock('epubjs') as { default: jest.Mock }).default

    await waitFor(() => expect(ePub).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(blobUrl)
    expect(ePub).toHaveBeenCalledWith(mockArrayBuffer)
  })
})
