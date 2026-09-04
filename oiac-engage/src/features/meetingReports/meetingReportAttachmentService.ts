import { MEETING_REPORT_ATTACHMENT_FLOW_URL } from '../../config/flowUrl.js'
import { normalizeGuid } from './meetingReportService'

export { MEETING_REPORT_ATTACHMENT_FLOW_URL }

export const MAX_ATTACHMENT_FILES = 10
export const MAX_ATTACHMENT_FILE_SIZE = 10 * 1024 * 1024
export const ATTACHMENT_FILE_NAME_PATTERN = /^[A-Za-z0-9_()-](?:[A-Za-z0-9 _()-]*[A-Za-z0-9_()-])?\.[A-Za-z0-9]+$/

const INVALID_FILE_NAME_MESSAGE = 'File names can contain only letters, numbers, spaces, hyphens, underscores, and parentheses, followed by a file extension.'

export type MeetingReportAttachment = {
  readonly attachmentId: string
  readonly fileName: string
  readonly fileUrl: string | null
  readonly contentType: string | null
  readonly size: number | null
}

export type AttachmentSelectionResult = {
  readonly files: readonly File[]
  readonly errors: readonly string[]
}

export class MeetingReportAttachmentFlowError extends Error {
  readonly status: number | null

  constructor(status: number | null = null) {
    super('The attachment request could not be completed.')
    this.name = 'MeetingReportAttachmentFlowError'
    this.status = status
  }
}

export function isValidAttachmentFileName(fileName: string): boolean {
  return ATTACHMENT_FILE_NAME_PATTERN.test(fileName)
}

export function validateAndMergeAttachmentFiles(
  current: readonly File[],
  incoming: readonly File[],
): AttachmentSelectionResult {
  const files = [...current]
  const errors: string[] = []
  const names = new Set(current.map((file) => file.name.toLowerCase()))

  for (const file of incoming) {
    const prefix = `${file.name}: `
    const normalizedName = file.name.toLowerCase()
    if (!isValidAttachmentFileName(file.name)) {
      errors.push(`${prefix}${INVALID_FILE_NAME_MESSAGE}`)
      continue
    }
    if (file.size === 0) {
      errors.push(`${prefix}Empty files cannot be uploaded.`)
      continue
    }
    if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
      errors.push(`${prefix}Files must be 10 MB or smaller.`)
      continue
    }
    if (names.has(normalizedName)) {
      errors.push(`${prefix}A file with this name is already selected.`)
      continue
    }
    if (files.length >= MAX_ATTACHMENT_FILES) {
      errors.push(`${prefix}You can select up to 10 files.`)
      continue
    }
    files.push(file)
    names.add(normalizedName)
  }

  return { files, errors }
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The selected file could not be read.'))
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('The selected file could not be read.'))
        return
      }
      const separator = reader.result.indexOf(',')
      if (separator < 0) {
        reject(new Error('The selected file could not be encoded.'))
        return
      }
      resolve(reader.result.slice(separator + 1))
    }
    reader.readAsDataURL(file)
  })
}

function requiredGuid(value: string, label: string): string {
  const normalized = normalizeGuid(value)
  if (!normalized) throw new Error(`${label} is invalid.`)
  return normalized
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function optionalHttpsUrl(value: unknown): string | null {
  const candidate = optionalText(value)
  if (!candidate) return null
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}

function optionalSize(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

function normalizeAttachment(value: unknown): MeetingReportAttachment {
  const record = object(value)
  const attachmentId = normalizeGuid(record?.attachmentId)
  const fileName = optionalText(record?.fileName)
  if (!record || !attachmentId || !fileName) {
    throw new Error('The attachment flow returned an invalid response.')
  }
  return {
    attachmentId,
    fileName,
    fileUrl: optionalHttpsUrl(record.fileUrl),
    contentType: optionalText(record.contentType),
    size: optionalSize(record.size),
  }
}

async function callAttachmentFlow(
  payload: Record<string, unknown>,
  acceptedStatuses: readonly number[],
  signal?: AbortSignal,
): Promise<{ readonly status: number; readonly body: unknown }> {
  let response: Response
  try {
    response = await fetch(MEETING_REPORT_ATTACHMENT_FLOW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch {
    throw new MeetingReportAttachmentFlowError()
  }

  if (!response.ok || !acceptedStatuses.includes(response.status)) {
    throw new MeetingReportAttachmentFlowError(response.status)
  }
  if (response.status === 204) return { status: response.status, body: null }

  try {
    return { status: response.status, body: await response.json() }
  } catch {
    throw new Error('The attachment flow returned an invalid response.')
  }
}

export async function listMeetingReportAttachments(
  meetingReportId: string,
  signal?: AbortSignal,
): Promise<readonly MeetingReportAttachment[]> {
  const normalizedReportId = requiredGuid(meetingReportId, 'Meeting Report identifier')
  const response = object((await callAttachmentFlow({
    operation: 'list',
    meetingReportId: normalizedReportId,
  }, [200], signal)).body)
  if (!response || !Array.isArray(response.attachments)) {
    throw new Error('The attachment flow returned an invalid response.')
  }
  return response.attachments.map(normalizeAttachment)
}

export async function uploadMeetingReportAttachment(
  meetingReportId: string,
  file: File,
): Promise<MeetingReportAttachment> {
  const normalizedReportId = requiredGuid(meetingReportId, 'Meeting Report identifier')
  const validation = validateAndMergeAttachmentFiles([], [file])
  if (validation.errors.length > 0) throw new Error(validation.errors[0])
  const response = object((await callAttachmentFlow({
    operation: 'upload',
    meetingReportId: normalizedReportId,
    file: {
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      contentBase64: await fileToBase64(file),
    },
  }, [200, 201])).body)
  if (!response || !('attachment' in response)) {
    throw new Error('The attachment flow returned an invalid response.')
  }
  return normalizeAttachment(response.attachment)
}

export async function deleteMeetingReportAttachment(
  meetingReportId: string,
  attachmentId: string,
): Promise<void> {
  const normalizedReportId = requiredGuid(meetingReportId, 'Meeting Report identifier')
  const normalizedAttachmentId = requiredGuid(attachmentId, 'Attachment identifier')
  const response = await callAttachmentFlow({
    operation: 'delete',
    meetingReportId: normalizedReportId,
    attachmentId: normalizedAttachmentId,
  }, [200, 204])
  if (response.status === 204) return
  const body = object(response.body)
  if (body?.deleted !== true || normalizeGuid(body.attachmentId) !== normalizedAttachmentId) {
    throw new Error('The attachment flow returned an invalid response.')
  }
}
