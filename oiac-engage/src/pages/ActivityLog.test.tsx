import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import ActivityLog from './ActivityLog'

test('filters the chronological Activity Log by category', async () => {
  const user = userEvent.setup()
  render(<ActivityLog />)
  expect(screen.getByRole('heading', { name: 'Activity Log' })).toBeInTheDocument()
  expect(screen.getByText('Report became available')).toBeInTheDocument()

  await user.selectOptions(screen.getByLabelText('Category'), 'appointment')
  expect(screen.getByText('Appointment updated')).toBeInTheDocument()
  expect(screen.queryByText('Report became available')).not.toBeInTheDocument()
})
