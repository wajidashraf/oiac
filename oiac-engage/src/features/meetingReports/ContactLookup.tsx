import { useEffect, useId, useRef, useState } from 'react'
import { FiMapPin, FiUser, FiX } from 'react-icons/fi'
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
  readonly compactSelection?: boolean
  readonly normalizeSearch?: (search: string) => string
  readonly emptyMessage?: string
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
  compactSelection = false,
  normalizeSearch,
  emptyMessage,
}: ContactLookupProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const lookup = useMeetingReportLookup(loadOptions, debounceMs, normalizeSearch)
  const input = useRef<HTMLInputElement>(null)
  const clear = useRef<HTMLButtonElement>(null)
  const previousSelection = useRef(value?.id)
  const selectedCompact = compactSelection && value !== null
  useEffect(() => {
    if (!compactSelection || previousSelection.current === value?.id) return
    previousSelection.current = value?.id
    if (value) clear.current?.focus()
    else input.current?.focus()
  }, [compactSelection, value?.id, value])

  return (
    <div className={`field meeting-report-lookup${compactSelection ? ' meeting-report-lookup--compact' : ''}`}>
      <label id={`${id}-label`} htmlFor={selectedCompact ? undefined : id}>
        <span>{label}{required ? <span className="required-mark" aria-hidden="true"> *</span> : null}</span>
      </label>
      <div className="meeting-report-lookup__control">
        {value ? (
          <div className="meeting-report-lookup__selection" role={selectedCompact ? 'group' : undefined} aria-labelledby={selectedCompact ? `${id}-label` : undefined} title={[value.name, value.email].filter(Boolean).join(' · ')}>
            <FiUser className="meeting-report-lookup__selection-icon" aria-hidden="true" />
            <strong>{value.name}</strong>
            <button ref={clear} type="button" onClick={() => { onChange(null); if (compactSelection) setOpen(false) }} disabled={disabled} aria-label={`Clear ${label}`}><FiX aria-hidden="true" /></button>
          </div>
        ) : null}
        {!selectedCompact ? <input
          ref={input}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-required={required}
          autoComplete="off"
          disabled={disabled}
          placeholder={value ? 'Search to replace...' : 'Search and select...'}
          value={lookup.search}
          onChange={(event) => {
            lookup.setSearch(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        /> : null}
      </div>
      {open && !selectedCompact ? (
        <LookupResults
          id={`${id}-options`}
          label={label}
          status={lookup.status}
          empty={lookup.options.length === 0}
          emptyMessage={emptyMessage}
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
  readonly describedBy?: string
  readonly loadOptions?: (search: string, signal?: AbortSignal) => Promise<readonly DistrictOption[]>
  readonly debounceMs?: number
}

export function DistrictLookup({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  describedBy,
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
      <div className="meeting-report-lookup__control">
        {value ? (
          <div className="meeting-report-lookup__selection" title={value.name}>
            <FiMapPin className="meeting-report-lookup__selection-icon" aria-hidden="true" />
            <strong>{value.name}</strong>
            <button type="button" onClick={() => onChange(null)} disabled={disabled} aria-label={`Clear ${label}`}><FiX aria-hidden="true" /></button>
          </div>
        ) : null}
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-required={required}
          aria-describedby={describedBy}
          autoComplete="off"
          disabled={disabled}
          placeholder={value ? 'Search to replace...' : 'Search and select...'}
          value={lookup.search}
          onChange={(event) => {
            lookup.setSearch(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
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
  readonly emptyMessage?: string
  readonly retry: () => void
  readonly children: React.ReactNode
}

function LookupResults({ id, label, status, empty, emptyMessage = 'No matching options.', retry, children }: LookupResultsProps) {
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
  if (empty) return <p className="meeting-report-lookup__message" role="status">{emptyMessage}</p>
  return <ul className="meeting-report-lookup__options" id={id} role="listbox" aria-label={`${label} options`}>{children}</ul>
}
