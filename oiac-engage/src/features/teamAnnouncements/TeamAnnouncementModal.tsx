import { useEffect, useId, useRef } from 'react'
import { LuExternalLink, LuX } from 'react-icons/lu'
import type { TeamAnnouncement } from './teamAnnouncementTypes'

export type TeamAnnouncementModalProps = {
  readonly announcement: TeamAnnouncement
  readonly formattedStartDate: string
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

export function TeamAnnouncementModal({
  announcement,
  formattedStartDate,
  returnFocusTo,
  onClose,
}: TeamAnnouncementModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
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
      className="team-announcement-modal"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="team-announcement-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="team-announcement-modal__header">
          <div>
            <p className="team-announcement-modal__eyebrow">Teams announcement</p>
            <h2 id={titleId}>{announcement.title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            className="button button--quiet team-announcement-modal__close"
            type="button"
            aria-label="Close announcement"
            onClick={onClose}
          >
            <LuX aria-hidden="true" />
          </button>
        </header>
        <time className="team-announcement-modal__date" dateTime={announcement.startDateTime}>
          {formattedStartDate}
        </time>
        <div className="team-announcement-modal__content">{announcement.content}</div>
        {announcement.link ? (
          <footer className="team-announcement-modal__footer">
            <a
              className="button button--primary"
              href={announcement.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open announcement
              <LuExternalLink aria-hidden="true" />
            </a>
          </footer>
        ) : null}
      </section>
    </div>
  )
}
