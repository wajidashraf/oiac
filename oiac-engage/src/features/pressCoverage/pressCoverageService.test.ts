import { beforeEach, describe, expect, test, vi } from 'vitest'
import { PowerPagesApiError, powerPagesFetch } from '../../shared/powerPagesApi'
import {
  canEditCoverage, coverageListing, createCoverage, displayCoverageDate,
  getCoverage, getCoveragePage, searchCoverageContacts, updateCoverage, CoverageSaveUncertainError,
} from './pressCoverageService'
import { emptyCoverageDraft } from './pressCoverageTypes'
import type { CoverageDraft, CoverageRecord } from './pressCoverageTypes'

vi.mock('../../shared/powerPagesApi', async (original) => ({
  ...await original<typeof import('../../shared/powerPagesApi')>(), powerPagesFetch: vi.fn(),
}))
const fetchMock = vi.mocked(powerPagesFetch)
const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const contactId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const draft = (): CoverageDraft => ({ ...emptyCoverageDraft(), headlineTitle: 'Coverage', mediaOutlet: 'News', datePublishedAired: '2026-10-16', coverageType: 866530000 })
const record = (): CoverageRecord => ({ ...draft(), id, isFeatured: false, submittedById: contactId, fileName: null, fileId: null })
beforeEach(() => vi.resetAllMocks())

describe('coverage reads', () => {
  test('loads one bounded server page with cancellation', async () => {
    const signal = new AbortController().signal
    fetchMock.mockResolvedValue({ ok: true, records: [{ mss_presscoverageid: id, mss_headlinetitle: 'Story', mss_coveragetype: 866530000, 'mss_coveragetype@OData.Community.Display.V1.FormattedValue': 'Télévision', _mss_submittedby_value: contactId, mss_coveragefile_name: 'clip.pdf', mss_coveragefile: contactId }], nextLink: '/_api/serverlogics/press-coverage?page=2' })
    const page = await getCoveragePage({}, signal)
    expect(page.records[0]).toMatchObject({ id, headlineTitle: 'Story', submittedById: contactId, fileName: 'clip.pdf', fileId: contactId })
    expect(coverageListing(page.records[0]).coverageType).toBe('Télévision')
    expect(page.nextLink).toBe('/_api/serverlogics/press-coverage?page=2')
    const [path, options] = fetchMock.mock.calls[0]
    expect(path).toBe('/_api/serverlogics/press-coverage?page=1')
    expect(options?.signal).toBe(signal)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  test('follows a validated continuation without preloading additional pages', async () => {
    fetchMock.mockResolvedValue({ success: true, data: JSON.stringify({ ok: true, records: [], nextLink: null }) })
    await expect(getCoveragePage({ nextLink: `${window.location.origin}/_api/serverlogics/press-coverage?page=2` })).resolves.toEqual({ records: [], nextLink: null })
    expect(fetchMock.mock.calls[0][0]).toBe('/_api/serverlogics/press-coverage?page=2')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  test('preserves read cancellation and rejects oversized pages', async () => {
    const aborted = new DOMException('Aborted', 'AbortError')
    fetchMock.mockRejectedValueOnce(aborted)
    await expect(getCoveragePage()).rejects.toBe(aborted)
    fetchMock.mockResolvedValueOnce({ ok: true, records: Array.from({ length: 16 }, () => ({ mss_presscoverageid: id })), nextLink: null })
    await expect(getCoveragePage()).rejects.toThrow()
  })
  test.each(['https://evil.example/_api/serverlogics/press-coverage?page=2', '/_api/contacts?page=2', '/_api/serverlogics/press-coverage?page=2#evil', '/_api/serverlogics/press-coverage?page=0', '/_api/serverlogics/press-coverage?page=2&id=x', '/_api/serverlogics/press-coverage?page=2&page=3'])('rejects unsafe continuation %s before requesting', async (nextLink) => {
    await expect(getCoveragePage({ nextLink })).rejects.toThrow(/continuation/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  test('validates server continuation and malformed page/record payloads', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, records: [], nextLink: 'https://evil.example/_api/serverlogics/press-coverage?page=2' })
    await expect(getCoveragePage()).rejects.toThrow(/continuation/i)
    fetchMock.mockResolvedValueOnce({ ok: true, records: null })
    await expect(getCoveragePage()).rejects.toThrow()
    fetchMock.mockResolvedValueOnce({ ok: true, records: [{ mss_presscoverageid: 'wrong' }], nextLink: null })
    await expect(getCoveragePage()).rejects.toThrow()
  })
  test('fetches the latest record and maps Related Contact separately from creator', async () => {
    fetchMock.mockResolvedValue({ ok: true, record: { mss_presscoverageid: id, mss_isfeatured: true, _mss_relatedcontact_value: contactId, '_mss_relatedcontact_value@OData.Community.Display.V1.FormattedValue': 'Reporter', _mss_submittedby_value: id } })
    await expect(getCoverage(id)).resolves.toMatchObject({ id, isFeatured: true, submittedById: id, relatedContact: { id: contactId, name: 'Reporter', email: null, jobTitle: null } })
    expect(fetchMock.mock.calls[0][0]).toBe(`/_api/serverlogics/press-coverage?id=${id}`)
  })
  test('uses variant preference and legacy fallbacks without numeric choice labels', () => {
    expect(coverageListing({ ...record(), isFeatured: true, headline: 'Featured', publication: 'Outlet', publicationDate: '2026-10-14' })).toEqual({ headline: 'Featured', mediaOutlet: 'Outlet', date: '2026-10-14', coverageType: 'Featured Coverage', tone: '—', coverageLevel: '—' })
    expect(coverageListing({ ...record(), isFeatured: true })).toMatchObject({ headline: 'Coverage', mediaOutlet: 'News', date: '2026-10-16' })
    expect(coverageListing({ ...record(), coverageType: 999, coverageLevel: 866530002, tone: 866530003 })).toMatchObject({ coverageType: '—', coverageLevel: 'Local', tone: 'Negative' })
  })
  test('limits and escapes narrow Contact search', async () => {
    fetchMock.mockResolvedValue({ value: [{ contactid: contactId, fullname: 'Reporter' }] })
    await expect(searchCoverageContacts(" O'Brien ")).resolves.toEqual([{ id: contactId, name: 'Reporter', email: null, jobTitle: null }])
    const query = new URL(fetchMock.mock.calls[0][0], window.location.origin).searchParams
    expect(query.get('$select')).toBe('contactid,fullname')
    expect(query.get('$filter')).toBe("contains(fullname,'O''Brien')")
    expect(query.get('$top')).toBe('15')
  })
  test('only permits the creator or an administrator to edit', () => {
    expect(canEditCoverage(record(), `{${contactId.toUpperCase()}}`, false)).toBe(true)
    expect(canEditCoverage(record(), id, false)).toBe(false)
    expect(canEditCoverage({ ...record(), submittedById: null }, contactId, false)).toBe(false)
    expect(canEditCoverage({ ...record(), submittedById: null }, contactId, true)).toBe(true)
  })
  test('displays valid calendar dates without shifting timezone or accepting rollover dates', () => {
    expect(displayCoverageDate('2026-10-16')).toBe('Oct 16, 2026')
    expect(displayCoverageDate('2026-02-30')).toBe('—')
    expect(displayCoverageDate('')).toBe('—')
  })
  test('preserves canonical business dates from the server and rejects raw UserLocal timestamps', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, record: { mss_presscoverageid: id, mss_datepublishedaired: '2026-10-16', mss_publicationdate: '2026-10-15' } })
    await expect(getCoverage(id)).resolves.toMatchObject({ datePublishedAired: '2026-10-16', publicationDate: '2026-10-15' })
    fetchMock.mockResolvedValueOnce({ ok: true, record: { mss_presscoverageid: id, mss_datepublishedaired: '2026-10-15T21:00:00Z' } })
    await expect(getCoverage(id)).rejects.toThrow(/date/i)
  })
})

describe('coverage mutations', () => {
  test('unwraps the actual Power Pages ServerLogic transport envelope and sanitizes transport errors', async () => {
    fetchMock.mockResolvedValueOnce({ requestId: 'trace', success: true, serverLogicName: 'press-coverage', data: JSON.stringify({ ok: true, id }), error: null })
    await expect(createCoverage('press', draft())).resolves.toEqual({ id })
    fetchMock.mockResolvedValueOnce({ requestId: 'trace', success: false, serverLogicName: 'press-coverage', data: null, error: 'secret upstream detail' })
    await expect(createCoverage('press', draft())).rejects.toBeInstanceOf(CoverageSaveUncertainError)
  })
  test('rejects text longer than verified attribute limits', async () => {
    await expect(createCoverage('press', { ...draft(), summary: 'a'.repeat(101) })).rejects.toThrow(/100/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  test('creates through server logic with variant-only fields and no creator/classification', async () => {
    fetchMock.mockResolvedValue({ ok: true, id })
    await expect(createCoverage('press', { ...draft(), headline: 'ignored', relatedContact: { id: contactId, name: 'Reporter', email: null, jobTitle: null } })).resolves.toEqual({ id })
    const [path, options] = fetchMock.mock.calls[0]
    expect(path).toBe('/_api/serverlogics/press-coverage')
    expect(options?.method).toBe('POST')
    const body = JSON.parse(String(options?.body))
    expect(body.operation).toBe('create')
    expect(body.variant).toBe('press')
    expect(body.fields).toMatchObject({ mss_headlinetitle: 'Coverage', mss_relatedcontact: contactId, mss_datepublishedaired: expect.any(String), mss_coveragetype: 866530000 })
    expect(body.fields).not.toHaveProperty('mss_headline')
    expect(body.fields).not.toHaveProperty('mss_submittedby')
    expect(body.fields).not.toHaveProperty('mss_isfeatured')
  })
  test('uses verified business column names and preserves explicit false choices', async () => {
    fetchMock.mockResolvedValue({ ok: true, id })
    await createCoverage('press', { ...draft(), eventCampaign: 'Rally', personInterviewed: 'Speaker', reporter: 'Journalist', oiacMentioned: false, followUpNeeded: false })
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).fields).toMatchObject({ mss_oiaceventcampaign: 'Rally', mss_personinterviewedquoted: 'Speaker', mss_reporterjournalist: 'Journalist', mss_oiacmentioned: false, mss_followupneeded: false })
  })
  test('featured writes contain only featured attributes and cleared edit values use null', async () => {
    fetchMock.mockResolvedValue({ ok: true, id })
    await createCoverage('featured', { ...draft(), headline: 'Featured', publication: 'News', publicationDate: '2026-10-16', shortSummary: 'Summary', originalArticleLink: 'https://example.com/article' })
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ operation: 'create', variant: 'featured', fields: { mss_headline: 'Featured', mss_publication: 'News', mss_publicationdate: '2026-10-16', mss_shortsummary: 'Summary', mss_originalarticlelink: 'https://example.com/article' } })
    await updateCoverage(id, 'press', { ...draft(), mediaOutlet: '' }, record())
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).fields).toEqual({ mss_mediaoutlet: null })
  })
  test('sends only changed variant-owned values and preserves hidden legacy fields', async () => {
    fetchMock.mockResolvedValue({ ok: true, id })
    await updateCoverage(id, 'press', { ...draft(), summary: 'Updated', headline: 'do not write' }, record())
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ operation: 'update', id, variant: 'press', fields: { mss_summary: 'Updated' } })
    expect(fetchMock.mock.calls[0][1]?.method).toBe('PATCH')
  })
  test('blocks variant changes and invalid values before sending', async () => {
    await expect(updateCoverage(id, 'featured', draft(), record())).rejects.toThrow(/variant/i)
    await expect(createCoverage('press', { ...draft(), datePublishedAired: '2026-02-30' })).rejects.toThrow(/date/i)
    await expect(createCoverage('press', { ...draft(), articleVideoUrl: 'javascript:alert(1)' })).rejects.toThrow(/HTTP/i)
    await expect(createCoverage('press', { ...draft(), coverageType: 123 })).rejects.toThrow(/choice/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  test('unwraps one encoded server response and respects explicit rejection', async () => {
    fetchMock.mockResolvedValueOnce(JSON.stringify({ ok: true, id }))
    await expect(createCoverage('press', draft())).resolves.toEqual({ id })
    fetchMock.mockResolvedValueOnce({ ok: false, error: { code: 'FORBIDDEN', message: 'Denied' } })
    await expect(createCoverage('press', draft())).rejects.toThrow('Denied')
  })
  test.each([undefined, {}, { ok: true, id: 'invalid' }, JSON.stringify(JSON.stringify({ ok: true, id }))])('marks malformed success as uncertain without retry', async (response) => {
    fetchMock.mockResolvedValue(response)
    await expect(createCoverage('press', draft())).rejects.toBeInstanceOf(CoverageSaveUncertainError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  test('marks interrupted and 5xx creates uncertain but preserves definite 4xx rejection', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network'))
    await expect(createCoverage('press', draft())).rejects.toBeInstanceOf(CoverageSaveUncertainError)
    fetchMock.mockRejectedValueOnce(new PowerPagesApiError('server', 500))
    await expect(createCoverage('press', draft())).rejects.toBeInstanceOf(CoverageSaveUncertainError)
    fetchMock.mockRejectedValueOnce(new PowerPagesApiError('timeout', 408))
    await expect(createCoverage('press', draft())).rejects.toBeInstanceOf(CoverageSaveUncertainError)
    fetchMock.mockRejectedValueOnce(new PowerPagesApiError('denied', 403))
    await expect(createCoverage('press', draft())).rejects.toMatchObject({ status: 403 })
  })
  test.each(['unavailable', 'unknown', undefined])('treats server error %s as an uncertain create result', async (code) => {
    fetchMock.mockResolvedValueOnce({ success: true, data: JSON.stringify({ ok: false, error: { code, message: 'Try later' } }) })
    await expect(createCoverage('press', draft())).rejects.toBeInstanceOf(CoverageSaveUncertainError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  test.each(['validation', 'unauthenticated', 'forbidden'])('preserves definite pre-write rejection %s', async (code) => {
    fetchMock.mockResolvedValueOnce({ success: true, data: JSON.stringify({ ok: false, error: { code, message: 'Rejected before write' } }) })
    await expect(createCoverage('press', draft())).rejects.toMatchObject({ code, message: 'Rejected before write' })
  })
})
