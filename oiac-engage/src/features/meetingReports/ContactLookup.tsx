import { useId, useState } from 'react'
import { searchContacts, searchDistricts } from './meetingReportService'
import type { ContactLookupKind, ContactOption, DistrictOption } from './meetingReportTypes'
import { useMeetingReportLookup } from './useMeetingReportLookup'

type ContactLookupProps = {
  readonly label: string
  readonly value: ContactOption | null
  readonly onChange: (value: ContactOption | null) => void
  readonly kind?: ContactLookupKind
  readonly required?: boolean
  readonly disabled?: boolean
  readonly loadOptions?: (search: string, signal?: AbortSignal) => Promise<readonly ContactOption[]>
  readonly debounceMs?: number
}

export function ContactLookup({
  label,
  value,
  onChange,
  kind = 'representative',
  required = false,
  disabled = false,
  loadOptions = (search, signal) => searchContacts(kind, search, signal),
  debounceMs = 350,
}: ContactLookupProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const lookup = useMeetingReportLookup(loadOptions, debounceMs)

  return (
    <div className="field meeting-report-lookup">
      <label htmlFor={id}>
        <span>{label}{required ? <span className="required-mark" aria-hidden="true"> *</span> : null}</span>
      </label>
      {value ? (
        <div className="meeting-report-lookup__selection">
          <span><strong>{value.name}</strong>{value.email ? <small>{value.email}</small> : null}</span>
          <button type="button" onClick={() => onChange(null)} disabled={disabled} aria-label={`Clear ${label}`}>Clear</button>
        </div>
      ) : null}
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-required={required}
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
      {open ? (
        <LookupResults
          id={`${id}-options`}
          label={label}
          status={lookup.status}
          empty={lookup.options.length === 0}
          retry={lookup.retry}
        >
          {lookup.options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={value?.id === option.id}
                  onClick={() => {
                    onChange(option)
                    if (lookup.search) lookup.setSearch('')
                    setOpen(false)
                }}
              >
                <strong>{option.name}</strong>
                {option.email || option.jobTitle ? <small>{[option.jobTitle, option.email].filter(Boolean).join(' · ')}</small> : null}
              </button>
            </li>
          ))}
        </LookupResults>
      ) : null}
    </div>
  )
}

type DistrictLookupProps = {
  readonly label: string
  readonly value: DistrictOption | null
  readonly onChange: (value: DistrictOption | null) => void
  readonly required?: boolean
  readonly disabled?: boolean
  readonly loadOptions?: (search: string, signal?: AbortSignal) => Promise<readonly DistrictOption[]>
  readonly debounceMs?: number
}

export function DistrictLookup({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  loadOptions = searchDistricts,
  debounceMs = 350,
}: DistrictLookupProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const lookup = useMeetingReportLookup(loadOptions, debounceMs)

  return (
    <div className="field meeting-report-lookup">
      <label htmlFor={id}>
        <span>{label}{required ? <span className="required-mark" aria-hidden="true"> *</span> : null}</span>
      </label>
      {value ? (
        <div className="meeting-report-lookup__selection">
          <span><strong>{value.name}</strong></span>
          <button type="button" onClick={() => onChange(null)} disabled={disabled} aria-label={`Clear ${label}`}>Clear</button>
        </div>
      ) : null}
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-required={required}
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
      {open ? (
        <LookupResults
          id={`${id}-options`}
          label={label}
          status={lookup.status}
          empty={lookup.options.length === 0}
          retry={lookup.retry}
        >
          {lookup.options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={value?.id === option.id}
                  onClick={() => {
                    onChange(option)
                    if (lookup.search) lookup.setSearch('')
                    setOpen(false)
                }}
              >{option.name}</button>
            </li>
          ))}
        </LookupResults>
      ) : null}
    </div>
  )
}

type LookupResultsProps = {
  readonly id: string
  readonly label: string
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly empty: boolean
  readonly retry: () => void
  readonly children: React.ReactNode
}

function LookupResults({ id, label, status, empty, retry, children }: LookupResultsProps) {
  if (status === 'loading' || status === 'idle') {
    return <p className="meeting-report-lookup__message" role="status">Loading options…</p>
  }
  if (status === 'error') {
    return (
      <div className="meeting-report-lookup__message meeting-report-lookup__message--error" role="alert">
        <span>Options could not be loaded.</span>
        <button type="button" onClick={retry} aria-label={`Retry ${label} lookup`}>Retry</button>
      </div>
    )
  }
  if (empty) return <p className="meeting-report-lookup__message" role="status">No matching options.</p>
  return <ul className="meeting-report-lookup__options" id={id} role="listbox" aria-label={`${label} options`}>{children}</ul>
}
