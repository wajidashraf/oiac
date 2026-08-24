import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import MyCalendar from './MyCalendar'

test('shows the member agenda with dates and times', () => {
  render(<MyCalendar />)

  expect(screen.getByRole('heading', { name: 'My Calendar' })).toBeInTheDocument()
  expect(screen.getByText('Member briefing session')).toBeInTheDocument()
  expect(screen.getByText('27 Aug 2026')).toBeInTheDocument()
  expect(screen.getByText('10:00 AM')).toBeInTheDocument()
  expect(document.title).toBe('My Calendar — OIAC Engage')
})
