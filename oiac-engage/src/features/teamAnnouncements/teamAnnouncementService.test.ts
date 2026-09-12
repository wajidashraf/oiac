import { beforeEach, describe, expect, test, vi } from 'vitest'
import { powerPagesFetch } from '../../shared/powerPagesApi'
import { getActiveTeamAnnouncements } from './teamAnnouncementService'

vi.mock('../../shared/powerPagesApi', () => ({ powerPagesFetch: vi.fn() }))

const NOW = new Date('2026-09-12T14:30:00.000Z')

function announcement(overrides: Record<string, unknown> = {}) {
  return {
    mss_teamsannouncementsid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    mss_title: 'Volunteer briefing update',
    mss_content: 'Please review the latest briefing materials.',
    mss_startdate: '2026-09-12T13:00:00.000Z',
    mss_enddate: '2026-09-12T16:00:00.000Z',
    mss_announcementlink: 'https://example.com/briefing',
    ...overrides,
  }
}

describe('active Teams announcements query and mapping', () => {
  beforeEach(() => vi.resetAllMocks())

  test('queries the active inclusive window and returns deterministic newest-first records', async () => {
    vi.mocked(powerPagesFetch).mockResolvedValue({
      value: [
        announcement({
          mss_teamsannouncementsid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          mss_title: 'Starts now',
          mss_startdate: NOW.toISOString(),
          mss_enddate: '2026-09-13T14:30:00.000Z',
        }),
        announcement({
          mss_teamsannouncementsid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          mss_title: 'Ends now',
          mss_startdate: '2026-09-11T14:30:00.000Z',
          mss_enddate: NOW.toISOString(),
        }),
        announcement({
          mss_teamsannouncementsid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          mss_title: 'Same start, first by ID',
          mss_startdate: '2026-09-12T12:00:00.000Z',
        }),
        announcement({
          mss_teamsannouncementsid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          mss_title: 'Same start, second by ID',
          mss_startdate: '2026-09-12T12:00:00.000Z',
        }),
      ],
    })

    const result = await getActiveTeamAnnouncements({ now: NOW })

    const [url, options] = vi.mocked(powerPagesFetch).mock.calls[0]
    const decodedUrl = decodeURIComponent(url).replace(/\+/g, ' ')
    expect(decodedUrl).toContain('/_api/mss_teamsannouncementses?')
    expect(decodedUrl).toContain('$select=mss_teamsannouncementsid,mss_announcementlink,mss_content,mss_enddate,mss_startdate,mss_title')
    expect(decodedUrl).toContain(`$filter=mss_startdate le ${NOW.toISOString()} and mss_enddate ge ${NOW.toISOString()}`)
    expect(decodedUrl).toContain('$orderby=mss_startdate desc,mss_teamsannouncementsid asc')
    expect(options).toEqual({ signal: undefined })
    expect(result.map((item) => item.title)).toEqual([
      'Starts now',
      'Same start, first by ID',
      'Same start, second by ID',
      'Ends now',
    ])
  })

  test('keeps only valid records active at the requested time and normalizes safe links', async () => {
    vi.mocked(powerPagesFetch).mockResolvedValue({ value: [
      announcement({ mss_title: 'Active secure link', mss_announcementlink: '  https://example.com/news  ' }),
      announcement({
        mss_teamsannouncementsid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        mss_title: 'Active http link',
        mss_announcementlink: 'http://example.com/news',
      }),
      announcement({
        mss_teamsannouncementsid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        mss_title: 'Unsafe link is hidden',
        mss_announcementlink: 'javascript:alert(1)',
      }),
      announcement({
        mss_teamsannouncementsid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        mss_title: 'Expired',
        mss_enddate: '2026-09-12T14:29:59.999Z',
      }),
      announcement({
        mss_teamsannouncementsid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        mss_title: 'Future',
        mss_startdate: '2026-09-12T14:30:00.001Z',
      }),
      announcement({
        mss_teamsannouncementsid: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        mss_title: 'Missing start',
        mss_startdate: null,
      }),
      announcement({
        mss_teamsannouncementsid: '11111111-1111-4111-8111-111111111111',
        mss_title: 'Invalid end',
        mss_enddate: 'not-a-date',
      }),
      announcement({
        mss_teamsannouncementsid: 'not-a-guid',
        mss_title: 'Invalid id',
      }),
    ] })

    const result = await getActiveTeamAnnouncements({ now: NOW })

    expect(result).toHaveLength(3)
    expect(result.map((item) => item.link)).toEqual([
      'https://example.com/news',
      'http://example.com/news',
      null,
    ])
  })

  test('accepts Dataverse sequential GUIDs used by announcement records', async () => {
    vi.mocked(powerPagesFetch).mockResolvedValue({ value: [
      announcement({
        mss_teamsannouncementsid: 'f9d7c399-a3ae-f111-aaac-70a8a5b12aa6',
        mss_title: 'Dataverse announcement',
      }),
    ] })

    const result = await getActiveTeamAnnouncements({ now: NOW })

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('f9d7c399-a3ae-f111-aaac-70a8a5b12aa6')
  })

  test.each([
    undefined,
    null,
    {},
    { value: null },
    { value: 'invalid' },
  ])('rejects malformed response envelope %#', async (response) => {
    vi.mocked(powerPagesFetch).mockResolvedValue(response)
    await expect(getActiveTeamAnnouncements({ now: NOW })).rejects.toThrow(
      'Teams announcements could not be loaded.',
    )
  })

  test('rejects an invalid effective date without making a request', async () => {
    await expect(getActiveTeamAnnouncements({ now: new Date('invalid') })).rejects.toThrow(
      'A valid announcement date is required.',
    )
    expect(powerPagesFetch).not.toHaveBeenCalled()
  })

  test('passes the supplied abort signal through to Power Pages', async () => {
    vi.mocked(powerPagesFetch).mockResolvedValue({ value: [] })
    const controller = new AbortController()

    await getActiveTeamAnnouncements({ now: NOW, signal: controller.signal })

    expect(powerPagesFetch).toHaveBeenCalledWith(expect.any(String), { signal: controller.signal })
  })
})
