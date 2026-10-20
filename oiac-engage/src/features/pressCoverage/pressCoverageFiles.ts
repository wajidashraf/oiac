import type { CoverageVariant } from './pressCoverageTypes'
import { powerPagesFetch, PowerPagesApiError, PowerPagesDataError } from '../../shared/powerPagesApi'
import { COVERAGE_ENDPOINT, coverageEnvelope } from './pressCoverageService'

const MIME_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'], 'application/pdf': ['pdf'], 'image/gif': ['gif'],
  'application/vnd.ms-excel': ['xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
}
const MEGABYTE = 1024 * 1024
const CHUNK_SIZE = 256 * 1024
const uploadSessions = new WeakMap<File, { id: string; variant: CoverageVariant; sessionId: string }>()

function validName(name: string): boolean {
  return name.length > 0 && name.length <= 128 && name === name.trim() && !/[\x00-\x1f\x7f<>:"/\\|?*]/.test(name)
    && name !== '.' && name !== '..' && !name.endsWith('.')
}

export function validateCoverageFile(file: File, variant: CoverageVariant): string | null {
  if (variant !== 'press' && variant !== 'featured') return 'Invalid coverage variant.'
  if (!validName(file.name)) return 'Use a filename of 128 characters or fewer without special path characters.'
  const extensions = Object.prototype.hasOwnProperty.call(MIME_EXTENSIONS, file.type) ? MIME_EXTENSIONS[file.type] : undefined
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!extensions?.includes(extension) || variant === 'featured' && !file.type.startsWith('image/')) {
    return variant === 'featured' ? 'Choose a JPG, PNG, GIF or WebP publication logo.' : 'Choose a PDF, JPG, PNG, GIF, WebP, XLS or XLSX attachment.'
  }
  const limit = variant === 'featured' ? 2 : 10
  if (file.size < 1 || file.size > limit * MEGABYTE) return `Choose a nonempty file of ${limit} MB or less.`
  return null
}

function matchesSignature(bytes: Uint8Array, mimeType: string): boolean {
  const starts = (signature: readonly number[]) => signature.every((byte, index) => bytes[index] === byte)
  if (mimeType === 'image/png') return starts([137, 80, 78, 71, 13, 10, 26, 10])
  if (mimeType === 'image/jpeg') return starts([255, 216, 255])
  if (mimeType === 'image/gif') return starts([71, 73, 70, 56, 55, 97]) || starts([71, 73, 70, 56, 57, 97])
  if (mimeType === 'application/vnd.ms-excel') return starts([208, 207, 17, 224, 161, 177, 26, 225])
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return starts([80, 75, 3, 4])
  if (mimeType === 'application/pdf') return starts([37, 80, 68, 70, 45])
  return mimeType === 'image/webp' && starts([82, 73, 70, 70]) && [87, 69, 66, 80].every((byte, index) => bytes[index + 8] === byte)
}

function fileBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The selected file could not be read.'))
    reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(new Uint8Array(reader.result)) : reject(new Error('The selected file could not be read.'))
    reader.readAsArrayBuffer(file)
  })
}

function requiredId(id: string): string {
  const normalized = id.trim().replace(/^\{(.+)\}$/, '$1').toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)) throw new Error('Invalid coverage identifier.')
  return normalized
}

function base64(bytes: Uint8Array): string {
  const chunks: string[] = []
  for (let start = 0; start < bytes.length; start += 8192) chunks.push(String.fromCharCode(...bytes.subarray(start, start + 8192)))
  return btoa(chunks.join(''))
}

function isCanonicalBase64(data: string): boolean {
  if (!data || data.length % 4 !== 0) return false
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0
  const contentLength = data.length - padding
  for (let index = 0; index < contentLength; index++) {
    const code = data.charCodeAt(index)
    if (!(code >= 65 && code <= 90 || code >= 97 && code <= 122 || code >= 48 && code <= 57 || code === 43 || code === 47)) return false
  }
  if (padding) {
    const lastValue = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.indexOf(data[contentLength - 1])
    // Unused low bits must be zero: four bits for ==, two bits for =.
    if (lastValue < 0 || (lastValue & (padding === 2 ? 15 : 3)) !== 0) return false
  }
  return true
}

export async function uploadCoverageFile(id: string, file: File, variant: CoverageVariant): Promise<void> {
  const coverageId = requiredId(id)
  const validation = validateCoverageFile(file, variant)
  if (validation) throw new Error(validation)
  const bytes = await fileBytes(file)
  if (!matchesSignature(bytes, file.type)) throw new Error('The file content does not match its declared type or signature.')
  let session = uploadSessions.get(file)
  if (!session || session.id !== coverageId || session.variant !== variant) {
    session = { id: coverageId, variant, sessionId: crypto.randomUUID() }
    uploadSessions.set(file, session)
  }
  try {
    const started = await fileCommand('begin', { id: coverageId, variant, fileName: file.name, mimeType: file.type, size: bytes.length, sessionId: session.sessionId })
    const blockCount = Math.ceil(bytes.length / CHUNK_SIZE)
    if (started.id !== coverageId || started.sessionId !== session.sessionId || started.chunkSize !== CHUNK_SIZE
      || !Number.isInteger(started.nextIndex) || Number(started.nextIndex) < 0 || Number(started.nextIndex) > blockCount) invalidFileResponse()
    for (let index = Number(started.nextIndex); index < blockCount; index++) {
      const data = base64(bytes.subarray(index * CHUNK_SIZE, Math.min((index + 1) * CHUNK_SIZE, bytes.length)))
      const saved = await fileCommand('chunk', { id: coverageId, sessionId: session.sessionId, index, data })
      if (saved.id !== coverageId || saved.sessionId !== session.sessionId || saved.nextIndex !== index + 1) invalidFileResponse()
    }
    const committed = await fileCommand('commit', { id: coverageId, sessionId: session.sessionId })
    if (committed.id !== coverageId || committed.fileName !== file.name || committed.mimeType !== file.type || committed.size !== bytes.length) invalidFileResponse()
    requiredId(typeof committed.fileId === 'string' ? committed.fileId : '')
    uploadSessions.delete(file)
  } catch (error) {
    // A definite stale-session response needs a fresh file session on the next
    // explicit retry. Uncertain responses retain the original session to resume.
    if (error instanceof PowerPagesApiError && error.code === 'conflict') uploadSessions.delete(file)
    throw error
  }
}

function invalidFileResponse(): never {
  throw new PowerPagesDataError('The coverage file response is invalid. Retry the file transfer.')
}

async function fileCommand(command: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  return coverageEnvelope(await powerPagesFetch<unknown>(COVERAGE_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'file', command, payload }),
  }))
}

export async function downloadCoverageFile(id: string): Promise<{ blob: Blob; fileName: string }> {
  const coverageId = requiredId(id)
  const info = await fileCommand('info', { id: coverageId })
  const { fileName, mimeType, size } = info
  const fileId = requiredId(typeof info.fileId === 'string' ? info.fileId : '')
  if (info.id !== coverageId || typeof fileName !== 'string' || !validName(fileName) || typeof mimeType !== 'string'
    || !Object.prototype.hasOwnProperty.call(MIME_EXTENSIONS, mimeType) || !MIME_EXTENSIONS[mimeType].includes(fileName.split('.').pop()?.toLowerCase() ?? '')
    || !Number.isInteger(size) || Number(size) < 1 || Number(size) > 10 * MEGABYTE || info.chunkSize !== CHUNK_SIZE) invalidFileResponse()
  const total = Number(size)
  const bytes = new Uint8Array(total)
  for (let offset = 0; offset < total; offset += CHUNK_SIZE) {
    const length = Math.min(CHUNK_SIZE, total - offset)
    const block = await fileCommand('read', { id: coverageId, fileId, offset, length })
    if (block.id !== coverageId || block.fileId !== fileId || block.offset !== offset || typeof block.data !== 'string'
      || block.data.length > Math.ceil(length / 3) * 4 || !isCanonicalBase64(block.data)) invalidFileResponse()
    let decoded: string
    try { decoded = atob(block.data) } catch { return invalidFileResponse() }
    if (decoded.length !== length) invalidFileResponse()
    for (let i = 0; i < decoded.length; i++) bytes[offset + i] = decoded.charCodeAt(i)
  }
  if (!matchesSignature(bytes, mimeType)) invalidFileResponse()
  return { blob: new Blob([bytes], { type: mimeType }), fileName }
}
