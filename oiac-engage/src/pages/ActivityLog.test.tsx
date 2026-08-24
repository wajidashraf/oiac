import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import ActivityLog from './ActivityLog'
import { activityItems } from '../data/portalData'

test('filters the chronological Activity Log by category', async () => {
  const user = userEvent.setup()
  render(<ActivityLog />)
  expect(screen.getByRole('heading', { name: 'Activity Log' })).toBeInTheDocument()
  expect(screen.getByText('Report became available')).toBeInTheDocument()

  await user.selectOptions(screen.getByLabelText('Category'), 'appointment')
  expect(screen.getByText('Appointment updated')).toBeInTheDocument()
  expect(screen.queryByText('Report became available')).not.toBeInTheDocument()
})

test('explains when a selected category has no matching activity', async () => {
  const user = userEvent.setup()
  render(<ActivityLog items={[activityItems[0]]} />)

  await user.selectOptions(screen.getByLabelText('Category'), 'appointment')
  expect(screen.getByRole('heading', { name: 'No matching activity' })).toBeInTheDocument()
})
