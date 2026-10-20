import type { ContactOption } from '../meetingReports/meetingReportTypes'

export const APPOINTMENT_STATUS = { pending: 866530000, accepted: 866530001, rejected: 866530002, rescheduled: 866530003, cancelled: 866530004 } as const
export const APPOINTMENT_FORMAT = { teams: 1, phone: 2, inPerson: 3 } as const
export type AppointmentPerson = { readonly id: string; readonly name: string }
export type AppointmentRecord = {
  readonly id: string; readonly title: string; readonly status: number; readonly statusLabel: string
  readonly meetingFormat: number; readonly meetingFormatLabel: string
  readonly preferredDateTime: string; readonly suggestedDateTime: string | null
  readonly agenda: string; readonly meetingLink: string | null; readonly reschedulingReason: string
  readonly requester: AppointmentPerson | null; readonly recipient: AppointmentPerson | null
  readonly rowVersion: string
}
export type AppointmentRequestDraft = {
  readonly title: string; readonly contact: ContactOption | null; readonly meetingFormat: number | null
  readonly preferredDate: string; readonly preferredTime: string; readonly preferredOffsetMinutes: number | null; readonly agenda: string
}
export type AppointmentRescheduleDraft = {
  readonly reason: string; readonly suggestedDate: string; readonly suggestedTime: string; readonly suggestedOffsetMinutes: number | null
}
export type AppointmentPage = { readonly appointments: readonly AppointmentRecord[]; readonly nextLink: string | null; readonly awaitingCount: number }
