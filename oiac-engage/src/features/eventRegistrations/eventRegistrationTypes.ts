export const EVENT_REGISTRATION_STATUS = {
  registered: 1,
  cancelled: 2,
  waitlisted: 3,
} as const

export type RegistrationStatus = typeof EVENT_REGISTRATION_STATUS[keyof typeof EVENT_REGISTRATION_STATUS]

export type EventRegistration = {
  readonly id: string
  readonly contactId: string
  readonly eventId: string
  readonly registrationDate: string | null
  readonly registrationNumber: string | null
  readonly status: RegistrationStatus
}

export type RegistrationOutcome = {
  readonly outcome: 'registered' | 'already-registered' | 'waitlisted'
  readonly registration: EventRegistration
}
