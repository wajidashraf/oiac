import { type FormEvent, useEffect, useRef, useState } from 'react'
import { FiChevronLeft } from 'react-icons/fi'
import EmptyState from '../components/EmptyState'
import { pressCoverage, type PressCoverageRecord } from '../data/portalData'

type PressCoverageProps = { items?: readonly PressCoverageRecord[] }
type CoverageDraft = Omit<PressCoverageRecord, 'id'>

const emptyDraft: CoverageDraft = {
  newsTitle: '',
  date: '',
  source: '',
  coverageType: '',
  sentiment: '',
  country: 'United States',
  url: '',
  pressAccount: '',
  language: '',
  rating: '',
  regardingEvent: '',
  mentions: '',
}

const sourceOptions = ['National', 'Online', 'Local'] as const
const sentimentOptions = ['Positive', 'Neutral', 'Negative'] as const
const coverageTypeOptions = ['News Article', 'Feature', 'Interview'] as const
const languageOptions = ['English', 'Persian', 'Spanish', 'French']
const ratingOptions = ['1', '2', '3', '4', '5']

function formatCoverageDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export default function PressCoverage({ items = pressCoverage }: PressCoverageProps) {
  const [records, setRecords] = useState<PressCoverageRecord[]>(() => [...items])
  const [draft, setDraft] = useState<CoverageDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'Press Coverage — OIAC Engage'
  }, [])

  useEffect(() => {
    if (isFormOpen) titleInputRef.current?.focus()
  }, [editingId, isFormOpen])

  const updateDraft = (field: keyof CoverageDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }) as CoverageDraft)
  }

  const openNewCoverage = () => {
    setDraft(emptyDraft)
    setEditingId(null)
    setSavedMessage('')
    setIsFormOpen(true)
  }

  const openEditCoverage = (record: PressCoverageRecord) => {
    const { id, ...editableRecord } = record
    setDraft(editableRecord)
    setEditingId(id)
    setSavedMessage('')
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingId(null)
    setDraft(emptyDraft)
  }

  const saveCoverage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextRecord: PressCoverageRecord = {
      id: editingId ?? `press-${Date.now()}`,
      ...draft,
    }

    setRecords((current) => editingId
      ? current.map((record) => record.id === editingId ? nextRecord : record)
      : [nextRecord, ...current])
    closeForm()
    setSavedMessage('Press coverage saved.')
  }

  return (
    <div className="page page--press-coverage">
      <a className="press-coverage__back" href="/">
        <FiChevronLeft aria-hidden="true" />
        Back
      </a>

      <header className="press-coverage__header">
        <h1>Press Coverage</h1>
        <p>Log and track media coverage related to OIAC activities and advocacy.</p>
      </header>

      <div className="press-coverage__toolbar">
        <button
          aria-controls="press-coverage-form"
          aria-expanded={isFormOpen}
          className="button button--primary press-coverage__add"
          onClick={openNewCoverage}
          type="button"
        >
          + Add Press Coverage
        </button>
      </div>

      {savedMessage ? <p className="form-success press-coverage__success" role="status">{savedMessage}</p> : null}

      {isFormOpen ? (
        <form
          aria-label="Press Coverage"
          className="press-coverage-form"
          id="press-coverage-form"
          onSubmit={saveCoverage}
        >
          <h2>Press Coverage</h2>
          <div className="press-coverage-form__grid">
            <label className="field">
              <span>News Title <span aria-hidden="true" className="required-mark">*</span></span>
              <input
                aria-label="News Title"
                aria-required="true"
                onChange={(event) => updateDraft('newsTitle', event.target.value)}
                placeholder="Article or segment title"
                ref={titleInputRef}
                required
                type="text"
                value={draft.newsTitle}
              />
            </label>

            <label className="field">
              <span>URL</span>
              <input
                onChange={(event) => updateDraft('url', event.target.value)}
                placeholder="https://..."
                type="url"
                value={draft.url}
              />
            </label>

            <label className="field">
              <span>Date <span aria-hidden="true" className="required-mark">*</span></span>
              <input
                aria-label="Date"
                aria-required="true"
                onChange={(event) => updateDraft('date', event.target.value)}
                required
                type="date"
                value={draft.date}
              />
            </label>

            <label className="field">
              <span>Country</span>
              <input onChange={(event) => updateDraft('country', event.target.value)} type="text" value={draft.country} />
            </label>

            <label className="field">
              <span>News Source Type</span>
              <select onChange={(event) => updateDraft('source', event.target.value)} value={draft.source}>
                <option value="">Select</option>
                {sourceOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Press Account</span>
              <input
                onChange={(event) => updateDraft('pressAccount', event.target.value)}
                placeholder="Publication or outlet name"
                type="text"
                value={draft.pressAccount}
              />
            </label>

            <label className="field">
              <span>Sentiment</span>
              <select onChange={(event) => updateDraft('sentiment', event.target.value)} value={draft.sentiment}>
                <option value="">Select</option>
                {sentimentOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Coverage Type</span>
              <select onChange={(event) => updateDraft('coverageType', event.target.value)} value={draft.coverageType}>
                <option value="">Select</option>
                {coverageTypeOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Language</span>
              <select onChange={(event) => updateDraft('language', event.target.value)} value={draft.language}>
                <option value="">Select language</option>
                {languageOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Rating</span>
              <select onChange={(event) => updateDraft('rating', event.target.value)} value={draft.rating}>
                <option value="">Select</option>
                {ratingOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Regarding Event</span>
              <input
                onChange={(event) => updateDraft('regardingEvent', event.target.value)}
                placeholder="Search or link an event..."
                type="text"
                value={draft.regardingEvent}
              />
            </label>

            <label className="field">
              <span>Mentions</span>
              <input
                onChange={(event) => updateDraft('mentions', event.target.value)}
                placeholder="Select or search options..."
                type="text"
                value={draft.mentions}
              />
            </label>
          </div>

          <div className="press-coverage-form__actions">
            <button className="button button--primary" type="submit">Save Coverage</button>
            <button className="button button--quiet" onClick={closeForm} type="button">Cancel</button>
          </div>
        </form>
      ) : null}

      {records.length === 0 ? (
        <EmptyState title="No press coverage yet" description="Add press coverage to begin tracking media activity." />
      ) : (
        <div className="press-coverage-table-scroll" role="region" aria-label="Press coverage table" tabIndex={0}>
          <table className="press-coverage-table" aria-label="Press coverage">
            <colgroup>
              <col className="press-coverage-table__title-column" />
              <col className="press-coverage-table__date-column" />
              <col className="press-coverage-table__source-column" />
              <col className="press-coverage-table__type-column" />
              <col className="press-coverage-table__sentiment-column" />
              <col className="press-coverage-table__country-column" />
              <col className="press-coverage-table__action-column" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">News Title</th>
                <th scope="col">Date</th>
                <th scope="col">Source</th>
                <th scope="col">Type</th>
                <th scope="col">Sentiment</th>
                <th scope="col">Country</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <th scope="row">{record.newsTitle}</th>
                  <td><time dateTime={record.date}>{formatCoverageDate(record.date)}</time></td>
                  <td><span className="press-coverage-table__source">{record.source}</span></td>
                  <td>{record.coverageType}</td>
                  <td>
                    <span className={`press-coverage-table__sentiment press-coverage-table__sentiment--${record.sentiment.toLowerCase() || 'unrated'}`}>
                      {record.sentiment}
                    </span>
                  </td>
                  <td>{record.country}</td>
                  <td>
                    <button
                      aria-label={`Edit ${record.newsTitle}`}
                      className="press-coverage-table__edit"
                      onClick={() => openEditCoverage(record)}
                      type="button"
                    >
                      Edit
                    </button>
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
