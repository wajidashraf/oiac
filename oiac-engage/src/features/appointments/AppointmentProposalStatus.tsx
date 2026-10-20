import { useEffect, useId, useRef, useState } from 'react'
import { formatAppointmentDateTime } from './appointmentDates'
import type { AppointmentRecord } from './appointmentTypes'

export function AppointmentProposalStatus({ record }: { record: AppointmentRecord }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const original = formatAppointmentDateTime(record.preferredDateTime)
  const suggested = record.suggestedDateTime ? formatAppointmentDateTime(record.suggestedDateTime) : 'Not provided'
  const description = `Proposal awaiting agreement. Original preferred time: ${original}. Suggested time: ${suggested}. ${record.reschedulingReason} This proposal is unconfirmed and is not in My Calendar.`

  function close(restoreFocus = true) {
    setOpen(false)
    if (restoreFocus) trigger.current?.focus()
  }
  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    function pointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false)
    }
    function keyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus()
    }
    document.addEventListener('pointerdown', pointerDown)
    document.addEventListener('keydown', keyDown)
    return () => { document.removeEventListener('pointerdown', pointerDown); document.removeEventListener('keydown', keyDown) }
  }, [open])

  return <>
    <button ref={trigger} className={`appointment-status appointment-status--${record.status} appointment-proposal-trigger`} type="button" aria-expanded={open} aria-controls={`${id}-panel`} aria-haspopup="dialog" aria-describedby={`${id}-description`} onClick={() => open ? close() : setOpen(true)}>{record.statusLabel}</button>
    <span className="sr-only" id={`${id}-description`}>{description}</span>
    {open ? <div ref={panel} id={`${id}-panel`} className="appointment-proposal-popover" role="dialog" tabIndex={-1} aria-labelledby={`${id}-heading`} onBlur={(event) => {
      if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== trigger.current) close(false)
    }}>
      <h4 id={`${id}-heading`}>Proposal awaiting agreement</h4>
      <p><strong>Original preferred time:</strong> {original}</p>
      <p><strong>Suggested time:</strong> {suggested}</p>
      {record.reschedulingReason ? <p><strong>Reason:</strong> {record.reschedulingReason}</p> : null}
      <p>This proposal is unconfirmed and is not in My Calendar.</p>
      <button className="button button--quiet appointment-secondary" type="button" onClick={() => close()} aria-label="Close proposal details">Close</button>
    </div> : null}
  </>
}
