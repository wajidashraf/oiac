import { beforeEach, describe, expect, test, vi } from 'vitest'
import { powerPagesFetch, powerPagesRequest } from '../../shared/powerPagesApi'
import {
  buildContactLookupQuery,
  buildDistrictLookupQuery,
  buildMeetingReportPayload,
  buildRelationshipOperations,
  createMeetingReport,
  getMeetingReport,
  getMeetingReportCount,
  getMeetingReports,
  getMeetingReportProfile,
  runRelationshipOperations,
  searchContacts,
  updateMeetingReport,
  MeetingReportCreateOutcomeUnknownError,
} from './meetingReportService'
import type { MeetingReportDraft } from './meetingReportTypes'

vi.mock('../../shared/powerPagesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/powerPagesApi')>()
  return {
    ...actual,
    powerPagesFetch: vi.fn(),
    powerPagesRequest: vi.fn(),
  }
})

const fetchMock = vi.mocked(powerPagesFetch)
const requestMock = vi.mocked(powerPagesRequest)

const reportId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const contactId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const representativeId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const districtId = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const staffId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
const volunteerId = 'ffffffff-ffff-ffff-ffff-ffffffffffff'

const draft: MeetingReportDraft = {
  subject: 'District briefing',
  startDateTime: '2026-08-18T09:30',
  endDateTime: '2026-08-18T10:45',
  representativeId,
  districtId,
  meetingFormat: 2,
  staffIds: [staffId],
  volunteerIds: [volunteerId],
  issuesDiscussed: 'Constituent services',
  followUpActions: 'Send the policy brief',
  documentsProvided: 'Policy summary',
  sentiment: 1,
}

describe('meeting report queries and mapping', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('builds escaped global Contact queries with required job-role filters', () => {
    const staffQuery = decodeURIComponent(buildContactLookupQuery('staff', "O'Brien"))
    expect(staffQuery).toContain("contains(jobtitle,'Staff')")
    expect(staffQuery).toContain("contains(fullname,'O''Brien')")
    expect(staffQuery).toContain('$select=contactid,fullname,emailaddress1,jobtitle')
    expect(staffQuery).toContain('$top=15')
    expect(staffQuery).not.toContain('_mss_district_value eq')

    const volunteerQuery = decodeURIComponent(buildContactLookupQuery('volunteer', 'Sara'))
    expect(volunteerQuery).toContain("contains(jobtitle,'Volunteer')")

    const representativeQuery = decodeURIComponent(buildContactLookupQuery('representative', 'Office'))
    expect(representativeQuery).not.toContain('contains(jobtitle')
  })

  test('builds an escaped global District query', () => {
    const query = decodeURIComponent(buildDistrictLookupQuery("DC's 1st"))
    const filter = new URLSearchParams(buildDistrictLookupQuery("DC's 1st").slice(1)).get('$filter')
    expect(query).toContain('$select=mss_districtid,mss_number')
    expect(filter).toBe("contains(mss_number,'DC''s 1st')")
    expect(query).toContain('$top=15')
  })

  test('maps only persisted fields and binds the owner on create', () => {
    const payload = buildMeetingReportPayload(draft, contactId, true)

    expect(payload).toEqual({
      mss_subject: 'District briefing',
      mss_startdateandtime: new Date('2026-08-18T09:30').toISOString(),
      mss_enddateandtime: new Date('2026-08-18T10:45').toISOString(),
      'mss_Representative@odata.bind': `/contacts(${representativeId})`,
      'mss_District@odata.bind': `/mss_districts(${districtId})`,
      mss_meetingformat: 2,
      mss_writedownwhatthestaffsaidnotwhatyousaid: 'Constituent services',
      mss_followupnoteoncethemeetingended: 'Send the policy brief',
      mss_documentsprovided: 'Policy summary',
      mss_overallsentiment: 1,
      'mss_Reportedby@odata.bind': `/contacts(${contactId})`,
    })
    expect(payload).not.toHaveProperty('mss_dateofmeeting')
  })

  test('rejects a meeting whose end is not later than its start', () => {
    expect(() => buildMeetingReportPayload({
      ...draft,
      endDateTime: '2026-08-18T09:30',
    }, contactId, true)).toThrow('End Date and Time must be later than Start Date and Time.')
  })

  test('loads the authenticated profile and resolves its District label', async () => {
    fetchMock
      .mockResolvedValueOnce({
        contactid: `{${contactId.toUpperCase()}}`,
        fullname: 'Sara Rahimi',
        emailaddress1: 'sara@example.com',
        address1_city: 'Washington',
        address1_stateorprovince: 'DC',
        _mss_district_value: districtId,
      })
      .mockResolvedValueOnce({ mss_districtid: districtId, mss_number: 'District of Columbia' })

    await expect(getMeetingReportProfile(contactId)).resolves.toEqual({
      contactId,
      fullName: 'Sara Rahimi',
      email: 'sara@example.com',
      city: 'Washington',
      stateOrProvince: 'DC',
      districtId,
      districtName: 'District of Columbia',
    })
  })

  test('maps global Contact search results and rejects invalid records', async () => {
    fetchMock.mockResolvedValue({
      value: [{ contactid: staffId, fullname: 'OIAC Staff', emailaddress1: null, jobtitle: 'Senior Staff' }],
    })

    await expect(searchContacts('staff', 'OIAC')).resolves.toEqual([
      { id: staffId, name: 'OIAC Staff', email: null, jobTitle: 'Senior Staff' },
    ])
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/_api/contacts?'), { signal: undefined })
  })
})

describe('meeting report mutations', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('creates the report and captures the entityid response header', async () => {
    requestMock.mockResolvedValue(new Response(null, {
      status: 204,
      headers: { entityid: `{${reportId.toUpperCase()}}` },
    }))

    await expect(createMeetingReport(draft, contactId)).resolves.toBe(reportId)
    expect(requestMock).toHaveBeenCalledWith('/_api/mss_meetingreports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildMeetingReportPayload(draft, contactId, true)),
    })
  })

  test('marks a successful create without an entityid as an unknown outcome', async () => {
    requestMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(createMeetingReport(draft, contactId))
      .rejects.toBeInstanceOf(MeetingReportCreateOutcomeUnknownError)
  })

  test('marks an interrupted create request as an unknown outcome to prevent duplicate retry', async () => {
    requestMock.mockRejectedValue(new TypeError('network interrupted'))

    await expect(createMeetingReport(draft, contactId))
      .rejects.toBeInstanceOf(MeetingReportCreateOutcomeUnknownError)
  })

  test('patches an existing report without changing its owner', async () => {
    requestMock.mockResolvedValue(new Response(null, { status: 204 }))

    await updateMeetingReport(reportId, draft)

    const payload = buildMeetingReportPayload(draft, undefined, false)
    expect(payload).not.toHaveProperty('mss_Reportedby@odata.bind')
    expect(requestMock).toHaveBeenCalledWith(`/_api/mss_meetingreports(${reportId})`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  })

  test('loads an existing report with both relationship collections', async () => {
    fetchMock.mockResolvedValue({
      mss_meetingreportid: reportId,
      mss_subject: 'Existing meeting',
      mss_startdateandtime: '2026-08-18T12:30:00Z',
      mss_enddateandtime: '2026-08-18T13:45:00Z',
      _mss_representative_value: representativeId,
      '_mss_representative_value@OData.Community.Display.V1.FormattedValue': 'Rep. Carter',
      _mss_district_value: districtId,
      '_mss_district_value@OData.Community.Display.V1.FormattedValue': 'DC',
      mss_meetingformat: 2,
      mss_writedownwhatthestaffsaidnotwhatyousaid: 'Issues',
      mss_followupnoteoncethemeetingended: 'Follow up',
      mss_documentsprovided: 'One pager',
      mss_overallsentiment: 3,
      mss_MeetingReport_Contact_Staff: [{ contactid: staffId, fullname: 'Staff Person' }],
      mss_MeetingReport_Contact_Volunteers: [{ contactid: volunteerId, fullname: 'Volunteer Person' }],
    })

    const result = await getMeetingReport(reportId)
    expect(result.subject).toBe('Existing meeting')
    expect(new Date(result.startDateTime).getTime()).toBe(new Date('2026-08-18T12:30:00Z').getTime())
    expect(new Date(result.endDateTime).getTime()).toBe(new Date('2026-08-18T13:45:00Z').getTime())
    expect(result.documentsProvided).toBe('One pager')
    expect(result.representative).toEqual({ id: representativeId, name: 'Rep. Carter', email: null, jobTitle: null })
    expect(result.staff).toEqual([{ id: staffId, name: 'Staff Person', email: null, jobTitle: null }])
    expect(result.volunteers).toEqual([{ id: volunteerId, name: 'Volunteer Person', email: null, jobTitle: null }])
  })

  test('falls back to the legacy meeting date when start and end date-times are absent', async () => {
    fetchMock.mockResolvedValue({
      mss_meetingreportid: reportId,
      mss_subject: 'Legacy meeting',
      mss_dateofmeeting: '2026-08-18T12:00:00Z',
      _mss_representative_value: representativeId,
      '_mss_representative_value@OData.Community.Display.V1.FormattedValue': 'Rep. Carter',
      _mss_district_value: districtId,
      '_mss_district_value@OData.Community.Display.V1.FormattedValue': 'DC',
      mss_meetingformat: 2,
      mss_writedownwhatthestaffsaidnotwhatyousaid: 'Issues',
    })

    const result = await getMeetingReport(reportId)

    expect(result.startDateTime).toBe('2026-08-18T12:00')
    expect(result.endDateTime).toBe('')
  })

  test('retrieves a fifteen-record server page and exposes its continuation link', async () => {
    const nextLink = 'https://oiac-engage.powerappsportals.com/_api/mss_meetingreports?%24skiptoken=opaque-page-2'
    fetchMock.mockResolvedValue({
      value: [{
        mss_meetingreportid: reportId,
        mss_subject: 'Existing meeting',
        mss_startdateandtime: '2026-08-18T12:00:00Z',
        '_mss_representative_value@OData.Community.Display.V1.FormattedValue': 'Rep. Carter',
        mss_overallsentiment: 2,
      }],
      '@odata.nextLink': nextLink,
    })

    await expect(getMeetingReports()).resolves.toEqual({
      reports: [{
        id: reportId,
        subject: 'Existing meeting',
        representativeName: 'Rep. Carter',
        date: '2026-08-18T12:00:00Z',
        sentimentLabel: 'Supportive',
      }],
      hasNext: true,
      nextLink,
    })
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/_api\/mss_meetingreports\?/), {
      signal: undefined,
      headers: {
        Prefer: expect.stringMatching(/FormattedValue.*odata\.maxpagesize=15/),
      },
    })
    expect(decodeURIComponent(vi.mocked(fetchMock).mock.calls[0][0])).not.toContain('$top=100')
  })

  test('uses the legacy meeting date when a list record has no start date and time', async () => {
    fetchMock.mockResolvedValue({
      value: [{
        mss_meetingreportid: reportId,
        mss_subject: 'Legacy meeting',
        mss_dateofmeeting: '2026-08-18T12:00:00Z',
        '_mss_representative_value@OData.Community.Display.V1.FormattedValue': 'Rep. Carter',
      }],
    })

    const page = await getMeetingReports()

    expect(page.reports[0].date).toBe('2026-08-18T12:00:00Z')
  })

  test('limits the Home query to the five latest meeting dates', async () => {
    fetchMock.mockResolvedValue({ value: [] })

    await getMeetingReports({ limit: 5 })

    const requestUrl = new URL(vi.mocked(fetchMock).mock.calls[0][0], 'https://oiac-engage.powerappsportals.com')
    expect(requestUrl.searchParams.get('$orderby')).toBe('mss_startdateandtime desc,mss_meetingreportid asc')
    expect(requestUrl.searchParams.get('$top')).toBe('5')
  })

  test('loads the exact Contact-owned meeting report count for the Home KPI', async () => {
    const controller = new AbortController()
    fetchMock.mockResolvedValue({ '@odata.count': 7, value: [] })

    await expect(getMeetingReportCount(controller.signal)).resolves.toBe(7)

    const [requestPath, requestOptions] = fetchMock.mock.calls[0]
    const requestUrl = new URL(requestPath, 'https://oiac-engage.powerappsportals.com')
    expect(requestUrl.pathname).toBe('/_api/mss_meetingreports')
    expect(requestUrl.searchParams.get('$select')).toBe('mss_meetingreportid')
    expect(requestUrl.searchParams.get('$count')).toBe('true')
    expect(requestUrl.searchParams.get('$top')).toBe('1')
    expect(requestOptions).toEqual({ signal: controller.signal })
  })

  test('rejects an invalid Dataverse meeting report count', async () => {
    fetchMock.mockResolvedValue({ '@odata.count': '7', value: [] })

    await expect(getMeetingReportCount()).rejects.toThrow('invalid Meeting Report count')
  })

  test('uses a validated server continuation link for the next Reports page', async () => {
    const nextLink = '/_api/mss_meetingreports?%24skiptoken=opaque-page-2'
    fetchMock.mockResolvedValue({ value: [] })

    await getMeetingReports({ nextLink })

    expect(fetchMock).toHaveBeenCalledWith(nextLink, expect.objectContaining({ signal: undefined }))
  })

  test('builds only the relationship changes required for an update', () => {
    expect(buildRelationshipOperations(
      { staffIds: [staffId], volunteerIds: [volunteerId] },
      { staffIds: [staffId, contactId, contactId], volunteerIds: [] },
    )).toEqual([
      { action: 'add', relationship: 'staff', contactId },
      { action: 'remove', relationship: 'volunteer', contactId: volunteerId },
    ])
  })

  test('runs deduplicated N:N operations and returns only failures for retry', async () => {
    requestMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockRejectedValueOnce(new Error('association failed'))

    const failed = await runRelationshipOperations(reportId, [
      { action: 'add', relationship: 'staff', contactId: staffId },
      { action: 'add', relationship: 'staff', contactId: staffId },
      { action: 'remove', relationship: 'volunteer', contactId: volunteerId },
    ])

    expect(requestMock).toHaveBeenCalledTimes(2)
    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      `/_api/mss_meetingreports(${reportId})/mss_MeetingReport_Contact_Staff/$ref`,
      expect.objectContaining({ method: 'POST' }),
    )
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(
        new RegExp(`^/_api/mss_meetingreports\\(${reportId}\\)/mss_MeetingReport_Contact_Volunteers/\\$ref\\?\\$id=`),
      ),
      { method: 'DELETE' },
    )
    expect(failed).toEqual([
      { action: 'remove', relationship: 'volunteer', contactId: volunteerId },
    ])
  })
})
