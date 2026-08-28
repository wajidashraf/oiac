export type ContactLookupKind = 'representative' | 'staff' | 'volunteer'

export type ContactOption = {
  readonly id: string
  readonly name: string
  readonly email: string | null
  readonly jobTitle: string | null
}

export type DistrictOption = {
  readonly id: string
  readonly name: string
}

export type MeetingReportProfile = {
  readonly contactId: string
  readonly fullName: string
  readonly email: string
  readonly city: string
  readonly stateOrProvince: string
  readonly districtId: string | null
  readonly districtName: string
}

export type MeetingFormat = 1 | 2 | 3 | 4 | 5
export type MeetingSentiment = 1 | 2 | 3 | 4 | 5

export type MeetingReportDraft = {
  readonly subject: string
  readonly date: string
  readonly representativeId: string
  readonly districtId: string
  readonly meetingFormat: MeetingFormat | null
  readonly staffIds: readonly string[]
  readonly volunteerIds: readonly string[]
  readonly issuesDiscussed: string
  readonly outcomesNextSteps: string
  readonly followUpActions: string
  readonly sentiment: MeetingSentiment | null
}

export type MeetingReportDetails = MeetingReportDraft & {
  readonly id: string
  readonly representative: ContactOption
  readonly district: DistrictOption
  readonly staff: readonly ContactOption[]
  readonly volunteers: readonly ContactOption[]
}

export type RelationshipKind = 'staff' | 'volunteer'
export type RelationshipAction = 'add' | 'remove'

export type RelationshipOperation = {
  readonly action: RelationshipAction
  readonly relationship: RelationshipKind
  readonly contactId: string
}

export type RelationshipSelection = {
  readonly staffIds: readonly string[]
  readonly volunteerIds: readonly string[]
}
