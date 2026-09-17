import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { EventDetailsModal } from './EventDetailsModal'
import type { EventItem } from './eventTypes'

const event: EventItem = {
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Volunteer Orientation Webinar',
  eventFormat: 'Virtual',
  eventFormatValue: 866530001,
  eventStatus: 'Registration Open',
  eventStatusValue: 866530002,
  eventType: 'Webinar',
  eventTypeValue: 866530005,
  startDateTime: '2026-09-16T18:00:00Z',
  endDateTime: '2026-09-16T19:30:00Z',
  meetingUrl: 'https://teams.microsoft.com/l/meetup-join/orientation',
  venueName: 'Online volunteer room',
  description: 'Learn how to support the next volunteer campaign.',
}

afterEach(() => {
  document.body.style.overflow = ''
  vi.restoreAllMocks()
})

describe('EventDetailsModal', () => {
  test('shows complete Event details and a safe Join meeting action', () => {
    render(
      <EventDetailsModal
        event={event}
        returnFocusTo={null}
        onClose={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: event.title })
    expect(within(dialog).getByText('Virtual')).toBeInTheDocument()
    expect(within(dialog).getByText('Webinar')).toBeInTheDocument()
    expect(within(dialog).getByText('Online volunteer room')).toBeInTheDocument()
    expect(within(dialog).getByText(event.description!)).toBeInTheDocument()
    expect(within(dialog).getByText('Start')).toBeInTheDocument()
    expect(within(dialog).getByText('End')).toBeInTheDocument()
    expect(dialog.querySelector(`time[datetime="${event.startDateTime}"]`)).toBeInTheDocument()
    expect(dialog.querySelector(`time[datetime="${event.endDateTime}"]`)).toBeInTheDocument()

    const joinLink = within(dialog).getByRole('link', { name: 'Join meeting' })
    expect(joinLink).toHaveAttribute('href', event.meetingUrl)
    expect(joinLink).toHaveAttribute('target', '_blank')
    expect(joinLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('omits empty optional details and rejects unsafe meeting URLs', () => {
    render(
      <EventDetailsModal
        event={{
          ...event,
          startDateTime: null,
          endDateTime: 'not-a-date',
          meetingUrl: 'javascript:alert(1)',
          venueName: '   ',
          description: '',
        }}
        returnFocusTo={null}
        onClose={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: event.title })
    expect(within(dialog).getAllByText('Not available')).toHaveLength(2)
    expect(within(dialog).queryByText('Venue')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Description')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('link', { name: 'Join meeting' })).not.toBeInTheDocument()
  })

  test('closes from its controls and direct backdrop interaction', async () => {
    const actor = userEvent.setup()
    const onClose = vi.fn()
    const { container } = render(
      <EventDetailsModal event={event} returnFocusTo={null} onClose={onClose} />,
    )

    await actor.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()

    await actor.click(screen.getByRole('button', { name: 'Close event details' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    const backdrop = container.querySelector('.event-details-modal')
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  test('traps focus, locks scrolling, and restores focus when removed', async () => {
    const actor = userEvent.setup()
    const trigger = document.createElement('button')
    trigger.textContent = event.title
    document.body.append(trigger)
    trigger.focus()
    document.body.style.overflow = 'auto'

    const { unmount } = render(
      <EventDetailsModal event={event} returnFocusTo={trigger} onClose={vi.fn()} />,
    )

    const closeButton = screen.getByRole('button', { name: 'Close event details' })
    const joinLink = screen.getByRole('link', { name: 'Join meeting' })
    expect(closeButton).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')

    await actor.tab({ shift: true })
    expect(joinLink).toHaveFocus()
    await actor.tab()
    expect(closeButton).toHaveFocus()

    unmount()
    expect(document.body.style.overflow).toBe('auto')
    expect(trigger).toHaveFocus()
    trigger.remove()
  })

  test('does not restore focus during a parent rerender with a new close callback', () => {
    const trigger = document.createElement('button')
    trigger.textContent = event.title
    document.body.append(trigger)
    const focusTrigger = vi.spyOn(trigger, 'focus')
    const firstOnClose = vi.fn()
    const nextOnClose = vi.fn()

    const { rerender, unmount } = render(
      <EventDetailsModal event={event} returnFocusTo={trigger} onClose={firstOnClose} />,
    )
    expect(screen.getByRole('button', { name: 'Close event details' })).toHaveFocus()

    rerender(
      <EventDetailsModal event={event} returnFocusTo={trigger} onClose={nextOnClose} />,
    )

    expect(focusTrigger).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Close event details' })).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(firstOnClose).not.toHaveBeenCalled()
    expect(nextOnClose).toHaveBeenCalledTimes(1)

    unmount()
    expect(focusTrigger).toHaveBeenCalledTimes(1)
    trigger.remove()
  })
})
