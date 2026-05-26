/**
 * @jest-environment jsdom
 *
 * Bug: EpubReader called ePub(url) without { openAs: 'epub' }, so epub.js
 * treated blob URLs as directory paths and fetched non-existent sub-files.
 *
 * Fix: ePub(url, { openAs: 'epub' }) forces epub.js to download the URL as
 * a packed zip and unpack it — the correct path for blob: and http: URLs.
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, waitFor } from '@testing-library/react'

// Define mocks INSIDE the factory to avoid jest hoisting/closure issues
jest.mock('epubjs', () => {
  const mockRendition = {
    display: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    destroy: jest.fn(),
  }
  const mockBook = {
    renderTo: jest.fn().mockReturnValue(mockRendition),
    destroy: jest.fn(),
  }
  const ePub = jest.fn().mockReturnValue(mockBook)
  // __esModule: true prevents esModuleInterop's __importDefault from double-wrapping
  // the mock, which would make .default an object rather than the callable jest.fn()
  return { __esModule: true, default: ePub }
})

import { EpubReader } from '../../renderer/components/reader/EpubReader'

describe('EpubReader', () => {
  it('calls epub.js with openAs: epub so blob URLs are loaded as packed EPUBs', async () => {
    const blobUrl = 'blob:http://localhost:3000/test-uuid-1234'
    render(<EpubReader url={blobUrl} />)

    const ePub = (jest.requireMock('epubjs') as { default: jest.Mock }).default

    await waitFor(() => expect(ePub).toHaveBeenCalled())

    expect(ePub).toHaveBeenCalledWith(blobUrl, { openAs: 'epub' })
  })
})
