import { useRef, useState, type FormEvent, type RefObject } from 'react'
import type { EventInput, EventItem } from './eventTypes'

type EventFormMode = 'create' | 'edit'
type EventFormProps = {
  readonly mode: EventFormMode
  readonly event?: EventItem
  readonly pending: boolean
  readonly requestError?: string | null
  readonly onSave: (input: EventInput) => void | Promise<void>
  readonly onCancel: () => void
}

type EventDraft = {
  title: string
  startDateTime: string
  endDateTime: string
  eventTypeValue: string
  eventFormatValue: string
  eventStatusValue: string
  venueName: string
  meetingUrl: string
  description: string
}

type EventField = keyof EventDraft
type EventErrors = Partial<Record<EventField, string>>

const EVENT_TYPES = [
  [866530000, 'Rally'],
  [866530001, 'Conference'],
  [866530002, 'Meeting'],
  [866530003, 'Community Event'],
  [866530004, 'Fundraiser'],
  [866530005, 'Webinar'],
  [866530006, 'Training'],
  [866530007, 'Town Hall'],
  [866530008, 'Campaign Event'],
  [866530009, 'Volunteer Event'],
  [866530010, 'Briefing'],
] as const

const EVENT_FORMATS = [
  [866530000, 'In Person'],
  [866530001, 'Virtual'],
  [866530002, 'Hybrid'],
] as const

const EVENT_STATUSES = [
  [866530000, 'Draft'],
  [866530001, 'Published'],
  [866530002, 'Registration Open'],
  [866530003, 'Registration Closed'],
  [866530004, 'Registration Closed (Legacy)'],
  [866530005, 'Cancelled'],
  [866530006, 'Postponed'],
] as const

function toLocalDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function initialDraft(event?: EventItem): EventDraft {
  return {
    title: event?.title ?? '',
    startDateTime: toLocalDateTime(event?.startDateTime),
    endDateTime: toLocalDateTime(event?.endDateTime),
    eventTypeValue: event?.eventTypeValue == null ? '' : String(event.eventTypeValue),
    eventFormatValue: event?.eventFormatValue == null ? '' : String(event.eventFormatValue),
    eventStatusValue: String(event?.eventStatusValue ?? 866530000),
    venueName: event?.venueName ?? '',
    meetingUrl: event?.meetingUrl ?? '',
    description: event?.description ?? '',
  }
}

function errorId(field: EventField): string {
  return `event-${field}-error`
}

export default function EventForm({
  mode,
  event,
  pending,
  requestError,
  onSave,
  onCancel,
}: EventFormProps) {
  const [draft, setDraft] = useState<EventDraft>(() => initialDraft(event))
  const [errors, setErrors] = useState<EventErrors>({})
  const titleRef = useRef<HTMLInputElement>(null)
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  const typeRef = useRef<HTMLSelectElement>(null)
  const formatRef = useRef<HTMLSelectElement>(null)
  const statusRef = useRef<HTMLSelectElement>(null)
  const venueRef = useRef<HTMLInputElement>(null)
  const meetingUrlRef = useRef<HTMLInputElement>(null)

  const updateDraft = (field: EventField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const updateFormat = (value: string) => {
    setDraft((current) => ({
      ...current,
      eventFormatValue: value,
      venueName: value === '866530001' ? '' : current.venueName,
      meetingUrl: value === '866530000' ? '' : current.meetingUrl,
    }))
    setErrors((current) => ({
      ...current,
      eventFormatValue: undefined,
      venueName: undefined,
      meetingUrl: undefined,
    }))
  }

  const focusFirstError = (nextErrors: EventErrors) => {
    const controls: readonly [EventField, RefObject<HTMLElement | null>][] = [
      ['title', titleRef],
      ['startDateTime', startRef],
      ['endDateTime', endRef],
      ['eventTypeValue', typeRef],
      ['eventFormatValue', formatRef],
      ['eventStatusValue', statusRef],
      ['venueName', venueRef],
      ['meetingUrl', meetingUrlRef],
    ]
    controls.find(([field]) => nextErrors[field])?.[1].current?.focus()
  }

  const submit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault()
    const nextErrors: EventErrors = {}
    const start = new Date(draft.startDateTime)
    const end = new Date(draft.endDateTime)
    const format = Number(draft.eventFormatValue)

    if (!draft.title.trim()) nextErrors.title = 'Event Subject is required.'
    if (!draft.startDateTime || Number.isNaN(start.getTime())) nextErrors.startDateTime = 'Start Date & Time is required.'
    if (!draft.endDateTime || Number.isNaN(end.getTime())) nextErrors.endDateTime = 'End Date & Time is required.'
    if (!nextErrors.startDateTime && !nextErrors.endDateTime && end.getTime() <= start.getTime()) {
      nextErrors.endDateTime = 'End Date & Time must be later than Start Date & Time.'
    }
    if (!draft.eventTypeValue) nextErrors.eventTypeValue = 'Event Type is required.'
    if (!draft.eventFormatValue) nextErrors.eventFormatValue = 'Event Format is required.'
    if (!draft.eventStatusValue) nextErrors.eventStatusValue = 'Event Status is required.'
    if ((format === 866530000 || format === 866530002) && !draft.venueName.trim()) {
      nextErrors.venueName = `Venue Name is required for ${format === 866530000 ? 'In Person' : 'Hybrid'} events.`
    }
    if ((format === 866530001 || format === 866530002) && !draft.meetingUrl.trim()) {
      nextErrors.meetingUrl = `Meeting URL is required for ${format === 866530001 ? 'Virtual' : 'Hybrid'} events.`
    } else if (draft.meetingUrl.trim() && !/^https?:\/\/[^\s]+$/i.test(draft.meetingUrl.trim())) {
      nextErrors.meetingUrl = 'Meeting URL must start with http:// or https://.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      focusFirstError(nextErrors)
      return
    }

    void onSave({
      title: draft.title.trim(),
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      eventTypeValue: Number(draft.eventTypeValue),
      eventFormatValue: format,
      eventStatusValue: Number(draft.eventStatusValue),
      venueName: format === 866530001 ? null : draft.venueName.trim() || null,
      meetingUrl: format === 866530000 ? null : draft.meetingUrl.trim() || null,
      description: draft.description.trim() || null,
    })
  }

  const needsVenue = draft.eventFormatValue === '866530000' || draft.eventFormatValue === '866530002'
  const needsMeetingUrl = draft.eventFormatValue === '866530001' || draft.eventFormatValue === '866530002'
  const formName = mode === 'create' ? 'Create Event' : 'Edit Event'

  return (
    <form className="oiac-event-form" aria-label={formName} noValidate onSubmit={submit}>
      <div className="oiac-event-form__heading">
        <div>
          <h2>{formName}</h2>
          <p>{mode === 'create' ? 'Add an event for volunteers and administrators.' : `Update ${event?.title ?? 'this event'}.`}</p>
        </div>
      </div>

      {requestError ? <div className="oiac-event-form__request-error" role="alert">{requestError}</div> : null}

      <div className="oiac-event-form__grid">
        <label className="oiac-event-field oiac-event-field--full">
          <span>Event Subject <span className="required-mark" aria-hidden="true">*</span></span>
          <input
            ref={titleRef}
            aria-label="Event Subject"
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? errorId('title') : undefined}
            autoComplete="off"
            disabled={pending}
            required
            value={draft.title}
            onChange={(changeEvent) => updateDraft('title', changeEvent.target.value)}
          />
          {errors.title ? <span className="oiac-event-field__error" id={errorId('title')}>{errors.title}</span> : null}
        </label>

        <label className="oiac-event-field">
          <span>Start Date &amp; Time <span className="required-mark" aria-hidden="true">*</span></span>
          <input
            ref={startRef}
            aria-label="Start Date & Time"
            aria-invalid={Boolean(errors.startDateTime)}
            aria-describedby={errors.startDateTime ? errorId('startDateTime') : undefined}
            disabled={pending}
            required
            step={1}
            type="datetime-local"
            value={draft.startDateTime}
            onChange={(changeEvent) => updateDraft('startDateTime', changeEvent.target.value)}
          />
          {errors.startDateTime ? <span className="oiac-event-field__error" id={errorId('startDateTime')}>{errors.startDateTime}</span> : null}
        </label>

        <label className="oiac-event-field">
          <span>End Date &amp; Time <span className="required-mark" aria-hidden="true">*</span></span>
          <input
            ref={endRef}
            aria-label="End Date & Time"
            aria-invalid={Boolean(errors.endDateTime)}
            aria-describedby={errors.endDateTime ? errorId('endDateTime') : undefined}
            disabled={pending}
            required
            step={1}
            type="datetime-local"
            value={draft.endDateTime}
            onChange={(changeEvent) => updateDraft('endDateTime', changeEvent.target.value)}
          />
          {errors.endDateTime ? <span className="oiac-event-field__error" id={errorId('endDateTime')}>{errors.endDateTime}</span> : null}
        </label>

        <label className="oiac-event-field">
          <span>Event Type <span className="required-mark" aria-hidden="true">*</span></span>
          <select
            ref={typeRef}
            aria-label="Event Type"
            aria-invalid={Boolean(errors.eventTypeValue)}
            aria-describedby={errors.eventTypeValue ? errorId('eventTypeValue') : undefined}
            disabled={pending}
            required
            value={draft.eventTypeValue}
            onChange={(changeEvent) => updateDraft('eventTypeValue', changeEvent.target.value)}
          >
            <option value="">Select Event Type</option>
            {EVENT_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          {errors.eventTypeValue ? <span className="oiac-event-field__error" id={errorId('eventTypeValue')}>{errors.eventTypeValue}</span> : null}
        </label>

        <label className="oiac-event-field">
          <span>Event Format <span className="required-mark" aria-hidden="true">*</span></span>
          <select
            ref={formatRef}
            aria-label="Event Format"
            aria-invalid={Boolean(errors.eventFormatValue)}
            aria-describedby={errors.eventFormatValue ? errorId('eventFormatValue') : undefined}
            disabled={pending}
            required
            value={draft.eventFormatValue}
            onChange={(changeEvent) => updateFormat(changeEvent.target.value)}
          >
            <option value="">Select Event Format</option>
            {EVENT_FORMATS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          {errors.eventFormatValue ? <span className="oiac-event-field__error" id={errorId('eventFormatValue')}>{errors.eventFormatValue}</span> : null}
        </label>

        <label className="oiac-event-field">
          <span>Event Status <span className="required-mark" aria-hidden="true">*</span></span>
          <select
            ref={statusRef}
            aria-label="Event Status"
            aria-invalid={Boolean(errors.eventStatusValue)}
            aria-describedby={errors.eventStatusValue ? errorId('eventStatusValue') : undefined}
            disabled={pending}
            required
            value={draft.eventStatusValue}
            onChange={(changeEvent) => updateDraft('eventStatusValue', changeEvent.target.value)}
          >
            {EVENT_STATUSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          {errors.eventStatusValue ? <span className="oiac-event-field__error" id={errorId('eventStatusValue')}>{errors.eventStatusValue}</span> : null}
        </label>

        {needsVenue ? (
          <label className="oiac-event-field">
            <span>Venue Name <span className="required-mark" aria-hidden="true">*</span></span>
            <input
              ref={venueRef}
              aria-label="Venue Name"
              aria-invalid={Boolean(errors.venueName)}
              aria-describedby={errors.venueName ? errorId('venueName') : undefined}
              autoComplete="organization"
              disabled={pending}
              required
              value={draft.venueName}
              onChange={(changeEvent) => updateDraft('venueName', changeEvent.target.value)}
            />
            {errors.venueName ? <span className="oiac-event-field__error" id={errorId('venueName')}>{errors.venueName}</span> : null}
          </label>
        ) : null}

        {needsMeetingUrl ? (
          <label className="oiac-event-field">
            <span>Meeting URL <span className="required-mark" aria-hidden="true">*</span></span>
            <input
              ref={meetingUrlRef}
              aria-label="Meeting URL"
              aria-invalid={Boolean(errors.meetingUrl)}
              aria-describedby={errors.meetingUrl ? errorId('meetingUrl') : undefined}
              autoComplete="url"
              disabled={pending}
              inputMode="url"
              required
              type="url"
              value={draft.meetingUrl}
              onChange={(changeEvent) => updateDraft('meetingUrl', changeEvent.target.value)}
            />
            {errors.meetingUrl ? <span className="oiac-event-field__error" id={errorId('meetingUrl')}>{errors.meetingUrl}</span> : null}
          </label>
        ) : null}

        <label className="oiac-event-field oiac-event-field--full">
          <span>Description</span>
          <textarea
            aria-label="Description"
            disabled={pending}
            rows={4}
            value={draft.description}
            onChange={(changeEvent) => updateDraft('description', changeEvent.target.value)}
          />
        </label>
      </div>

      <div className="oiac-event-form__actions">
        <button type="submit" disabled={pending}>{pending ? 'Saving…' : mode === 'create' ? 'Create Event' : 'Save Changes'}</button>
        <button type="button" disabled={pending} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
