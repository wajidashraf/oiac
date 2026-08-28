import { beforeEach, describe, expect, test, vi } from 'vitest'
import { powerPagesFetch, powerPagesRequest } from '../../shared/powerPagesApi'
import {
  buildContactLookupQuery,
  buildDistrictLookupQuery,
  buildMeetingReportPayload,
  buildRelationshipOperations,
  createMeetingReport,
  getMeetingReport,
  getMeetingReports,
  getMeetingReportProfile,
  runRelationshipOperations,
  searchContacts,
  updateMeetingReport,
} from './meetingReportService'
import type { MeetingReportDraft } from './meetingReportTypes'

vi.mock('../../shared/powerPagesApi', () => ({
  powerPagesFetch: vi.fn(),
  powerPagesRequest: vi.fn(),
}))

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
  date: '2026-08-18',
  representativeId,
  districtId,
  meetingFormat: 2,
  staffIds: [staffId],
  volunteerIds: [volunteerId],
  issuesDiscussed: 'Constituent services',
  outcomesNextSteps: 'UI only for now',
  followUpActions: 'Send the policy brief',
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
    expect(buildMeetingReportPayload(draft, contactId, true)).toEqual({
      mss_subject: 'District briefing',
      mss_dateofmeeting: '2026-08-18T12:00:00.000Z',
      'mss_Representative@odata.bind': `/contacts(${representativeId})`,
      'mss_District@odata.bind': `/mss_districts(${districtId})`,
      mss_meetingformat: 2,
      mss_writedownwhatthestaffsaidnotwhatyousaid: 'Constituent services',
      mss_followupnoteoncethemeetingended: 'Send the policy brief',
      mss_overallsentiment: 1,
      'mss_Reportedby@odata.bind': `/contacts(${contactId})`,
    })
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
      mss_dateofmeeting: '2026-08-18T12:00:00Z',
      _mss_representative_value: representativeId,
      '_mss_representative_value@OData.Community.Display.V1.FormattedValue': 'Rep. Carter',
      _mss_district_value: districtId,
      '_mss_district_value@OData.Community.Display.V1.FormattedValue': 'DC',
      mss_meetingformat: 2,
      mss_writedownwhatthestaffsaidnotwhatyousaid: 'Issues',
      mss_followupnoteoncethemeetingended: 'Follow up',
      mss_overallsentiment: 3,
      mss_MeetingReport_Contact_Staff: [{ contactid: staffId, fullname: 'Staff Person' }],
      mss_MeetingReport_Contact_Volunteers: [{ contactid: volunteerId, fullname: 'Volunteer Person' }],
    })

    const result = await getMeetingReport(reportId)
    expect(result.subject).toBe('Existing meeting')
    expect(result.date).toBe('2026-08-18')
    expect(result.representative).toEqual({ id: representativeId, name: 'Rep. Carter', email: null, jobTitle: null })
    expect(result.staff).toEqual([{ id: staffId, name: 'Staff Person', email: null, jobTitle: null }])
    expect(result.volunteers).toEqual([{ id: volunteerId, name: 'Volunteer Person', email: null, jobTitle: null }])
  })

  test('retrieves permitted reports for real record-specific edit links', async () => {
    fetchMock.mockResolvedValue({
      value: [{
        mss_meetingreportid: reportId,
        mss_subject: 'Existing meeting',
        mss_dateofmeeting: '2026-08-18T12:00:00Z',
        '_mss_representative_value@OData.Community.Display.V1.FormattedValue': 'Rep. Carter',
        mss_overallsentiment: 2,
      }],
    })

    await expect(getMeetingReports()).resolves.toEqual([{
      id: reportId,
      subject: 'Existing meeting',
      representativeName: 'Rep. Carter',
      date: '2026-08-18',
      sentimentLabel: 'Supportive',
    }])
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/_api\/mss_meetingreports\?/), {
      signal: undefined,
      headers: expect.objectContaining({ Prefer: expect.stringContaining('FormattedValue') }),
    })
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
      `/_api/mss_meetingreports(${reportId})/mss_MeetingReport_Contact_Volunteers(${volunteerId})/$ref`,
      { method: 'DELETE' },
    )
    expect(failed).toEqual([
      { action: 'remove', relationship: 'volunteer', contactId: volunteerId },
    ])
  })
})
