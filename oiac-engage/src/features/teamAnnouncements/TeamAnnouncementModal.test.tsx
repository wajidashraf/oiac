import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { TeamAnnouncement } from './teamAnnouncementTypes'
import { TeamAnnouncementModal } from './TeamAnnouncementModal'

const announcement: TeamAnnouncement = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  title: 'Volunteer briefing update',
  content: 'First paragraph.\n\nSecond paragraph.',
  startDateTime: '2026-09-12T13:00:00Z',
  endDateTime: '2026-09-13T13:00:00Z',
  link: 'https://example.com/briefing',
}

afterEach(() => {
  document.body.style.overflow = ''
  vi.restoreAllMocks()
})

describe('TeamAnnouncementModal', () => {
  test('shows announcement details and a safe external-link action when available', () => {
    render(
      <TeamAnnouncementModal
        announcement={announcement}
        formattedStartDate="Sep 12, 2026 · 9:00 AM ET"
        returnFocusTo={null}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: announcement.title })).toBeInTheDocument()
    expect(screen.getByText('Sep 12, 2026 · 9:00 AM ET')).toBeInTheDocument()
    expect(document.querySelector('.team-announcement-modal__content')).toHaveTextContent(
      'First paragraph. Second paragraph.',
    )
    expect(screen.getByRole('link', { name: 'Open announcement' })).toHaveAttribute(
      'href',
      announcement.link,
    )
    expect(screen.getByRole('link', { name: 'Open announcement' })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: 'Open announcement' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    )
  })

  test('hides the external-link action when the announcement has no link', () => {
    render(
      <TeamAnnouncementModal
        announcement={{ ...announcement, link: null }}
        formattedStartDate="Sep 12, 2026 · 9:00 AM ET"
        returnFocusTo={null}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByRole('link', { name: 'Open announcement' })).not.toBeInTheDocument()
  })

  test('closes on Escape and direct backdrop click but not a click inside the dialog', async () => {
    const actor = userEvent.setup()
    const onClose = vi.fn()
    const { container } = render(
      <TeamAnnouncementModal
        announcement={announcement}
        formattedStartDate="Sep 12, 2026 · 9:00 AM ET"
        returnFocusTo={null}
        onClose={onClose}
      />,
    )
    const backdrop = container.querySelector('.team-announcement-modal')
    expect(backdrop).not.toBeNull()

    await actor.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  test('traps focus, locks page scroll, and restores both when removed', async () => {
    const actor = userEvent.setup()
    const trigger = document.createElement('button')
    trigger.textContent = 'Open details'
    document.body.append(trigger)
    trigger.focus()
    document.body.style.overflow = 'auto'

    const { unmount } = render(
      <TeamAnnouncementModal
        announcement={announcement}
        formattedStartDate="Sep 12, 2026 · 9:00 AM ET"
        returnFocusTo={trigger}
        onClose={vi.fn()}
      />,
    )

    const closeButton = screen.getByRole('button', { name: 'Close announcement' })
    const link = screen.getByRole('link', { name: 'Open announcement' })
    expect(closeButton).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')

    await actor.tab({ shift: true })
    expect(link).toHaveFocus()
    await actor.tab()
    expect(closeButton).toHaveFocus()

    unmount()
    expect(document.body.style.overflow).toBe('auto')
    expect(trigger).toHaveFocus()
    trigger.remove()
  })
})
