import { useEffect, useId, useRef, useState } from 'react'
import { LuX } from 'react-icons/lu'
import { DistrictLookup } from '../meetingReports/ContactLookup'
import type { DistrictOption } from '../meetingReports/meetingReportTypes'
import { updateAdminContact } from './contactService'
import type { AdminContactUpdate, DistrictContact } from './contactTypes'

export type AdminContactEditModalProps = {
  readonly contact: DistrictContact
  readonly returnFocusTo: HTMLButtonElement | null
  readonly onClose: () => void
  readonly onSaved: () => void
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function initialDistrict(contact: DistrictContact): DistrictOption | null {
  return contact.districtId
    ? { id: contact.districtId, name: contact.districtName ?? 'Assigned district' }
    : null
}

export function AdminContactEditModal({
  contact,
  returnFocusTo,
  onClose,
  onSaved,
}: AdminContactEditModalProps) {
  const titleId = useId()
  const errorId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const savingRef = useRef(false)
  const [firstName, setFirstName] = useState(contact.firstName ?? '')
  const [lastName, setLastName] = useState(contact.lastName ?? '')
  const [jobTitle, setJobTitle] = useState(contact.jobTitle ?? '')
  const [mobilePhone, setMobilePhone] = useState(contact.mobilePhone ?? '')
  const [city, setCity] = useState(contact.city ?? '')
  const [stateOrProvince, setStateOrProvince] = useState(contact.stateOrProvince ?? '')
  const [postalCode, setPostalCode] = useState(contact.postalCode ?? '')
  const [district, setDistrict] = useState<DistrictOption | null>(() => initialDistrict(contact))
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!savingRef.current) onClose()
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current) return

    if (!lastName.trim()) {
      setErrorMessage('Last Name is required.')
      return
    }

    savingRef.current = true
    setIsSaving(true)
    setErrorMessage(null)
    const values: AdminContactUpdate = {
      firstName,
      lastName,
      jobTitle,
      mobilePhone,
      city,
      stateOrProvince,
      postalCode,
      districtId: district?.id ?? null,
    }

    try {
      await updateAdminContact(contact.id, values)
      onSaved()
    } catch (error: unknown) {
      console.error('[AdminContactEditModal] Contact update failed', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      })
      setErrorMessage('Contact changes could not be saved. Try again.')
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  return (
    <div
      className="admin-contact-modal"
      onClick={(event) => {
        if (event.target === event.currentTarget && !savingRef.current) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="admin-contact-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="admin-contact-modal__header">
          <div>
            <p className="admin-contact-modal__eyebrow">Administrator</p>
            <h2 id={titleId}>Edit volunteer contact</h2>
            <p>{contact.fullName ?? contact.email ?? 'Volunteer contact'}</p>
          </div>
          <button
            ref={closeButtonRef}
            className="button button--quiet admin-contact-modal__close"
            type="button"
            aria-label="Close edit contact"
            disabled={isSaving}
            onClick={onClose}
          >
            <LuX aria-hidden="true" />
          </button>
        </header>

        <form
          className="admin-contact-modal__form"
          aria-label="Edit volunteer contact"
          aria-describedby={errorMessage ? errorId : undefined}
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="admin-contact-modal__grid">
            <label className="field admin-contact-modal__field">
              <span>First Name</span>
              <input value={firstName} disabled={isSaving} autoComplete="given-name" onChange={(event) => setFirstName(event.target.value)} />
            </label>
            <label className="field admin-contact-modal__field">
              <span>Last Name <span className="required-mark" aria-hidden="true">*</span></span>
              <input aria-label="Last Name" value={lastName} disabled={isSaving} required aria-invalid={errorMessage === 'Last Name is required.'} autoComplete="family-name" onChange={(event) => setLastName(event.target.value)} />
            </label>
            <label className="field admin-contact-modal__field admin-contact-modal__wide">
              <span>Email</span>
              <input value={contact.email ?? ''} readOnly type="email" autoComplete="email" />
            </label>
            <label className="field admin-contact-modal__field admin-contact-modal__wide">
              <span>Job Title</span>
              <input value={jobTitle} disabled={isSaving} autoComplete="organization-title" onChange={(event) => setJobTitle(event.target.value)} />
            </label>
            <label className="field admin-contact-modal__field">
              <span>Mobile Phone</span>
              <input value={mobilePhone} disabled={isSaving} type="tel" autoComplete="tel" onChange={(event) => setMobilePhone(event.target.value)} />
            </label>
            <label className="field admin-contact-modal__field">
              <span>City</span>
              <input value={city} disabled={isSaving} autoComplete="address-level2" onChange={(event) => setCity(event.target.value)} />
            </label>
            <label className="field admin-contact-modal__field">
              <span>State / Province</span>
              <input value={stateOrProvince} disabled={isSaving} autoComplete="address-level1" onChange={(event) => setStateOrProvince(event.target.value)} />
            </label>
            <label className="field admin-contact-modal__field">
              <span>Postal Code</span>
              <input value={postalCode} disabled={isSaving} autoComplete="postal-code" onChange={(event) => setPostalCode(event.target.value)} />
            </label>
            <div className="field admin-contact-modal__field admin-contact-modal__wide">
              <DistrictLookup
                label="District"
                value={district}
                onChange={setDistrict}
                disabled={isSaving}
              />
            </div>
          </div>

          {errorMessage ? <p id={errorId} className="admin-contact-modal__error" role="alert">{errorMessage}</p> : null}

          <footer className="admin-contact-modal__actions">
            <button className="button button--primary" type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
