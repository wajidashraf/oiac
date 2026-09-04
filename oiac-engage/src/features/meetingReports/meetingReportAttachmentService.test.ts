import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  MAX_ATTACHMENT_FILE_SIZE,
  MEETING_REPORT_ATTACHMENT_FLOW_URL,
  MeetingReportAttachmentFlowError,
  deleteMeetingReportAttachment,
  fileToBase64,
  isValidAttachmentFileName,
  listMeetingReportAttachments,
  uploadMeetingReportAttachment,
  validateAndMergeAttachmentFiles,
} from './meetingReportAttachmentService'

const reportId = '11111111-1111-4111-8111-111111111111'
const attachmentId = '22222222-2222-4222-8222-222222222222'
const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function attachmentResponse(overrides: Record<string, unknown> = {}) {
  return {
    attachmentId,
    fileName: 'Meeting Notes_2026.pdf',
    fileUrl: 'https://contoso.sharepoint.com/Meeting%20Notes_2026.pdf',
    contentType: 'application/pdf',
    size: 5,
    ...overrides,
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('attachment selection validation', () => {
  test.each([
    'Meeting Notes_2026.pdf',
    'report(1).pdf',
    'meeting-notes.pdf',
    'Photo_01.JPG',
  ])('accepts the supported filename %s', (fileName) => {
    expect(isValidAttachmentFileName(fileName)).toBe(true)
  })

  test.each([
    ' report.pdf',
    'report .pdf',
    'report.final.pdf',
    'report&notes.pdf',
    '.env',
    'report',
  ])('rejects the unsupported filename %s', (fileName) => {
    expect(isValidAttachmentFileName(fileName)).toBe(false)
  })

  test('keeps valid files and reports invalid files from the same selection', () => {
    const valid = new File(['valid'], 'Meeting Notes.pdf', { type: 'application/pdf' })
    const invalid = new File(['invalid'], 'Meeting&Notes.pdf', { type: 'application/pdf' })

    const result = validateAndMergeAttachmentFiles([], [valid, invalid])

    expect(result.files).toEqual([valid])
    expect(result.errors).toEqual([
      'Meeting&Notes.pdf: File names can contain only letters, numbers, spaces, hyphens, underscores, and parentheses, followed by a file extension.',
    ])
  })

  test('rejects empty, oversized, and case-insensitive duplicate files', () => {
    const existing = new File(['saved'], 'Report.pdf', { type: 'application/pdf' })
    const empty = new File([], 'Empty.pdf', { type: 'application/pdf' })
    const oversized = new File(
      [new Uint8Array(MAX_ATTACHMENT_FILE_SIZE + 1)],
      'Large.pdf',
      { type: 'application/pdf' },
    )
    const duplicate = new File(['again'], 'report.PDF', { type: 'application/pdf' })

    const result = validateAndMergeAttachmentFiles([existing], [empty, oversized, duplicate])

    expect(result.files).toEqual([existing])
    expect(result.errors).toEqual([
      'Empty.pdf: Empty files cannot be uploaded.',
      'Large.pdf: Files must be 10 MB or smaller.',
      'report.PDF: A file with this name is already selected.',
    ])
  })

  test('rejects files after the ten-file selection limit', () => {
    const current = Array.from({ length: 10 }, (_, index) => (
      new File(['file'], `File_${index}.txt`, { type: 'text/plain' })
    ))
    const extra = new File(['extra'], 'Extra.txt', { type: 'text/plain' })

    const result = validateAndMergeAttachmentFiles(current, [extra])

    expect(result.files).toEqual(current)
    expect(result.errors).toEqual(['Extra.txt: You can select up to 10 files.'])
  })
})

describe('attachment flow operations', () => {
  test('lists and normalizes existing attachments', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      attachments: [attachmentResponse({ contentType: undefined, size: undefined })],
    }))

    await expect(listMeetingReportAttachments(reportId)).resolves.toEqual([{
      attachmentId,
      fileName: 'Meeting Notes_2026.pdf',
      fileUrl: 'https://contoso.sharepoint.com/Meeting%20Notes_2026.pdf',
      contentType: null,
      size: null,
    }])
    expect(fetchMock).toHaveBeenCalledWith(MEETING_REPORT_ATTACHMENT_FLOW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'list', meetingReportId: reportId }),
      signal: undefined,
    })
  })

  test('converts file content to base64 without a data URL prefix', async () => {
    const file = new File(['hello'], 'Meeting Notes.txt', { type: 'text/plain' })

    await expect(fileToBase64(file)).resolves.toBe('aGVsbG8=')
  })

  test('uploads one file with the normalized flow payload', async () => {
    const file = new File(['hello'], 'Meeting Notes.txt', { type: '' })
    fetchMock.mockResolvedValue(jsonResponse({
      attachment: attachmentResponse({
        fileName: 'Meeting Notes.txt',
        contentType: 'application/octet-stream',
      }),
    }, 201))

    await expect(uploadMeetingReportAttachment(reportId, file)).resolves.toMatchObject({
      attachmentId,
      fileName: 'Meeting Notes.txt',
    })

    const request = fetchMock.mock.calls[0][1]
    expect(JSON.parse(String(request?.body))).toEqual({
      operation: 'upload',
      meetingReportId: reportId,
      file: {
        fileName: 'Meeting Notes.txt',
        contentType: 'application/octet-stream',
        size: 5,
        contentBase64: 'aGVsbG8=',
      },
    })
  })

  test('deletes an attachment and accepts an empty 204 response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(deleteMeetingReportAttachment(reportId, attachmentId)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(MEETING_REPORT_ATTACHMENT_FLOW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'delete', meetingReportId: reportId, attachmentId }),
      signal: undefined,
    })
  })

  test('rejects malformed attachment responses', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ attachments: [{ fileName: 'Missing ID.pdf' }] }))

    await expect(listMeetingReportAttachments(reportId)).rejects.toThrow(
      'The attachment flow returned an invalid response.',
    )
  })

  test('returns a safe typed error without exposing the endpoint or file content', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      error: { code: 'RawFailure', message: MEETING_REPORT_ATTACHMENT_FLOW_URL },
    }, 500))

    const error = await listMeetingReportAttachments(reportId).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(MeetingReportAttachmentFlowError)
    expect(error).toMatchObject({ status: 500 })
    expect(String(error)).toBe('MeetingReportAttachmentFlowError: The attachment request could not be completed.')
    expect(String(error)).not.toContain('sig=')
  })
})
