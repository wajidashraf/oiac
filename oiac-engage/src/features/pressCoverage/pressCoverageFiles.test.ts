import { beforeEach, expect, test, vi } from 'vitest'
import { powerPagesFetch } from '../../shared/powerPagesApi'
import { downloadCoverageFile, uploadCoverageFile, validateCoverageFile } from './pressCoverageFiles'

vi.mock('../../shared/powerPagesApi', async (original) => ({ ...await original<typeof import('../../shared/powerPagesApi')>(), powerPagesFetch: vi.fn() }))
const fetchMock = vi.mocked(powerPagesFetch)
const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1])
beforeEach(() => vi.resetAllMocks())

test('validates ordinary and logo type, size, filename and empty content before upload', () => {
  expect(validateCoverageFile(new File([png], 'logo.png', { type: 'image/png' }), 'featured')).toBeNull()
  expect(validateCoverageFile(new File(['pdf'], 'article.pdf', { type: 'application/pdf' }), 'press')).toBeNull()
  for (const file of [new File(['pdf'], 'logo.pdf', { type: 'application/pdf' }), new File(['svg'], 'logo.svg', { type: 'image/svg+xml' }), new File([png], '../logo.png', { type: 'image/png' }), new File([], 'logo.png', { type: 'image/png' }), new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'logo.png', { type: 'image/png' })]) {
    expect(validateCoverageFile(file, 'featured')).toEqual(expect.any(String))
  }
  expect(validateCoverageFile(new File([png], 'a'.repeat(125) + '.png', { type: 'image/png' }), 'press')).toEqual(expect.any(String))
  expect(validateCoverageFile(new File([png], 'logo.png', { type: '__proto__' }), 'press')).toEqual(expect.any(String))
})

test('checks file signature and never uploads renamed content', async () => {
  await expect(uploadCoverageFile(id, new File(['<html>bad</html>'], 'logo.png', { type: 'image/png' }), 'featured')).rejects.toThrow(/content|signature/i)
  expect(fetchMock).not.toHaveBeenCalled()
})

const fileId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const chunkSize = 256 * 1024
function encode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(binary)
}
function commandOf(options: unknown): { command: string; payload: Record<string, unknown> } {
  return JSON.parse(String((options as { body?: unknown }).body))
}
function downloadTransport(bytes = png, infoOverride = {}, readOverride = {}) {
  fetchMock.mockImplementation(async (_path, options) => {
    const { command, payload } = commandOf(options)
    if (command === 'info') return { ok: true, id, fileId, fileName: 'logo.png', mimeType: 'image/png', size: bytes.length, chunkSize, ...infoOverride }
    if (command === 'read') return { ok: true, id, fileId, offset: payload.offset, data: encode(bytes.subarray(Number(payload.offset), Number(payload.offset) + Number(payload.length))), ...readOverride }
    throw Error('Unexpected file command')
  })
}

test('uploads bounded browser blocks to the already-saved coverage and verifies the commit receipt', async () => {
  const bytes = new Uint8Array(600123); bytes.set(png); bytes[262144] = 27; bytes[524288] = 33
  const chunks: Uint8Array[] = []
  let sessionId = ''
  fetchMock.mockImplementation(async (path, options) => {
    expect(path).toBe('/_api/serverlogics/press-coverage')
    expect(String(options?.body).length).toBeLessThan(400000)
    const { command, payload } = commandOf(options)
    expect(payload.id).toBe(id)
    if (command === 'begin') { sessionId = String(payload.sessionId); return { ok: true, id, sessionId, chunkSize, nextIndex: 0 } }
    if (command === 'chunk') {
      expect(payload.sessionId).toBe(sessionId)
      expect(payload.index).toBe(chunks.length)
      chunks.push(Uint8Array.from(atob(String(payload.data)), c => c.charCodeAt(0)))
      return { ok: true, id, sessionId, nextIndex: chunks.length }
    }
    if (command === 'commit') return { ok: true, id, fileId, fileName: 'clip.png', mimeType: 'image/png', size: bytes.length }
    throw Error('Unexpected file command')
  })
  await uploadCoverageFile(id, new File([bytes], 'clip.png', { type: 'image/png' }), 'press')
  expect(chunks.map(c => c.length)).toEqual([chunkSize, chunkSize, bytes.length - 2 * chunkSize])
  const rebuilt = new Uint8Array(bytes.length)
  chunks.forEach((chunk, index) => rebuilt.set(chunk, index * chunkSize))
  expect(rebuilt.every((value, index) => value === bytes[index])).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(5)
})

test('file-only retry resumes the same session on the same record after an uncertain block response', async () => {
  const bytes = new Uint8Array(chunkSize + 12); bytes.set(png)
  const file = new File([bytes], 'clip.png', { type: 'image/png' })
  const sessions: string[] = []; const indices: number[] = []; let accepted = 0; let interrupted = false
  fetchMock.mockImplementation(async (_path, options) => {
    const { command, payload } = commandOf(options)
    expect(payload.id).toBe(id)
    if (command === 'begin') { sessions.push(String(payload.sessionId)); return { ok: true, id, sessionId: payload.sessionId, chunkSize, nextIndex: accepted } }
    if (command === 'chunk') {
      indices.push(Number(payload.index)); accepted++
      if (!interrupted) { interrupted = true; throw Error('Connection lost after native save') }
      return { ok: true, id, sessionId: payload.sessionId, nextIndex: accepted }
    }
    if (command === 'commit') return { ok: true, id, fileId, fileName: file.name, mimeType: file.type, size: file.size }
    throw Error('Unexpected file command')
  })
  await expect(uploadCoverageFile(id, file, 'press')).rejects.toThrow()
  await expect(uploadCoverageFile(id, file, 'press')).resolves.toBeUndefined()
  expect(sessions).toHaveLength(2); expect(sessions[1]).toBe(sessions[0]); expect(indices).toEqual([0, 1])
})

test('does not report success for a commit associated with a different record', async () => {
  fetchMock.mockImplementation(async (_path, options) => {
    const { command, payload } = commandOf(options)
    if (command === 'begin') return { ok: true, id, sessionId: payload.sessionId, chunkSize, nextIndex: 0 }
    if (command === 'chunk') return { ok: true, id, sessionId: payload.sessionId, nextIndex: 1 }
    return { ok: true, id: fileId, fileId, fileName: 'logo.png', mimeType: 'image/png', size: png.length }
  })
  await expect(uploadCoverageFile(id, new File([png], 'logo.png', { type: 'image/png' }), 'featured')).rejects.toThrow()
})

test('restarts only the file session on the next explicit retry after an expired or conflicting session', async () => {
  const file = new File([png], 'logo.png', { type: 'image/png' }); const sessions: string[] = []
  fetchMock.mockImplementation(async (_path, options) => {
    const { command, payload } = commandOf(options)
    expect(payload.id).toBe(id)
    if (command === 'begin') {
      sessions.push(String(payload.sessionId))
      return sessions.length === 1 ? { ok: false, error: { code: 'conflict', message: 'The session expired.' } } : { ok: true, id, sessionId: payload.sessionId, chunkSize, nextIndex: 0 }
    }
    if (command === 'chunk') return { ok: true, id, sessionId: payload.sessionId, nextIndex: 1 }
    return { ok: true, id, fileId, fileName: file.name, mimeType: file.type, size: file.size }
  })
  await expect(uploadCoverageFile(id, file, 'featured')).rejects.toThrow()
  await uploadCoverageFile(id, file, 'featured')
  expect(sessions).toHaveLength(2); expect(sessions[1]).not.toBe(sessions[0])
})

test('downloads a multi-block authorized file without a single large response or lost bytes', async () => {
  const bytes = new Uint8Array(3 * 1024 * 1024 + 7); bytes.set(png); bytes[262144] = 91; bytes[bytes.length - 1] = 21
  downloadTransport(bytes)
  const result = await downloadCoverageFile(id)
  expect(result.fileName).toBe('logo.png'); expect(result.blob.size).toBe(bytes.length)
  const reader = new FileReader()
  const actual = await new Promise<Uint8Array>(resolve => { reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer)); reader.readAsArrayBuffer(result.blob) })
  expect(actual.every((value, index) => value === bytes[index])).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(14)
  for (const [, options] of fetchMock.mock.calls.slice(1)) {
    const { command, payload } = commandOf(options)
    expect(command).toBe('read'); expect(payload.fileId).toBe(fileId); expect(Number(payload.length)).toBeLessThanOrEqual(chunkSize)
  }
})

test.each(['iVBORw0KGgp=', 'iVBORw0KGgoBAB==', 'iVBORw0K=goB', 'iVBORw0KGgo===', 'iVBORw0KGgoB\n'])('rejects noncanonical download block %s', async data => {
  downloadTransport(png, {}, { data })
  await expect(downloadCoverageFile(id)).rejects.toThrow()
})
test.each([['iVBORw0KGgo=', 8], ['iVBORw0KGgoBAA==', 10]] as const)('accepts canonical padded block %s', async (data, size) => {
  downloadTransport(new Uint8Array(size), {}, { data })
  await expect(downloadCoverageFile(id)).resolves.toMatchObject({ fileName: 'logo.png', blob: expect.objectContaining({ size }) })
})
test.each([{ fileName: '../bad.png' }, { size: 10 * 1024 * 1024 + 1 }, { fileName: 'logo.svg', mimeType: 'image/svg+xml' }, { chunkSize: 10 * 1024 * 1024 }])('rejects invalid download metadata before reading blocks %j', async overrides => {
  downloadTransport(png, overrides)
  await expect(downloadCoverageFile(id)).rejects.toThrow()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
test.each([{ id: fileId }, { fileId: id }, { offset: 1 }, { data: 'PGh0bWw+' }])('rejects replaced, misassociated, or corrupt download block %j', async overrides => {
  downloadTransport(png, {}, overrides)
  await expect(downloadCoverageFile(id)).rejects.toThrow()
})



const extraFormats = [
  ['clip.gif', 'image/gif', new Uint8Array([71,73,70,56,55,97])],
  ['clip.gif', 'image/gif', new Uint8Array([71,73,70,56,57,97])],
  ['data.xls', 'application/vnd.ms-excel', new Uint8Array([208,207,17,224,161,177,26,225])],
  ['data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Uint8Array([80,75,3,4])],
] as const

test.each(extraFormats)('downloads validated %s format with its MIME and signature', async (fileName, mimeType, bytes) => {
  downloadTransport(bytes, { fileName, mimeType })
  const result = await downloadCoverageFile(id)
  expect(result.fileName).toBe(fileName)
  expect(result.blob.type).toBe(mimeType)
  expect(result.blob.size).toBe(bytes.length)
})

test.each(extraFormats)('accepts %s only within the matching extension and featured image policy', async (fileName, mimeType, bytes) => {
  const file = new File([bytes], fileName, { type: mimeType })
  expect(validateCoverageFile(file, 'press')).toBeNull()
  expect(validateCoverageFile(file, 'featured') === null).toBe(mimeType === 'image/gif')
  expect(validateCoverageFile(new File([bytes], 'bad.xlsm', { type: mimeType }), 'press')).toEqual(expect.any(String))
  await expect(uploadCoverageFile(id, new File(['bad bytes'], fileName, { type: mimeType }), 'press')).rejects.toThrow(/signature/)
  expect(fetchMock).not.toHaveBeenCalled()
})


test('new format size limits remain two MiB for featured images and ten MiB for press attachments', () => {
  expect(validateCoverageFile(new File([new Uint8Array(2 * 1024 * 1024)], 'logo.gif', { type: 'image/gif' }), 'featured')).toBeNull()
  expect(validateCoverageFile(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'logo.gif', { type: 'image/gif' }), 'featured')).toEqual(expect.any(String))
  expect(validateCoverageFile(new File([new Uint8Array(10 * 1024 * 1024)], 'data.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'press')).toBeNull()
  expect(validateCoverageFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'data.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'press')).toEqual(expect.any(String))
})

test.each(extraFormats)('uploads accepted %s signatures through the unchanged bound transfer', async (fileName, mimeType, bytes) => {
  fetchMock.mockImplementation(async (_path, options) => {
    const { command, payload } = commandOf(options)
    if (command === 'begin') return { ok: true, id, sessionId: payload.sessionId, nextIndex: 0, chunkSize }
    if (command === 'chunk') return { ok: true, id, sessionId: payload.sessionId, nextIndex: 1 }
    return { ok: true, id, fileId, fileName, mimeType, size: bytes.length }
  })
  await expect(uploadCoverageFile(id, new File([bytes], fileName, { type: mimeType }), 'press')).resolves.toBeUndefined()
})
