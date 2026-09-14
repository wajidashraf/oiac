export const MEETING_INVITATION_STATUS = {
  accepted: 1,
  pending: 2,
  rejected: 3,
} as const

export type MeetingInvitationStatus = typeof MEETING_INVITATION_STATUS[keyof typeof MEETING_INVITATION_STATUS]

export type MeetingInviteParticipant = {
  readonly id: string
  readonly contactId: string
  readonly meetingInviteId: string
  readonly status: MeetingInvitationStatus
  readonly acceptedOn: string | null
  readonly name: string | null
}

export type MeetingInvite = {
  readonly id: string
  readonly title: string
  readonly startDateTime: string
  readonly endDateTime: string | null
  readonly meetingLink: string | null
  readonly participant: MeetingInviteParticipant | null
}

export type MeetingInviteCollection = {
  readonly contactFullName: string
  readonly invites: readonly MeetingInvite[]
}

export type AcceptMeetingInviteInput = {
  readonly contactId: string
  readonly contactFullName: string
  readonly invite: MeetingInvite
}
