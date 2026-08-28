import { type FormEvent, useEffect, useRef, useState } from 'react'
import { FiChevronLeft } from 'react-icons/fi'
import EmptyState from '../components/EmptyState'
import { activityItems, type ActivityItem, type ActivityType } from '../data/portalData'

type ActivityLogProps = { items?: readonly ActivityItem[] }
type ActivityDraft = Pick<ActivityItem, 'type' | 'date' | 'subject' | 'contact' | 'notes'>

const activityTypes: readonly ActivityType[] = ['Email', 'Appointment', 'Event Participation']

const emptyDraft: ActivityDraft = {
  type: 'Email',
  date: '',
  subject: '',
  contact: '',
  notes: '',
}

const contactFields: Record<ActivityType, { label: string; placeholder: string; type: 'email' | 'text' }> = {
  Email: { label: 'To (Email Address)', placeholder: 'e.g. office@sen.johnson.gov', type: 'email' },
  Appointment: { label: 'With / Office', placeholder: 'Representative or office name', type: 'text' },
  'Event Participation': { label: 'Event / Organization', placeholder: 'Event or organization name', type: 'text' },
}

function formatActivityDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function countLabel(type: ActivityType, count: number) {
  if (count === 1) return `1 ${type}`
  return `${count} ${type === 'Email' ? 'Emails' : type === 'Appointment' ? 'Appointments' : 'Event Participations'}`
}

function isViewOnlyActivity(record: ActivityItem) {
  return (record.type === 'Email' && record.status === 'Submitted')
    || (record.type === 'Appointment' && record.status === 'Confirmed')
    || (record.type === 'Event Participation' && record.status === 'Completed')
}

export default function ActivityLog({ items = activityItems }: ActivityLogProps) {
  const [records, setRecords] = useState<ActivityItem[]>(() => [...items])
  const [draft, setDraft] = useState<ActivityDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const activityTypeRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    document.title = 'Activity — OIAC Engage'
  }, [])

  useEffect(() => {
    if (isFormOpen) activityTypeRef.current?.focus()
  }, [editingId, isFormOpen])

  const counts = activityTypes.map((type) => ({
    type,
    count: records.filter((record) => record.type === type).length,
  }))
  const contactField = contactFields[draft.type]

  const updateDraft = (field: keyof ActivityDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }) as ActivityDraft)
  }

  const openNewActivity = () => {
    setDraft(emptyDraft)
    setEditingId(null)
    setSavedMessage('')
    setIsFormOpen(true)
  }

  const openEditActivity = (record: ActivityItem) => {
    setDraft({
      type: record.type,
      date: record.date,
      subject: record.subject,
      contact: record.contact,
      notes: record.notes,
    })
    setEditingId(record.id)
    setSavedMessage('')
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setDraft(emptyDraft)
    setEditingId(null)
    setIsFormOpen(false)
  }

  const saveActivity = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const existingRecord = editingId ? records.find((record) => record.id === editingId) : undefined
    const nextRecord: ActivityItem = {
      id: editingId ?? `activity-${Date.now()}`,
      ...draft,
      status: existingRecord?.status ?? 'Submitted',
    }

    setRecords((current) => editingId
      ? current.map((record) => record.id === editingId ? nextRecord : record)
      : [nextRecord, ...current])
    closeForm()
    setSavedMessage(editingId ? 'Activity updated.' : 'Activity submitted.')
  }

  const formName = editingId ? 'Edit Activity' : 'New Activity'

  return (
    <div className="page page--activity-log">
      <a className="activity-log__back" href="/">
        <FiChevronLeft aria-hidden="true" />
        Back
      </a>

      <header className="activity-log__header">
        <h1>Activity</h1>
        <p>Submit and track your outreach activities — connected to the Volunteer Activity Table in Dataverse.</p>
      </header>

      <div className="activity-log__toolbar">
        <div className="activity-log__counts" role="group" aria-label="Activity totals">
          {counts.map(({ type, count }) => <span key={type}>{countLabel(type, count)}</span>)}
        </div>
        <button
          aria-controls="activity-log-form"
          aria-expanded={isFormOpen}
          className="button button--primary activity-log__submit"
          onClick={openNewActivity}
          type="button"
        >
          + Submit Activity
        </button>
      </div>

      {savedMessage ? <p className="form-success activity-log__success" role="status">{savedMessage}</p> : null}

      {isFormOpen ? (
        <form
          aria-label={formName}
          className="activity-log-form"
          id="activity-log-form"
          onSubmit={saveActivity}
        >
          <h2>{formName}</h2>
          <div className="activity-log-form__grid">
            <label className="field" htmlFor="activity-type">
              <span>Activity Type <span aria-hidden="true" className="required-mark">*</span></span>
              <select
                aria-label="Activity Type"
                id="activity-type"
                onChange={(event) => updateDraft('type', event.target.value)}
                ref={activityTypeRef}
                required
                value={draft.type}
              >
                {activityTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>

            <label className="field" htmlFor="activity-date">
              <span>Date <span aria-hidden="true" className="required-mark">*</span></span>
              <input
                aria-label="Date"
                id="activity-date"
                onChange={(event) => updateDraft('date', event.target.value)}
                required
                type="date"
                value={draft.date}
              />
            </label>

            <label className="field" htmlFor="activity-subject">
              <span>Subject / Description <span aria-hidden="true" className="required-mark">*</span></span>
              <input
                aria-label="Subject / Description"
                id="activity-subject"
                onChange={(event) => updateDraft('subject', event.target.value)}
                placeholder={draft.type === 'Email' ? 'Email subject...' : 'Activity description...'}
                required
                type="text"
                value={draft.subject}
              />
            </label>

            <label className="field" htmlFor="activity-contact">
              <span>{contactField.label} <span aria-hidden="true" className="required-mark">*</span></span>
              <input
                aria-label={contactField.label}
                id="activity-contact"
                onChange={(event) => updateDraft('contact', event.target.value)}
                placeholder={contactField.placeholder}
                required
                type={contactField.type}
                value={draft.contact}
              />
            </label>

            <label className="field field--full" htmlFor="activity-notes">
              <span>Notes</span>
              <textarea
                id="activity-notes"
                onChange={(event) => updateDraft('notes', event.target.value)}
                placeholder="Additional notes..."
                rows={3}
                value={draft.notes}
              />
            </label>
          </div>

          <div className="activity-log-form__actions">
            <button className="button button--primary" type="submit">{editingId ? 'Save Changes' : 'Submit'}</button>
            <button className="button button--quiet" onClick={closeForm} type="button">Cancel</button>
          </div>
        </form>
      ) : null}

      {records.length === 0 ? (
        <EmptyState title="No activity yet" description="Submit an activity to begin tracking your outreach." />
      ) : (
        <div className="activity-log-table-scroll" role="region" aria-label="Activity table" tabIndex={0}>
          <table className="activity-log-table" aria-label="Activities">
            <colgroup>
              <col className="activity-log-table__type-column" />
              <col className="activity-log-table__subject-column" />
              <col className="activity-log-table__date-column" />
              <col className="activity-log-table__status-column" />
              <col className="activity-log-table__action-column" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Subject</th>
                <th scope="col">Date</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td><span className="activity-log-table__type">{record.type}</span></td>
                  <th scope="row">{record.subject}</th>
                  <td><time dateTime={record.date}>{formatActivityDate(record.date)}</time></td>
                  <td><span className={`activity-log-table__status activity-log-table__status--${record.status.toLowerCase()}`}>{record.status}</span></td>
                  <td>
                    {isViewOnlyActivity(record) ? (
                      <button
                        aria-label={`View ${record.subject}`}
                        className="activity-log-table__action"
                        type="button"
                      >
                        View
                      </button>
                    ) : (
                      <button
                        aria-label={`Edit ${record.subject}`}
                        className="activity-log-table__action"
                        onClick={() => openEditActivity(record)}
                        type="button"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
