import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { PortalUser } from '../auth/powerPagesSession'
import {
  deleteMeetingReportAttachment,
  listMeetingReportAttachments,
  uploadMeetingReportAttachments,
} from '../features/meetingReports/meetingReportAttachmentService'
import {
  createMeetingReport,
  getMeetingReport,
  getMeetingReportProfile,
  getMeetingReports,
  runRelationshipOperations,
  searchContacts,
  searchDistricts,
  updateMeetingReport,
} from '../features/meetingReports/meetingReportService'
import type { MeetingReportDetails, MeetingReportProfile } from '../features/meetingReports/meetingReportTypes'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MeetingReportForm from './MeetingReportForm'
import Report from './Report'

vi.mock('../features/meetingReports/meetingReportService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../features/meetingReports/meetingReportService')>()
  return {
    ...original,
    createMeetingReport: vi.fn(),
    getMeetingReport: vi.fn(),
    getMeetingReportProfile: vi.fn(),
    getMeetingReports: vi.fn(),
    runRelationshipOperations: vi.fn(),
    searchContacts: vi.fn(),
    searchDistricts: vi.fn(),
    updateMeetingReport: vi.fn(),
  }
})

vi.mock('../features/meetingReports/meetingReportAttachmentService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../features/meetingReports/meetingReportAttachmentService')>()
  return {
    ...original,
    deleteMeetingReportAttachment: vi.fn(),
    listMeetingReportAttachments: vi.fn(),
    uploadMeetingReportAttachments: vi.fn(),
    viewAttachment: vi.fn(),
  }
})

const user: PortalUser = {
  userName: 'sara@example.com',
  contactId: '11111111-1111-1111-1111-111111111111',
  userRoles: ['Authenticated Users'],
}
const reportId = '22222222-2222-2222-2222-222222222222'
const representative = {
  id: '33333333-3333-3333-3333-333333333333',
  name: 'Rep. Carter Office',
  email: 'carter@example.gov',
  jobTitle: 'Representative',
}
const district = { id: '44444444-4444-4444-4444-444444444444', name: 'DC' }
const staff = {
  id: '55555555-5555-5555-5555-555555555555',
  name: 'Ali Staff',
  email: 'ali@oiac.org',
  jobTitle: 'Staff',
}
const volunteer = {
  id: '66666666-6666-6666-6666-666666666666',
  name: 'Neda Volunteer',
  email: 'neda@example.com',
  jobTitle: 'Volunteer',
}
const staffSaidLabel = 'Write Down What the Staff Said, Not What You Said'
const existingAttachment = {
  meetingReportId: reportId,
  attachmentId: '77777777-7777-7777-7777-777777777777',
  fileName: 'Existing notes.pdf',
  contentType: 'application/pdf',
  size: 2048,
}

const profile: MeetingReportProfile = {
  contactId: user.contactId!,
  fullName: 'Sara Rahimi',
  email: 'sara@example.com',
  stateOrProvince: 'DC',
  city: 'Washington',
  districtId: district.id,
  districtName: district.name,
}

const existingReport: MeetingReportDetails = {
  id: reportId,
  subject: 'Existing advocacy meeting',
  startDateTime: '2026-08-18T09:30',
  endDateTime: '2026-08-18T10:45',
  representativeId: representative.id,
  representative,
  districtId: district.id,
  district,
  meetingFormat: 2,
  staffIds: [staff.id],
  staff: [staff],
  volunteerIds: [volunteer.id],
  volunteers: [volunteer],
  issuesDiscussed: 'Existing issues',
  followUpActions: 'Existing follow up',
  sentiment: 2,
}

function renderReportRoute(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/report" element={<Report />} />
        <Route path="/report/new" element={<MeetingReportForm user={user} />} />
        <Route path="/report/:reportId/edit" element={<MeetingReportForm user={user} />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getMeetingReportProfile).mockResolvedValue(profile)
  vi.mocked(getMeetingReport).mockResolvedValue(existingReport)
  vi.mocked(getMeetingReports).mockResolvedValue({
    reports: [{
      id: reportId,
      subject: existingReport.subject,
      representativeName: representative.name,
      districtName: district.name,
      date: '2026-08-18T12:30:00Z',
      sentimentLabel: 'Supportive',
    }],
    hasNext: false,
    nextLink: null,
  })
  vi.mocked(searchContacts).mockImplementation(async (kind) => {
    if (kind === 'staff') return [staff]
    if (kind === 'volunteer') return [volunteer]
    return [representative]
  })
  vi.mocked(searchDistricts).mockResolvedValue([district])
  vi.mocked(createMeetingReport).mockResolvedValue(reportId)
  vi.mocked(updateMeetingReport).mockResolvedValue()
  vi.mocked(runRelationshipOperations).mockResolvedValue([])
  vi.mocked(listMeetingReportAttachments).mockResolvedValue([])
  vi.mocked(uploadMeetingReportAttachments).mockImplementation(async (meetingReportId, files) => ({
    succeededAttachments: files.map((file) => ({
      meetingReportId,
      attachmentId: '88888888-8888-8888-8888-888888888888',
      fileName: file.name,
      contentType: file.type || null,
      size: file.size,
    })),
    failedFiles: [],
  }))
  vi.mocked(deleteMeetingReportAttachment).mockResolvedValue()
})

test('lists Dataverse meeting reports with real record-specific edit actions', async () => {
  renderReportRoute('/report')
  expect(screen.getByRole('heading', { name: 'Meeting Reports', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '+ Submit Report' })).toHaveAttribute('href', '/report/new')
  const table = await screen.findByRole('table', { name: 'Meeting Reports' })
  expect(within(table).getAllByRole('row')).toHaveLength(2)
  expect(within(table).getByRole('columnheader', { name: 'District' })).toBeInTheDocument()
  expect(within(table).getByRole('cell', { name: 'DC' })).toBeInTheDocument()
  expect(within(table).queryByRole('columnheader', { name: 'Files' })).not.toBeInTheDocument()
  expect(within(table).getByRole('link', { name: `Edit ${existingReport.subject}` }))
    .toHaveAttribute('href', `/report/${reportId}/edit`)
  expect(table.querySelector('time')).toHaveTextContent(/\d{1,2}:\d{2} (AM|PM)/)
})

test('paginates Meeting Reports with fifteen-record server pages', async () => {
  const actor = userEvent.setup()
  const nextLink = '/_api/mss_meetingreports?%24skiptoken=opaque-page-2'
  const pageOne = Array.from({ length: 15 }, (_, index) => ({
    id: `${String(index + 1).padStart(8, '0')}-1111-1111-1111-111111111111`,
    subject: `Meeting ${index + 1}`,
    representativeName: 'Representative',
    districtName: 'DC',
    date: `2026-08-${String(28 - index).padStart(2, '0')}T12:00:00Z`,
    sentimentLabel: 'Neutral',
  }))
  vi.mocked(getMeetingReports)
    .mockResolvedValueOnce({ reports: pageOne, hasNext: true, nextLink })
    .mockResolvedValueOnce({
      reports: [{
        id: '99999999-1111-1111-1111-111111111111',
        subject: 'Meeting 16',
        representativeName: 'Representative',
        districtName: 'DC',
        date: '2026-08-01T12:00:00Z',
        sentimentLabel: 'Supportive',
      }],
      hasNext: false,
      nextLink: null,
    })
    .mockResolvedValueOnce({ reports: pageOne, hasNext: true, nextLink })

  renderReportRoute('/report')
  const firstTable = await screen.findByRole('table', { name: 'Meeting Reports' })
  expect(within(firstTable).getAllByRole('row')).toHaveLength(16)
  expect(screen.getByText('Page 1')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()

  await actor.click(screen.getByRole('button', { name: 'Next page' }))

  expect(await screen.findByText('Meeting 16')).toBeInTheDocument()
  expect(screen.getByText('Page 2')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  expect(getMeetingReports).toHaveBeenNthCalledWith(2, { nextLink }, expect.any(AbortSignal))

  await actor.click(screen.getByRole('button', { name: 'Previous page' }))

  expect(await screen.findByText('Meeting 1')).toBeInTheDocument()
  expect(screen.getByText('Page 1')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  expect(getMeetingReports).toHaveBeenNthCalledWith(3, { nextLink: null }, expect.any(AbortSignal))
})

test('loads the authenticated profile as read-only volunteer information', async () => {
  renderReportRoute('/report/new')
  expect(await screen.findByRole('heading', { name: 'Volunteer Information', level: 2 })).toBeInTheDocument()
  expect(screen.getByLabelText('Full Name')).toHaveValue('Sara Rahimi')
  expect(screen.getByLabelText('Full Name')).toHaveAttribute('readonly')
  expect(screen.getByLabelText('Email')).toHaveValue('sara@example.com')
  expect(screen.getByLabelText('District')).toHaveValue('DC')
  expect(screen.queryByLabelText('City')).not.toBeInTheDocument()
  expect(getMeetingReportProfile).toHaveBeenCalledWith(user.contactId, expect.any(AbortSignal))
  expect(listMeetingReportAttachments).not.toHaveBeenCalled()
})

test('requires an end date and time later than the start date and time', async () => {
  const actor = userEvent.setup()
  renderReportRoute('/report/new')
  await screen.findByDisplayValue('Sara Rahimi')
  await actor.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  await actor.type(screen.getByLabelText('Subject'), 'Invalid time range')
  const startDateTime = screen.getByLabelText('Start Date and Time')
  const endDateTime = screen.getByLabelText('End Date and Time')
  expect(startDateTime).toBeRequired()
  expect(endDateTime).toBeRequired()
  fireEvent.change(startDateTime, { target: { value: '2026-09-01T11:00' } })
  fireEvent.change(endDateTime, { target: { value: '2026-09-01T10:00' } })

  await actor.click(screen.getByRole('button', { name: 'Next: Report Content' }))

  const error = screen.getByRole('alert')
  expect(error).toHaveTextContent('End Date and Time must be later than Start Date and Time.')
  expect(endDateTime).toHaveFocus()
  expect(endDateTime).toHaveAttribute('aria-invalid', 'true')
  expect(endDateTime).toHaveAttribute('aria-describedby', error.id)
  expect(screen.getByRole('heading', { name: 'Meeting Details' })).toBeInTheDocument()
})

test('creates a report and associates selected Staff and Volunteers', async () => {
  const actor = userEvent.setup()
  let finishRelationships: (() => void) | undefined
  let finishBatchUpload: (() => void) | undefined
  vi.mocked(runRelationshipOperations).mockImplementationOnce(() => new Promise((resolve) => {
    finishRelationships = () => resolve([])
  }))
  vi.mocked(uploadMeetingReportAttachments).mockImplementationOnce((_id, files) => new Promise((resolve) => {
    finishBatchUpload = () => resolve({
      succeededAttachments: files.map((file) => ({ ...existingAttachment, fileName: file.name })),
      failedFiles: [],
    })
  }))
  renderReportRoute('/report/new')
  await screen.findByDisplayValue('Sara Rahimi')
  await actor.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  expect(screen.queryByRole('button', { name: 'Clear District' })).not.toBeInTheDocument()
  await actor.type(screen.getByLabelText('Subject'), 'Community briefing')
  fireEvent.change(screen.getByLabelText('Start Date and Time'), { target: { value: '2026-09-01T09:30' } })
  fireEvent.change(screen.getByLabelText('End Date and Time'), { target: { value: '2026-09-01T10:45' } })
  await actor.click(screen.getByRole('combobox', { name: 'Representative' }))
  await actor.click(await screen.findByRole('option', { name: /Rep. Carter Office/ }))
  await actor.click(screen.getByRole('combobox', { name: 'District' }))
  await actor.click(await screen.findByRole('option', { name: 'DC' }))
  await actor.click(screen.getByRole('radio', { name: /Teams/ }))
  await actor.click(screen.getByRole('combobox', { name: 'Tag OIAC Staff Members' }))
  await actor.click(await screen.findByRole('checkbox', { name: /Ali Staff/ }))
  await actor.click(screen.getByRole('combobox', { name: 'Tag Volunteers' }))
  await actor.click(await screen.findByRole('checkbox', { name: /Neda Volunteer/ }))
  await actor.click(screen.getByRole('button', { name: 'Next: Report Content' }))
  expect(screen.queryByLabelText('Outcomes & Next Steps')).not.toBeInTheDocument()
  await actor.type(screen.getByLabelText(staffSaidLabel), 'Community priorities')
  await actor.type(screen.getByLabelText('Follow-Up Note (Once the Meeting Ended)'), 'Email the team')
  const document = new File(['policy'], 'Policy summary(1).pdf', { type: 'application/pdf' })
  const appendix = new File(['appendix'], 'Appendix_2026.pdf', { type: 'application/pdf' })
  const documentInput = screen.getByLabelText('Documents Provided')
  expect(documentInput).toHaveAttribute('type', 'file')
  expect(documentInput).toHaveAttribute('multiple')
  await actor.upload(documentInput, [document, appendix])
  await actor.click(screen.getByRole('radio', { name: 'Neutral' }))
  await actor.click(screen.getByRole('button', { name: 'Submit Report' }))

  expect(await screen.findByRole('status', { name: 'Saving report' })).toHaveTextContent('Saving report')
  const pageBackLabel = screen.getByText('Back', { selector: '.report-page__back > span' })
  expect(pageBackLabel.parentElement).toHaveAttribute('aria-disabled', 'true')
  expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument()
  expect(createMeetingReport).toHaveBeenCalledWith(expect.objectContaining({
    subject: 'Community briefing', representativeId: representative.id, districtId: district.id,
    startDateTime: '2026-09-01T09:30', endDateTime: '2026-09-01T10:45',
    meetingFormat: 2, staffIds: [staff.id], volunteerIds: [volunteer.id],
    issuesDiscussed: 'Community priorities', followUpActions: 'Email the team',
    sentiment: 3,
  }), user.contactId)
  expect(runRelationshipOperations).toHaveBeenCalledWith(reportId, [
    { action: 'add', relationship: 'staff', contactId: staff.id },
    { action: 'add', relationship: 'volunteer', contactId: volunteer.id },
  ])
  expect(uploadMeetingReportAttachments).not.toHaveBeenCalled()
  await act(async () => finishRelationships?.())
  expect(uploadMeetingReportAttachments).toHaveBeenCalledWith(reportId, [document, appendix])
  expect(uploadMeetingReportAttachments).toHaveBeenCalledTimes(1)
  expect(vi.mocked(createMeetingReport).mock.invocationCallOrder[0])
    .toBeLessThan(vi.mocked(uploadMeetingReportAttachments).mock.invocationCallOrder[0])
  expect(vi.mocked(runRelationshipOperations).mock.invocationCallOrder[0])
    .toBeLessThan(vi.mocked(uploadMeetingReportAttachments).mock.invocationCallOrder[0])
  await act(async () => finishBatchUpload?.())
  expect(await screen.findByRole('status')).toHaveTextContent('Report saved.')
})

test('hydrates and updates a report, removing deselected relationships', async () => {
  const actor = userEvent.setup()
  renderReportRoute(`/report/${reportId}/edit`)
  await screen.findByDisplayValue('Sara Rahimi')
  await actor.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  expect(screen.getByLabelText('Subject')).toHaveValue('Existing advocacy meeting')
  expect(screen.getByLabelText('Start Date and Time')).toHaveValue('2026-08-18T09:30')
  expect(screen.getByLabelText('End Date and Time')).toHaveValue('2026-08-18T10:45')
  expect(screen.getByRole('button', { name: 'Clear District' }).parentElement).toHaveTextContent('DC')
  await actor.click(screen.getByRole('combobox', { name: 'Tag Volunteers' }))
  await actor.click(await screen.findByRole('checkbox', { name: /Neda Volunteer/ }))
  await actor.click(screen.getByRole('button', { name: 'Next: Report Content' }))
  expect(screen.getByLabelText(staffSaidLabel)).toHaveValue('Existing issues')
  expect(screen.getByLabelText('Documents Provided')).toHaveAttribute('type', 'file')
  const editFile = new File(['edit'], 'Edit attachment.pdf', { type: 'application/pdf' })
  await actor.upload(screen.getByLabelText('Documents Provided'), editFile)
  await actor.click(screen.getByRole('button', { name: 'Update Report' }))

  expect(updateMeetingReport).toHaveBeenCalledWith(reportId, expect.objectContaining({
    startDateTime: '2026-08-18T09:30',
    endDateTime: '2026-08-18T10:45',
    volunteerIds: [],
  }))
  expect(runRelationshipOperations).toHaveBeenCalledWith(reportId, [
    { action: 'remove', relationship: 'volunteer', contactId: volunteer.id },
  ])
  expect(uploadMeetingReportAttachments).toHaveBeenCalledWith(reportId, [editFile])
  expect(vi.mocked(updateMeetingReport).mock.invocationCallOrder[0])
    .toBeLessThan(vi.mocked(runRelationshipOperations).mock.invocationCallOrder[0])
  expect(vi.mocked(runRelationshipOperations).mock.invocationCallOrder[0])
    .toBeLessThan(vi.mocked(uploadMeetingReportAttachments).mock.invocationCallOrder[0])
  expect(await screen.findByRole('status')).toHaveTextContent('Report updated.')
})

test('retries only failed relationships without creating a duplicate report', async () => {
  const actor = userEvent.setup()
  const failedOperation = { action: 'add' as const, relationship: 'staff' as const, contactId: staff.id }
  vi.mocked(runRelationshipOperations).mockResolvedValueOnce([failedOperation]).mockResolvedValueOnce([])
  renderReportRoute('/report/new')

  await screen.findByDisplayValue('Sara Rahimi')
  await actor.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  await actor.type(screen.getByLabelText('Subject'), 'Retry meeting')
  fireEvent.change(screen.getByLabelText('Start Date and Time'), { target: { value: '2026-09-01T09:30' } })
  fireEvent.change(screen.getByLabelText('End Date and Time'), { target: { value: '2026-09-01T10:45' } })
  await actor.click(screen.getByRole('combobox', { name: 'Representative' }))
  await actor.click(await screen.findByRole('option', { name: /Rep. Carter Office/ }))
  await actor.click(screen.getByRole('combobox', { name: 'District' }))
  await actor.click(await screen.findByRole('option', { name: 'DC' }))
  await actor.click(screen.getByRole('radio', { name: /In-person/ }))
  await actor.click(screen.getByRole('combobox', { name: 'Tag OIAC Staff Members' }))
  await actor.click(await screen.findByRole('checkbox', { name: /Ali Staff/ }))
  await actor.click(screen.getByRole('button', { name: 'Next: Report Content' }))
  await actor.type(screen.getByLabelText(staffSaidLabel), 'Retry associations')
  const afterLinks = new File(['links'], 'After links.pdf', { type: 'application/pdf' })
  await actor.upload(screen.getByLabelText('Documents Provided'), afterLinks)
  await actor.click(screen.getByRole('button', { name: 'Submit Report' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('report was saved')
  expect(uploadMeetingReportAttachments).not.toHaveBeenCalled()
  expect(screen.getByLabelText(staffSaidLabel)).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Submit Report' })).toBeDisabled()
  await actor.click(screen.getByRole('button', { name: 'Retry contact links' }))
  expect(createMeetingReport).toHaveBeenCalledTimes(1)
  expect(runRelationshipOperations).toHaveBeenCalledTimes(2)
  expect(runRelationshipOperations).toHaveBeenLastCalledWith(reportId, [failedOperation])
  expect(uploadMeetingReportAttachments).toHaveBeenCalledWith(reportId, [afterLinks])
  expect(await screen.findByRole('status')).toHaveTextContent('Report saved.')
})

test('rejects invalid attachment names immediately without calling the upload flow', async () => {
  const actor = userEvent.setup()
  renderReportRoute(`/report/${reportId}/edit`)
  await screen.findByDisplayValue('Sara Rahimi')
  await actor.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  await actor.click(screen.getByRole('button', { name: 'Next: Report Content' }))

  await actor.upload(screen.getByLabelText('Documents Provided'), new File(['x'], 'report&notes.pdf'))

  expect(screen.getByRole('alert')).toHaveTextContent('report&notes.pdf')
  expect(screen.getByRole('alert')).toHaveTextContent('letters, numbers, spaces, hyphens, underscores, and parentheses')
  expect(screen.queryByText('report&notes.pdf', { selector: '.meeting-attachments__file-name' })).not.toBeInTheDocument()
  expect(uploadMeetingReportAttachments).not.toHaveBeenCalled()
})

test('lists and deletes existing files only on an edit form', async () => {
  const actor = userEvent.setup()
  vi.mocked(listMeetingReportAttachments).mockResolvedValue([existingAttachment])
  vi.spyOn(window, 'confirm').mockReturnValue(true)

  renderReportRoute(`/report/${reportId}/edit`)
  await screen.findByDisplayValue('Sara Rahimi')
  await actor.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  await actor.click(screen.getByRole('button', { name: 'Next: Report Content' }))

  await screen.findByRole('button', { name: 'View Existing notes.pdf' })
  expect(listMeetingReportAttachments).toHaveBeenCalledWith(reportId, expect.any(AbortSignal))
  await actor.click(screen.getByRole('button', { name: 'Delete Existing notes.pdf' }))
  expect(deleteMeetingReportAttachment).toHaveBeenCalledWith(
    reportId,
    existingAttachment.attachmentId,
  )
  expect(screen.queryByRole('button', { name: 'View Existing notes.pdf' })).not.toBeInTheDocument()
})

test('keeps an existing file when deletion is cancelled', async () => {
  const actor = userEvent.setup()
  vi.mocked(listMeetingReportAttachments).mockResolvedValue([existingAttachment])
  vi.spyOn(window, 'confirm').mockReturnValue(false)

  renderReportRoute(`/report/${reportId}/edit`)
  await screen.findByDisplayValue('Sara Rahimi')
  await actor.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  await actor.click(screen.getByRole('button', { name: 'Next: Report Content' }))
  await screen.findByRole('button', { name: 'View Existing notes.pdf' })
  await actor.click(screen.getByRole('button', { name: 'Delete Existing notes.pdf' }))

  expect(deleteMeetingReportAttachment).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'View Existing notes.pdf' })).toBeInTheDocument()
})

test('keeps an existing file visible when deletion fails', async () => {
  const actor = userEvent.setup()
  vi.mocked(listMeetingReportAttachments).mockResolvedValue([existingAttachment])
  vi.mocked(deleteMeetingReportAttachment).mockRejectedValue(new Error('delete failed'))
  vi.spyOn(window, 'confirm').mockReturnValue(true)

  renderReportRoute(`/report/${reportId}/edit`)
  await screen.findByDisplayValue('Sara Rahimi')
  await actor.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  await actor.click(screen.getByRole('button', { name: 'Next: Report Content' }))
  await screen.findByRole('button', { name: 'View Existing notes.pdf' })
  await actor.click(screen.getByRole('button', { name: 'Delete Existing notes.pdf' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Existing notes.pdf could not be deleted')
  expect(screen.getByRole('button', { name: 'View Existing notes.pdf' })).toBeInTheDocument()
})

test('allows retrying an attachment list failure without blocking edit', async () => {
  const actor = userEvent.setup()
  vi.mocked(listMeetingReportAttachments)
    .mockRejectedValueOnce(new Error('unavailable'))
    .mockResolvedValueOnce([existingAttachment])

  renderReportRoute(`/report/${reportId}/edit`)
  await screen.findByDisplayValue('Sara Rahimi')
  await actor.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  await actor.click(screen.getByRole('button', { name: 'Next: Report Content' }))
  expect(await screen.findByText('Uploaded documents could not be loaded.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Update Report' })).toBeEnabled()

  await actor.click(screen.getByRole('button', { name: 'Retry uploaded documents' }))
  expect(await screen.findByRole('button', { name: 'View Existing notes.pdf' })).toBeInTheDocument()
  expect(listMeetingReportAttachments).toHaveBeenCalledTimes(2)
})

test('retries only failed uploads without saving a second report', async () => {
  const actor = userEvent.setup()
  vi.mocked(uploadMeetingReportAttachments)
    .mockImplementationOnce(async (_id, files) => ({
      succeededAttachments: [{ ...existingAttachment, fileName: files[0].name }],
      failedFiles: [files[1]],
    }))
    .mockImplementationOnce(async (_id, files) => ({
      succeededAttachments: [{ ...existingAttachment, fileName: files[0].name }],
      failedFiles: [],
    }))
  renderReportRoute('/report/new')

  await screen.findByDisplayValue('Sara Rahimi')
  await actor.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  await actor.type(screen.getByLabelText('Subject'), 'Attachment retry')
  fireEvent.change(screen.getByLabelText('Start Date and Time'), { target: { value: '2026-09-01T09:30' } })
  fireEvent.change(screen.getByLabelText('End Date and Time'), { target: { value: '2026-09-01T10:45' } })
  await actor.click(screen.getByRole('combobox', { name: 'Representative' }))
  await actor.click(await screen.findByRole('option', { name: /Rep. Carter Office/ }))
  await actor.click(screen.getByRole('combobox', { name: 'District' }))
  await actor.click(await screen.findByRole('option', { name: 'DC' }))
  await actor.click(screen.getByRole('radio', { name: /Phone/ }))
  await actor.click(screen.getByRole('button', { name: 'Next: Report Content' }))
  await actor.type(screen.getByLabelText(staffSaidLabel), 'Retry the document')
  const uploadedFile = new File(['uploaded'], 'uploaded.pdf', { type: 'application/pdf' })
  const retryFile = new File(['retry'], 'retry.pdf', { type: 'application/pdf' })
  await actor.upload(screen.getByLabelText('Documents Provided'), [uploadedFile, retryFile])
  await actor.click(screen.getByRole('button', { name: 'Submit Report' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('report was saved, but some files could not be uploaded')
  await actor.click(screen.getByRole('button', { name: 'Retry file uploads' }))
  expect(createMeetingReport).toHaveBeenCalledTimes(1)
  expect(runRelationshipOperations).toHaveBeenCalledTimes(1)
  expect(uploadMeetingReportAttachments).toHaveBeenCalledTimes(2)
  expect(uploadMeetingReportAttachments).toHaveBeenNthCalledWith(1, reportId, [uploadedFile, retryFile])
  expect(uploadMeetingReportAttachments).toHaveBeenLastCalledWith(reportId, [retryFile])
  expect(await screen.findByRole('status')).toHaveTextContent('Report saved.')
})

test('retries the complete batch after an upload request failure without saving again', async () => {
  const actor = userEvent.setup()
  vi.mocked(uploadMeetingReportAttachments).mockRejectedValueOnce(new Error('request failed'))
  renderReportRoute('/report/new')

  await screen.findByDisplayValue('Sara Rahimi')
  await actor.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  await actor.type(screen.getByLabelText('Subject'), 'Batch request retry')
  fireEvent.change(screen.getByLabelText('Start Date and Time'), { target: { value: '2026-09-01T09:30' } })
  fireEvent.change(screen.getByLabelText('End Date and Time'), { target: { value: '2026-09-01T10:45' } })
  await actor.click(screen.getByRole('combobox', { name: 'Representative' }))
  await actor.click(await screen.findByRole('option', { name: /Rep. Carter Office/ }))
  await actor.click(screen.getByRole('combobox', { name: 'District' }))
  await actor.click(await screen.findByRole('option', { name: 'DC' }))
  await actor.click(screen.getByRole('radio', { name: /Phone/ }))
  await actor.click(screen.getByRole('button', { name: 'Next: Report Content' }))
  await actor.type(screen.getByLabelText(staffSaidLabel), 'Retry the complete batch')
  const first = new File(['first'], 'First.pdf', { type: 'application/pdf' })
  const second = new File(['second'], 'Second.pdf', { type: 'application/pdf' })
  await actor.upload(screen.getByLabelText('Documents Provided'), [first, second])
  await actor.click(screen.getByRole('button', { name: 'Submit Report' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('report was saved, but some files could not be uploaded')
  expect(screen.getByRole('list', { name: 'Files selected for upload' })).toHaveTextContent('First.pdf')
  expect(screen.getByRole('list', { name: 'Files selected for upload' })).toHaveTextContent('Second.pdf')
  await actor.click(screen.getByRole('button', { name: 'Retry file uploads' }))

  expect(createMeetingReport).toHaveBeenCalledTimes(1)
  expect(runRelationshipOperations).toHaveBeenCalledTimes(1)
  expect(uploadMeetingReportAttachments).toHaveBeenCalledTimes(2)
  expect(uploadMeetingReportAttachments).toHaveBeenNthCalledWith(1, reportId, [first, second])
  expect(uploadMeetingReportAttachments).toHaveBeenNthCalledWith(2, reportId, [first, second])
  expect(await screen.findByRole('status')).toHaveTextContent('Report saved.')
})

test('reloads existing attachments when an edit upload fails while the original list is pending', async () => {
  const actor = userEvent.setup()
  let finishStaleList: ((attachments: readonly typeof existingAttachment[]) => void) | undefined
  vi.mocked(listMeetingReportAttachments)
    .mockImplementationOnce(() => new Promise((resolve) => {
      finishStaleList = resolve
    }))
    .mockResolvedValueOnce([existingAttachment])
  vi.mocked(uploadMeetingReportAttachments).mockRejectedValueOnce(new Error('request failed'))
  renderReportRoute(`/report/${reportId}/edit`)

  await screen.findByDisplayValue('Sara Rahimi')
  await actor.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  await actor.click(screen.getByRole('button', { name: 'Next: Report Content' }))
  const file = new File(['retry'], 'Retry edit.pdf', { type: 'application/pdf' })
  await actor.upload(screen.getByLabelText('Documents Provided'), file)
  await actor.click(screen.getByRole('button', { name: 'Update Report' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('report was saved, but some files could not be uploaded')
  expect(await screen.findByRole('button', { name: 'View Existing notes.pdf' })).toBeInTheDocument()
  expect(listMeetingReportAttachments).toHaveBeenCalledTimes(2)
  await act(async () => finishStaleList?.([]))
  expect(screen.getByRole('button', { name: 'View Existing notes.pdf' })).toBeInTheDocument()
})
