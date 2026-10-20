import { describe, expect, test, vi, beforeEach } from 'vitest'
import { listSiteActivity, getSiteActivity } from './siteActivityLogService'
import { powerPagesFetch } from '../../shared/powerPagesApi'
vi.mock('../../shared/powerPagesApi', async (original) => ({ ...await original<typeof import('../../shared/powerPagesApi')>(), powerPagesFetch: vi.fn() }))
const fetchMock = vi.mocked(powerPagesFetch)
const id = '11111111-1111-4111-8111-111111111111'
const entry = { id, actorName: 'Alice', module: 866530000, action: 866530000, recordType: 'mss_meetingreport', recordId: id, recordTitle: 'Report', occurredOn: '2026-10-19T10:00:00Z', summary: 'Report created' }
const query = { scope: 'mine' as const, page: 1, module: null, action: null, from: null, to: null }
beforeEach(() => vi.resetAllMocks())
describe('site activity reader', () => {
 test('posts session-scoped query and unwraps the server envelope', async () => {
  fetchMock.mockResolvedValue({ success: true, data: JSON.stringify({ ok: true, entries: [entry], nextPage: 2, totalCount: null, canViewAll: false }) })
  expect(await listSiteActivity(query)).toMatchObject({ entries: [entry], nextPage: 2, canViewAll: false })
  expect(fetchMock).toHaveBeenCalledWith('/_api/serverlogics/site-activity-log', expect.objectContaining({ method: 'POST', body: JSON.stringify({ command: 'list', payload: query }) }))
 })
 test.each([{ ...query, page: 0 }, { ...query, module: 123 }, { ...query, from: '2026-10-19' }, { ...query, from: '2026-10-20T00:00:00Z', to: '2026-10-19T00:00:00Z' }])('rejects invalid filters before sending', async (invalid) => {
  await expect(listSiteActivity(invalid)).rejects.toThrow()
  expect(fetchMock).not.toHaveBeenCalled()
 })
 test.each([{ ...entry, occurredOn: 'bad' }, { ...entry, actorName: 'x'.repeat(101) }, { ...entry, action: '866530000' }])('rejects malformed rows', async (invalid) => {
  fetchMock.mockResolvedValue({ ok: true, entries: [invalid], nextPage: null, totalCount: null, canViewAll: false })
  await expect(listSiteActivity(query)).rejects.toThrow()
 })
 test('does not display arbitrary server error text', async () => {
  fetchMock.mockResolvedValue({ ok: false, error: { code: 'forbidden', message: 'secret' } })
  await expect(listSiteActivity(query)).rejects.toThrow('You do not have access to this activity history.')
 })
 test('validates detail identity and details capacity', async () => {
  await expect(getSiteActivity('bad', 'mine')).rejects.toThrow()
  fetchMock.mockResolvedValue({ ok: true, entry: { ...entry, details: { note: 'x'.repeat(4001) } } })
  await expect(getSiteActivity(id, 'mine')).rejects.toThrow()
 })
})
test('rejects calendar rollover timestamps and cross-entry detail responses', async () => {
 fetchMock.mockResolvedValue({ ok: true, entries: [{ ...entry, occurredOn: '2026-02-30T00:00:00Z' }], nextPage: null, totalCount: null, canViewAll: false })
 await expect(listSiteActivity(query)).rejects.toThrow()
 fetchMock.mockResolvedValue({ ok: true, entry: { ...entry, id: '22222222-2222-4222-8222-222222222222', details: {} } })
 await expect(getSiteActivity(id, 'mine')).rejects.toThrow()
})
test('accepts actual native round-trip seven-digit UTC timestamps without losing the original', async () => {
 const occurredOn = '2026-10-19T10:00:00.1234567Z'
 fetchMock.mockResolvedValue({ ok: true, entries: [{ ...entry, occurredOn }], nextPage: null, totalCount: null, canViewAll: false })
 expect((await listSiteActivity(query)).entries[0].occurredOn).toBe(occurredOn)
})
