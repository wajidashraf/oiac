import { useEffect, useState } from 'react'
import { LuChevronLeft } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { districtContacts } from '../data/contacts'

export default function Contact() {
  const [query, setQuery] = useState('')
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const selectedContact = districtContacts.find((contact) => contact.id === selectedContactId)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleContacts = normalizedQuery
    ? districtContacts.filter((contact) => (
      contact.fullName.toLocaleLowerCase().includes(normalizedQuery)
      || contact.state.toLocaleLowerCase().includes(normalizedQuery)
      || contact.city.toLocaleLowerCase().includes(normalizedQuery)
    ))
    : districtContacts

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
        <p>Showing contacts in your district — Washington, DC &amp; Virginia.</p>
      </header>

      <div className="contact-directory__search">
        <label className="sr-only" htmlFor="contact-search">Search contacts</label>
        <input
          id="contact-search"
          type="search"
          value={query}
          placeholder="Search by name, state, or city..."
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {selectedContact ? (
        <form
          aria-label={`Contact details for ${selectedContact.fullName}`}
          className="contact-directory__viewer"
        >
          <div className="contact-directory__viewer-heading">
            <div>
              <h2>Contact Details</h2>
              <p>View the contact information for {selectedContact.fullName}.</p>
            </div>
            <button className="button button--quiet" onClick={() => setSelectedContactId(null)} type="button">Close</button>
          </div>
          <div className="contact-directory__viewer-grid">
            <label className="field">
              <span>Full Name</span>
              <input aria-label="Full Name" readOnly value={selectedContact.fullName} />
            </label>
            <label className="field">
              <span>Mobile Phone</span>
              <input aria-label="Mobile Phone" readOnly type="tel" value={selectedContact.mobilePhone} />
            </label>
            <label className="field">
              <span>Email</span>
              <input aria-label="Email" readOnly type="email" value={selectedContact.email} />
            </label>
            <label className="field">
              <span>State</span>
              <input aria-label="State" readOnly value={selectedContact.state} />
            </label>
            <label className="field">
              <span>City</span>
              <input aria-label="City" readOnly value={selectedContact.city} />
            </label>
          </div>
        </form>
      ) : null}

      {visibleContacts.length > 0 ? (
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
                <th scope="col">State</th>
                <th scope="col">City</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visibleContacts.map((contact) => (
                <tr key={contact.id}>
                  <th scope="row">{contact.fullName}</th>
                  <td>
                    <a href={contact.phoneHref} aria-label={`Call ${contact.fullName}`}>{contact.mobilePhone}</a>
                  </td>
                  <td>
                    <a href={`mailto:${contact.email}`} aria-label={`Email ${contact.fullName}`}>{contact.email}</a>
                  </td>
                  <td><span className="contact-directory__state">{contact.state}</span></td>
                  <td>{contact.city}</td>
                  <td>
                    <button
                      aria-label={`View ${contact.fullName} contact`}
                      className="contact-directory__view"
                      onClick={() => setSelectedContactId(contact.id)}
                      type="button"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="contact-directory__empty" role="status">
          <strong>No contacts found.</strong> Try another name, state, or city.
        </p>
      )}
    </div>
  )
}
