import type { MeetingInvite } from '../meetingInvites/meetingInviteTypes'

type TimedMeeting = {
  readonly meeting: MeetingInvite
  readonly startTime: number
}

export function selectUpcomingMeetings(
  invites: readonly MeetingInvite[],
  now: Date = new Date(),
): readonly MeetingInvite[] {
  const nowTime = now.getTime()
  if (!Number.isFinite(nowTime)) return []

  return invites
    .map((meeting): TimedMeeting => ({
      meeting,
      startTime: Date.parse(meeting.startDateTime),
    }))
    .filter(({ startTime }) => Number.isFinite(startTime) && startTime >= nowTime)
    .sort((left, right) => left.startTime - right.startTime
      || left.meeting.id.localeCompare(right.meeting.id))
    .map(({ meeting }) => meeting)
}
