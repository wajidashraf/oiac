import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import MyCalendar from './MyCalendar'

function renderCalendar() {
  return render(
    <MemoryRouter>
      <MyCalendar initialMonth={new Date(2026, 8, 1)} />
    </MemoryRouter>,
  )
}

describe('My Calendar', () => {
  test('renders selected-month items in the grid and upcoming list', () => {
    renderCalendar()

    expect(screen.getByRole('heading', { name: 'My Calendar', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'September 2026', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Accepted meetings')).toBeInTheDocument()
    expect(screen.getByText('Registered events')).toBeInTheDocument()

    const septemberEighth = screen.getByRole('gridcell', { name: 'Tuesday, September 8, 2026' })
    expect(within(septemberEighth).getByRole('link', { name: /Join Capitol Hill Advocacy Day/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Join Capitol Hill Advocacy Day/i })).toHaveLength(2)
    expect(screen.queryByText('OIAC National Convention 2026')).not.toBeInTheDocument()
    expect(document.title).toBe('My Calendar — OIAC Engage')
  })

  test('opens every calendar item in Teams or Outlook in a new tab', () => {
    renderCalendar()

    const links = screen.getAllByRole('link', { name: /Join Congressional Outreach Training Session/i })
    expect(links).toHaveLength(2)
    links.forEach((link) => {
      expect(link).toHaveAttribute('href', 'https://teams.microsoft.com/')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noreferrer')
    })
  })

  test('moves between months and updates the grid and upcoming list together', async () => {
    const user = userEvent.setup()
    renderCalendar()

    await user.click(screen.getByRole('button', { name: 'Show October 2026' }))

    expect(screen.getByRole('heading', { name: 'October 2026', level: 2 })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Join OIAC National Convention 2026/i })).toHaveLength(2)
    expect(screen.queryByText('Capitol Hill Advocacy Day')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show September 2026' })).toBeInTheDocument()
  })

  test('keeps the month grid visible and explains an empty selected month', async () => {
    const user = userEvent.setup()
    renderCalendar()

    await user.click(screen.getByRole('button', { name: 'Show August 2026' }))

    expect(screen.getByRole('grid', { name: 'August 2026 calendar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No upcoming items this month', level: 3 })).toBeInTheDocument()
  })
})
