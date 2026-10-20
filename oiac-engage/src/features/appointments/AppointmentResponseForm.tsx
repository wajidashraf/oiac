import { useEffect, useRef, type FormEvent } from 'react'
import { AppointmentTimeFields, type AppointmentErrors } from './AppointmentRequestForm'
import { APPOINTMENT_FORMAT, type AppointmentRecord, type AppointmentRescheduleDraft } from './appointmentTypes'

export function AppointmentResponseForm({ record, mode, draft, link, errors, saving, onDraftChange, onLinkChange, onSubmit, onCancel }: {
  record: AppointmentRecord; mode: 'accept' | 'reschedule'; draft: AppointmentRescheduleDraft; link: string; errors: AppointmentErrors; saving: boolean
  onDraftChange: (draft: AppointmentRescheduleDraft) => void; onLinkChange: (link: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void
}) {
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => { form.current?.querySelector<HTMLElement>('input,textarea,button')?.focus() }, [mode, record.id])
  const accept = mode === 'accept'
  return <form ref={form} className="appointment-response" aria-label={`${accept ? 'Accept' : 'Reschedule'} ${record.title}`} noValidate onSubmit={onSubmit}>
    <h4>{accept ? 'Accept appointment' : 'Request reschedule'}</h4>
    {accept ? <p>The appointment will be confirmed at the original preferred time and appear in both participants’ My Calendar.</p> : <p>Suggest an alternative in Eastern Time. This proposal will remain unconfirmed and will not appear in My Calendar.</p>}
    <fieldset disabled={saving}><legend className="sr-only">{accept ? 'Acceptance details' : 'Rescheduling details'}</legend><div className="appointment-form__grid">
      {accept ? record.meetingFormat === APPOINTMENT_FORMAT.teams ? <label className="appointment-field appointment-field--full" htmlFor="appointment-meetingLink"><span>Microsoft Teams meeting link <span aria-hidden="true">*</span></span>
        <input id="appointment-meetingLink" aria-label="Microsoft Teams meeting link" type="url" required maxLength={2000} value={link} placeholder="https://…" aria-invalid={Boolean(errors.link)} aria-describedby={errors.link ? 'appointment-link-error' : undefined} onChange={(event) => onLinkChange(event.target.value)} />
        {errors.link ? <span id="appointment-link-error" className="appointment-error">{errors.link}</span> : null}
      </label> : <p>No meeting link is needed for {record.meetingFormatLabel}.</p> : <>
        <label className="appointment-field appointment-field--full" htmlFor="appointment-reason"><span>Rescheduling reason <span aria-hidden="true">*</span></span><textarea id="appointment-reason" aria-label="Rescheduling reason" required maxLength={100} rows={2} value={draft.reason} aria-invalid={Boolean(errors.reason)} aria-describedby={errors.reason ? 'appointment-reason-error' : undefined} onChange={(event) => onDraftChange({ ...draft, reason: event.target.value })} />{errors.reason ? <span id="appointment-reason-error" className="appointment-error">{errors.reason}</span> : null}</label>
        <AppointmentTimeFields prefix="Suggested" date={draft.suggestedDate} time={draft.suggestedTime} offset={draft.suggestedOffsetMinutes} errors={errors} disabled={saving} onChange={(suggestedDate, suggestedTime, suggestedOffsetMinutes) => onDraftChange({ ...draft, suggestedDate, suggestedTime, suggestedOffsetMinutes })} />
      </>}
    </div></fieldset>
    <div className="appointment-form__actions"><button className="button button--primary appointment-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : accept ? 'Confirm Acceptance' : 'Send Reschedule Request'}</button><button className="button button--quiet appointment-secondary" type="button" disabled={saving} onClick={onCancel}>Cancel</button></div>
  </form>
}
