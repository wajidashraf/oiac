import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import { type EventItem } from '../data/eventsData'
import Events from './Events'

function renderEvents(items?: readonly EventItem[]) {
  return render(
    <MemoryRouter>
      <Events items={items} />
    </MemoryRouter>,
  )
}

describe('Events', () => {
  test('renders the six reference events in List view by default', () => {
    renderEvents()

    expect(screen.getByRole('heading', { name: 'Events', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Rallies, conventions, advocacy days, and organizational briefings.')).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'All', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'List', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calendar', pressed: false })).toBeInTheDocument()
    expect(document.title).toBe('Events — OIAC Engage')
  })

  test('filters cards by category', async () => {
    const user = userEvent.setup()
    renderEvents()

    await user.click(screen.getByRole('button', { name: 'Rally' }))

    expect(screen.getByRole('button', { name: 'Rally', pressed: true })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Iranian American Rights Rally — Los Angeles' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Iranian American Heritage Month Kickoff' })).toBeInTheDocument()
    expect(screen.queryByText('Capitol Hill Advocacy Day')).not.toBeInTheDocument()
  })

  test('preserves the active filter when switching to the separate Events calendar', async () => {
    const user = userEvent.setup()
    renderEvents()

    await user.click(screen.getByRole('button', { name: 'Advocacy Day' }))
    await user.click(screen.getByRole('button', { name: 'Calendar' }))

    expect(screen.getByRole('button', { name: 'Advocacy Day', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calendar', pressed: true })).toBeInTheDocument()
    const grid = screen.getByRole('grid', { name: 'Events September 2026 calendar' })
    expect(within(grid).getByText('Capitol Hill Advocacy Day')).toBeInTheDocument()
    expect(within(grid).queryByText('Congressional Outreach Training Session')).not.toBeInTheDocument()
    expect(within(grid).queryByText('Volunteer Captain Briefing')).not.toBeInTheDocument()
  })

  test('navigates Events months without importing My Calendar records', async () => {
    const user = userEvent.setup()
    renderEvents()

    await user.click(screen.getByRole('button', { name: 'Calendar' }))
    await user.click(screen.getByRole('button', { name: 'Show October 2026' }))

    const grid = screen.getByRole('grid', { name: 'Events October 2026 calendar' })
    expect(within(grid).getByText('OIAC National Convention 2026')).toBeInTheDocument()
    expect(within(grid).getByText('Iranian American Heritage Month Kickoff')).toBeInTheDocument()
    expect(within(grid).queryByText('Congressional Outreach Training Session')).not.toBeInTheDocument()
  })

  test('keeps Register and Add to Calendar actions inert', async () => {
    const user = userEvent.setup()
    renderEvents()

    const rally = screen.getByRole('heading', { name: 'Iranian American Rights Rally — Los Angeles' }).closest('article')
    expect(rally).not.toBeNull()
    const rallyCard = within(rally as HTMLElement)

    await user.click(rallyCard.getByRole('button', { name: 'Register' }))
    await user.click(rallyCard.getByRole('button', { name: 'Add to Calendar' }))

    expect(rallyCard.getByRole('button', { name: 'Register' })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'List', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All', pressed: true })).toBeInTheDocument()
  })

  test('explains when the selected category has no matching events', async () => {
    const user = userEvent.setup()
    const conventionOnly: readonly EventItem[] = [{
      id: 'only-event',
      title: 'Only Convention',
      date: '2026-09-10',
      location: 'Washington, D.C.',
      category: 'Convention',
      status: 'Upcoming',
      registered: false,
    }]
    renderEvents(conventionOnly)

    await user.click(screen.getByRole('button', { name: 'Rally' }))

    expect(screen.getByRole('heading', { name: 'No events in this category', level: 2 })).toBeInTheDocument()
  })
})
