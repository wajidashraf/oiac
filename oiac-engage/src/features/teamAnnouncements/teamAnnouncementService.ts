import { powerPagesFetch } from '../../shared/powerPagesApi'
import type { TeamAnnouncement, TeamAnnouncementQuery } from './teamAnnouncementTypes'

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SELECT_FIELDS = [
  'mss_teamsannouncementsid',
  'mss_announcementlink',
  'mss_content',
  'mss_enddate',
  'mss_startdate',
  'mss_title',
].join(',')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function validDateTime(value: unknown): { value: string; time: number } | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return null
  return { value, time }
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function mapAnnouncement(value: unknown, now: number): TeamAnnouncement | null {
  if (!isRecord(value)) return null

  const id = requiredText(value.mss_teamsannouncementsid)?.toLowerCase() ?? null
  const title = requiredText(value.mss_title)
  const content = requiredText(value.mss_content)
  const start = validDateTime(value.mss_startdate)
  const end = validDateTime(value.mss_enddate)

  if (!id || !GUID_PATTERN.test(id) || !title || !content || !start || !end) return null
  if (start.time > now || end.time < now || end.time < start.time) return null

  return {
    id,
    title,
    content,
    startDateTime: start.value,
    endDateTime: end.value,
    link: safeHttpUrl(value.mss_announcementlink),
  }
}

export async function getActiveTeamAnnouncements(
  options: TeamAnnouncementQuery = {},
): Promise<readonly TeamAnnouncement[]> {
  const now = options.now ?? new Date()
  const nowTime = now.getTime()
  if (Number.isNaN(nowTime)) throw new Error('A valid announcement date is required.')

  const nowIso = now.toISOString()
  const query = new URLSearchParams({
    $select: SELECT_FIELDS,
    $filter: `mss_startdate le ${nowIso} and mss_enddate ge ${nowIso}`,
    $orderby: 'mss_startdate desc,mss_teamsannouncementsid asc',
  })
  const response = await powerPagesFetch<unknown>(
    `/_api/mss_teamsannouncementses?${query.toString()}`,
    { signal: options.signal },
  )

  if (!isRecord(response) || !Array.isArray(response.value)) {
    throw new Error('Teams announcements could not be loaded.')
  }

  return response.value
    .map((item) => mapAnnouncement(item, nowTime))
    .filter((item): item is TeamAnnouncement => item !== null)
    .sort((left, right) => {
      const byStart = new Date(right.startDateTime).getTime() - new Date(left.startDateTime).getTime()
      return byStart || left.id.localeCompare(right.id)
    })
}
