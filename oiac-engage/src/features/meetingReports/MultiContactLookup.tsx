import { useId, useState } from 'react'
import { searchContacts } from './meetingReportService'
import type { ContactLookupKind, ContactOption } from './meetingReportTypes'
import { useMeetingReportLookup } from './useMeetingReportLookup'

type MultiContactLookupProps = {
  readonly label: string
  readonly values: readonly ContactOption[]
  readonly onChange: (values: readonly ContactOption[]) => void
  readonly kind?: Exclude<ContactLookupKind, 'representative'>
  readonly disabled?: boolean
  readonly loadOptions?: (search: string, signal?: AbortSignal) => Promise<readonly ContactOption[]>
  readonly debounceMs?: number
}

export function MultiContactLookup({
  label,
  values,
  onChange,
  kind = 'staff',
  disabled = false,
  loadOptions = (search, signal) => searchContacts(kind, search, signal),
  debounceMs = 350,
}: MultiContactLookupProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const lookup = useMeetingReportLookup(loadOptions, debounceMs)
  const selectedIds = new Set(values.map((value) => value.id))
  const availableOptions = lookup.options.filter((option) => !selectedIds.has(option.id))

  return (
    <div className="field field--full meeting-report-lookup meeting-report-lookup--multi">
      <label htmlFor={id}><span>{label}</span></label>
      {values.length > 0 ? (
        <ul className="meeting-report-lookup__chips" aria-label={`Selected ${label}`}>
          {values.map((value) => (
            <li key={value.id}>
              <span>{value.name}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${value.name}`}
                onClick={() => onChange(values.filter((item) => item.id !== value.id))}
              >×</button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        autoComplete="off"
        disabled={disabled}
        placeholder="Search and select..."
        value={lookup.search}
        onChange={(event) => {
          lookup.setSearch(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (lookup.status === 'loading' || lookup.status === 'idle') ? (
        <p className="meeting-report-lookup__message" role="status">Loading options…</p>
      ) : null}
      {open && lookup.status === 'error' ? (
        <div className="meeting-report-lookup__message meeting-report-lookup__message--error" role="alert">
          <span>Options could not be loaded.</span>
          <button type="button" onClick={lookup.retry} aria-label={`Retry ${label} lookup`}>Retry</button>
        </div>
      ) : null}
      {open && lookup.status === 'ready' && availableOptions.length === 0 ? (
        <p className="meeting-report-lookup__message" role="status">No matching options.</p>
      ) : null}
      {open && lookup.status === 'ready' && availableOptions.length > 0 ? (
        <ul className="meeting-report-lookup__options" id={`${id}-options`} role="listbox" aria-label={`${label} options`} aria-multiselectable="true">
          {availableOptions.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => {
                  if (!selectedIds.has(option.id)) onChange([...values, option])
                  if (lookup.search) lookup.setSearch('')
                  setOpen(false)
                }}
              >
                <strong>{option.name}</strong>
                {option.email || option.jobTitle ? <small>{[option.jobTitle, option.email].filter(Boolean).join(' · ')}</small> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
