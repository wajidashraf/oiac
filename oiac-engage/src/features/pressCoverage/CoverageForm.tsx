import { useEffect, useRef, type FormEvent } from 'react'
import { FiDownload } from 'react-icons/fi'
import CoverageAttachment from './CoverageAttachment'
import { ContactLookup } from '../meetingReports/ContactLookup'
import { searchCoverageContacts } from './pressCoverageService'
import { COVERAGE_OPTIONS, type CoverageChoice, type CoverageDraft, type CoverageRecord, type CoverageVariant } from './pressCoverageTypes'
import { COVERAGE_TEXT_LIMITS, type CoverageErrors } from './pressCoverageValidation'

type Props = {
  readOnly?: boolean
  canEdit?: boolean
  onEdit?: () => void
  variant: CoverageVariant
  draft: CoverageDraft
  original: CoverageRecord | null
  file: File | null
  errors: CoverageErrors
  saving: boolean
  uploadOnly: boolean
  uncertain: boolean
  onChange: <K extends keyof CoverageDraft>(key: K, value: CoverageDraft[K]) => void
  onFileChange: (file: File | null) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  onChangeType: () => void
  onDownload: () => void
}

type TextKey = { [K in keyof CoverageDraft]: CoverageDraft[K] extends string ? K : never }[keyof CoverageDraft]
type TextField = { key: TextKey; label: string; type?: string; placeholder?: string; required?: boolean; multiline?: boolean; full?: boolean }
const pressFields: readonly (TextField | { key: CoverageChoice; label: string; choice: true })[] = [
  { key: 'headlineTitle', label: 'Headline / Title', required: true, full: true, placeholder: 'Article or segment title' },
  { key: 'mediaOutlet', label: 'Media Outlet', required: true, placeholder: 'Publication or outlet name' },
  { key: 'coverageType', label: 'Coverage Type', choice: true },
  { key: 'datePublishedAired', label: 'Date Published / Aired', required: true, type: 'date' },
  { key: 'eventCampaign', label: 'OIAC Event / Campaign', placeholder: 'Related event or campaign' },
  { key: 'personInterviewed', label: 'Person Interviewed / Quoted', placeholder: 'Name of person interviewed or quoted' },
  { key: 'reporter', label: 'Reporter / Journalist', placeholder: 'Reporter or journalist name' },
  { key: 'programSection', label: 'Program / Section', placeholder: 'Program or publication section' },
  { key: 'coverageLevel', label: 'Coverage Level', choice: true },
  { key: 'tone', label: 'Tone', choice: true },
  { key: 'keyTopic', label: 'Key Topic', choice: true },
  { key: 'articleVideoUrl', label: 'Article / Video URL', type: 'url', placeholder: 'https://...' },
  { key: 'summary', label: 'Summary', multiline: true, full: true, placeholder: 'Summarize the coverage...' },
]
const featuredFields: readonly TextField[] = [
  { key: 'publication', label: 'Publication', required: true, placeholder: 'Publication name' },
  { key: 'headline', label: 'Headline', required: true, placeholder: 'Article headline', full: true },
  { key: 'shortSummary', label: 'Short Summary', required: true, multiline: true, full: true, placeholder: 'Briefly summarize the article...' },
  { key: 'publicationDate', label: 'Publication Date', required: true, type: 'date' },
  { key: 'originalArticleLink', label: 'Original Article Link', required: true, type: 'url', placeholder: 'https://...' },
]

export function CoverageForm(props: Props) {
  const { variant, original, draft, file, errors, saving, uploadOnly, uncertain, onChange, readOnly = false } = props
  const ref = useRef<HTMLFormElement>(null)
  const isFeatured = variant === 'featured'
  const title = `${readOnly ? 'View' : original ? 'Edit' : 'New'} ${isFeatured ? 'Featured' : 'Press'} Coverage`
  const locked = readOnly || saving || uploadOnly || uncertain
  useEffect(() => { ref.current?.querySelector<HTMLInputElement>('input')?.focus() }, [variant, original?.id])

  function textField(field: TextField) {
    const id = `coverage-${field.key}`
    const attributes = {
      id, name: field.key, value: draft[field.key], required: !readOnly && field.required, readOnly, disabled: !readOnly && locked, 'aria-label': field.label,
      'aria-required': field.required || undefined, 'aria-invalid': errors[field.key] ? true : undefined,
      'aria-describedby': errors[field.key] ? `${id}-error` : undefined,
      placeholder: field.placeholder,
      maxLength: field.key in COVERAGE_TEXT_LIMITS ? COVERAGE_TEXT_LIMITS[field.key as keyof typeof COVERAGE_TEXT_LIMITS] : undefined,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(field.key, event.target.value),
    }
    return <div className={`field${field.full ? ' coverage-field--full' : ''}`} key={field.key}>
      <label htmlFor={id}>{field.label}{field.required ? <span aria-hidden="true" className="required-mark"> *</span> : null}</label>
      {field.multiline ? <textarea {...attributes} rows={isFeatured ? 3 : 4} /> : <input {...attributes} type={field.type ?? 'text'} />}
      {errors[field.key] ? <span className="coverage-field__error" id={`${id}-error`}>{errors[field.key]}</span> : null}
    </div>
  }
  function choiceField(key: CoverageChoice, label: string) {
    return <div className="field" key={key}>
      <label htmlFor={`coverage-${key}`}>{label}</label>
      <select id={`coverage-${key}`} disabled={locked} value={draft[key] ?? ''} onChange={(event) => onChange(key, event.target.value === '' ? null : Number(event.target.value))}>
        <option value="">Select</option>
        {COVERAGE_OPTIONS[key].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        {draft[key] !== null && !COVERAGE_OPTIONS[key].some((option) => option.value === draft[key]) ? <option value={draft[key]!}>{original?.choiceLabels?.[key] || 'Existing value'}</option> : null}
      </select>
    </div>
  }
  function booleanField(key: 'oiacMentioned' | 'followUpNeeded', label: string) {
    return <div className="field" key={key}>
      <label htmlFor={`coverage-${key}`}>{label}</label>
      <select id={`coverage-${key}`} disabled={locked} value={draft[key] === null ? '' : String(draft[key])} onChange={(event) => onChange(key, event.target.value === '' ? null : event.target.value === 'true')}>
        <option value="">Select</option><option value="true">Yes</option><option value="false">No</option>
      </select>
    </div>
  }
  const fileField = <div className="field coverage-file">
    <label htmlFor="coverage-file">{isFeatured ? 'Publication Logo' : 'Attachment'}{isFeatured ? <span aria-hidden="true" className="required-mark"> *</span> : null}</label>
    <div className="coverage-file__control">
      <input id="coverage-file" name="file" type="file" aria-label={isFeatured ? 'Publication Logo' : 'Attachment'} disabled={saving || uncertain} accept={isFeatured ? 'image/png,image/jpeg,image/gif,image/webp' : '.pdf,.xls,.xlsx,image/png,image/jpeg,image/gif,image/webp'} aria-required={isFeatured} aria-invalid={errors.file ? true : undefined} aria-describedby={errors.file ? 'coverage-file-error coverage-file-help' : 'coverage-file-help'} onChange={(event) => props.onFileChange(event.target.files?.[0] ?? null)} />
    </div>
    <small id="coverage-file-help">{isFeatured ? 'PNG, JPG, GIF or WebP, up to 2 MB.' : 'PDF, PNG, JPG, GIF, WebP, XLS or XLSX, up to 10 MB.'}</small>
    {file ? <small>Selected: {file.name}</small> : null}
    {original?.fileName ? <button type="button" className="coverage-download" disabled={saving} onClick={props.onDownload}><FiDownload aria-hidden="true" /> Download {original.fileName}</button> : null}
    {errors.file ? <span id="coverage-file-error" className="coverage-field__error">{errors.file}</span> : null}
  </div>

  return <form noValidate id="press-coverage-form" ref={ref} className={`press-coverage-form coverage-form${isFeatured ? ' coverage-form--featured' : ''}`} aria-label={title} onSubmit={(event) => { if (readOnly) event.preventDefault(); else props.onSubmit(event) }}>
    <div className="coverage-form__heading"><div><h2>{title}</h2><p>{isFeatured ? 'Add a high-impact article to the coverage list.' : 'Capture the media placement, related campaign, people, and follow-up details.'}</p></div>
      {!original ? <button className="coverage-text-action" type="button" disabled={saving || uploadOnly} onClick={props.onChangeType}>Change type</button> : null}
    </div>
    <div className="press-coverage-form__grid">
      {isFeatured && !readOnly ? fileField : null}
      {isFeatured ? featuredFields.map(textField) : pressFields.map((field) => 'choice' in field ? choiceField(field.key, field.label) : textField(field))}
      {!isFeatured ? <>
        {booleanField('oiacMentioned', 'OIAC Mentioned?')}
        {readOnly ? <div className="field"><label htmlFor="coverage-related-contact">Related Contact</label><input id="coverage-related-contact" readOnly value={draft.relatedContact?.name ?? ''} /></div> : <ContactLookup label="Related Contact" compactSelection value={draft.relatedContact} onChange={(value) => onChange('relatedContact', value)} loadOptions={searchCoverageContacts} disabled={locked} />}
        {textField({ key: 'keyQuotes', label: 'Key Quote', multiline: true, full: true, placeholder: 'Add a key quote from the coverage...' })}
        {booleanField('followUpNeeded', 'Follow-up Needed?')}
        {!readOnly ? fileField : null}
      </> : null}
      {readOnly ? original?.fileName && original.fileId ? <CoverageAttachment key={`${original.id}:${original.fileId}:${original.fileName}`} id={original.id} fileName={original.fileName} /> : <p>No attachment.</p> : null}
    </div>
    <div className="press-coverage-form__actions">
      {readOnly ? props.canEdit ? <button className="button button--primary" type="button" onClick={props.onEdit} aria-label="Edit coverage">Edit</button> : null : <button className="button button--primary" type="submit" disabled={saving || uncertain}>{saving ? 'Saving…' : uploadOnly ? 'Retry file upload' : original ? 'Save changes' : `Save ${isFeatured ? 'Featured' : 'Press'} Coverage`}</button>}
      <button className="button button--quiet" onClick={props.onCancel} disabled={saving} type="button">{readOnly ? 'Close' : 'Cancel'}</button>
    </div>
    {saving ? <p role="status" className="coverage-form__status">{uploadOnly ? 'Uploading file…' : 'Saving coverage…'}</p> : null}
  </form>
}
