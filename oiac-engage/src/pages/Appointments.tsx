import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LuChevronLeft } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { appointments, type AppointmentRecord } from '../data/portalData'

type AppointmentsProps = { items?: readonly AppointmentRecord[] }
type AppointmentDraft = {
  title: string
  with: string
  status: AppointmentRecord['status'] | ''
  date: string
  time: string
  agenda: string
  location: string
}

const emptyDraft: AppointmentDraft = {
  title: '',
  with: '',
  status: '',
  date: '',
  time: '',
  agenda: '',
  location: '',
}

function formatDate(date: string) {
  if (!date) return 'Date to be confirmed'
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function formatTime(time: string) {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2026, 0, 1, hours, minutes))
}

export default function Appointments({ items = appointments }: AppointmentsProps) {
  const [records, setRecords] = useState<AppointmentRecord[]>(() => [...items])
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<AppointmentDraft>(emptyDraft)
  const newAppointmentButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    document.title = 'Appointments — OIAC Engage'
  }, [])

  const updateDraft = (field: keyof AppointmentDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const closeForm = () => {
    setFormOpen(false)
    setDraft(emptyDraft)
    newAppointmentButton.current?.focus()
  }

  const submitAppointment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextAppointment: AppointmentRecord = {
      id: `appointment-${Date.now()}`,
      title: draft.title.trim(),
      with: draft.with.trim(),
      status: draft.status || 'Pending',
      date: formatDate(draft.date),
      time: formatTime(draft.time),
      agenda: draft.agenda.trim(),
      location: draft.location,
    }
    setRecords((current) => [nextAppointment, ...current])
    closeForm()
  }

  return (
    <div className="page oiac-appointments-page">
      <Link className="oiac-appointments-page__back" to="/">
        <LuChevronLeft aria-hidden="true" />
        <span>Back</span>
      </Link>

      <header className="oiac-appointments-page__header">
        <h1>Appointments</h1>
        <p>Schedule and track appointments with representatives and organizational contacts.</p>
      </header>

      <div className="oiac-appointments-page__toolbar">
        <button
          ref={newAppointmentButton}
          className="oiac-appointments-page__new"
          type="button"
          aria-expanded={formOpen}
          aria-controls="new-appointment-form"
          onClick={() => setFormOpen(true)}
        >
          + New Appointment
        </button>
      </div>

      {formOpen ? (
        <form
          className="oiac-appointment-form"
          id="new-appointment-form"
          aria-label="New Appointment"
          onSubmit={submitAppointment}
        >
          <h2>Request Appointment</h2>
          <div className="oiac-appointment-form__grid">
            <label className="oiac-appointment-field oiac-appointment-field--full">
              <span>Appointment Title <span className="required-mark" aria-hidden="true">*</span></span>
              <input
                aria-label="Appointment Title"
                name="appointmentTitle"
                autoComplete="off"
                required
                value={draft.title}
                onChange={(event) => updateDraft('title', event.target.value)}
                placeholder="e.g. Meeting with Rep. Johnson's office"
              />
            </label>

            <label className="oiac-appointment-field">
              <span>Representative / Office <span className="required-mark" aria-hidden="true">*</span></span>
              <input
                aria-label="Representative / Office"
                name="representativeOffice"
                autoComplete="organization"
                required
                value={draft.with}
                onChange={(event) => updateDraft('with', event.target.value)}
                placeholder="e.g. Sen. Carter's office"
              />
            </label>

            <label className="oiac-appointment-field">
              <span>Status</span>
              <select aria-label="Status" name="status" value={draft.status} onChange={(event) => updateDraft('status', event.target.value)}>
                <option value="">Select</option>
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
              </select>
            </label>

            <label className="oiac-appointment-field">
              <span>Preferred Date</span>
              <input aria-label="Preferred Date" name="preferredDate" type="date" value={draft.date} onChange={(event) => updateDraft('date', event.target.value)} />
            </label>

            <label className="oiac-appointment-field">
              <span>Preferred Time</span>
              <input aria-label="Preferred Time" name="preferredTime" type="time" value={draft.time} onChange={(event) => updateDraft('time', event.target.value)} />
            </label>

            <label className="oiac-appointment-field oiac-appointment-field--full">
              <span>Purpose / Agenda</span>
              <textarea
                aria-label="Purpose / Agenda"
                name="agenda"
                value={draft.agenda}
                onChange={(event) => updateDraft('agenda', event.target.value)}
                placeholder="Describe the purpose..."
              />
            </label>

            <label className="oiac-appointment-field">
              <span>Location / Platform</span>
              <select aria-label="Location / Platform" name="location" value={draft.location} onChange={(event) => updateDraft('location', event.target.value)}>
                <option value="">Select location</option>
                <option value="Microsoft Teams">Microsoft Teams</option>
                <option value="OIAC DC Office">OIAC DC Office</option>
                <option value="Representative Office">Representative Office</option>
              </select>
            </label>
          </div>

          <div className="oiac-appointment-form__actions">
            <button type="submit">Submit Request</button>
            <button type="button" onClick={closeForm}>Cancel</button>
          </div>
        </form>
      ) : null}

      {records.length === 0 ? (
        <section className="oiac-appointments-page__empty">
          <h2>No appointments yet</h2>
          <p>New appointment requests will appear here.</p>
        </section>
      ) : (
        <ul className="oiac-appointment-list" aria-label="Appointments list">
          {records.map((appointment) => (
            <li key={appointment.id} className="oiac-appointment-card">
              <div className="oiac-appointment-card__details">
                <h2>{appointment.title}</h2>
                <p>{appointment.with} · {appointment.date}{appointment.time ? ` ${appointment.time}` : ''}</p>
              </div>
              <div className="oiac-appointment-card__actions">
                {appointment.joinUrl !== undefined ? appointment.joinUrl ? (
                  <a className="oiac-appointment-card__join" href={appointment.joinUrl}>Join Teams</a>
                ) : (
                  <button className="oiac-appointment-card__join" type="button" disabled title="Teams link not yet available">Join Teams</button>
                ) : null}
                {appointment.status === 'Completed' ? (
                  <Link className="oiac-appointment-card__report" to="/my-reports">View Report</Link>
                ) : null}
                <span className={`oiac-appointment-card__status oiac-appointment-card__status--${appointment.status.toLowerCase()}`}>
                  {appointment.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
