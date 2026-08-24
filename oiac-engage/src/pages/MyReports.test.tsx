import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import MyReports from './MyReports'

test('shows member report periods and availability', () => {
  render(<MyReports />)

  expect(screen.getByRole('heading', { name: 'My Reports' })).toBeInTheDocument()
  expect(screen.getByText('Member engagement summary')).toBeInTheDocument()
  expect(screen.getByText('July 2026')).toBeInTheDocument()
  expect(screen.getAllByText('Available')).toHaveLength(2)
  expect(document.title).toBe('My Reports — OIAC Engage')
})
