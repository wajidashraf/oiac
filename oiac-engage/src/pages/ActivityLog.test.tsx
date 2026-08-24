import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import ActivityLog from './ActivityLog'

test('renders the chronological Activity Log', () => {
  render(<ActivityLog />)
  expect(screen.getByRole('heading', { name: 'Activity Log' })).toBeInTheDocument()
  expect(screen.getByText('Report became available')).toBeInTheDocument()
})
