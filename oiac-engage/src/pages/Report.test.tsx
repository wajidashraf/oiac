import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, test } from 'vitest'
import MeetingReportForm from './MeetingReportForm'
import Report from './Report'

function renderReportRoute(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/report" element={<Report />} />
        <Route path="/report/new" element={<MeetingReportForm />} />
        <Route path="/report/:reportId/edit" element={<MeetingReportForm />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('lists meeting reports with a create action and record-specific edit actions', () => {
  renderReportRoute('/report')

  expect(screen.getByRole('heading', { name: 'Meeting Reports', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '+ Submit Report' })).toHaveAttribute('href', '/report/new')

  const table = screen.getByRole('table', { name: 'Meeting Reports' })
  expect(within(table).getAllByRole('row')).toHaveLength(4)
  expect(within(table).getByRole('link', { name: 'Edit Advocacy Briefing — Rep. Chen Office' }))
    .toHaveAttribute('href', '/report/advocacy-briefing-chen/edit')
})

test('opens a new report at the volunteer information step with profile details prefilled', () => {
  renderReportRoute('/report/new')

  expect(screen.getByRole('heading', { name: 'Volunteer Information', level: 2 })).toBeInTheDocument()
  expect(screen.getByLabelText('Full Name')).toHaveValue('Sara Rahimi')
  expect(screen.getByLabelText('Email')).toHaveValue('sara.rahimi@email.com')
  expect(screen.getByLabelText('State')).toHaveValue('DC')
  expect(screen.getByLabelText('City')).toHaveValue('Washington')
  expect(screen.getByText('Your Info').closest('li')).toHaveAttribute('aria-current', 'step')
})

test('prefills an existing report and presents the complete meeting details step', async () => {
  const user = userEvent.setup()
  renderReportRoute('/report/advocacy-briefing-chen/edit')

  await user.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  expect(screen.getByRole('heading', { name: 'Meeting Details', level: 2 })).toBeInTheDocument()
  expect(screen.getByLabelText('Meeting Title')).toHaveValue('Advocacy Briefing — Rep. Chen Office')
  expect(screen.getByLabelText('Representative / Office')).toHaveValue("Rep. Chen's Office")
  expect(screen.getByLabelText('Date of Meeting')).toHaveValue('2026-08-05')
  expect(screen.getByLabelText('State / District')).toBeInTheDocument()
  expect(screen.getByLabelText('Related Event')).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Meeting Format' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: /Teams/ })).toBeInTheDocument()
  expect(screen.getByLabelText('Tag OIAC Staff Members')).toBeInTheDocument()
  expect(screen.getByLabelText('Tag Volunteers')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Next: Report Content' }))
  expect(screen.getByRole('heading', { name: 'Report Content', level: 2 })).toBeInTheDocument()
  expect(screen.getByLabelText('Issues Discussed')).toBeInTheDocument()
  expect(screen.getByLabelText('Outcomes & Next Steps')).toBeInTheDocument()
  expect(screen.getByLabelText('Follow-up Actions')).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Overall Sentiment' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Supportive' })).toBeChecked()
  expect(screen.getByText('Report').closest('li')).toHaveAttribute('aria-current', 'step')
})

test('preserves report details across steps and submits the completed report', async () => {
  const user = userEvent.setup()
  renderReportRoute('/report/new')

  await user.click(screen.getByRole('button', { name: 'Next: Meeting Details' }))
  await user.type(screen.getByLabelText('Meeting Title'), 'Community briefing')
  await user.type(screen.getByLabelText('Representative / Office'), 'District office')
  await user.type(screen.getByLabelText('Date of Meeting'), '2026-09-01')
  await user.click(screen.getByRole('radio', { name: /District/ }))
  await user.click(screen.getByRole('button', { name: 'Next: Report Content' }))
  await user.type(screen.getByLabelText('Issues Discussed'), 'Community priorities and constituent services')
  await user.click(screen.getByRole('radio', { name: 'Neutral' }))
  await user.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.getByRole('radio', { name: /District/ })).toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Next: Report Content' }))
  expect(screen.getByLabelText('Issues Discussed')).toHaveValue('Community priorities and constituent services')
  await user.click(screen.getByRole('button', { name: 'Submit Report' }))

  expect(screen.getByRole('status')).toHaveTextContent('Report saved.')
  expect(screen.getByRole('table', { name: 'Meeting Reports' })).toBeInTheDocument()
})
