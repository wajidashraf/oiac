import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { AttachmentViewResult } from './meetingReportAttachmentService'
import { AttachmentPreviewModal } from './AttachmentPreviewModal'

const pdfResult: AttachmentViewResult = {
  blob: new Blob(['pdf'], { type: 'application/pdf' }),
  fileName: 'Returned Notes.pdf',
  contentType: 'application/pdf',
}

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:attachment-preview'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AttachmentPreviewModal', () => {
  test('previews a PDF, downloads it, closes, revokes its URL, and restores focus', async () => {
    const actor = userEvent.setup()
    const onClose = vi.fn()
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const { unmount } = render(
      <AttachmentPreviewModal
        result={pdfResult}
        kind="pdf"
        returnFocusTo={trigger}
        onClose={onClose}
      />,
    )

    expect(await screen.findByRole('dialog', { name: 'Preview Returned Notes.pdf' })).toBeInTheDocument()
    expect(screen.getByTitle('PDF preview of Returned Notes.pdf')).toHaveAttribute('src', 'blob:attachment-preview')
    expect(screen.getByRole('link', { name: 'Download Returned Notes.pdf' })).toHaveAttribute(
      'download',
      'Returned Notes.pdf',
    )
    expect(screen.getByRole('button', { name: 'Close preview' })).toHaveFocus()

    await actor.click(screen.getByRole('button', { name: 'Close preview' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:attachment-preview')
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveFocus()
    trigger.remove()
  })

  test('renders a responsive image preview with the original filename', async () => {
    const imageResult: AttachmentViewResult = {
      blob: new Blob(['image'], { type: 'image/png' }),
      fileName: 'Returned Photo.png',
      contentType: 'image/png',
    }

    render(
      <AttachmentPreviewModal result={imageResult} kind="image" returnFocusTo={null} onClose={vi.fn()} />,
    )

    expect(await screen.findByRole('dialog', { name: 'Preview Returned Photo.png' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Returned Photo.png' })).toHaveAttribute(
      'src',
      'blob:attachment-preview',
    )
  })

  test('closes on Escape and revokes the active URL on unmount', async () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <AttachmentPreviewModal result={pdfResult} kind="pdf" returnFocusTo={null} onClose={onClose} />,
    )
    await screen.findByRole('dialog')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  test('revokes the active URL when removed without using a control', async () => {
    const { unmount } = render(
      <AttachmentPreviewModal result={pdfResult} kind="pdf" returnFocusTo={null} onClose={vi.fn()} />,
    )
    await screen.findByRole('dialog')

    unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:attachment-preview')
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })
})
