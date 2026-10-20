const operations: Record<string, string> = {
 // Exact operation identifiers emitted by the native command observer and legacy capture adapter.
 PinActivity: 'Activity post pinned', UnpinActivity: 'Activity post unpinned', AppointmentCreated: 'Appointment request created',
 MeetingreportCreate: 'Meeting report created', MeetingreportUpdate: 'Meeting report updated', MeetingreportDelete: 'Meeting report deleted',
 EventCreate: 'Event created', EventUpdate: 'Event updated', EventDelete: 'Event deleted',
 EventregistrationCreate: 'Event registration created', EventregistrationUpdate: 'Event registration updated', EventregistrationDelete: 'Event registration deleted',
 ContactCreate: 'Contact created', ContactUpdate: 'Contact updated', ContactDelete: 'Contact deleted',
 PresscoverageCreate: 'Press coverage created', PresscoverageUpdate: 'Press coverage updated', PresscoverageDelete: 'Press coverage deleted',
 RegistrationReactivated: 'Event registration reactivated',
 PostPublished: 'Post published', PostUpdated: 'Post updated', PostDeleted: 'Post deleted', PostPinned: 'Post pinned', PostUnpinned: 'Post unpinned',
 CommentCreated: 'Comment added', CommentUpdated: 'Comment updated', CommentDeleted: 'Comment deleted', ReplyCreated: 'Reply added',
 AppointmentRequested: 'Appointment requested', AppointmentAccepted: 'Appointment accepted', AppointmentRejected: 'Appointment rejected', AppointmentCancelled: 'Appointment cancelled', AppointmentRescheduled: 'Appointment rescheduled', RescheduleRequested: 'Reschedule requested',
 RegistrationCreated: 'Registration created', RegistrationCancelled: 'Registration cancelled', EventRegistered: 'Event registration', EventJoined: 'Event joined', EventLeft: 'Event left',
 CoverageSubmitted: 'Coverage submitted', CoverageUpdated: 'Coverage updated', FileUploaded: 'File uploaded', FileDeleted: 'File deleted', ProfileUpdated: 'Profile updated', MeetingReportCreated: 'Meeting report created', MeetingReportUpdated: 'Meeting report updated',
}
const statuses: Record<number, string> = { 866530000: 'Pending', 866530001: 'Accepted', 866530002: 'Rejected', 866530003: 'Rescheduled', 866530004: 'Cancelled' }
function bytes(value: unknown): string | null {
 if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return null
 if (value < 1024) return `${value} ${value === 1 ? 'byte' : 'bytes'}`
 const units = ['KB', 'MB', 'GB', 'TB', 'PB']; const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length)
 return `${Number((value / 1024 ** exponent).toFixed(1))} ${units[exponent - 1]}`
}
export function formatHistoryDetails(module: number, details: Record<string, unknown>): [string, string][] {
 const result: [string, string][] = []
 const add = (label: string, value: string | undefined | null) => { if (value !== undefined && value !== null) result.push([label, value]) }
 add('Operation', typeof details.operation === 'string' && Object.prototype.hasOwnProperty.call(operations, details.operation) ? operations[details.operation] : null)
 for (const [key, label] of [['confirmed', 'Confirmed'], ['pinned', 'Pinned']] as const) add(label, typeof details[key] === 'boolean' ? details[key] ? 'Yes' : 'No' : null)
 if (module === 866530003) {
  for (const [key, label] of [['previousStatus', 'Previous status'], ['status', 'Status']] as const) add(label, typeof details[key] === 'number' ? statuses[details[key]] : null)
 }
 add('File type', details.fileKind === 'logo' ? 'Publication logo' : details.fileKind === 'attachment' ? 'Attachment' : null)
 add('File size', bytes(details.fileSize))
 add('Replaced', typeof details.replaced === 'boolean' ? details.replaced ? 'Yes' : 'No' : null)
 return result
}
