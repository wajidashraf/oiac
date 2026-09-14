import { expect, test } from 'vitest'
import type { MeetingInvite } from '../meetingInvites/meetingInviteTypes'
import { selectUpcomingMeetings } from './upcomingMeetings'

function meeting(
  id: string,
  startDateTime: string,
  title = `Meeting ${id}`,
): MeetingInvite {
  return {
    id,
    title,
    startDateTime,
    endDateTime: null,
    meetingLink: 'https://teams.microsoft.com/l/meetup-join/briefing',
    participant: null,
  }
}

test('keeps meetings at or after now and excludes past or invalid starts', () => {
  const result = selectUpcomingMeetings([
    meeting('past', '2026-09-14T11:59:59Z'),
    meeting('boundary', '2026-09-14T12:00:00Z'),
    meeting('future', '2026-09-14T12:00:01Z'),
    meeting('invalid', 'not-a-date'),
  ], new Date('2026-09-14T12:00:00Z'))

  expect(result.map(({ id }) => id)).toEqual(['boundary', 'future'])
})

test('returns every future meeting in ascending order with an ID tie-breaker', () => {
  const result = selectUpcomingMeetings([
    meeting('meeting-d', '2026-09-18T12:00:00Z'),
    meeting('meeting-c', '2026-09-17T12:00:00Z'),
    meeting('meeting-b', '2026-09-16T12:00:00Z'),
    meeting('meeting-a', '2026-09-16T12:00:00Z'),
  ], new Date('2026-09-14T12:00:00Z'))

  expect(result.map(({ id }) => id)).toEqual([
    'meeting-a',
    'meeting-b',
    'meeting-c',
    'meeting-d',
  ])
})

test('does not mutate the eligible invite collection', () => {
  const later = meeting('later', '2026-09-18T12:00:00Z')
  const sooner = meeting('sooner', '2026-09-16T12:00:00Z')
  const invites = [later, sooner]

  selectUpcomingMeetings(invites, new Date('2026-09-14T12:00:00Z'))

  expect(invites).toEqual([later, sooner])
})

test('returns an empty collection for an invalid current time', () => {
  expect(selectUpcomingMeetings([
    meeting('future', '2099-01-01T12:00:00Z'),
  ], new Date('not-a-date'))).toEqual([])
})
