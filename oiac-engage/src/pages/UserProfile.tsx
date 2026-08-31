import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LuChevronLeft } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import type { PortalUser } from '../auth/powerPagesSession'
import {
  getMyProfile,
  normalizeProfileContactId,
  updateMyProfile,
} from '../features/profile/profileService'
import type { ProfileFormValues } from '../features/profile/profileTypes'

type UserProfileProps = {
  readonly user: PortalUser
}

type LoadStatus = 'loading' | 'ready' | 'missing-session' | 'error'
type FieldErrors = Partial<Record<'firstName' | 'lastName', string>>

const EMPTY_PROFILE: ProfileFormValues = {
  firstName: '',
  lastName: '',
  city: '',
  state: '',
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export default function UserProfile({ user }: UserProfileProps) {
  const contactId = normalizeProfileContactId(user.contactId)
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(contactId ? 'loading' : 'missing-session')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [values, setValues] = useState<ProfileFormValues>(EMPTY_PROFILE)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const firstNameRef = useRef<HTMLInputElement>(null)
  const lastNameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'My Profile — OIAC Engage'
  }, [])

  useEffect(() => {
    if (!contactId) {
      setLoadStatus('missing-session')
      return
    }

    const controller = new AbortController()
    setLoadStatus('loading')
    setFormError(null)
    setSuccessMessage(null)

    getMyProfile(contactId, controller.signal)
      .then((profile) => {
        setValues(profile)
        setLoadStatus('ready')
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) setLoadStatus('error')
      })

    return () => controller.abort()
  }, [contactId, loadAttempt])

  function changeValue(field: keyof ProfileFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setSuccessMessage(null)
    setFormError(null)
    if (field === 'firstName' || field === 'lastName') {
      setFieldErrors((current) => ({ ...current, [field]: undefined }))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!contactId || saving) return

    const nextErrors: FieldErrors = {}
    if (!values.firstName.trim()) nextErrors.firstName = 'Enter your first name.'
    if (!values.lastName.trim()) nextErrors.lastName = 'Enter your last name.'
    setFieldErrors(nextErrors)

    if (nextErrors.firstName || nextErrors.lastName) {
      setFormError('Enter your first and last name.')
      setSuccessMessage(null)
      if (nextErrors.firstName) firstNameRef.current?.focus()
      else lastNameRef.current?.focus()
      return
    }

    setSaving(true)
    setFormError(null)
    setSuccessMessage(null)
    try {
      const savedValues = await updateMyProfile(contactId, values)
      setValues(savedValues)
      setSuccessMessage('Profile updated.')
    } catch {
      setFormError('Your profile could not be updated. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page page--profile">
      <Link className="profile-page__back" to="/">
        <LuChevronLeft aria-hidden="true" />
        <span>Back to dashboard</span>
      </Link>

      <header className="profile-page__header">
        <p className="profile-page__eyebrow">Account details</p>
        <h1>My Profile</h1>
        <p>Keep the contact details associated with your portal account up to date.</p>
      </header>

      {loadStatus === 'loading' ? (
        <p className="profile-page__state" role="status">Loading your profile…</p>
      ) : null}

      {loadStatus === 'missing-session' ? (
        <p className="profile-page__state" role="status">
          Your Power Pages session could not identify your Contact. Sign in again to continue.
        </p>
      ) : null}

      {loadStatus === 'error' ? (
        <div className="profile-page__state profile-page__state--error" role="alert">
          <p>Your profile could not be loaded.</p>
          <button className="button button--quiet" type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
            Try again
          </button>
        </div>
      ) : null}

      {loadStatus === 'ready' ? (
        <section className="profile-card" aria-labelledby="profile-form-title">
          <div className="profile-card__heading">
            <h2 id="profile-form-title">Contact information</h2>
            <p>Required fields are marked with an asterisk.</p>
          </div>

          <form className="profile-form" onSubmit={handleSubmit} noValidate aria-busy={saving}>
            {formError ? <div className="form-alert" role="alert">{formError}</div> : null}
            {successMessage ? <div className="form-success" role="status">{successMessage}</div> : null}

            <div className="profile-form__grid">
              <div className="field">
                <label htmlFor="profile-first-name">First Name <span aria-hidden="true">*</span></label>
                <input
                  ref={firstNameRef}
                  id="profile-first-name"
                  name="firstname"
                  type="text"
                  autoComplete="given-name"
                  required
                  disabled={saving}
                  value={values.firstName}
                  aria-invalid={fieldErrors.firstName ? 'true' : undefined}
                  aria-describedby={fieldErrors.firstName ? 'profile-first-name-error' : undefined}
                  onChange={(event) => changeValue('firstName', event.target.value)}
                />
                {fieldErrors.firstName ? <span className="field__error" id="profile-first-name-error">{fieldErrors.firstName}</span> : null}
              </div>

              <div className="field">
                <label htmlFor="profile-last-name">Last Name <span aria-hidden="true">*</span></label>
                <input
                  ref={lastNameRef}
                  id="profile-last-name"
                  name="lastname"
                  type="text"
                  autoComplete="family-name"
                  required
                  disabled={saving}
                  value={values.lastName}
                  aria-invalid={fieldErrors.lastName ? 'true' : undefined}
                  aria-describedby={fieldErrors.lastName ? 'profile-last-name-error' : undefined}
                  onChange={(event) => changeValue('lastName', event.target.value)}
                />
                {fieldErrors.lastName ? <span className="field__error" id="profile-last-name-error">{fieldErrors.lastName}</span> : null}
              </div>

              <div className="field">
                <label htmlFor="profile-city">City</label>
                <input
                  id="profile-city"
                  name="address1_city"
                  type="text"
                  autoComplete="address-level2"
                  disabled={saving}
                  value={values.city}
                  onChange={(event) => changeValue('city', event.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="profile-state">State</label>
                <input
                  id="profile-state"
                  name="address1_stateorprovince"
                  type="text"
                  autoComplete="address-level1"
                  disabled={saving}
                  value={values.state}
                  onChange={(event) => changeValue('state', event.target.value)}
                />
              </div>
            </div>

            <div className="profile-form__actions">
              <button className="button button--primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  )
}
