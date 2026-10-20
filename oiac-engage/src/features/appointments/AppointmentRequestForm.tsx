import { normalizeAppointmentContactSearch } from './appointmentContactSearch'
import { useEffect, useRef, type FormEvent } from 'react'
import { ContactLookup } from '../meetingReports/ContactLookup'
import { getEasternTimeOptions } from './appointmentDates'
import { searchAppointmentContacts } from './appointmentService'
import { APPOINTMENT_FORMAT, type AppointmentRequestDraft } from './appointmentTypes'

export type AppointmentErrors = Record<string, string | undefined>
type Props = {
  draft: AppointmentRequestDraft; errors: AppointmentErrors; locked: boolean; saving: boolean; contactId: string
  onChange: (draft: AppointmentRequestDraft) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void
}

export function AppointmentTimeFields({ prefix, date, time, offset, errors, disabled, onChange }: {
  prefix: 'Preferred' | 'Suggested'; date: string; time: string; offset: number | null; errors: AppointmentErrors; disabled: boolean
  onChange: (date: string, time: string, offset: number | null) => void
}) {
  const options = getEasternTimeOptions(date, time)
  const id = prefix.toLowerCase()
  return <>
    <label className="appointment-field" htmlFor={`appointment-${id}Date`}><span>{prefix} Date <span aria-hidden="true">*</span></span>
      <input id={`appointment-${id}Date`} aria-label={`${prefix} Date`} type="date" required disabled={disabled} value={date} aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? `appointment-${id}-date-error` : undefined} onChange={(event) => onChange(event.target.value, time, null)} />
      {errors.date ? <span className="appointment-error" id={`appointment-${id}-date-error`}>{errors.date}</span> : null}
    </label>
    <label className="appointment-field" htmlFor={`appointment-${id}Time`}><span>{prefix} Time (Eastern Time) <span aria-hidden="true">*</span></span>
      <input id={`appointment-${id}Time`} aria-label={`${prefix} Time (Eastern Time)`} type="time" required disabled={disabled} value={time} aria-invalid={Boolean(errors.time)} aria-describedby={errors.time ? `appointment-${id}-time-error` : undefined} onChange={(event) => onChange(date, event.target.value, null)} />
      {errors.time ? <span className="appointment-error" id={`appointment-${id}-time-error`}>{errors.time}</span> : null}
    </label>
    {options.length === 2 ? <label className="appointment-field appointment-field--full" htmlFor={`appointment-${id}Offset`}><span>Time occurrence (Eastern Time) <span aria-hidden="true">*</span></span>
      <select id={`appointment-${id}Offset`} aria-label="Time occurrence (Eastern Time)" required disabled={disabled} value={offset ?? ''} aria-invalid={Boolean(errors.offset)} aria-describedby={errors.offset ? `appointment-${id}-offset-error` : undefined} onChange={(event) => onChange(date, time, event.target.value === '' ? null : Number(event.target.value))}>
        <option value="">Choose an occurrence</option>{options.map((option) => <option key={option.offsetMinutes} value={option.offsetMinutes}>{option.label}</option>)}
      </select>
      <small>This time occurs twice when clocks change. Choose the UTC offset.</small>
      {errors.offset ? <span className="appointment-error" id={`appointment-${id}-offset-error`}>{errors.offset}</span> : null}
    </label> : null}
  </>
}

export function AppointmentRequestForm({ draft, errors, locked, saving, contactId, onChange, onSubmit, onCancel }: Props) {
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => { form.current?.querySelector<HTMLInputElement>('input')?.focus() }, [])
  return <form ref={form} id="appointment-request-form" className="appointment-form" aria-label="Request Appointment" noValidate onSubmit={onSubmit}>
    <h2>Request Appointment</h2><p>Choose a contact and your preferred meeting time. All times are Eastern Time.</p>
    <fieldset disabled={locked}><legend className="sr-only">Appointment details</legend><div className="appointment-form__grid">
      <label className="appointment-field appointment-field--full" htmlFor="appointment-title"><span>Appointment Title <span aria-hidden="true">*</span></span>
        <input id="appointment-title" aria-label="Appointment Title" required maxLength={850} value={draft.title} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'appointment-title-error' : undefined} placeholder="e.g. Community policy discussion" onChange={(event) => onChange({ ...draft, title: event.target.value })} />
        {errors.title ? <span id="appointment-title-error" className="appointment-error">{errors.title}</span> : null}
      </label>
      <div className="appointment-field"><ContactLookup label="Contact" compactSelection required normalizeSearch={normalizeAppointmentContactSearch} emptyMessage="No matching contacts found" disabled={locked} value={draft.contact} onChange={(contact) => onChange({ ...draft, contact })} loadOptions={async (search, signal) => (await searchAppointmentContacts(search, signal)).filter((option) => option.id.toLowerCase() !== contactId.toLowerCase())} />
        {errors.contact ? <span className="appointment-error" role="alert">{errors.contact}</span> : null}
      </div>
      <label className="appointment-field" htmlFor="appointment-format"><span>Meeting Format <span aria-hidden="true">*</span></span>
        <select id="appointment-format" aria-label="Meeting Format" required value={draft.meetingFormat ?? ''} aria-invalid={Boolean(errors.format)} aria-describedby={errors.format ? 'appointment-format-error' : undefined} onChange={(event) => onChange({ ...draft, meetingFormat: event.target.value === '' ? null : Number(event.target.value) })}>
          <option value="">Select format</option><option value={APPOINTMENT_FORMAT.teams}>Microsoft Teams</option><option value={APPOINTMENT_FORMAT.phone}>Phone Call</option><option value={APPOINTMENT_FORMAT.inPerson}>In Person</option>
        </select>{errors.format ? <span id="appointment-format-error" className="appointment-error">{errors.format}</span> : null}
      </label>
      <AppointmentTimeFields prefix="Preferred" date={draft.preferredDate} time={draft.preferredTime} offset={draft.preferredOffsetMinutes} errors={errors} disabled={locked} onChange={(preferredDate, preferredTime, preferredOffsetMinutes) => onChange({ ...draft, preferredDate, preferredTime, preferredOffsetMinutes })} />
      <label className="appointment-field appointment-field--full" htmlFor="appointment-agenda"><span>Purpose / Agenda <small>(optional)</small></span><textarea id="appointment-agenda" aria-label="Purpose / Agenda" rows={3} maxLength={100} value={draft.agenda} onChange={(event) => onChange({ ...draft, agenda: event.target.value })} placeholder="Describe the purpose of your appointment…" /></label>
    </div></fieldset>
    <div className="appointment-form__actions"><button className="button button--primary appointment-primary" type="submit" disabled={locked}>{saving ? 'Sending…' : 'Submit Request'}</button><button className="button button--quiet appointment-secondary" type="button" disabled={saving} onClick={onCancel}>Cancel</button></div>
  </form>
}
