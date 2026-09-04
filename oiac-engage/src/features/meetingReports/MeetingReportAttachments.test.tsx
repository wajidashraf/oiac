import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { MeetingReportAttachment } from './meetingReportAttachmentService'
import { MeetingReportAttachments, type MeetingReportAttachmentsProps } from './MeetingReportAttachments'

const selectedFile = new File(['hello'], 'Meeting Notes.pdf', { type: 'application/pdf' })
const existingAttachment: MeetingReportAttachment = {
  attachmentId: '22222222-2222-4222-8222-222222222222',
  fileName: 'Existing Report.pdf',
  fileUrl: 'https://contoso.sharepoint.com/Existing%20Report.pdf',
  contentType: 'application/pdf',
  size: 2048,
}

function renderAttachments(overrides: Partial<MeetingReportAttachmentsProps> = {}) {
  const props: MeetingReportAttachmentsProps = {
    selectedFiles: [],
    existingAttachments: [],
    listStatus: 'idle',
    selectionErrors: [],
    deletingAttachmentIds: new Set(),
    disabled: false,
    onFilesSelected: vi.fn(),
    onSelectedFileRemoved: vi.fn(),
    onDeleteExisting: vi.fn(),
    onRetryList: vi.fn(),
    ...overrides,
  }
  return { ...render(<MeetingReportAttachments {...props} />), props }
}

test('provides a multiple file input and forwards each selected file', async () => {
  const actor = userEvent.setup()
  const onFilesSelected = vi.fn()
  renderAttachments({ onFilesSelected })
  const input = screen.getByLabelText('Documents Provided')
  const secondFile = new File(['world'], 'report(1).txt', { type: 'text/plain' })

  expect(input).toHaveAttribute('type', 'file')
  expect(input).toHaveAttribute('name', 'documentsProvided')
  expect(input).toHaveAttribute('multiple')
  expect(screen.getByText(/70 MB combined/)).toBeInTheDocument()
  await actor.upload(input, [selectedFile, secondFile])

  expect(onFilesSelected).toHaveBeenCalledWith([selectedFile, secondFile])
  expect(input).toHaveValue('')
})

test('shows selected files with sizes and removes them locally', async () => {
  const actor = userEvent.setup()
  const onSelectedFileRemoved = vi.fn()
  renderAttachments({ selectedFiles: [selectedFile], onSelectedFileRemoved })

  expect(screen.getByRole('list', { name: 'Files selected for upload' })).toHaveTextContent('Meeting Notes.pdf')
  expect(screen.getByText('5 B')).toBeInTheDocument()
  await actor.click(screen.getByRole('button', { name: 'Remove Meeting Notes.pdf' }))

  expect(onSelectedFileRemoved).toHaveBeenCalledWith('Meeting Notes.pdf')
})

test('associates immediate selection errors with the file input', () => {
  renderAttachments({ selectionErrors: ['report&notes.pdf: File name is invalid.'] })

  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent('report&notes.pdf: File name is invalid.')
  expect(screen.getByLabelText('Documents Provided')).toHaveAttribute('aria-describedby', expect.stringContaining(alert.id))
})

test('renders existing attachments with safe links and delete actions', async () => {
  const actor = userEvent.setup()
  const onDeleteExisting = vi.fn()
  renderAttachments({
    existingAttachments: [existingAttachment],
    listStatus: 'ready',
    onDeleteExisting,
  })

  expect(screen.getByRole('link', { name: 'Open Existing Report.pdf' })).toHaveAttribute(
    'href',
    'https://contoso.sharepoint.com/Existing%20Report.pdf?web=1',
  )
  expect(screen.getByText('2 KB')).toBeInTheDocument()
  await actor.click(screen.getByRole('button', { name: 'Delete Existing Report.pdf' }))

  expect(onDeleteExisting).toHaveBeenCalledWith(existingAttachment)
})

test('shows attachment loading, empty, and retry states', async () => {
  const actor = userEvent.setup()
  const { rerender, props } = renderAttachments({ listStatus: 'loading' })
  expect(screen.getByRole('status')).toHaveTextContent('Loading uploaded documents')

  rerender(<MeetingReportAttachments {...props} listStatus="ready" />)
  expect(screen.getByText('No documents have been uploaded.')).toBeInTheDocument()

  rerender(<MeetingReportAttachments {...props} listStatus="error" />)
  expect(screen.getByRole('alert')).toHaveTextContent('Uploaded documents could not be loaded.')
  await actor.click(screen.getByRole('button', { name: 'Retry uploaded documents' }))
  expect(props.onRetryList).toHaveBeenCalledTimes(1)
})

test('disables file and item actions during save or deletion', () => {
  const { rerender, props } = renderAttachments({
    selectedFiles: [selectedFile],
    existingAttachments: [existingAttachment],
    listStatus: 'ready',
    disabled: true,
  })

  expect(screen.getByLabelText('Documents Provided')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Remove Meeting Notes.pdf' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Delete Existing Report.pdf' })).toBeDisabled()

  rerender(<MeetingReportAttachments
    {...props}
    disabled={false}
    deletingAttachmentIds={new Set([existingAttachment.attachmentId])}
  />)
  expect(screen.getByRole('button', { name: 'Deleting Existing Report.pdf' })).toBeDisabled()
})

test('resets the native input after a low-level change event', () => {
  const onFilesSelected = vi.fn()
  renderAttachments({ onFilesSelected })
  const input = screen.getByLabelText('Documents Provided') as HTMLInputElement

  fireEvent.change(input, { target: { files: [selectedFile] } })

  expect(onFilesSelected).toHaveBeenCalledWith([selectedFile])
  expect(input.value).toBe('')
})
