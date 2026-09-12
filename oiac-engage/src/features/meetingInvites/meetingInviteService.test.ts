import { beforeEach, describe, expect, test, vi } from 'vitest'
import { powerPagesFetch } from '../../shared/powerPagesApi'
import { getMeetingInvites, MEETING_INVITATION_STATUS } from './meetingInviteService'

vi.mock('../../shared/powerPagesApi', () => ({
  powerPagesFetch: vi.fn(),
  powerPagesRequest: vi.fn(),
}))

const CONTACT_ID = '11111111-1111-4111-8111-111111111111'
const DISTRICT_ID = '22222222-2222-4222-8222-222222222222'

function invite(overrides: Record<string, unknown>) {
  return {
    mss_meetinginvitesid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    mss_meetingtitle: 'All-volunteer briefing',
    mss_meetingstartdate: '2026-09-18T18:00:00Z',
    mss_meetingenddate: '2026-09-18T19:00:00Z',
    mss_meetingforall: false,
    mss_MeetingInvites_Contact_Contact: [],
    mss_MeetingInvites_mss_District_mss_District: [],
    ...overrides,
  }
}

describe('meeting invite queries and mapping', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('loads the profile, invites, and current-contact participants in parallel and keeps eligible invites', async () => {
    const pending: Array<(value: unknown) => void> = []
    vi.mocked(powerPagesFetch).mockImplementation(() => new Promise((resolve) => pending.push(resolve)))

    const resultPromise = getMeetingInvites(`{${CONTACT_ID.toUpperCase()}}`)
    expect(powerPagesFetch).toHaveBeenCalledTimes(3)

    const urls = vi.mocked(powerPagesFetch).mock.calls.map(([url]) => decodeURIComponent(url).replaceAll('+', ' '))
    expect(urls[0]).toContain(`/_api/contacts(${CONTACT_ID})?$select=contactid,fullname,_mss_district_value`)
    expect(urls[1]).toContain('/_api/mss_meetinginviteses?')
    expect(urls[1]).toContain('$expand=mss_MeetingInvites_Contact_Contact($select=contactid),mss_MeetingInvites_mss_District_mss_District($select=mss_districtid)')
    expect(urls[2]).toContain('/_api/mss_meetinginviteparticipants?')
    expect(urls[2]).toContain(`$filter=_mss_contact_value eq ${CONTACT_ID}`)

    pending[0]({ contactid: CONTACT_ID, fullname: 'Sara Rahimi', _mss_district_value: DISTRICT_ID })
    pending[1]({
      value: [
        invite({ mss_meetingforall: true }),
        invite({
          mss_meetinginvitesid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          mss_meetingtitle: 'Direct invitation',
          mss_meetingstartdate: '2026-09-16T18:00:00Z',
          mss_MeetingInvites_Contact_Contact: [{ contactid: `{${CONTACT_ID.toUpperCase()}}` }],
        }),
        invite({
          mss_meetinginvitesid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          mss_meetingtitle: 'District invitation',
          mss_meetingstartdate: '2026-09-17T18:00:00Z',
          mss_MeetingInvites_mss_District_mss_District: [{ mss_districtid: DISTRICT_ID }],
        }),
        invite({
          mss_meetinginvitesid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          mss_meetingtitle: 'Not eligible',
        }),
      ],
    })
    pending[2]({
      value: [{
        mss_meetinginviteparticipantid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        _mss_contact_value: CONTACT_ID,
        _mss_meetinginvite_value: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        mss_invitationstatus: MEETING_INVITATION_STATUS.pending,
        mss_acceptedon: null,
        mss_name: 'Direct invitation - Sara Rahimi',
      }],
    })

    await expect(resultPromise).resolves.toMatchObject({
      contactFullName: 'Sara Rahimi',
      invites: [
        { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', participant: { status: 2 } },
        { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', participant: null },
        { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', participant: null },
      ],
    })
  })

  test('chooses one deterministic participant using status, accepted date, and ID precedence', async () => {
    vi.mocked(powerPagesFetch)
      .mockResolvedValueOnce({ contactid: CONTACT_ID, fullname: 'Sara Rahimi', _mss_district_value: null })
      .mockResolvedValueOnce({ value: [invite({ mss_meetingforall: true })] })
      .mockResolvedValueOnce({ value: [
        {
          mss_meetinginviteparticipantid: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          _mss_contact_value: CONTACT_ID,
          _mss_meetinginvite_value: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          mss_invitationstatus: MEETING_INVITATION_STATUS.rejected,
          mss_acceptedon: '2026-09-12T12:00:00Z',
          mss_name: 'Rejected',
        },
        {
          mss_meetinginviteparticipantid: '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          _mss_contact_value: CONTACT_ID,
          _mss_meetinginvite_value: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          mss_invitationstatus: MEETING_INVITATION_STATUS.accepted,
          mss_acceptedon: '2026-09-12T11:00:00Z',
          mss_name: 'Accepted older',
        },
        {
          mss_meetinginviteparticipantid: '22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          _mss_contact_value: CONTACT_ID,
          _mss_meetinginvite_value: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          mss_invitationstatus: MEETING_INVITATION_STATUS.accepted,
          mss_acceptedon: '2026-09-12T13:00:00Z',
          mss_name: 'Accepted newest',
        },
      ] })

    const result = await getMeetingInvites(CONTACT_ID)
    expect(result.invites[0].participant?.id).toBe('22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  })

  test('sorts invalid dates last and rejects malformed response envelopes', async () => {
    vi.mocked(powerPagesFetch)
      .mockResolvedValueOnce({ contactid: CONTACT_ID, fullname: 'Sara Rahimi' })
      .mockResolvedValueOnce({ value: [
        invite({ mss_meetinginvitesid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', mss_meetingstartdate: 'not-a-date', mss_meetingforall: true }),
        invite({ mss_meetinginvitesid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', mss_meetingstartdate: 'not-a-date', mss_meetingforall: true }),
        invite({ mss_meetinginvitesid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', mss_meetingstartdate: '2026-09-10T10:00:00Z', mss_meetingforall: true }),
      ] })
      .mockResolvedValueOnce({ value: [] })

    await expect(getMeetingInvites(CONTACT_ID)).resolves.toMatchObject({
      invites: [
        { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
        { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      ],
    })

    vi.mocked(powerPagesFetch)
      .mockReset()
      .mockResolvedValueOnce({ contactid: CONTACT_ID, fullname: 'Sara Rahimi' })
      .mockResolvedValueOnce({ value: 'invalid' })
      .mockResolvedValueOnce({ value: [] })
    await expect(getMeetingInvites(CONTACT_ID)).rejects.toThrow('Meeting invites could not be loaded.')
  })
})
