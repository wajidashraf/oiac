import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import MyReports from './MyReports'

test('shows member report periods and availability', () => {
  const { container } = render(<MyReports />)

  expect(screen.getByRole('heading', { name: 'My Reports' })).toBeInTheDocument()
  expect(screen.getByText('Member engagement summary')).toBeInTheDocument()
  expect(screen.getByText('July 2026')).toBeInTheDocument()
  expect(screen.getAllByText('Available')).toHaveLength(2)
  expect(screen.getByText('Report details will be available after data connection.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /view member engagement summary/i })).not.toBeInTheDocument()
  expect(container.firstElementChild).toHaveClass('page--my-reports')
  expect(document.title).toBe('My Reports — OIAC Engage')
})
