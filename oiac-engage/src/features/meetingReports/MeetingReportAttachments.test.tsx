import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
vi.mock('./meetingReportAttachmentService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./meetingReportAttachmentService')>()
  return { ...actual, viewAttachment: vi.fn() }
})
import {
  MeetingReportAttachmentFlowError,
  type AttachmentViewResult,
  type MeetingReportAttachment,
  viewAttachment,
} from './meetingReportAttachmentService'
import { MeetingReportAttachments, type MeetingReportAttachmentsProps } from './MeetingReportAttachments'

const selectedFile = new File(['hello'], 'Meeting Notes.pdf', { type: 'application/pdf' })
const existingAttachment: MeetingReportAttachment = {
  meetingReportId: '11111111-1111-4111-8111-111111111111',
  attachmentId: '22222222-2222-4222-8222-222222222222',
  fileName: 'Existing Report.pdf',
  contentType: 'application/pdf',
  size: 2048,
}

beforeEach(() => {
  vi.mocked(viewAttachment).mockReset()
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:attachment-view'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
})

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

test('replaces the existing Open link with a secure View button and keeps delete actions', async () => {
  const actor = userEvent.setup()
  const onDeleteExisting = vi.fn()
  renderAttachments({
    existingAttachments: [existingAttachment],
    listStatus: 'ready',
    onDeleteExisting,
  })

  expect(screen.queryByRole('link', { name: 'Open Existing Report.pdf' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'View Existing Report.pdf' })).toBeInTheDocument()
  expect(screen.getByText('2 KB')).toBeInTheDocument()
  await actor.click(screen.getByRole('button', { name: 'Delete Existing Report.pdf' }))

  expect(onDeleteExisting).toHaveBeenCalledWith(existingAttachment)
})

test('disables repeat View clicks while the same attachment is loading', async () => {
  let resolveView!: (result: AttachmentViewResult) => void
  vi.mocked(viewAttachment).mockReturnValue(new Promise((resolve) => { resolveView = resolve }))
  renderAttachments({ existingAttachments: [existingAttachment], listStatus: 'ready' })

  const viewButton = screen.getByRole('button', { name: 'View Existing Report.pdf' })
  fireEvent.click(viewButton)
  fireEvent.click(viewButton)

  expect(viewAttachment).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Loading Existing Report.pdf' })).toBeDisabled()

  resolveView({
    blob: new Blob(['pdf'], { type: 'application/pdf' }),
    fileName: 'Returned Notes.pdf',
    contentType: 'application/pdf',
  })
  expect(await screen.findByRole('dialog', { name: 'Preview Returned Notes.pdf' })).toBeInTheDocument()
})

test.each([
  ['application/pdf', 'Returned Notes.pdf', 'PDF preview of Returned Notes.pdf'],
  ['image/webp', 'Returned Photo.webp', 'Returned Photo.webp'],
  ['application/octet-stream', 'Returned Notes.PDF', 'PDF preview of Returned Notes.PDF'],
  ['application/octet-stream', 'Returned Photo.PNG', 'Returned Photo.PNG'],
])('routes %s content named %s to its browser preview', async (contentType, fileName, previewName) => {
  const actor = userEvent.setup()
  vi.mocked(viewAttachment).mockResolvedValue({
    blob: new Blob(['content'], { type: contentType }),
    fileName,
    contentType,
  })
  renderAttachments({ existingAttachments: [existingAttachment], listStatus: 'ready' })

  await actor.click(screen.getByRole('button', { name: 'View Existing Report.pdf' }))

  expect(await screen.findByRole('dialog', { name: `Preview ${fileName}` })).toBeInTheDocument()
  if (previewName.startsWith('PDF preview')) {
    expect(screen.getByTitle(previewName)).toBeInTheDocument()
  } else {
    expect(screen.getByRole('img', { name: previewName })).toBeInTheDocument()
  }
})

test('downloads unsupported content without opening a preview and revokes its temporary URL', async () => {
  const actor = userEvent.setup()
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  vi.mocked(viewAttachment).mockResolvedValue({
    blob: new Blob(['document'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    fileName: 'Returned Document.docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  renderAttachments({ existingAttachments: [existingAttachment], listStatus: 'ready' })

  await actor.click(screen.getByRole('button', { name: 'View Existing Report.pdf' }))

  expect(clickSpy).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(document.querySelector('a[download="Returned Document.docx"]')).not.toBeInTheDocument()
  await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:attachment-view'))
})

test('downloads an explicitly unsupported MIME type despite a previewable extension', async () => {
  const actor = userEvent.setup()
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  vi.mocked(viewAttachment).mockResolvedValue({
    blob: new Blob(['text'], { type: 'text/plain' }),
    fileName: 'Misleading.pdf',
    contentType: 'text/plain',
  })
  renderAttachments({ existingAttachments: [existingAttachment], listStatus: 'ready' })

  await actor.click(screen.getByRole('button', { name: 'View Existing Report.pdf' }))

  expect(clickSpy).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test.each([
  ['InvalidViewRequest', 'The file request is invalid. Refresh the page and try again.'],
  ['MeetingReportNotFound', 'This meeting report is unavailable or you do not have access to it.'],
  ['AttachmentNotFound', 'This attachment is unavailable or you do not have access to it.'],
  ['FileContentNotFound', 'The stored file content is unavailable.'],
  ['AttachmentLookupFailed', 'The attachment could not be retrieved. Try again.'],
])('shows the existing error UI for the %s flow error', async (code, message) => {
  const actor = userEvent.setup()
  const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
  vi.mocked(viewAttachment).mockRejectedValue(new MeetingReportAttachmentFlowError(404, code))
  renderAttachments({ existingAttachments: [existingAttachment], listStatus: 'ready' })

  await actor.click(screen.getByRole('button', { name: 'View Existing Report.pdf' }))

  expect(screen.getByRole('alert')).toHaveClass('form-alert')
  expect(screen.getByRole('alert')).toHaveTextContent(message)
  expect(alertSpy).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'View Existing Report.pdf' })).toBeEnabled()
})

test('returns focus to View after closing a preview', async () => {
  const actor = userEvent.setup()
  vi.mocked(viewAttachment).mockResolvedValue({
    blob: new Blob(['pdf'], { type: 'application/pdf' }),
    fileName: 'Returned Notes.pdf',
    contentType: 'application/pdf',
  })
  renderAttachments({ existingAttachments: [existingAttachment], listStatus: 'ready' })
  const viewButton = screen.getByRole('button', { name: 'View Existing Report.pdf' })

  await actor.click(viewButton)
  await actor.click(await screen.findByRole('button', { name: 'Close preview' }))

  expect(viewButton).toHaveFocus()
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
