import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { PortalUser } from '../auth/powerPagesSession'
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
  date: '2026-08-18',
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
  outcomesNextSteps: '',
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
  vi.mocked(getMeetingReports).mockResolvedValue([{
    id: reportId,
    subject: existingReport.subject,
    representativeName: representative.name,
    date: existingReport.date,
    sentimentLabel: 'Supportive',
  }])
  vi.mocked(searchContacts).mockImplementation(async (kind) => {
    if (kind === 'staff') return [staff]
    if (kind === 'volunteer') return [volunteer]
    return [representative]
  })
  vi.mocked(searchDistricts).mockResolvedValue([district])
  vi.mocked(createMeetingReport).mockResolvedValue(reportId)
  vi.mocked(updateMeetingReport).mockResolvedValue()
  vi.mocked(runRelationshipOperations).mockResolvedValue([])
})

test('lists Dataverse meeting reports with real record-specific edit actions', async () => {
  renderReportRoute('/report')
  expect(screen.getByRole('heading', { name: 'Meeting Reports', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '+ Submit Report' })).toHaveAttribute('href', '/report/new')
  const table = await screen.findByRole('table', { name: 'Meeting Reports' })
  expect(within(table).getAllByRole('row')).toHaveLength(2)
  expect(within(table).getByRole('link', { name: `Edit ${existingReport.subject}` }))
    .toHaveAttribute('href', `/report/${reportId}/edit`)
})

test('loads the authenticated profile as read-only volunteer information', async () => {
  renderReportRoute('/report/new')
  expect(await screen.findByRole('heading', { name: 'Volunteer Information', level: 2 })).toBeInTheDocument()
  expect(screen.getByLabelText('Full Name')).toHaveValue('Sara Rahimi')
  expect(screen.getByLabelText('Full Name')).toHaveAttribute('readonly')
  expect(screen.getByLabelText('Email')).toHaveValue('sara@example.com')
  expect(screen.getByLabelText('State / District')).toHaveValue('DC')
  expect(screen.getByLabelText('City')).toHaveValue('Washington')
  expect(getMeetingReportProfile).toHaveBeenCalledWith(user.contactId, expect.any(AbortSignal))
})

test('creates a report and associates selected Staff and Volunteers', async () => {
  const actor = userEvent.setup()
  let finishRelationships: (() => void) | undefined
  vi.mocked(runRelationshipOperations).mockImplementationOnce(() => new Promise((resolve) => {
    finishRelationships = () => resolve([])
  }))
  renderReportRoute('/report/new')
  await screen.findByDisplayValue('Sara Rahimi')
  await actor.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  await actor.type(screen.getByLabelText('Meeting Title'), 'Community briefing')
  await actor.type(screen.getByLabelText('Date of Meeting'), '2026-09-01')
  await actor.click(screen.getByRole('combobox', { name: 'Representative / Office' }))
  await actor.click(await screen.findByRole('option', { name: /Rep. Carter Office/ }))
  await actor.click(screen.getByRole('combobox', { name: 'State / District' }))
  await actor.click(await screen.findByRole('option', { name: 'DC' }))
  await actor.click(screen.getByRole('radio', { name: /Teams/ }))
  await actor.click(screen.getByRole('combobox', { name: 'Tag OIAC Staff Members' }))
  await actor.click(await screen.findByRole('checkbox', { name: /Ali Staff/ }))
  await actor.click(screen.getByRole('combobox', { name: 'Tag Volunteers' }))
  await actor.click(await screen.findByRole('checkbox', { name: /Neda Volunteer/ }))
  await actor.click(screen.getByRole('button', { name: 'Next: Report Content' }))
  await actor.type(screen.getByLabelText('Issues Discussed'), 'Community priorities')
  await actor.click(screen.getByRole('radio', { name: 'Neutral' }))
  await actor.click(screen.getByRole('button', { name: 'Submit Report' }))

  expect(await screen.findByRole('status', { name: 'Saving report' })).toHaveTextContent('Saving report')
  expect(createMeetingReport).toHaveBeenCalledWith(expect.objectContaining({
    subject: 'Community briefing', representativeId: representative.id, districtId: district.id,
    meetingFormat: 2, staffIds: [staff.id], volunteerIds: [volunteer.id], sentiment: 3,
  }), user.contactId)
  expect(runRelationshipOperations).toHaveBeenCalledWith(reportId, [
    { action: 'add', relationship: 'staff', contactId: staff.id },
    { action: 'add', relationship: 'volunteer', contactId: volunteer.id },
  ])
  await act(async () => finishRelationships?.())
  expect(await screen.findByRole('status')).toHaveTextContent('Report saved.')
})

test('hydrates and updates a report, removing deselected relationships', async () => {
  const actor = userEvent.setup()
  renderReportRoute(`/report/${reportId}/edit`)
  await screen.findByDisplayValue('Sara Rahimi')
  await actor.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  expect(screen.getByLabelText('Meeting Title')).toHaveValue('Existing advocacy meeting')
  await actor.click(screen.getByRole('combobox', { name: 'Tag Volunteers' }))
  await actor.click(await screen.findByRole('checkbox', { name: /Neda Volunteer/ }))
  await actor.click(screen.getByRole('button', { name: 'Next: Report Content' }))
  expect(screen.getByLabelText('Issues Discussed')).toHaveValue('Existing issues')
  await actor.click(screen.getByRole('button', { name: 'Update Report' }))

  expect(updateMeetingReport).toHaveBeenCalledWith(reportId, expect.objectContaining({ volunteerIds: [] }))
  expect(runRelationshipOperations).toHaveBeenCalledWith(reportId, [
    { action: 'remove', relationship: 'volunteer', contactId: volunteer.id },
  ])
  expect(await screen.findByRole('status')).toHaveTextContent('Report updated.')
})

test('retries only failed relationships without creating a duplicate report', async () => {
  const actor = userEvent.setup()
  const failedOperation = { action: 'add' as const, relationship: 'staff' as const, contactId: staff.id }
  vi.mocked(runRelationshipOperations).mockResolvedValueOnce([failedOperation]).mockResolvedValueOnce([])
  renderReportRoute('/report/new')

  await screen.findByDisplayValue('Sara Rahimi')
  await actor.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  await actor.type(screen.getByLabelText('Meeting Title'), 'Retry meeting')
  await actor.type(screen.getByLabelText('Date of Meeting'), '2026-09-01')
  await actor.click(screen.getByRole('combobox', { name: 'Representative / Office' }))
  await actor.click(await screen.findByRole('option', { name: /Rep. Carter Office/ }))
  await actor.click(screen.getByRole('combobox', { name: 'State / District' }))
  await actor.click(await screen.findByRole('option', { name: 'DC' }))
  await actor.click(screen.getByRole('radio', { name: /In-person/ }))
  await actor.click(screen.getByRole('combobox', { name: 'Tag OIAC Staff Members' }))
  await actor.click(await screen.findByRole('checkbox', { name: /Ali Staff/ }))
  await actor.click(screen.getByRole('button', { name: 'Next: Report Content' }))
  await actor.type(screen.getByLabelText('Issues Discussed'), 'Retry associations')
  await actor.click(screen.getByRole('button', { name: 'Submit Report' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('report was saved')
  expect(screen.getByLabelText('Issues Discussed')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Submit Report' })).toBeDisabled()
  await actor.click(screen.getByRole('button', { name: 'Retry contact links' }))
  expect(createMeetingReport).toHaveBeenCalledTimes(1)
  expect(runRelationshipOperations).toHaveBeenCalledTimes(2)
  expect(runRelationshipOperations).toHaveBeenLastCalledWith(reportId, [failedOperation])
  expect(await screen.findByRole('status')).toHaveTextContent('Report saved.')
})
