import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { LuChevronDown, LuSearch } from 'react-icons/lu'
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
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const lookup = useMeetingReportLookup(loadOptions, debounceMs)
  const selectedIds = useMemo(() => new Set(values.map((value) => value.id)), [values])
  const options = useMemo(() => {
    const optionsById = new Map<string, ContactOption>()
    values.forEach((value) => optionsById.set(value.id, value))
    lookup.options.forEach((option) => optionsById.set(option.id, option))
    return [...optionsById.values()]
  }, [lookup.options, values])

  useEffect(() => {
    if (!open) return undefined

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function toggleOption(option: ContactOption) {
    if (selectedIds.has(option.id)) {
      onChange(values.filter((value) => value.id !== option.id))
      return
    }
    onChange([...values, option])
  }

  return (
    <div ref={rootRef} className="field field--full meeting-report-lookup meeting-report-lookup--multi">
      <span id={`${id}-label`} className="meeting-report-lookup__label">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className="meeting-report-lookup__multi-trigger"
        role="combobox"
        aria-label={label}
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{values.length > 0 ? `${values.length} selected` : 'Select options'}</span>
        <LuChevronDown aria-hidden="true" />
      </button>

      {open ? (
        <div className="meeting-report-lookup__multi-panel" id={`${id}-panel`}>
          <div className="meeting-report-lookup__multi-search">
            <LuSearch aria-hidden="true" />
            <input
              type="search"
              role="searchbox"
              aria-label={`Search ${label}`}
              autoComplete="off"
              placeholder="Search"
              value={lookup.search}
              onChange={(event) => lookup.setSearch(event.target.value)}
            />
          </div>

          {lookup.status === 'loading' || lookup.status === 'idle' ? (
            <p className="meeting-report-lookup__message" role="status">Loading options…</p>
          ) : null}
          {lookup.status === 'error' ? (
            <div className="meeting-report-lookup__message meeting-report-lookup__message--error" role="alert">
              <span>Options could not be loaded.</span>
              <button type="button" onClick={lookup.retry} aria-label={`Retry ${label} lookup`}>Retry</button>
            </div>
          ) : null}
          {lookup.status === 'ready' && options.length === 0 ? (
            <p className="meeting-report-lookup__message" role="status">No matching options.</p>
          ) : null}
          {lookup.status === 'ready' && options.length > 0 ? (
            <ul className="meeting-report-lookup__multi-options" role="listbox" aria-label={`${label} options`} aria-multiselectable="true">
              {options.map((option) => {
                const selected = selectedIds.has(option.id)
                return (
                  <li key={option.id} role="option" aria-selected={selected}>
                    <label>
                      <input type="checkbox" checked={selected} onChange={() => toggleOption(option)} />
                      <span>
                        <strong>{option.name}</strong>
                        {option.email || option.jobTitle ? <small>{[option.jobTitle, option.email].filter(Boolean).join(' · ')}</small> : null}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
