import { beforeEach, describe, expect, test, vi } from 'vitest'
import { PowerPagesDataError, powerPagesFetch, powerPagesRequest } from '../../shared/powerPagesApi'
import {
  acceptMeetingInvite,
  getMeetingInvites,
  MEETING_INVITATION_STATUS,
} from './meetingInviteService'
import type { MeetingInvite } from './meetingInviteTypes'

vi.mock('../../shared/powerPagesApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../shared/powerPagesApi')>(),
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
    mss_meetinglink: 'https://teams.microsoft.com/l/meetup-join/all-volunteer-briefing',
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

    const urls = vi.mocked(powerPagesFetch).mock.calls.map(([url]) => decodeURIComponent(url).replace(/\+/g, ' '))
    expect(urls[0]).toContain(`/_api/contacts(${CONTACT_ID})?$select=contactid,fullname,_mss_district_value`)
    expect(urls[1]).toContain('/_api/mss_meetinginviteses?')
    expect(urls[1]).toContain('$select=mss_meetinginvitesid,mss_meetingenddate,mss_meetingforall,mss_meetingstartdate,mss_meetingtitle,mss_meetinglink')
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
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          meetingLink: 'https://teams.microsoft.com/l/meetup-join/all-volunteer-briefing',
          participant: { status: 2 },
        },
        {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          meetingLink: 'https://teams.microsoft.com/l/meetup-join/all-volunteer-briefing',
          participant: null,
        },
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          meetingLink: 'https://teams.microsoft.com/l/meetup-join/all-volunteer-briefing',
          participant: null,
        },
      ],
    })
  })

  test('keeps trimmed HTTP meeting links and rejects unsafe or unusable links', async () => {
    const rows = [
      ['11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '  https://teams.microsoft.com/l/meetup-join/briefing  ', 'https://teams.microsoft.com/l/meetup-join/briefing'],
      ['22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'javascript:alert(1)', null],
      ['33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'mailto:person@example.com', null],
      ['44444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '/relative/path', null],
      ['55555555-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'not a URL', null],
      ['66666666-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '   ', null],
      ['77777777-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'http://example.com/meeting', 'http://example.com/meeting'],
      ['88888888-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 123, null],
    ] as const
    vi.mocked(powerPagesFetch)
      .mockResolvedValueOnce({ contactid: CONTACT_ID, fullname: 'Sara Rahimi', _mss_district_value: null })
      .mockResolvedValueOnce({ value: rows.map(([id, meetingLink]) => invite({
        mss_meetinginvitesid: id,
        mss_meetingforall: true,
        mss_meetinglink: meetingLink,
      })) })
      .mockResolvedValueOnce({ value: [] })

    const result = await getMeetingInvites(CONTACT_ID)

    expect(result.invites.map(({ id, meetingLink }) => ({ id, meetingLink }))).toEqual(
      rows.map(([id, , meetingLink]) => ({ id, meetingLink })),
    )
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

  test('skips an older orphan participant with a null Meeting Invite lookup', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.mocked(powerPagesFetch)
      .mockResolvedValueOnce({
        contactid: `{${CONTACT_ID.toUpperCase()}}`,
        fullname: 'Nabeel1 Ahmad',
        _mss_district_value: DISTRICT_ID,
      })
      .mockResolvedValueOnce({ value: [invite({ mss_meetingforall: true })] })
      .mockResolvedValueOnce({ value: [{
        mss_meetinginviteparticipantid: '62b6e1de-4ab0-f111-aaac-7ced8d3c2947',
        _mss_contact_value: `{${CONTACT_ID.toUpperCase()}}`,
        _mss_meetinginvite_value: null,
        mss_invitationstatus: MEETING_INVITATION_STATUS.accepted,
        mss_acceptedon: '2026-09-14T14:45:07Z',
        mss_name: 'test - Nabeel1 Ahmad',
      }] })

    await expect(getMeetingInvites(CONTACT_ID)).resolves.toMatchObject({
      contactFullName: 'Nabeel1 Ahmad',
      invites: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', participant: null }],
    })
    expect(warning).toHaveBeenCalledWith(
      '[MeetingInvites] skipped invalid participant rows',
      { skippedCount: 1, totalCount: 1 },
    )
  })

  test('accepts missing profile fields, district, and relationship expansions as empty values', async () => {
    vi.mocked(powerPagesFetch)
      .mockResolvedValueOnce({ contactid: CONTACT_ID })
      .mockResolvedValueOnce({ value: [
        invite({
          mss_meetingforall: true,
          mss_MeetingInvites_Contact_Contact: undefined,
          mss_MeetingInvites_mss_District_mss_District: null,
        }),
      ] })
      .mockResolvedValueOnce({ value: [] })

    await expect(getMeetingInvites(CONTACT_ID)).resolves.toMatchObject({
      contactFullName: 'Portal user',
      invites: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
    })
  })

  test('normalizes Contact and District GUIDs before evaluating invite eligibility', async () => {
    vi.mocked(powerPagesFetch)
      .mockResolvedValueOnce({
        contactid: `{${CONTACT_ID.toUpperCase()}}`,
        fullname: 'Multi Role User',
        _mss_district_value: `{${DISTRICT_ID.toUpperCase()}}`,
      })
      .mockResolvedValueOnce({ value: [
        invite({
          mss_MeetingInvites_Contact_Contact: [{ contactid: `{${CONTACT_ID.toUpperCase()}}` }],
        }),
        invite({
          mss_meetinginvitesid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          mss_MeetingInvites_mss_District_mss_District: [
            { mss_districtid: `{${DISTRICT_ID.toUpperCase()}}` },
          ],
        }),
      ] })
      .mockResolvedValueOnce({ value: [] })

    await expect(getMeetingInvites(CONTACT_ID)).resolves.toMatchObject({
      invites: [
        { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      ],
    })
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
    await expect(getMeetingInvites(CONTACT_ID)).rejects.toBeInstanceOf(PowerPagesDataError)
  })
})

describe('accepting a meeting invite', () => {
  const acceptedAt = new Date('2026-09-12T14:30:00.000Z')
  const baseInvite: MeetingInvite = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'District Briefing',
    startDateTime: '2026-09-18T18:00:00Z',
    endDateTime: '2026-09-18T19:00:00Z',
    meetingLink: 'https://teams.microsoft.com/l/meetup-join/district-briefing',
    participant: null,
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('keeps an already accepted participant without writing', async () => {
    const participant = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      contactId: CONTACT_ID,
      meetingInviteId: baseInvite.id,
      status: MEETING_INVITATION_STATUS.accepted,
      acceptedOn: '2026-09-10T10:00:00Z',
      name: 'District Briefing - Sara Rahimi',
    } as const

    await expect(acceptMeetingInvite({
      contactId: CONTACT_ID,
      contactFullName: 'Sara Rahimi',
      invite: { ...baseInvite, participant },
    }, acceptedAt)).resolves.toEqual(participant)
    expect(powerPagesRequest).not.toHaveBeenCalled()
  })

  test.each([
    MEETING_INVITATION_STATUS.pending,
    MEETING_INVITATION_STATUS.rejected,
  ])('patches an existing status %s participant to Accepted', async (status) => {
    const participant = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      contactId: CONTACT_ID,
      meetingInviteId: baseInvite.id,
      status,
      acceptedOn: null,
      name: 'District Briefing - Sara Rahimi',
    } as const
    vi.mocked(powerPagesRequest).mockResolvedValue(new Response(null, { status: 204 }))

    const result = await acceptMeetingInvite({
      contactId: CONTACT_ID,
      contactFullName: 'Sara Rahimi',
      invite: { ...baseInvite, participant },
    }, acceptedAt)

    expect(powerPagesRequest).toHaveBeenCalledWith(
      `/_api/mss_meetinginviteparticipants(${participant.id})`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mss_invitationstatus: MEETING_INVITATION_STATUS.accepted,
          mss_acceptedon: acceptedAt.toISOString(),
        }),
      },
    )
    expect(result).toMatchObject({ status: 1, acceptedOn: acceptedAt.toISOString() })
  })

  test('creates a participant with both Dataverse bindings when no participant exists', async () => {
    const participantId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    vi.mocked(powerPagesRequest).mockResolvedValue(new Response(null, {
      status: 204,
      headers: { entityid: `{${participantId.toUpperCase()}}` },
    }))

    const result = await acceptMeetingInvite({
      contactId: CONTACT_ID,
      contactFullName: 'Sara Rahimi',
      invite: baseInvite,
    }, acceptedAt)

    expect(powerPagesRequest).toHaveBeenCalledWith('/_api/mss_meetinginviteparticipants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mss_name: 'District Briefing - Sara Rahimi',
        mss_invitationstatus: MEETING_INVITATION_STATUS.accepted,
        mss_acceptedon: acceptedAt.toISOString(),
        'mss_Contact@odata.bind': `/contacts(${CONTACT_ID})`,
        'mss_MeetingInvite@odata.bind': `/mss_meetinginviteses(${baseInvite.id})`,
      }),
    })
    expect(result).toEqual({
      id: participantId,
      contactId: CONTACT_ID,
      meetingInviteId: baseInvite.id,
      status: MEETING_INVITATION_STATUS.accepted,
      acceptedOn: acceptedAt.toISOString(),
      name: 'District Briefing - Sara Rahimi',
    })
  })

  test('recovers a committed create with a narrow participant query when entityid is missing', async () => {
    const participantId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    vi.mocked(powerPagesRequest).mockResolvedValue(new Response(null, { status: 204 }))
    vi.mocked(powerPagesFetch).mockResolvedValue({ value: [{
      mss_meetinginviteparticipantid: participantId,
      _mss_contact_value: CONTACT_ID,
      _mss_meetinginvite_value: baseInvite.id,
      mss_invitationstatus: MEETING_INVITATION_STATUS.accepted,
      mss_acceptedon: acceptedAt.toISOString(),
      mss_name: 'District Briefing - Sara Rahimi',
    }] })

    await expect(acceptMeetingInvite({
      contactId: CONTACT_ID,
      contactFullName: 'Sara Rahimi',
      invite: baseInvite,
    }, acceptedAt)).resolves.toMatchObject({ id: participantId, status: 1 })
    expect(decodeURIComponent(vi.mocked(powerPagesFetch).mock.calls[0][0]).replace(/\+/g, ' '))
      .toContain(`$filter=_mss_contact_value eq ${CONTACT_ID} and _mss_meetinginvite_value eq ${baseInvite.id}`)
  })
})
