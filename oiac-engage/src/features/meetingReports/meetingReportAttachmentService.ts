import { MEETING_REPORT_ATTACHMENT_FLOW_URL } from '../../config/flowUrl.js'
import { powerPagesFetch } from '../../shared/powerPagesApi'
import { normalizeGuid } from './meetingReportService'

export { MEETING_REPORT_ATTACHMENT_FLOW_URL }

export const MAX_ATTACHMENT_FILES = 10
export const MAX_ATTACHMENT_FILE_SIZE = 10 * 1024 * 1024
export const MAX_ATTACHMENT_TOTAL_SIZE = 70 * 1024 * 1024
export const ATTACHMENT_FILE_NAME_PATTERN = /^[A-Za-z0-9_()-](?:[A-Za-z0-9 _()-]*[A-Za-z0-9_()-])?\.[A-Za-z0-9]+$/

const INVALID_FILE_NAME_MESSAGE = 'File names can contain only letters, numbers, spaces, hyphens, underscores, and parentheses, followed by a file extension.'

export type MeetingReportAttachment = {
  readonly attachmentId: string
  readonly duplicateAttachmentIds?: readonly string[]
  readonly fileName: string
  readonly fileUrl: string | null
  readonly contentType: string | null
  readonly size: number | null
}

export type AttachmentSelectionResult = {
  readonly files: readonly File[]
  readonly errors: readonly string[]
}

export type AttachmentBatchUploadResult = {
  readonly succeededAttachments: readonly MeetingReportAttachment[]
  readonly failedFiles: readonly File[]
}

type DataverseAttachmentRecord = {
  readonly mss_attachmentsid?: unknown
  readonly mss_attachmentname?: unknown
  readonly mss_filesize?: unknown
  readonly mss_filetype?: unknown
  readonly _mss_meetingreport_value?: unknown
  readonly mss_sharepointfileid?: unknown
  readonly mss_sharepointfilepath?: unknown
  readonly mss_shareablelink?: unknown
}

const ATTACHMENT_LIST_SELECT = [
  'mss_attachmentsid',
  'mss_attachmentname',
  'mss_filesize',
  'mss_filetype',
  '_mss_meetingreport_value',
  'mss_sharepointfileid',
  'mss_sharepointfilepath',
  'mss_shareablelink',
] as const

const clientFileIds = new WeakMap<File, string>()

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
  let totalSize = current.reduce((total, file) => total + file.size, 0)

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
    if (totalSize + file.size > MAX_ATTACHMENT_TOTAL_SIZE) {
      errors.push(`${prefix}Combined file size must be 70 MB or smaller.`)
      continue
    }
    files.push(file)
    names.add(normalizedName)
    totalSize += file.size
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

function normalizeDataverseAttachment(record: DataverseAttachmentRecord): {
  readonly reportId: string
  readonly attachment: MeetingReportAttachment
  readonly fileKeys: readonly string[]
} {
  const reportId = requiredGuid(String(record._mss_meetingreport_value ?? ''), 'Meeting Report identifier')
  const attachmentId = requiredGuid(String(record.mss_attachmentsid ?? ''), 'Attachment identifier')
  const fileName = optionalText(record.mss_attachmentname)
  if (!fileName) throw new Error('Dataverse returned an attachment without a file name.')
  const fileUrl = optionalHttpsUrl(record.mss_shareablelink)
  const sharePointFileId = optionalText(record.mss_sharepointfileid)
  const sharePointFilePath = optionalText(record.mss_sharepointfilepath)
  const fileKeys = [
    sharePointFileId ? `id:${sharePointFileId.toLowerCase()}` : null,
    fileUrl ? `url:${fileUrl.toLowerCase()}` : null,
    sharePointFilePath ? `path:${sharePointFilePath.toLowerCase()}` : null,
  ].filter((key): key is string => key !== null)
  if (fileKeys.length === 0) fileKeys.push(`attachment:${attachmentId}`)
  return {
    reportId,
    fileKeys,
    attachment: {
      attachmentId,
      fileName,
      fileUrl,
      contentType: optionalText(record.mss_filetype),
      size: optionalSize(record.mss_filesize),
    },
  }
}

export async function listMeetingReportPageAttachments(
  meetingReportIds: readonly string[],
  signal?: AbortSignal,
): Promise<ReadonlyMap<string, readonly MeetingReportAttachment[]>> {
  const normalizedReportIds = [...new Set(
    meetingReportIds.map((id) => requiredGuid(id, 'Meeting Report identifier')),
  )]
  if (normalizedReportIds.length === 0) return new Map()

  const params = new URLSearchParams()
  params.set('$select', ATTACHMENT_LIST_SELECT.join(','))
  params.set('$filter', normalizedReportIds
    .map((id) => `_mss_meetingreport_value eq ${id}`)
    .join(' or '))
  params.set('$orderby', 'mss_attachmentname asc,mss_attachmentsid asc')
  const response = await powerPagesFetch<{ readonly value?: readonly DataverseAttachmentRecord[] }>(
    `/_api/mss_attachmentses?${params.toString()}`,
    { signal },
  )
  if (!Array.isArray(response.value)) throw new Error('Dataverse returned an invalid attachment list.')

  const groupsByReport = new Map(normalizedReportIds.map((id) => [id, [] as Array<{
    readonly attachment: MeetingReportAttachment
    readonly attachmentIds: string[]
    readonly keys: Set<string>
  }>]))
  for (const record of response.value) {
    const normalized = normalizeDataverseAttachment(record)
    const reportGroups = groupsByReport.get(normalized.reportId)
    if (!reportGroups) continue

    const matchingIndexes: number[] = []
    for (let index = 0; index < reportGroups.length; index += 1) {
      if (normalized.fileKeys.some((key) => reportGroups[index].keys.has(key))) matchingIndexes.push(index)
    }
    if (matchingIndexes.length === 0) {
      reportGroups.push({
        attachment: normalized.attachment,
        attachmentIds: [normalized.attachment.attachmentId],
        keys: new Set(normalized.fileKeys),
      })
      continue
    }

    const primaryGroup = reportGroups[matchingIndexes[0]]
    for (const key of normalized.fileKeys) primaryGroup.keys.add(key)
    for (let index = matchingIndexes.length - 1; index > 0; index -= 1) {
      const mergedGroup = reportGroups[matchingIndexes[index]]
      for (const key of mergedGroup.keys) primaryGroup.keys.add(key)
      for (const attachmentId of mergedGroup.attachmentIds) {
        if (!primaryGroup.attachmentIds.includes(attachmentId)) primaryGroup.attachmentIds.push(attachmentId)
      }
      reportGroups.splice(matchingIndexes[index], 1)
    }
    if (!primaryGroup.attachmentIds.includes(normalized.attachment.attachmentId)) {
      primaryGroup.attachmentIds.push(normalized.attachment.attachmentId)
    }
  }
  return new Map([...groupsByReport].map(([reportId, groups]) => [
    reportId,
    groups.map((group) => group.attachmentIds.length > 1
      ? { ...group.attachment, duplicateAttachmentIds: group.attachmentIds.slice(1) }
      : group.attachment),
  ]))
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

  if (!acceptedStatuses.includes(response.status)) {
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
  const attachmentsByReport = await listMeetingReportPageAttachments([normalizedReportId], signal)
  return attachmentsByReport.get(normalizedReportId) ?? []
}

export function buildMeetingReportAttachmentPreviewUrl(fileUrl: string): string {
  const previewUrl = new URL(fileUrl)
  previewUrl.searchParams.delete('download')
  previewUrl.searchParams.set('web', '1')
  return previewUrl.href
}

function clientFileId(file: File): string {
  const existing = clientFileIds.get(file)
  if (existing) return existing
  const created = crypto.randomUUID()
  clientFileIds.set(file, created)
  return created
}

export async function uploadMeetingReportAttachments(
  meetingReportId: string,
  files: readonly File[],
): Promise<AttachmentBatchUploadResult> {
  const normalizedReportId = requiredGuid(meetingReportId, 'Meeting Report identifier')
  if (files.length === 0) throw new Error('Select at least one file to upload.')
  const validation = validateAndMergeAttachmentFiles([], files)
  if (validation.errors.length > 0) throw new Error(validation.errors[0])
  const requestFiles = []
  for (const file of files) {
    requestFiles.push({
      clientFileId: clientFileId(file),
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      contentBase64: await fileToBase64(file),
    })
  }
  const response = object((await callAttachmentFlow({
    operation: 'upload',
    meetingReportId: normalizedReportId,
    files: requestFiles,
  }, [200])).body)
  if (!response || !Array.isArray(response.results) || response.results.length !== files.length) {
    throw new Error('The attachment flow returned an invalid response.')
  }

  const requestById = new Map(requestFiles.map((requestFile, index) => [
    requestFile.clientFileId,
    { file: files[index], fileName: requestFile.fileName },
  ]))
  const seen = new Set<string>()
  const succeededAttachments: MeetingReportAttachment[] = []
  const failedFiles: File[] = []
  for (const value of response.results) {
    const result = object(value)
    const id = optionalText(result?.clientFileId)
    const fileName = optionalText(result?.fileName)
    const request = id ? requestById.get(id) : undefined
    if (!result || !id || !request || seen.has(id) || fileName !== request.fileName) {
      throw new Error('The attachment flow returned an invalid response.')
    }
    seen.add(id)
    if (result.status === 'failed') {
      failedFiles.push(request.file)
      continue
    }
    if (result.status !== 'succeeded') {
      throw new Error('The attachment flow returned an invalid response.')
    }
    const attachment = normalizeAttachment(result.attachment)
    if (attachment.fileName !== request.fileName) {
      throw new Error('The attachment flow returned an invalid response.')
    }
    succeededAttachments.push(attachment)
  }
  return { succeededAttachments, failedFiles }
}

export async function deleteMeetingReportAttachment(
  meetingReportId: string,
  attachmentId: string,
  duplicateAttachmentIds: readonly string[] = [],
): Promise<void> {
  const normalizedReportId = requiredGuid(meetingReportId, 'Meeting Report identifier')
  const normalizedAttachmentIds = [...new Set([attachmentId, ...duplicateAttachmentIds].map(
    (id) => requiredGuid(id, 'Attachment identifier'),
  ))]
  for (const normalizedAttachmentId of normalizedAttachmentIds) {
    const response = await callAttachmentFlow({
      operation: 'delete',
      meetingReportId: normalizedReportId,
      attachmentId: normalizedAttachmentId,
    }, [200, 204, 404])
    if (response.status === 204 || response.status === 404) continue
    const body = object(response.body)
    if (body?.deleted !== true || normalizeGuid(body.attachmentId) !== normalizedAttachmentId) {
      throw new Error('The attachment flow returned an invalid response.')
    }
  }
}
