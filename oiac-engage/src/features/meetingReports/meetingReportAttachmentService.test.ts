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
  listMeetingReportPageAttachments,
  uploadMeetingReportAttachments,
  validateAndMergeAttachmentFiles,
  viewAttachment,
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
    meetingReportId: reportId,
    attachmentId,
    fileName: 'Meeting Notes_2026.pdf',
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
  test('views an attachment with only its Dataverse identifiers and reads successful content as a Blob', async () => {
    const response = new Response('pdf content', {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf; charset=binary',
        'X-File-Name': 'Original Meeting Notes.pdf',
      },
    })
    const jsonSpy = vi.spyOn(response, 'json')
    fetchMock.mockResolvedValue(response)

    const result = await viewAttachment({
      meetingReportId: reportId,
      attachmentId,
      fileName: 'Dataverse Name.pdf',
      contentType: 'image/png',
    })

    expect(fetchMock).toHaveBeenCalledWith(MEETING_REPORT_ATTACHMENT_FLOW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'view', meetingReportId: reportId, attachmentId }),
      signal: undefined,
    })
    expect(jsonSpy).not.toHaveBeenCalled()
    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.blob.size).toBeGreaterThan(0)
    expect(result).toMatchObject({
      fileName: 'Original Meeting Notes.pdf',
      contentType: 'application/pdf',
    })
  })

  test('falls back to Dataverse metadata when binary response headers are absent', async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))

    const result = await viewAttachment({
      meetingReportId: `{${reportId.toUpperCase()}}`,
      attachmentId: `{${attachmentId.toUpperCase()}}`,
      fileName: 'Dataverse Image.png',
      contentType: 'image/png',
    })

    expect(result).toMatchObject({ fileName: 'Dataverse Image.png', contentType: 'image/png' })
    expect(result.blob.type).toBe('image/png')
  })

  test.each([
    'InvalidViewRequest',
    'MeetingReportNotFound',
    'AttachmentNotFound',
    'FileContentNotFound',
    'AttachmentLookupFailed',
  ])('returns the safe flow error code %s for a failed view', async (code) => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code, message: 'Sensitive flow detail' } }, 404))

    const error = await viewAttachment({
      meetingReportId: reportId,
      attachmentId,
      fileName: 'Meeting Notes.pdf',
      contentType: 'application/pdf',
    }).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(MeetingReportAttachmentFlowError)
    expect(error).toMatchObject({ status: 404, code })
    expect(String(error)).not.toContain('Sensitive flow detail')
  })

  test('returns a safe typed error for malformed error JSON and network failures', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 500 }))

    await expect(viewAttachment({
      meetingReportId: reportId,
      attachmentId,
      fileName: 'Meeting Notes.pdf',
      contentType: null,
    })).rejects.toMatchObject({ status: 500, code: null })

    fetchMock.mockRejectedValueOnce(new Error('https://flow.example.test?sig=secret'))

    const networkError = await viewAttachment({
      meetingReportId: reportId,
      attachmentId,
      fileName: 'Meeting Notes.pdf',
      contentType: null,
    }).catch((reason: unknown) => reason)
    expect(networkError).toMatchObject({ status: null, code: null })
    expect(String(networkError)).not.toContain('sig=secret')
  })

  test('loads safe Dataverse attachment metadata and preserves each row independently', async () => {
    const secondReportId = '33333333-3333-4333-8333-333333333333'
    fetchMock.mockResolvedValue(jsonResponse({
      value: [
        {
          mss_attachmentsid: attachmentId,
          mss_attachmentname: 'Meeting Notes.pdf',
          mss_filesize: 2048,
          mss_filetype: 'application/pdf',
          _mss_meetingreport_value: reportId,
          mss_sharepointfileid: 'different-connector-file-id',
          mss_sharepointfilepath: '/Shared Documents/report/Meeting Notes.pdf',
          mss_sharepointfileurl: 'https://contoso.sharepoint.com/Shared%20Documents/report/Meeting%20Notes.pdf',
          mss_shareablelink: 'https://contoso.sharepoint.com/:b:/r/sites/OIAC/wrong-link.pdf?e=abc123',
        },
        {
          mss_attachmentsid: '44444444-4444-4444-8444-444444444444',
          mss_attachmentname: 'Duplicate row.pdf',
          mss_filesize: 2048,
          mss_filetype: 'application/pdf',
          _mss_meetingreport_value: reportId,
          mss_sharepointfileid: 'shared-documents/report/meeting-notes.pdf',
          mss_sharepointfilepath: '/Shared Documents/report/Alias.pdf',
          mss_sharepointfileurl: 'https://contoso.sharepoint.com/Shared%20Documents/report/Alias.pdf',
        },
        {
          mss_attachmentsid: '66666666-6666-4666-8666-666666666666',
          mss_attachmentname: 'Third duplicate row.pdf',
          mss_filesize: 2048,
          mss_filetype: 'application/pdf',
          _mss_meetingreport_value: reportId,
          mss_sharepointfileid: 'shared-documents/report/meeting-notes.pdf',
          mss_sharepointfilepath: '/Shared Documents/report/Meeting Notes.pdf',
          mss_sharepointfileurl: 'https://contoso.sharepoint.com/Shared%20Documents/report/Meeting%20Notes.pdf',
        },
        {
          mss_attachmentsid: '55555555-5555-4555-8555-555555555555',
          mss_attachmentname: 'District data.xlsx',
          mss_filesize: 4096,
          mss_filetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          _mss_meetingreport_value: secondReportId,
          mss_sharepointfileid: 'shared-documents/report/district-data.xlsx',
          mss_sharepointfilepath: '/Shared Documents/report/District data.xlsx',
          mss_sharepointfileurl: 'javascript:alert(1)',
          mss_shareablelink: 'https://contoso.sharepoint.com/:x:/r/sites/OIAC/wrong-link.xlsx?e=def456',
        },
      ],
    }))

    const result = await listMeetingReportPageAttachments([reportId, secondReportId])

    expect(result.get(reportId)).toEqual([
      {
        meetingReportId: reportId,
        attachmentId,
        fileName: 'Meeting Notes.pdf',
        contentType: 'application/pdf',
        size: 2048,
      },
      {
        meetingReportId: reportId,
        attachmentId: '44444444-4444-4444-8444-444444444444',
        fileName: 'Duplicate row.pdf',
        contentType: 'application/pdf',
        size: 2048,
      },
      {
        meetingReportId: reportId,
        attachmentId: '66666666-6666-4666-8666-666666666666',
        fileName: 'Third duplicate row.pdf',
        contentType: 'application/pdf',
        size: 2048,
      },
    ])
    expect(result.get(secondReportId)).toEqual([{
      meetingReportId: secondReportId,
      attachmentId: '55555555-5555-4555-8555-555555555555',
      fileName: 'District data.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 4096,
    }])
    const [requestUrl, requestInit] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(String(requestUrl), 'https://portal.example')
    expect(parsedUrl.pathname).toBe('/_api/mss_attachmentses')
    expect(parsedUrl.searchParams.get('$filter')).toBe(
      `_mss_meetingreport_value eq ${reportId} or _mss_meetingreport_value eq ${secondReportId}`,
    )
    expect(parsedUrl.searchParams.get('$select')).toBe(
      'mss_attachmentsid,mss_attachmentname,mss_filesize,mss_filetype,_mss_meetingreport_value',
    )
    for (const forbidden of [
      'mss_sharepointfileurl',
      'mss_sharepointfilepath',
      'mss_sharepointfileid',
      'mss_clientfileid',
    ]) expect(parsedUrl.searchParams.get('$select')).not.toContain(forbidden)
    expect(requestInit).toEqual(expect.objectContaining({ credentials: 'same-origin' }))
  })

  test('lists and normalizes existing attachments', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      value: [{
        mss_attachmentsid: attachmentId,
        mss_attachmentname: 'Meeting Notes_2026.pdf',
        mss_filetype: null,
        mss_filesize: null,
        _mss_meetingreport_value: reportId,
        mss_sharepointfileid: 'meeting-notes-file-id',
        mss_sharepointfilepath: '/Shared Documents/Meeting Notes_2026.pdf',
        mss_sharepointfileurl: 'https://contoso.sharepoint.com/Meeting%20Notes_2026.pdf',
        mss_shareablelink: 'https://contoso.sharepoint.com/:b:/r/sites/OIAC/wrong-link.pdf?e=ghi789',
      }],
    }))

    await expect(listMeetingReportAttachments(reportId)).resolves.toEqual([{
      meetingReportId: reportId,
      attachmentId,
      fileName: 'Meeting Notes_2026.pdf',
      contentType: null,
      size: null,
    }])
    const [requestUrl] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(String(requestUrl), 'https://portal.example')
    expect(parsedUrl.pathname).toBe('/_api/mss_attachmentses')
    expect(parsedUrl.searchParams.get('$filter')).toBe(`_mss_meetingreport_value eq ${reportId}`)
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
    const duplicateAttachmentId = '33333333-3333-4333-8333-333333333333'

    await expect(deleteMeetingReportAttachment(
      reportId,
      attachmentId,
      [duplicateAttachmentId],
    )).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(1, MEETING_REPORT_ATTACHMENT_FLOW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'delete', meetingReportId: reportId, attachmentId }),
      signal: undefined,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, MEETING_REPORT_ATTACHMENT_FLOW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'delete', meetingReportId: reportId, attachmentId: duplicateAttachmentId }),
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

  test('retries duplicate cleanup after the primary attachment was already deleted', async () => {
    const duplicateAttachmentId = '33333333-3333-4333-8333-333333333333'
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'TemporaryFailure' } }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'AttachmentNotFound' } }, 404))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(deleteMeetingReportAttachment(reportId, attachmentId, [duplicateAttachmentId]))
      .rejects.toMatchObject({ status: 500 })
    await expect(deleteMeetingReportAttachment(reportId, attachmentId, [duplicateAttachmentId]))
      .resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  test('rejects successful but unsupported operation statuses', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }, 202))
    await expect(uploadMeetingReportAttachments(reportId, [new File(['hello'], 'Report.pdf')]))
      .rejects.toMatchObject({ status: 202 })
  })

  test('rejects malformed attachment responses', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ value: [{
      mss_attachmentname: 'Missing ID.pdf',
      _mss_meetingreport_value: reportId,
    }] }))

    await expect(listMeetingReportAttachments(reportId)).rejects.toThrow(
      'Attachment identifier is invalid.',
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

    const error = await deleteMeetingReportAttachment(reportId, attachmentId).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(MeetingReportAttachmentFlowError)
    expect(error).toMatchObject({ status: 500 })
    expect(String(error)).toBe('MeetingReportAttachmentFlowError: The attachment request could not be completed.')
    expect(String(error)).not.toContain('sig=')
  })
})
