import { type FormEvent, useEffect, useRef, useState } from 'react'
import { FiChevronLeft, FiFileText, FiStar } from 'react-icons/fi'
import EmptyState from '../components/EmptyState'
import { CoverageForm } from '../features/pressCoverage/CoverageForm'
import CoverageSavingOverlay from '../features/pressCoverage/CoverageSavingOverlay'
import { downloadCoverageFile, uploadCoverageFile, validateCoverageFile } from '../features/pressCoverage/pressCoverageFiles'
import { canEditCoverage, coverageListing, CoverageSaveUncertainError, createCoverage, displayCoverageDate, getCoverage, getCoveragePage, updateCoverage } from '../features/pressCoverage/pressCoverageService'
import { emptyCoverageDraft, type CoverageDraft, type CoverageRecord, type CoverageVariant } from '../features/pressCoverage/pressCoverageTypes'
import { validateCoverageDraft, type CoverageErrors } from '../features/pressCoverage/pressCoverageValidation'
import { useCoverageNavigationGuard } from '../features/pressCoverage/useCoverageNavigationGuard'
import '../features/pressCoverage/pressCoverage.css'

type PressCoverageProps = { contactId?: string; isAdmin?: boolean; canCreate?: boolean }
type Screen = 'closed' | 'select' | 'form' | 'view' | 'loading-edit'

function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Coverage could not be saved. Try again.' }

export default function PressCoverage({ contactId, isAdmin = false, canCreate = true }: PressCoverageProps) {
  const [records, setRecords] = useState<readonly CoverageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [nextLink, setNextLink] = useState<string | null>(null)
  const [pages, setPages] = useState<readonly (string | undefined)[]>([undefined])
  const [revision, setRevision] = useState(0)
  const [screen, setScreen] = useState<Screen>('closed')
  const [variant, setVariant] = useState<CoverageVariant>('press')
  const [draft, setDraft] = useState<CoverageDraft>(emptyCoverageDraft)
  const [original, setOriginal] = useState<CoverageRecord | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<CoverageErrors>({})
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const initialDraft = useRef(JSON.stringify(emptyCoverageDraft()))
  const savingLock = useRef(false)
  const editRequest = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const pageLink = pages[pages.length - 1]
  const dirty = screen === 'form' && (JSON.stringify(draft) !== initialDraft.current || file !== null || savedRecordId !== null)
  const navigationBlocked = useCoverageNavigationGuard({ dirty, saving, pendingFile: savedRecordId !== null })

  useEffect(() => {
    document.title = 'Press Coverage — OIAC Engage'
    mounted.current = true
    return () => { mounted.current = false; editRequest.current?.abort() }
  }, [])

  useEffect(() => {
    const request = new AbortController()
    let active = true
    setLoading(true)
    setListError('')
    setNextLink(null)
    getCoveragePage({ nextLink: pageLink }, request.signal).then((page) => {
      if (!active || request.signal.aborted) return
      setRecords(page.records)
      setNextLink(page.nextLink)
    }).catch((error: unknown) => {
      if (!active || request.signal.aborted) return
      setListError(errorMessage(error))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; request.abort() }
  }, [pageLink, revision])

  function mayDiscard() { return !savingLock.current && (!dirty || window.confirm(savedRecordId ? 'The coverage record is saved, but its file has not finished uploading. Leave this form?' : 'Discard your unsaved coverage changes?')) }
  function resetForm() {
    const empty = emptyCoverageDraft()
    setDraft(empty)
    initialDraft.current = JSON.stringify(empty)
    setOriginal(null); setFile(null); setErrors({}); setFormError(''); setSavedRecordId(null); setUncertain(false)
  }
  function closeForm() {
    if (!mayDiscard()) return
    editRequest.current?.abort()
    resetForm(); setScreen('closed')
  }
  function openSelector() {
    if (!canCreate || !mayDiscard()) return
    editRequest.current?.abort()
    resetForm(); setSuccess(''); setScreen('select')
  }
  function chooseType(nextVariant: CoverageVariant) {
    if (savingLock.current) return
    resetForm(); setVariant(nextVariant); setScreen('form')
  }
  async function openRecord(record: CoverageRecord, mode: 'form' | 'view') {
    if ((mode === 'form' && !canEditCoverage(record, contactId, isAdmin)) || !mayDiscard()) return
    editRequest.current?.abort()
    const request = new AbortController()
    editRequest.current = request
    resetForm(); setSuccess(''); setScreen('loading-edit')
    try {
      const latest = await getCoverage(record.id, request.signal)
      if (request.signal.aborted || !mounted.current || editRequest.current !== request) return
      if (mode === 'form' && !canEditCoverage(latest, contactId, isAdmin)) throw new Error('You no longer have permission to edit this coverage.')
      setDraft(latest)
      initialDraft.current = JSON.stringify(latest)
      setOriginal(latest); setVariant(latest.isFeatured ? 'featured' : 'press'); setScreen(mode)
    } catch (error) {
      if (request.signal.aborted || !mounted.current || editRequest.current !== request) return
      setFormError(errorMessage(error)); setScreen('closed')
    }
  }
  function updateDraft<K extends keyof CoverageDraft>(key: K, value: CoverageDraft[K]) {
    if (screen !== 'form' || savingLock.current || savedRecordId || uncertain) return
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }
  function updateFile(nextFile: File | null) {
    if (screen !== 'form' || savingLock.current || uncertain) return
    setFile(nextFile)
    const error = nextFile ? validateCoverageFile(nextFile, variant) : null
    setErrors((current) => ({ ...current, file: error ?? undefined }))
  }
  function refreshList() { setPages([undefined]); setRevision((current) => current + 1) }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (screen !== 'form' || savingLock.current || uncertain || (original ? !canEditCoverage(original, contactId, isAdmin) : !canCreate)) return
    const nextErrors = savedRecordId ? { file: file ? validateCoverageFile(file, variant) ?? undefined : 'Choose the file to retry its upload.' } : validateCoverageDraft(variant, draft, file, Boolean(original?.fileName))
    setErrors(nextErrors)
    const firstError = Object.keys(nextErrors).find((key) => nextErrors[key as keyof CoverageErrors])
    if (firstError) { document.getElementById(`coverage-${firstError}`)?.focus(); return }
    savingLock.current = true
    setSaving(true); setFormError(''); setSuccess('')
    let recordId = savedRecordId
    try {
      if (!recordId) {
        const result = original ? await updateCoverage(original.id, variant, draft, original) : await createCoverage(variant, draft)
        recordId = result.id
        if (!mounted.current) return
        if (file) setSavedRecordId(recordId)
      }
      if (file) await uploadCoverageFile(recordId, file, variant)
      if (!mounted.current) return
      resetForm(); setScreen('closed'); setSuccess(variant === 'featured' ? 'Featured coverage saved.' : 'Press coverage saved.'); refreshList()
    } catch (error) {
      if (!mounted.current) return
      if (error instanceof CoverageSaveUncertainError) {
        setUncertain(true)
        setFormError(`${errorMessage(error)} Refresh the coverage list and check whether this record was saved before starting a new submission.`)
      } else if (recordId && file) {
        setSavedRecordId(recordId)
        setFormError(`Coverage record saved. File upload failed: ${errorMessage(error)} Retry the file upload to finish.`)
      } else setFormError(errorMessage(error))
    } finally {
      savingLock.current = false
      if (mounted.current) setSaving(false)
    }
  }
  async function downloadFile() {
    if (!original) return
    setFormError('')
    try {
      const { blob, fileName } = await downloadCoverageFile(original.id)
      if (!mounted.current) return
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = fileName; document.body.append(anchor); anchor.click(); anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (error) { if (mounted.current) setFormError(`File could not be downloaded. ${errorMessage(error)}`) }
  }

  return <div className="page page--press-coverage">
    {saving ? <CoverageSavingOverlay /> : null}
    <a className="press-coverage__back" href="/"><FiChevronLeft aria-hidden="true" /> Back</a>
    <header className="press-coverage__header"><h1>Press Coverage</h1><p>Log and track media coverage related to OIAC activities and advocacy.</p></header>
    <div className="press-coverage__toolbar">{canCreate ? <button aria-controls="press-coverage-editor" aria-expanded={screen !== 'closed'} className="button button--primary press-coverage__add" disabled={saving} onClick={openSelector} type="button">+ Add Coverage</button> : null}</div>
    {success ? <p className="form-success press-coverage__success" role="status">{success}</p> : null}
    {navigationBlocked ? <p role="status" className="coverage-list-status">Coverage is still saving. Wait until it finishes before leaving this page.</p> : null}
    {formError ? <div className="coverage-alert" role="alert"><p>{formError}</p>{uncertain ? <button className="button button--quiet" type="button" disabled={saving || loading} onClick={refreshList}>Refresh coverage list</button> : null}</div> : null}
    <div id="press-coverage-editor">
      {screen === 'select' ? <section className="coverage-selector" aria-label="Select coverage type">
        <h2>Select coverage type</h2><p className="coverage-selector__description">Choose the type of record you want to add. The form will update with the relevant fields.</p><div className="coverage-selector__cards">
          <button type="button" className="coverage-selector__card" onClick={() => chooseType('press')}><FiFileText aria-hidden="true" /><span><strong>Press Coverage</strong><span>Log complete media, interview, campaign, tone, contact, and follow-up details.</span></span></button>
          <button type="button" className="coverage-selector__card" onClick={() => chooseType('featured')}><FiStar aria-hidden="true" /><span><strong>Featured Coverage</strong><span>Create a highlighted record with a publication logo, summary, date, and original link.</span></span></button>
        </div><button className="button button--quiet" type="button" onClick={closeForm}>Cancel</button>
      </section> : null}
      {screen === 'loading-edit' ? <div className="coverage-loading"><p role="status">Loading latest coverage…</p><button type="button" className="button button--quiet" onClick={closeForm} aria-label="Cancel loading edit">Cancel</button></div> : null}
      {screen === 'form' || screen === 'view' ? <CoverageForm readOnly={screen === 'view'} canEdit={Boolean(original && canEditCoverage(original, contactId, isAdmin))} onEdit={() => { if (original) void openRecord(original, 'form') }} variant={variant} original={original} draft={draft} file={file} errors={errors} saving={saving} uploadOnly={savedRecordId !== null} uncertain={uncertain} onChange={updateDraft} onFileChange={updateFile} onSubmit={save} onCancel={closeForm} onChangeType={openSelector} onDownload={() => { void downloadFile() }} /> : null}
    </div>
    {loading ? <p className="coverage-list-status" role="status">Loading coverage…</p> : null}
    {listError ? <div className="coverage-alert" role="alert"><p>{listError}</p><button className="button button--quiet" disabled={saving} onClick={() => setRevision((current) => current + 1)} type="button" aria-label="Retry loading coverage">Retry</button></div> : null}
    {!loading && !listError && records.length === 0 ? <EmptyState title="No press coverage yet" description="Add coverage to begin tracking media activity." /> : null}
    {records.length ? <div className="press-coverage-table-scroll" role="region" aria-label="Press coverage table" tabIndex={0} aria-busy={loading}>
      <table className="press-coverage-table coverage-table" aria-label="Press coverage"><thead><tr>{['Headline', 'Date', 'Media Outlet', 'Coverage Type', 'Tone', 'Coverage Level', 'Featured', 'Actions'].map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead>
        <tbody>{records.map((record) => {
          const row = coverageListing(record)
          return <tr key={record.id} className={record.isFeatured ? 'coverage-table__featured-row' : undefined}>
            <th scope="row"><button className="coverage-headline" type="button" disabled={saving} onClick={() => { void openRecord(record, 'view') }}>{row.headline}</button></th><td>{row.date ? <time dateTime={row.date}>{displayCoverageDate(row.date)}</time> : '—'}</td>
            <td>{row.mediaOutlet && row.mediaOutlet !== '—' ? <span className="press-coverage-table__source">{row.mediaOutlet}</span> : '—'}</td>
            <td>{row.coverageType}</td><td><span className={`press-coverage-table__sentiment press-coverage-table__sentiment--${row.tone.toLowerCase()}`}>{row.tone}</span></td><td>{row.coverageLevel}</td>
            <td>{record.isFeatured ? <span className="coverage-featured-badge"><FiStar aria-hidden="true" /> Featured</span> : 'No'}</td>
            <td><div className="coverage-row-actions">{canEditCoverage(record, contactId, isAdmin) ? <button type="button" className="press-coverage-table__edit" disabled={saving || screen === 'loading-edit'} onClick={() => { void openRecord(record, 'form') }} aria-label={`Edit ${row.headline}`}>Edit</button> : null}<button type="button" className="press-coverage-table__edit" disabled={saving} onClick={() => { void openRecord(record, 'view') }} aria-label={`View ${row.headline}`}>View</button></div></td>
          </tr>
        })}</tbody>
      </table>
    </div> : null}
    {records.length || pages.length > 1 ? <nav className="coverage-pagination" aria-label="Coverage pages"><button className="button button--quiet" type="button" disabled={pages.length === 1 || loading || saving} onClick={() => setPages((current) => current.slice(0, -1))}>Previous</button><span>Page {pages.length}</span><button className="button button--quiet" type="button" disabled={!nextLink || Boolean(listError) || loading || saving} onClick={() => { if (nextLink && !listError) setPages((current) => [...current, nextLink]) }}>Next</button></nav> : null}
  </div>
}
