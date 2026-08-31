import { useEffect } from 'react'
import { LuChevronLeft } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import type { PortalUser } from '../auth/powerPagesSession'
import { useDistrictContacts } from '../features/contacts/useDistrictContacts'

type ContactProps = {
  readonly user: PortalUser
}

function displayValue(value: string | null): string {
  return value?.trim() || '—'
}

export default function Contact({ user }: ContactProps) {
  const directory = useDistrictContacts(user.contactId)
  const hasContacts = directory.contacts.length > 0
  const canSearch = ![
    'loading-district',
    'missing-session',
    'missing-district',
  ].includes(directory.status)
  const showPagination = hasContacts || directory.page > 1

  useEffect(() => {
    document.title = 'Contacts — OIAC Engage'
  }, [])

  return (
    <div className="page page--contacts">
      <Link className="contact-directory__back" to="/">
        <LuChevronLeft aria-hidden="true" />
        <span>Back</span>
      </Link>

      <header className="contact-directory__header">
        <h1>Contacts</h1>
        <p>Contacts assigned to your district.</p>
      </header>

      {canSearch ? (
        <div className="contact-directory__search">
          <label className="sr-only" htmlFor="contact-search">Search contacts</label>
          <input
            id="contact-search"
            type="search"
            value={directory.search}
            placeholder="Search by name, email, phone, or city..."
            autoComplete="off"
            onChange={(event) => directory.setSearch(event.target.value)}
          />
        </div>
      ) : null}

      <div className="contact-directory__results" aria-busy={directory.isLoading}>
        {directory.status === 'loading-district' ? (
          <p className="contact-directory__state-panel" role="status">Loading your district…</p>
        ) : null}

        {directory.status === 'missing-session' ? (
          <p className="contact-directory__state-panel" role="status">
            Your Power Pages session could not identify your Contact. Sign in again to continue.
          </p>
        ) : null}

        {directory.status === 'missing-district' ? (
          <p className="contact-directory__state-panel" role="status">
            No district is assigned to your profile. Contact an administrator to update your district.
          </p>
        ) : null}

        {directory.status === 'error' ? (
          <div className="contact-directory__error" role="alert">
            <p>{directory.errorMessage ?? 'Contacts could not be loaded. Try again.'}</p>
            <button className="contact-directory__retry" type="button" onClick={directory.retry}>Retry</button>
          </div>
        ) : null}

        {directory.status === 'loading-contacts' ? (
          <p className="contact-directory__loading" role="status">Loading contacts…</p>
        ) : null}

        {hasContacts ? (
          <div
            className="contact-directory__table-scroll"
            role="region"
            aria-label="District contacts table, scroll horizontally"
            tabIndex={0}
          >
            <table className="contact-directory__table" aria-label="District contacts">
              <thead>
                <tr>
                  <th scope="col">Full Name</th>
                  <th scope="col">Mobile Phone</th>
                  <th scope="col">Email</th>
                  <th scope="col">District</th>
                  <th scope="col">City</th>
                </tr>
              </thead>
              <tbody>
                {directory.contacts.map((contact) => (
                  <tr key={contact.id}>
                    <th scope="row">{displayValue(contact.fullName)}</th>
                    <td>{displayValue(contact.mobilePhone)}</td>
                    <td>{displayValue(contact.email)}</td>
                    <td>{displayValue(contact.districtName)}</td>
                    <td>{displayValue(contact.city)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {directory.status === 'ready' && !hasContacts ? (
          <p className="contact-directory__empty" role="status">
            {directory.search
              ? <>No contacts match “{directory.search}”.</>
              : <>No contacts are available in your district.</>}
          </p>
        ) : null}

        {showPagination ? (
          <nav className="contact-directory__pagination" aria-label="Contacts pagination">
            <button
              type="button"
              aria-label="Previous page"
              disabled={directory.page === 1 || directory.isLoading}
              onClick={directory.previousPage}
            >
              Previous
            </button>
            <span className="contact-directory__page-indicator" aria-live="polite">Page {directory.page}</span>
            <button
              type="button"
              aria-label="Next page"
              disabled={!directory.hasNext || directory.isLoading}
              onClick={directory.nextPage}
            >
              Next
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  )
}
