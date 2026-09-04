import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../../config/flowUrl.js', () => ({
  MEETING_REPORT_ATTACHMENT_FLOW_URL: 'https://flow.example.test/meeting-report-attachments',
}))
import {
  MAX_ATTACHMENT_FILE_SIZE,
  MAX_ATTACHMENT_TOTAL_SIZE,
  MEETING_REPORT_ATTACHMENT_FLOW_URL,
  MeetingReportAttachmentFlowError,
  deleteMeetingReportAttachment,
  fileToBase64,
  isValidAttachmentFileName,
  listMeetingReportAttachments,
  uploadMeetingReportAttachments,
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

  test('accepts exactly 70 MB and rejects one additional byte', () => {
    const current = Array.from({ length: 6 }, (_, index) => (
      { name: `Existing_${index}.pdf`, size: 10 * 1024 * 1024 } as File
    ))
    const finalTenMb = { name: 'Final.pdf', size: 10 * 1024 * 1024 } as File
    const exactLimit = validateAndMergeAttachmentFiles(current, [finalTenMb])
    const oneByteOver = { name: 'Extra.pdf', size: 1 } as File

    const result = validateAndMergeAttachmentFiles(exactLimit.files, [oneByteOver])

    expect(MAX_ATTACHMENT_TOTAL_SIZE).toBe(70 * 1024 * 1024)
    expect(exactLimit.files).toEqual([...current, finalTenMb])
    expect(exactLimit.errors).toEqual([])
    expect(result.files).toEqual(exactLimit.files)
    expect(result.errors).toEqual(['Extra.pdf: Combined file size must be 70 MB or smaller.'])
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

  test('uploads all files in one request and returns per-file outcomes', async () => {
    const first = new File(['hello'], 'Meeting Notes.txt', { type: '' })
    const second = new File(['follow'], 'Follow-up.pdf', { type: 'application/pdf' })
    fetchMock.mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body))
      return jsonResponse({ results: [
        {
          clientFileId: body.files[0].clientFileId,
          fileName: first.name,
          status: 'succeeded',
          attachment: attachmentResponse({ fileName: first.name, contentType: 'application/octet-stream' }),
        },
        {
          clientFileId: body.files[1].clientFileId,
          fileName: second.name,
          status: 'failed',
          errorCode: 'SharePointUploadFailed',
        },
      ] })
    })

    const result = await uploadMeetingReportAttachments(reportId, [first, second])

    expect(result.succeededAttachments).toHaveLength(1)
    expect(result.failedFiles).toEqual([second])
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const request = fetchMock.mock.calls[0][1]
    expect(JSON.parse(String(request?.body))).toEqual(expect.objectContaining({
      operation: 'upload', meetingReportId: reportId,
      files: [expect.objectContaining({
        fileName: 'Meeting Notes.txt',
        contentType: 'application/octet-stream',
        size: 5,
        contentBase64: 'aGVsbG8=',
        clientFileId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      }), expect.objectContaining({ fileName: 'Follow-up.pdf' })],
    }))
  })

  test('reuses each client file ID when failed files are retried', async () => {
    const file = new File(['retry'], 'Retry.pdf', { type: 'application/pdf' })
    const requestIds: string[] = []
    fetchMock.mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body))
      requestIds.push(body.files[0].clientFileId)
      return jsonResponse({ results: [{
        clientFileId: body.files[0].clientFileId,
        fileName: file.name,
        status: 'failed',
      }] })
    })

    await uploadMeetingReportAttachments(reportId, [file])
    await uploadMeetingReportAttachments(reportId, [file])

    expect(requestIds[0]).toBe(requestIds[1])
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

  test('validates a successful 200 delete response before accepting it', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ deleted: true, attachmentId }))

    await expect(deleteMeetingReportAttachment(reportId, attachmentId)).resolves.toBeUndefined()

    fetchMock.mockResolvedValue(jsonResponse({ deleted: false, attachmentId }))
    await expect(deleteMeetingReportAttachment(reportId, attachmentId)).rejects.toThrow(
      'The attachment flow returned an invalid response.',
    )
  })

  test('rejects successful but unsupported operation statuses', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ attachments: [] }, 201))
    await expect(listMeetingReportAttachments(reportId)).rejects.toMatchObject({ status: 201 })

    fetchMock.mockResolvedValue(jsonResponse({ results: [] }, 202))
    await expect(uploadMeetingReportAttachments(reportId, [new File(['hello'], 'Report.pdf')]))
      .rejects.toMatchObject({ status: 202 })
  })

  test('rejects malformed attachment responses', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ attachments: [{ fileName: 'Missing ID.pdf' }] }))

    await expect(listMeetingReportAttachments(reportId)).rejects.toThrow(
      'The attachment flow returned an invalid response.',
    )

    fetchMock.mockResolvedValue(jsonResponse({ results: [] }))
    await expect(uploadMeetingReportAttachments(reportId, [new File(['hello'], 'Report.pdf')])).rejects.toThrow(
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
