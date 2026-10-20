import { expect, test } from 'vitest'
import { formatHistoryDetails } from './historyDetails'
test('shows only approved readable native details, including appointment choices and file size', () => {
 expect(formatHistoryDetails(866530003, { schemaVersion: 1, operation: 'AppointmentAccepted', confirmed: true, pinned: false, previousStatus: 866530000, status: 866530001, fileKind: 'logo', fileSize: 2048, replaced: true, parentId: 'secret', arbitrary: 'secret' })).toEqual([
  ['Operation', 'Appointment accepted'], ['Confirmed', 'Yes'], ['Pinned', 'No'], ['Previous status', 'Pending'], ['Status', 'Accepted'], ['File type', 'Publication logo'], ['File size', '2 KB'], ['Replaced', 'Yes'],
 ])
})
test('does not expose unknown choices, operations, non-appointment status, IDs, or unsafe types', () => {
 expect(formatHistoryDetails(866530000, { status: 866530001, previousStatus: 123, operation: 'RawInternalOperation', fileKind: 'internal', fileSize: -1, replaced: 'yes', schemaVersion: 1 })).toEqual([])
 expect(formatHistoryDetails(866530003, { status: 123, fileKind: 'attachment', fileSize: 100 })).toEqual([['File type', 'Attachment'], ['File size', '100 bytes']])
})
test.each([
 ['PinActivity', 'Activity post pinned'], ['UnpinActivity', 'Activity post unpinned'], ['AppointmentCreated', 'Appointment request created'],
 ['MeetingreportCreate', 'Meeting report created'], ['MeetingreportUpdate', 'Meeting report updated'], ['MeetingreportDelete', 'Meeting report deleted'],
 ['EventCreate', 'Event created'], ['EventUpdate', 'Event updated'], ['EventDelete', 'Event deleted'],
 ['EventregistrationCreate', 'Event registration created'], ['EventregistrationUpdate', 'Event registration updated'], ['EventregistrationDelete', 'Event registration deleted'],
 ['ContactCreate', 'Contact created'], ['ContactUpdate', 'Contact updated'], ['ContactDelete', 'Contact deleted'],
 ['PresscoverageCreate', 'Press coverage created'], ['PresscoverageUpdate', 'Press coverage updated'], ['PresscoverageDelete', 'Press coverage deleted'],
 ['RegistrationReactivated', 'Event registration reactivated'],
])('renders actual backend operation %s without machine text', (operation, label) => {
 expect(formatHistoryDetails(866530000, { schemaVersion: 1, operation })).toEqual([['Operation', label]])
})
test.each(['toString', '__proto__', 'constructor'])('omits unknown operation names inherited from Object %s', operation => {
 expect(formatHistoryDetails(866530000, { operation })).toEqual([])
})
