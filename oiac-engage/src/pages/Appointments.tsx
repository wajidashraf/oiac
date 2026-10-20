import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { LuChevronLeft } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { AppointmentRequestForm, type AppointmentErrors } from '../features/appointments/AppointmentRequestForm'
import { AppointmentResponseForm } from '../features/appointments/AppointmentResponseForm'
import { AppointmentProposalStatus } from '../features/appointments/AppointmentProposalStatus'
import { appointmentTimeLabel, emptyAppointmentRequest, emptyAppointmentReschedule, formatAppointmentDateTime, getEasternTimeOptions } from '../features/appointments/appointmentDates'
import { acceptAppointment, AppointmentConflictError, AppointmentSaveUncertainError, createAppointment, getAppointmentPage, rescheduleAppointment } from '../features/appointments/appointmentService'
import { APPOINTMENT_FORMAT, APPOINTMENT_STATUS, type AppointmentPage, type AppointmentRecord } from '../features/appointments/appointmentTypes'
import { useAppointmentNavigationGuard } from '../features/appointments/useAppointmentNavigationGuard'
import '../features/appointments/appointments.css'

type Props = { contactId?: string; isAdmin?: boolean; canCreate?: boolean }
type ActiveForm = { mode: 'create' } | { mode: 'accept' | 'reschedule'; record: AppointmentRecord } | null
const sameId = (a: string | undefined, b: string | undefined) => Boolean(a && b && a.toLowerCase() === b.toLowerCase())
const cardDateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'short', day: 'numeric' })
function cardDateTime(utc: string) {
  if (formatAppointmentDateTime(utc) === '—') return '—'
  return `${cardDateFormatter.format(new Date(utc))} at ${appointmentTimeLabel(utc).replace(/ E[DS]T$/, ' ET')}`
}
const safeMeetingLink = (value: string | null) => {
  if (!value || value.length > 2000) return null
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null } catch { return null }
}

function useAppointmentList(view: 'incoming' | 'outgoing' | 'all', contactId: string | undefined, isAdmin: boolean, enabled = true) {
  const identity = `${contactId ?? ''}:${isAdmin}:${enabled}`
  const [state, setState] = useState<{ identity: string; page: AppointmentPage | null; loading: boolean; error: boolean }>({ identity, page: null, loading: Boolean(contactId), error: false })
  const [pages, setPages] = useState<readonly (string | undefined)[]>([undefined])
  const [revision, setRevision] = useState(0)
  const pageLink = pages[pages.length - 1]
  useEffect(() => { setPages([undefined]) }, [identity])
  useEffect(() => {
    const request = new AbortController()
    let active = true
    if (!contactId || !enabled) { setState({ identity, page: null, loading: false, error: false }); return }
    setState((previous) => ({ identity, page: previous.identity === identity ? previous.page : null, loading: true, error: false }))
    getAppointmentPage(view, pageLink, request.signal).then((page) => {
      if (active && !request.signal.aborted) setState({ identity, page, loading: false, error: false })
    }).catch(() => {
      if (active && !request.signal.aborted) setState({ identity, page: null, loading: false, error: true })
    })
    return () => { active = false; request.abort() }
  }, [view, contactId, isAdmin, identity, pageLink, revision, enabled])
  const refresh = useCallback(() => { setPages([undefined]); setRevision((value) => value + 1) }, [])
  const page = state.identity === identity ? state.page : null
  return { page, loading: state.identity !== identity ? Boolean(contactId) : state.loading, error: state.identity === identity && state.error, refresh, pageNumber: pages.length,
    previous: () => setPages((value) => value.slice(0, -1)), next: () => { if (page?.nextLink) setPages((value) => [...value, page.nextLink!]) } }
}

function dateErrors(date: string, time: string, offset: number | null): AppointmentErrors {
  const errors: AppointmentErrors = {}
  if (!date) errors.date = 'Choose a date.'
  if (!time) errors.time = 'Choose a time in Eastern Time.'
  const options = getEasternTimeOptions(date, time)
  if (date && time && !options.length) errors.time = 'This Eastern Time does not exist. Choose another date or time.'
  if (options.length === 2 && !options.some((option) => option.offsetMinutes === offset)) errors.offset = 'Choose which occurrence of this time you mean.'
  return errors
}

export default function Appointments({ contactId, isAdmin = false, canCreate = true }: Props) {
  const [selectedView, setSelectedView] = useState<{ identity: string; all: boolean }>({ identity: '', all: false })
  const viewIdentity = `${contactId ?? ''}:${isAdmin}`
  const allSelected = isAdmin && selectedView.identity === viewIdentity && selectedView.all
  const all = useAppointmentList('all', contactId, isAdmin, allSelected)
  const incoming = useAppointmentList('incoming', contactId, isAdmin)
  const outgoing = useAppointmentList('outgoing', contactId, isAdmin)
  const [active, setActive] = useState<ActiveForm>(null)
  const [request, setRequest] = useState(emptyAppointmentRequest)
  const [response, setResponse] = useState(emptyAppointmentReschedule)
  const [link, setLink] = useState('')
  const [errors, setErrors] = useState<AppointmentErrors>({})
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [checked, setChecked] = useState(false)
  const newButton = useRef<HTMLButtonElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const savingLock = useRef(false)
  const mounted = useRef(true)
  const uncertainKey = `oiac-appointment-uncertain:${contactId ?? ''}`
  const identity = useRef(viewIdentity)
  const dirty = active?.mode === 'create' ? JSON.stringify(request) !== JSON.stringify(emptyAppointmentRequest()) : Boolean(active && (link || JSON.stringify(response) !== JSON.stringify(emptyAppointmentReschedule())))
  const navigationBlocked = useAppointmentNavigationGuard({ dirty, saving })

  useEffect(() => { document.title = 'Appointments — OIAC Engage'; mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    identity.current = viewIdentity
    setSelectedView({ identity: viewIdentity, all: false })
    setActive(null); setRequest(emptyAppointmentRequest()); setResponse(emptyAppointmentReschedule()); setLink(''); setErrors({}); setFormError(''); setNotice(''); setChecked(false)
    try { setUncertain(sessionStorage.getItem(uncertainKey) === '1') } catch { setUncertain(false) }
  }, [viewIdentity, uncertainKey])
  const refresh = () => { incoming.refresh(); outgoing.refresh(); all.refresh() }
  function reset() { setRequest(emptyAppointmentRequest()); setResponse(emptyAppointmentReschedule()); setLink(''); setErrors({}); setFormError('') }
  function mayDiscard() { return !savingLock.current && (!dirty || window.confirm('Discard your unsaved appointment changes?')) }
  function close(force = false) {
    if (!force && !mayDiscard()) return
    reset(); setActive(null)
    const target = trigger.current ?? newButton.current
    requestAnimationFrame(() => target?.isConnected ? target.focus() : newButton.current?.focus())
  }
  function open(next: Exclude<ActiveForm, null>, button: HTMLButtonElement) {
    if (!contactId || !mayDiscard() || (next.mode === 'create' && (!canCreate || uncertain))) return
    if (next.mode !== 'create' && (!sameId(next.record.recipient?.id, contactId) || next.record.status !== APPOINTMENT_STATUS.pending)) return
    reset(); setNotice(''); trigger.current = button; setActive(next)
  }
  function changeView(showAll: boolean) {
    if (!isAdmin || showAll === allSelected || !mayDiscard()) return
    reset(); setActive(null); setSelectedView({ identity: viewIdentity, all: showAll })
  }
  function focusError(nextErrors: AppointmentErrors) {
    setErrors(nextErrors)
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.appointment-form [aria-invalid="true"], .appointment-response [aria-invalid="true"]')?.focus())
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!active || savingLock.current || !contactId || (active.mode === 'create' && (uncertain || !canCreate))) return
    let nextErrors: AppointmentErrors = {}
    if (active.mode === 'create') {
      nextErrors = dateErrors(request.preferredDate, request.preferredTime, request.preferredOffsetMinutes)
      if (!request.title.trim()) nextErrors.title = 'Enter an appointment title.'
      if (!request.contact || sameId(request.contact.id, contactId)) nextErrors.contact = 'Choose another eligible contact.'
      if (![1, 2, 3].includes(request.meetingFormat ?? 0)) nextErrors.format = 'Choose a meeting format.'
    } else {
      if (!sameId(active.record.recipient?.id, contactId) || active.record.status !== APPOINTMENT_STATUS.pending) return
      if (active.mode === 'accept') { if (active.record.meetingFormat === APPOINTMENT_FORMAT.teams && !safeMeetingLink(link.trim())) nextErrors.link = 'Enter a valid HTTPS meeting link.' }
      else { nextErrors = dateErrors(response.suggestedDate, response.suggestedTime, response.suggestedOffsetMinutes); if (!response.reason.trim()) nextErrors.reason = 'Enter a rescheduling reason.' }
    }
    if (Object.values(nextErrors).some(Boolean)) { focusError(nextErrors); return }
    savingLock.current = true; setSaving(true); setErrors({}); setFormError(''); setNotice('')
    const actor = viewIdentity
    try {
      if (active.mode === 'create') {
        const options = getEasternTimeOptions(request.preferredDate, request.preferredTime)
        await createAppointment({ ...request, preferredOffsetMinutes: options.length === 1 ? options[0].offsetMinutes : request.preferredOffsetMinutes })
      } else if (active.mode === 'accept') await acceptAppointment(active.record, active.record.meetingFormat === APPOINTMENT_FORMAT.teams ? link.trim() : '')
      else {
        const options = getEasternTimeOptions(response.suggestedDate, response.suggestedTime)
        await rescheduleAppointment(active.record, { ...response, suggestedOffsetMinutes: options.length === 1 ? options[0].offsetMinutes : response.suggestedOffsetMinutes })
      }
      if (!mounted.current || identity.current !== actor) return
      close(true); setNotice(active.mode === 'create' ? 'Appointment request sent.' : active.mode === 'accept' ? 'Appointment accepted. It is now in both participants’ My Calendar.' : 'Reschedule proposal sent. It is awaiting agreement.'); refresh()
    } catch (error) {
      if (!mounted.current || identity.current !== actor) return
      if (active.mode === 'create' && error instanceof AppointmentSaveUncertainError) {
        setUncertain(true); setChecked(false)
        try { sessionStorage.setItem(uncertainKey, '1') } catch { /* The current page remains locked. */ }
        setFormError('The request may have been saved. Refresh your outgoing appointments and check the list before starting another request.')
      } else if (error instanceof AppointmentConflictError) {
        setFormError('This appointment changed while you were responding. Review its current state in the refreshed list before responding again.'); setActive(null); refresh()
      } else setFormError('Your appointment could not be saved. Your entries are preserved; try again.')
    } finally { savingLock.current = false; if (mounted.current) setSaving(false) }
  }
  async function checkOutgoing() {
    if (!contactId || savingLock.current) return
    setChecked(false)
    outgoing.refresh()
    try { await getAppointmentPage('outgoing'); if (mounted.current) setChecked(true) } catch { setFormError('Your outgoing appointments could not be refreshed. Try again before starting another request.') }
  }
  function finishCheck() {
    if (!checked) return
    try { sessionStorage.removeItem(uncertainKey) } catch { /* In-memory lock can still be cleared. */ }
    setUncertain(false); setChecked(false); close(true); setNotice('Review the outgoing list before submitting a new request.')
  }

  function list(view: 'incoming' | 'outgoing' | 'all', source: ReturnType<typeof useAppointmentList>) {
    const incomingView = view === 'incoming'
    function changePage(move: () => void) {
      // Paging away from a response card must follow the same discard rule as switching cards.
      if (!mayDiscard()) return
      if (active) { reset(); setActive(null) }
      move()
    }
    const records = source.page?.appointments.filter((record) => (view === 'all' && isAdmin) || sameId(incomingView ? record.recipient?.id : record.requester?.id, contactId)) ?? []
    return <section className="appointment-section" aria-labelledby={`appointments-${view}-heading`}>
      <div className="appointment-section__heading"><h2 id={`appointments-${view}-heading`}>{view === 'all' ? 'All appointments' : incomingView ? 'Meeting requests sent to you' : 'Meeting requests you sent'}</h2>{incomingView && source.page && !source.loading && !source.error ? <span className="appointment-count">{source.page.awaitingCount} awaiting response</span> : null}</div>
      {source.loading ? <p role="status">Loading {view} appointments…</p> : null}
      {source.error ? <div className="appointment-alert" role="alert"><p>Your {view} appointments could not be loaded.</p><button className="button button--quiet appointment-secondary" type="button" disabled={saving} onClick={source.refresh} aria-label={`Retry ${view} appointments`}>Retry</button></div> : null}
      {!source.loading && !source.error && !records.length ? <p className="appointment-empty">{contactId ? view === 'all' ? 'No appointments.' : incomingView ? 'No incoming appointment requests.' : 'No outgoing appointment requests yet.' : 'Sign in to view your appointments.'}</p> : null}
      {records.length ? <ul className="appointment-list" aria-label={`${view === 'all' ? 'All' : incomingView ? 'Incoming' : 'Outgoing'} appointments`} aria-busy={source.loading}>
        {records.map((record) => {
          const person = incomingView ? record.requester : record.recipient
          const name = person?.name || (incomingView ? 'Unknown requester' : 'Unknown recipient')
          const canRespond = (incomingView || view === 'all') && record.status === APPOINTMENT_STATUS.pending && sameId(record.recipient?.id, contactId)
          const expanded = active && active.mode !== 'create' && active.record.id === record.id
          const join = record.status === APPOINTMENT_STATUS.accepted && record.meetingFormat === APPOINTMENT_FORMAT.teams ? safeMeetingLink(record.meetingLink) : null
          const metadata = view === 'all' ? `Requested by ${record.requester?.name || 'Unknown requester'} · Requested for ${record.recipient?.name || 'Unknown recipient'} · ${cardDateTime(record.preferredDateTime)}` : `${incomingView ? 'Requested by' : 'Requested for'} ${name} · ${cardDateTime(record.preferredDateTime)}`
          const status = record.status === APPOINTMENT_STATUS.pending ? 'Pending' : record.statusLabel
          return <li key={record.id} className={`appointment-card${expanded ? ' appointment-card--expanded' : ''}`}><div className="appointment-card__row">
            <span className="appointment-avatar" aria-hidden="true">{name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}</span>
            <div className="appointment-card__details">
              <div className="appointment-card__heading"><h3 title={record.title}>{record.title}</h3></div>
              <p className="appointment-card__metadata" title={metadata}>{view === 'all' ? <>Requested by {record.requester?.name || 'Unknown requester'} · Requested for {record.recipient?.name || 'Unknown recipient'}</> : <>{incomingView ? 'Requested by' : 'Requested for'} {name}</>} · <time dateTime={record.preferredDateTime}>{cardDateTime(record.preferredDateTime)}</time></p>
              <p className="appointment-card__agenda" title={record.agenda}>{record.agenda}</p>
            </div>
            <div className="appointment-card__actions">{!canRespond && (record.status === APPOINTMENT_STATUS.rescheduled ? <AppointmentProposalStatus record={record} /> : <span className={`appointment-status appointment-status--${record.status}`} title={record.statusLabel}>{status}</span>)}{join ? <a className="button button--quiet appointment-join" href={join} target="_blank" rel="noopener noreferrer">Join meeting</a> : null}{canRespond ? <div className="appointment-card__buttons"><button className="button button--primary appointment-primary" type="button" disabled={saving} aria-label={`Accept ${record.title}`} aria-expanded={Boolean(expanded && active.mode === 'accept')} onClick={(event) => open({ mode: 'accept', record }, event.currentTarget)}>Accept</button><button className="button button--quiet appointment-secondary" type="button" disabled={saving} aria-label={`Request reschedule ${record.title}`} aria-expanded={Boolean(expanded && active.mode === 'reschedule')} onClick={(event) => open({ mode: 'reschedule', record }, event.currentTarget)}>Request Reschedule</button></div> : null}</div>
          </div>
          {expanded ? <AppointmentResponseForm record={active.record} mode={active.mode} draft={response} link={link} errors={errors} saving={saving} onDraftChange={(value) => { if (!savingLock.current) { setResponse(value); setErrors({}) } }} onLinkChange={(value) => { if (!savingLock.current) { setLink(value); setErrors({}) } }} onSubmit={save} onCancel={() => close()} /> : null}
          </li>
        })}
      </ul> : null}
      {source.pageNumber > 1 || source.page?.nextLink ? <nav className="appointment-pagination" aria-label={`${view} appointment pages`}><button className="button button--quiet appointment-secondary" type="button" disabled={saving || source.loading || source.pageNumber === 1} onClick={() => changePage(source.previous)}>Previous</button><span>Page {source.pageNumber}</span><button className="button button--quiet appointment-secondary" type="button" disabled={saving || source.loading || source.error || !source.page?.nextLink} onClick={() => changePage(source.next)}>Next</button></nav> : null}
    </section>
  }

  return <div className="page page--appointments">
    <Link className="appointments-back" to="/"><LuChevronLeft aria-hidden="true" />Back</Link>
    <header className="appointments-header"><h1>Appointments</h1><p>Schedule and track appointments with representatives and organizational contacts.</p></header>
    <div className="appointments-toolbar">{contactId && canCreate ? <button ref={newButton} className="button button--primary appointment-primary" type="button" disabled={saving || uncertain} aria-controls="appointment-request-form" aria-expanded={active?.mode === 'create'} onClick={(event) => open({ mode: 'create' }, event.currentTarget)}>+ New Appointment</button> : null}</div>
    {isAdmin && contactId ? <div className="appointment-view-switch" role="group" aria-label="Appointment view"><button className="button button--quiet appointment-secondary" type="button" aria-pressed={!allSelected} disabled={saving} onClick={() => changeView(false)}>My Appointments</button><button className="button button--quiet appointment-secondary" type="button" aria-pressed={allSelected} disabled={saving} onClick={() => changeView(true)}>All Appointments</button></div> : null}
    {notice ? <p className="appointment-notice" role="status">{notice}</p> : null}
    {navigationBlocked ? <p role="status">Your appointment is still saving. Wait until it finishes before leaving this page.</p> : null}
    {formError ? <p className="appointment-alert" role="alert">{formError}</p> : null}
    {uncertain ? <div className="appointment-alert"><p>Check your outgoing appointments to see whether the last request was saved.</p><button className="button button--quiet appointment-secondary" type="button" disabled={outgoing.loading || saving} onClick={() => { void checkOutgoing() }}>Refresh outgoing appointments</button>{checked && !outgoing.loading && !outgoing.error ? <button className="button button--quiet appointment-secondary" type="button" onClick={finishCheck}>I checked the list; start a new request</button> : null}</div> : null}
    {active?.mode === 'create' && contactId ? <AppointmentRequestForm draft={request} errors={errors} locked={saving || uncertain} saving={saving} contactId={contactId} onChange={(value) => { if (!savingLock.current && !uncertain) { setRequest(value); setErrors({}) } }} onSubmit={save} onCancel={() => close()} /> : null}
    {allSelected ? list('all', all) : <>{list('incoming', incoming)}{list('outgoing', outgoing)}</>}
  </div>
}
