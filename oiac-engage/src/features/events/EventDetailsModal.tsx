import { useEffect, useId, useRef } from 'react'
import { LuExternalLink, LuX } from 'react-icons/lu'
import type { EventItem } from './eventTypes'

export type EventDetailsModalProps = {
  readonly event: EventItem
  readonly returnFocusTo: HTMLButtonElement | null
  readonly onClose: () => void
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function safeHttpUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function displayValue(value: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed || null
}

function dateTimeDetails(value: string | null): { readonly iso: string | null; readonly label: string } {
  if (!value) return { iso: null, label: 'Not available' }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return { iso: null, label: 'Not available' }
  return {
    iso: value,
    label: new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed),
  }
}

export function EventDetailsModal({ event, returnFocusTo, onClose }: EventDetailsModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const start = dateTimeDetails(event.startDateTime)
  const end = dateTimeDetails(event.endDateTime)
  const venue = displayValue(event.venueName)
  const description = displayValue(event.description)
  const meetingUrl = safeHttpUrl(event.meetingUrl)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') {
        keyEvent.preventDefault()
        onClose()
        return
      }
      if (keyEvent.key !== 'Tab') return

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1)
      if (focusable.length === 0) {
        keyEvent.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (keyEvent.shiftKey && document.activeElement === first) {
        keyEvent.preventDefault()
        last.focus()
      } else if (!keyEvent.shiftKey && document.activeElement === last) {
        keyEvent.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      returnFocusTo?.focus()
    }
  }, [onClose, returnFocusTo])

  return (
    <div
      className="event-details-modal"
      onClick={(clickEvent) => {
        if (clickEvent.target === clickEvent.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="event-details-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="event-details-modal__header">
          <div>
            <p className="event-details-modal__eyebrow">Event details</p>
            <h2 id={titleId}>{event.title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            className="button button--quiet event-details-modal__close"
            type="button"
            aria-label="Close event details"
            onClick={onClose}
          >
            <LuX aria-hidden="true" />
          </button>
        </header>

        <dl className="event-details-modal__metadata">
          <div>
            <dt>Format</dt>
            <dd>{event.eventFormat}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{event.eventType}</dd>
          </div>
        </dl>

        <dl className="event-details-modal__schedule">
          <div>
            <dt>Start</dt>
            <dd>{start.iso ? <time dateTime={start.iso}>{start.label}</time> : start.label}</dd>
          </div>
          <div>
            <dt>End</dt>
            <dd>{end.iso ? <time dateTime={end.iso}>{end.label}</time> : end.label}</dd>
          </div>
        </dl>

        {venue ? (
          <section className="event-details-modal__section" aria-labelledby={`${titleId}-venue`}>
            <h3 id={`${titleId}-venue`}>Venue</h3>
            <p>{venue}</p>
          </section>
        ) : null}

        {description ? (
          <section className="event-details-modal__section" aria-labelledby={`${titleId}-description`}>
            <h3 id={`${titleId}-description`}>Description</h3>
            <p>{description}</p>
          </section>
        ) : null}

        {meetingUrl ? (
          <footer className="event-details-modal__footer">
            <a
              className="button button--primary"
              href={meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Join meeting
              <LuExternalLink aria-hidden="true" />
            </a>
          </footer>
        ) : null}
      </section>
    </div>
  )
}
