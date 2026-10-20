// Node's VM is present in the Vitest runtime. The browser project intentionally
// has no @types/node dependency; keep this test-only API typed locally.
const vmModule = 'node:vm'
const { runInNewContext } = await import(/* @vite-ignore */ vmModule) as {
  runInNewContext(code: string, context: Record<string, unknown>): unknown
}
import { describe, expect, test, vi } from 'vitest'

const scripts = import.meta.glob('../../../.powerpages-site/server-logic/press-coverage/press-coverage.js', { eager: true, query: '?raw', import: 'default' })
const source = Object.values(scripts)[0] as string | undefined
const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const contact = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const activity = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const press = { mss_headlinetitle: 'Coverage', mss_mediaoutlet: 'News', mss_datepublishedaired: '2026-10-16' }
const record = { ...press, mss_datepublishedaired: '2026-10-15T21:00:00Z', mss_presscoverageid: id, mss_isfeatured: false, _mss_submittedby_value: contact }
const envelope = (body: unknown, status = 200) => JSON.stringify({ StatusCode: status, Body: body === undefined ? '' : JSON.stringify(body), IsSuccessStatusCode: status >= 200 && status < 300, Headers: {} })
function encode(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  return btoa(binary)
}
const decode = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0))

function harness(method = 'GET', body: unknown = {}, query: Record<string, unknown> = {}) {
  const sdk = {
    RetrieveRecord: vi.fn(() => envelope(record)),
    RetrieveMultipleRecords: vi.fn(() => envelope({ value: [] })),
    CreateRecord: vi.fn(() => envelope(undefined, 204)),
    UpdateRecord: vi.fn(() => envelope(undefined, 204)),
    InvokeCustomApi: vi.fn((_method: string, url: string, _payload?: string) => {
      if (url === 'mss_CoverageLocalTime') {
        const utc = (JSON.parse(_payload!) as { UtcTime: string }).UtcTime
        return envelope({ LocalTime: new Date(new Date(utc).getTime() + 3 * 60 * 60 * 1000).toISOString() })
      }
      if (url === 'InitializeFileBlocksUpload') return envelope({ FileContinuationToken: 'server-only' })
      if (url === 'CommitFileBlocksUpload') return envelope({ FileId: contact, FileSizeInBytes: 8 })
      return envelope(undefined, 204)
    }),
  }
  const server = { User: { ContactId: contact } as unknown, Context: { HttpMethod: method, Body: JSON.stringify(body), QueryParameters: query, ActivityId: activity }, Connector: { Dataverse: sdk }, Logger: { Log: vi.fn(), Error: vi.fn() } }
  const context: Record<string, unknown> = { Server: server }
  runInNewContext(source || '', context)
  return { sdk, server, call() {
    const name = method.toLowerCase()
    expect(context[name], `missing ${name} implementation`).toBeTypeOf('function')
    const output = (context[name] as () => unknown)()
    expect(output).toBeTypeOf('string')
    return JSON.parse(output as string)
  } }
}

describe('bounded coverage file commands', () => {
  const sessionId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  const begin = { id, variant: 'press', fileName: 'clip.png', mimeType: 'image/png', size: 9, sessionId }
  test('binds an upload to trusted actor after the existing record write permission check', () => {
    const h = harness('POST', { operation: 'file', command: 'begin', payload: begin })
    h.sdk.InvokeCustomApi.mockImplementation(() => envelope({ Result: JSON.stringify({ ok: true, id, sessionId, chunkSize: 262144, nextIndex: 0 }) }))
    expect(h.call()).toMatchObject({ ok: true, id, sessionId })
    expect(h.sdk.UpdateRecord).toHaveBeenCalledTimes(1)
    expect(h.sdk.UpdateRecord).toHaveBeenCalledWith('mss_presscoverages', id, '{}')
    const call = h.sdk.InvokeCustomApi.mock.calls[0]
    expect(call[1]).toBe('mss_CoverageFileCommand')
    expect(JSON.parse(call[2]!)).toEqual({ ActorContactId: contact, Command: 'begin', Payload: JSON.stringify(begin) })
    expect(h.sdk.UpdateRecord.mock.invocationCallOrder[0]).toBeLessThan(h.sdk.InvokeCustomApi.mock.invocationCallOrder[0])
  })
  test('denies a file command before native invocation if portal write permission rejects', () => {
    const h = harness('POST', { operation: 'file', command: 'begin', payload: begin })
    h.sdk.UpdateRecord.mockReturnValue(envelope({}, 403))
    expect(h.call()).toMatchObject({ ok: false, error: { code: 'forbidden' } })
    expect(h.sdk.InvokeCustomApi).not.toHaveBeenCalled()
  })
  test('reads file metadata with read authorization and no write check', () => {
    const h = harness('POST', { operation: 'file', command: 'info', payload: { id } })
    h.sdk.InvokeCustomApi.mockImplementation(() => envelope({ Result: JSON.stringify({ ok: true, id, fileId: contact, fileName: 'clip.png', mimeType: 'image/png', size: 9, chunkSize: 262144 }) }))
    expect(h.call()).toMatchObject({ ok: true, id, fileName: 'clip.png' })
    expect(h.sdk.RetrieveRecord).toHaveBeenCalled()
    expect(h.sdk.UpdateRecord).not.toHaveBeenCalled()
    expect(h.sdk.RetrieveRecord.mock.calls[0].join(' ')).not.toContain('mss_coverageuploadstate')
  })
  test.each([
    { operation: 'file', command: 'begin', payload: begin, ActorContactId: id },
    { operation: 'file', command: 'UploadBlock', payload: begin },
    { operation: 'file', command: 'chunk', payload: { id, sessionId, index: 0, data: 'A'.repeat(400000) } },
    { operation: 'file', command: 'read', payload: { id, fileId: contact, offset: 0, length: 262145 } },
    { operation: 'file', command: 'commit', payload: { id, sessionId, FileContinuationToken: 'forged' } },
  ])('rejects unapproved identity, commands, tokens and oversized blocks %j', body => {
    const h = harness('POST', body)
    expect(h.call()).toMatchObject({ ok: false, error: { code: 'validation' } })
    expect(h.sdk.InvokeCustomApi).not.toHaveBeenCalled()
  })
})

describe('coverage server authorization and writes', () => {
  test('avoids the hosted prohibited Function pattern including anonymous callbacks', () => {
    expect(source).not.toMatch(/Function\s*\(/i)
  })
  test('avoids the hosted prohibited with pattern, including suffix string methods', () => {
    expect(source).not.toMatch(/with\s*\(/i)
  })
  test('avoids the hosted prohibited prototype access pattern', () => {
    expect(source).not.toMatch(/\.prototype\./i)
  })
  test('stamps creator and known record ID with no dependency on response headers', () => {
    const h = harness('POST', { operation: 'create', variant: 'press', fields: press })
    expect(h.call()).toEqual({ ok: true, id: activity })
    const [table, payload] = h.sdk.CreateRecord.mock.calls[0] as unknown as [string, string]
    expect(table).toBe('mss_presscoverages')
    expect(JSON.parse(payload)).toMatchObject({ mss_presscoverageid: activity, mss_isfeatured: false, 'mss_SubmittedBy@odata.bind': `/contacts(${contact})`, mss_datepublishedaired: '2026-10-16T09:00:00.000Z' })
    expect(h.sdk.InvokeCustomApi.mock.calls.every((call) => call[0] === 'post' && call[1] === 'mss_CoverageLocalTime')).toBe(true)
  })
  test('creates coverage with an empty optional Related Contact without a null relationship binding', () => {
    const h = harness('POST', { operation: 'create', variant: 'press', fields: { ...press, mss_relatedcontact: null } })
    h.sdk.CreateRecord.mockImplementation((_table?: string, body?: string) => {
      const payload = JSON.parse(body!)
      return 'mss_RelatedContact@odata.bind' in payload ? envelope({ error: { message: 'Null navigation binding rejected on create' } }, 400) : envelope(undefined, 204)
    })
    expect(h.call()).toEqual({ ok: true, id: activity })
    expect(JSON.parse((h.sdk.CreateRecord.mock.calls[0] as unknown as string[])[1])).not.toHaveProperty('mss_RelatedContact@odata.bind')
  })
  test.each([null, {}, { ContactId: 'invalid' }, { id: 'x', roles: ['Administrator'] }])('denies anonymous or invalid trusted identity %j', (user) => {
    const h = harness('POST', { operation: 'create', variant: 'press', fields: press }); h.server.User = user
    expect(h.call()).toMatchObject({ ok: false, error: { code: 'unauthenticated' } })
    expect(h.sdk.CreateRecord).not.toHaveBeenCalled()
  })
  test.each(['mss_isfeatured', '_mss_submittedby_value', 'mss_submittedby', 'mss_SubmittedBy@odata.bind', 'ownerid', 'mss_publication', 'mss_presscoverageid', '__proto__'])('rejects forged or foreign field %s', (field) => {
    const fields = JSON.parse(JSON.stringify(press).slice(0, -1) + `,${JSON.stringify(field)}:"forged"}`)
    const h = harness('POST', { operation: 'create', variant: 'press', fields })
    expect(h.call()).toMatchObject({ ok: false, error: { code: 'validation' } })
    expect(h.sdk.CreateRecord).not.toHaveBeenCalled()
  })
  test.each([{ mss_coveragetype: '866530000' }, { mss_coveragetype: 123 }, { mss_oiacmentioned: 'true' }, { mss_mediaoutlet: 3 }, { mss_mediaoutlet: 'x'.repeat(101) }, { mss_headlinetitle: 'x'.repeat(851) }, { mss_datepublishedaired: '2026-02-30' }, { mss_datepublishedaired: '2026-10-16T00:00:00Z' }, { mss_articlevideourl: 'javascript:alert(1)' }, { mss_relatedcontact: 'invalid' }, { mss_mediaoutlet: '' }])('validates actual types, lengths, dates and required fields %j', (invalid) => {
    const h = harness('POST', { operation: 'create', variant: 'press', fields: { ...press, ...invalid } })
    expect(h.call()).toMatchObject({ ok: false, error: { code: 'validation' } })
    expect(h.sdk.CreateRecord).not.toHaveBeenCalled()
  })
  test('merges required fields, preserves unrelated data and clears Related Contact with a null navigation property', () => {
    const h = harness('PATCH', { operation: 'update', id, variant: 'press', fields: { mss_summary: 'Changed', mss_relatedcontact: null } })
    h.sdk.UpdateRecord.mockImplementation((_table?: string, _id?: string, body?: string) => {
      const payload = JSON.parse(body!)
      return 'mss_RelatedContact@odata.bind' in payload ? envelope({ error: { message: 'Null annotated relationship binding rejected' } }, 400) : envelope(undefined, 204)
    })
    expect(h.call()).toEqual({ ok: true, id })
    expect(h.sdk.RetrieveRecord.mock.calls[0]).toEqual(['mss_presscoverages', id, expect.stringContaining('$select='), true])
    expect(JSON.parse((h.sdk.UpdateRecord.mock.calls[0] as unknown as string[])[2])).toEqual({ mss_summary: 'Changed', mss_RelatedContact: null })
  })
  test('always requests portal write authorization for unchanged edits', () => {
    const h = harness('PATCH', { operation: 'update', id, variant: 'press', fields: {} })
    h.sdk.UpdateRecord.mockReturnValue(envelope({ error: { message: 'secret SDK detail' } }, 403))
    expect(h.call()).toEqual({ ok: false, error: { code: 'forbidden', message: 'You do not have permission to change this coverage.' } })
    expect(h.sdk.UpdateRecord).toHaveBeenCalledTimes(1)
  })
  test('rejects variant changes and invalid operation/method pairs', () => {
    expect(harness('PATCH', { operation: 'update', id, variant: 'featured', fields: {} }).call()).toMatchObject({ ok: false })
    expect(harness('POST', { operation: 'update', id, variant: 'press', fields: {} }).call()).toMatchObject({ ok: false })
    expect(harness('PATCH', { operation: 'create', variant: 'press', fields: press }).call()).toMatchObject({ ok: false })
  })
  test('fails closed on invalid SDK response and hides thrown connector details', () => {
    const h = harness('POST', { operation: 'create', variant: 'press', fields: press })
    h.sdk.CreateRecord.mockReturnValue('{"StatusCode":500,"Body":"secret","IsSuccessStatusCode":true}')
    expect(JSON.stringify(h.call())).not.toContain('secret')
    h.sdk.CreateRecord.mockImplementation(() => { throw Error('private tenant information') })
    expect(h.call()).toMatchObject({ ok: false, error: { code: 'unavailable' } })
  })
  test.each([{}, { StatusCode: 500, IsSuccessStatusCode: true }, { StatusCode: 200, IsSuccessStatusCode: false }, { StatusCode: 200, ServerError: true }, { StatusCode: 200, Body: '{"error":{"message":"private"}}' }, { StatusCode: 200, Body: 'malformed' }])('rejects failed or malformed SDK envelopes %j', (result) => {
    const h = harness('POST', { operation: 'create', variant: 'press', fields: press })
    h.sdk.CreateRecord.mockReturnValue(JSON.stringify(result))
    expect(h.call()).toMatchObject({ ok: false, error: { code: 'unavailable' } })
  })
  test('supports SDK object envelopes as well as serialized envelopes', () => {
    const h = harness('GET', {}, { id })
    h.sdk.RetrieveRecord.mockReturnValue({ StatusCode: 200, Body: JSON.stringify(record), IsSuccessStatusCode: true } as unknown as string)
    expect(h.call()).toMatchObject({ ok: true, record: { mss_presscoverageid: id } })
  })
  test('does not infer admin authority from browser roles or reject permitted legacy admin updates', () => {
    const h = harness('PATCH', { operation: 'update', id, variant: 'press', fields: { mss_summary: 'Admin edit' } })
    h.sdk.RetrieveRecord.mockReturnValue(envelope({ ...record, _mss_submittedby_value: null }))
    expect(h.call()).toEqual({ ok: true, id })
    h.sdk.UpdateRecord.mockReturnValue(envelope({}, 403))
    expect(h.call()).toMatchObject({ ok: false, error: { code: 'forbidden' } })
  })
  test('rejects malformed date conversion responses before creating a record', () => {
    const h = harness('POST', { operation: 'create', variant: 'press', fields: press })
    h.sdk.InvokeCustomApi.mockReturnValue(envelope({ LocalTime: 'bad' }))
    expect(h.call()).toMatchObject({ ok: false }); expect(h.sdk.CreateRecord).not.toHaveBeenCalled()
  })
  test('converts canonical dates with historical timezone rules and verifies the inverted wall time', () => {
    const h = harness('POST', { operation: 'create', variant: 'press', fields: { ...press, mss_datepublishedaired: '2020-01-02' } })
    h.sdk.InvokeCustomApi.mockImplementation((_method, _url, payload) => {
      const utc = (JSON.parse(payload!) as { UtcTime: string }).UtcTime
      return envelope({ LocalTime: new Date(new Date(utc).getTime() + 2 * 60 * 60 * 1000).toISOString() })
    })
    expect(h.call()).toEqual({ ok: true, id: activity })
    expect(JSON.parse((h.sdk.CreateRecord.mock.calls[0] as unknown as string[])[1]).mss_datepublishedaired).toBe('2020-01-02T10:00:00.000Z')
    expect(h.sdk.InvokeCustomApi).toHaveBeenCalledTimes(2)
  })
})

describe('coverage server reads', () => {
  test('uses the fixed native-time adapter when the hosted connector rejects built-in functions', () => {
    const h = harness('GET', {}, { id })
    h.sdk.InvokeCustomApi.mockImplementation((_method, url) => url === 'mss_CoverageLocalTime'
      ? envelope({ LocalTime: '2026-10-16T00:00:00Z' })
      : envelope({ error: { code: 'invalid_url' } }, 400))
    expect(h.call()).toMatchObject({ ok: true, record: { mss_datepublishedaired: '2026-10-16' } })
  })
  test('reads full record, normalizes business date and returns Related Contact display name', () => {
    const h = harness('GET', {}, { id })
    h.sdk.RetrieveRecord.mockReturnValue(envelope({ ...record, _mss_relatedcontact_value: activity, mss_RelatedContact: { contactid: activity, fullname: 'Reporter' } }))
    expect(h.call()).toMatchObject({ ok: true, record: { mss_datepublishedaired: '2026-10-16', '_mss_relatedcontact_value@OData.Community.Display.V1.FormattedValue': 'Reporter' } })
    expect(h.sdk.InvokeCustomApi.mock.calls[0]).toEqual(['post', 'mss_CoverageLocalTime', JSON.stringify({ UtcTime: record.mss_datepublishedaired })])
    expect((h.sdk.RetrieveRecord.mock.calls[0] as unknown as string[])[2]).toContain('$expand=mss_RelatedContact($select=contactid,fullname)')
  })
  test('uses bounded stable simple paging and caches identical date conversions', () => {
    const h = harness('GET', {}, { page: '2' })
    h.sdk.RetrieveMultipleRecords.mockReturnValue(envelope({ value: Array.from({ length: 15 }, () => record) }))
    expect(h.call()).toMatchObject({ ok: true, nextLink: '/_api/serverlogics/press-coverage?page=3', records: expect.arrayContaining([expect.objectContaining({ mss_datepublishedaired: '2026-10-16' })]) })
    const fetch = decodeURIComponent((h.sdk.RetrieveMultipleRecords.mock.calls[0] as unknown as string[])[1])
    expect(fetch).toContain('count="15" page="2"')
    expect(fetch).toContain('<order attribute="mss_isfeatured" descending="true" />')
    expect(fetch).toContain('<order attribute="createdon" descending="true" />')
    expect(fetch).toContain('<order attribute="mss_presscoverageid" descending="false" />')
    expect(fetch).not.toContain('all-attributes')
    expect(h.sdk.InvokeCustomApi).toHaveBeenCalledTimes(1)
  })
  test.each(['0', '-1', '1.1', '1 OR 1=1', '3334', '99999999999999999'])('rejects invalid or excessive page %s', (page) => {
    const h = harness('GET', {}, { page }); expect(h.call()).toMatchObject({ ok: false }); expect(h.sdk.RetrieveMultipleRecords).not.toHaveBeenCalled()
  })
  test('denies anonymous reads and missing read permission before file actions', () => {
    const h = harness('GET', {}, { operation: 'file', id }); h.server.User = null
    expect(h.call()).toMatchObject({ ok: false }); expect(h.sdk.InvokeCustomApi).not.toHaveBeenCalled()
    h.server.User = { id: contact }; h.sdk.RetrieveRecord.mockReturnValue(envelope({}, 403))
    expect(h.call()).toMatchObject({ ok: false }); expect(h.sdk.InvokeCustomApi).not.toHaveBeenCalled()
  })
  test('does not expose arbitrary entities, fields or unselected response data', () => {
    const h = harness('GET', {}, { entitySetName: 'contacts', query: '$select=*' })
    expect(h.call()).toMatchObject({ ok: false }); expect(h.sdk.RetrieveMultipleRecords).not.toHaveBeenCalled()
    const read = harness('GET', {}, { id })
    read.sdk.RetrieveRecord.mockReturnValue(envelope({ ...record, ownerid: 'private', arbitrary: 'private' }))
    expect(JSON.stringify(read.call())).not.toContain('private')
  })
  test('returns null continuation at the simple-paging boundary', () => {
    const h = harness('GET', {}, { page: '3333' })
    h.sdk.RetrieveMultipleRecords.mockReturnValue(envelope({ value: Array.from({ length: 15 }, () => record) }))
    expect(h.call()).toMatchObject({ ok: true, nextLink: null })
  })
})

describe('coverage server files', () => {
  const png = encode(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))
  const upload = { operation: 'upload', id, variant: 'press', fileName: 'clip.png', mimeType: 'image/png', data: png }
  test('authorizes write before file actions and keeps tokens private; retries target same record', () => {
    const h = harness('POST', upload)
    expect(h.call()).toEqual({ ok: true, id })
    expect(h.sdk.UpdateRecord.mock.invocationCallOrder[0]).toBeLessThan(h.sdk.InvokeCustomApi.mock.invocationCallOrder[0])
    expect(JSON.parse(h.sdk.InvokeCustomApi.mock.calls.find((call) => call[1] === 'InitializeFileBlocksUpload')![2]!)).toMatchObject({ Target: { '@odata.type': 'Microsoft.Dynamics.CRM.mss_presscoverage', mss_presscoverageid: id }, FileAttributeName: 'mss_coveragefile' })
    expect(h.call()).toEqual({ ok: true, id })
    expect(h.sdk.CreateRecord).not.toHaveBeenCalled()
  })
  test('stops noncreator file replacements when portal write permission rejects', () => {
    const h = harness('POST', upload); h.sdk.UpdateRecord.mockReturnValue(envelope({}, 403))
    expect(h.call()).toMatchObject({ ok: false, error: { code: 'forbidden' } }); expect(h.sdk.InvokeCustomApi).not.toHaveBeenCalled()
  })
  test.each([{ fileName: '../clip.png' }, { mimeType: 'image/svg+xml' }, { data: btoa('<script>') }, { data: '%%%%' }, { data: '' }, { mimeType: 'application/pdf' }, { fileName: 'x'.repeat(129) + '.png' }])('rejects unsafe upload %j', (invalid) => {
    const h = harness('POST', { ...upload, ...invalid }); expect(h.call()).toMatchObject({ ok: false }); expect(h.sdk.InvokeCustomApi).not.toHaveBeenCalled()
  })
  test('enforces featured raster-only 2MB and normal 10MB limits', () => {
    const h = harness('POST', { ...upload, data: 'A'.repeat(Math.ceil(10 * 1024 * 1024 / 3) * 4 + 4) })
    expect(h.call()).toMatchObject({ ok: false }); expect(h.sdk.InvokeCustomApi).not.toHaveBeenCalled()
    const featured = harness('POST', { ...upload, variant: 'featured', data: 'A'.repeat(3 * 1024 * 1024) })
    featured.sdk.RetrieveRecord.mockReturnValue(envelope({ ...record, mss_isfeatured: true }))
    expect(featured.call()).toMatchObject({ ok: false }); expect(featured.sdk.InvokeCustomApi).not.toHaveBeenCalled()
  })
  test('chunks large upload on base64 boundaries and commits ordered block IDs', () => {
    const bytes = new Uint8Array(3 * 1024 * 1024 + 1); bytes.set(decode(png))
    const h = harness('POST', { ...upload, data: encode(bytes) })
    expect(h.call()).toEqual({ ok: true, id })
    const blocks = h.sdk.InvokeCustomApi.mock.calls.filter((call) => call[1] === 'UploadBlock').map((call) => JSON.parse(call[2]!))
    expect(blocks.map((block) => block.BlockData).join('')).toBe(encode(bytes))
    expect(blocks.every((block) => /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(block.BlockId))).toBe(true)
    expect(new Set(blocks.map((block) => block.BlockId)).size).toBe(blocks.length)
    const commit = JSON.parse(h.sdk.InvokeCustomApi.mock.calls.find((call) => call[1] === 'CommitFileBlocksUpload')![2]!)
    expect(commit.BlockList).toEqual(blocks.map((block) => block.BlockId))
  })
  test('downloads aligned chunks without corrupting base64 or exposing continuation tokens', () => {
    const bytes = new Uint8Array(3 * 1024 * 1024 + 7); bytes.set(decode(png))
    const h = harness('GET', {}, { operation: 'file', id })
    h.sdk.InvokeCustomApi.mockImplementation((_method, action, payload) => {
      if (action === 'InitializeFileBlocksDownload') return envelope({ FileName: 'clip.png', FileSizeInBytes: bytes.length, FileContinuationToken: 'secret', IsChunkingSupported: true })
      const { Offset, BlockLength } = JSON.parse(payload!)
      return envelope({ Data: encode(bytes.subarray(Offset, Offset + BlockLength)) })
    })
    const output = h.call()
    expect(output).toEqual({ ok: true, fileName: 'clip.png', mimeType: 'image/png', data: encode(bytes) })
    expect(h.sdk.RetrieveRecord.mock.invocationCallOrder[0]).toBeLessThan(h.sdk.InvokeCustomApi.mock.invocationCallOrder[0])
  })
  test.each([{ FileSizeInBytes: 10 * 1024 * 1024 + 1 }, { FileName: 'unsafe.html' }, { FileContinuationToken: null }, { FileSizeInBytes: -1 }])('rejects invalid download metadata without requesting file blocks %j', (invalid) => {
    const h = harness('GET', {}, { operation: 'file', id })
    h.sdk.InvokeCustomApi.mockReturnValue(envelope({ FileName: 'clip.png', FileSizeInBytes: 8, FileContinuationToken: 'secret', IsChunkingSupported: true, ...invalid }))
    expect(h.call()).toMatchObject({ ok: false })
    expect(h.sdk.InvokeCustomApi).toHaveBeenCalledTimes(1)
  })
  test('uses one request when file storage does not support chunking', () => {
    const h = harness('GET', {}, { operation: 'file', id })
    h.sdk.InvokeCustomApi.mockImplementation((_method, name) => name === 'InitializeFileBlocksDownload' ? envelope({ FileName: 'clip.png', FileSizeInBytes: 8, FileContinuationToken: 'secret', IsChunkingSupported: false }) : envelope({ Data: png }))
    expect(h.call()).toMatchObject({ ok: true, data: png })
    expect(JSON.parse(h.sdk.InvokeCustomApi.mock.calls[1][2]!)).toMatchObject({ Offset: 0, BlockLength: 8 })
  })
  test('does not report upload success when committing the file fails', () => {
    const h = harness('POST', upload)
    const normal = h.sdk.InvokeCustomApi.getMockImplementation()!
    h.sdk.InvokeCustomApi.mockImplementation((method, name, payload) => name === 'CommitFileBlocksUpload' ? envelope({ error: 'private' }, 500) : normal(method, name, payload))
    expect(h.call()).toMatchObject({ ok: false, error: { code: 'unavailable' } })
    expect(h.sdk.CreateRecord).not.toHaveBeenCalled()
  })
})
