import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  LuArrowLeft,
  LuArrowRight,
  LuCalendarDays,
  LuCheck,
  LuChevronLeft,
  LuFileText,
  LuInfo,
  LuLoaderCircle,
  LuUserRound,
} from 'react-icons/lu'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { PortalUser } from '../auth/powerPagesSession'
import { ContactLookup, DistrictLookup } from '../features/meetingReports/ContactLookup'
import { MultiContactLookup } from '../features/meetingReports/MultiContactLookup'
import {
  buildRelationshipOperations,
  createMeetingReport,
  getMeetingReport,
  getMeetingReportProfile,
  runRelationshipOperations,
  searchContacts,
  searchDistricts,
  updateMeetingReport,
  MeetingReportCreateOutcomeUnknownError,
} from '../features/meetingReports/meetingReportService'
import type {
  ContactOption,
  DistrictOption,
  MeetingFormat,
  MeetingReportDraft,
  MeetingReportProfile,
  MeetingSentiment,
  RelationshipOperation,
  RelationshipSelection,
} from '../features/meetingReports/meetingReportTypes'

const steps = [
  { label: 'Your Info', icon: LuUserRound },
  { label: 'Meeting', icon: LuCalendarDays },
  { label: 'Report', icon: LuFileText },
] as const

const meetingFormats: readonly { value: MeetingFormat; label: string; icon: string; detail: string }[] = [
  { value: 1, label: 'In-person', icon: '🏛️', detail: 'Capitol Hill' },
  { value: 2, label: 'Teams', icon: '💻', detail: 'Microsoft Teams' },
  { value: 3, label: 'Phone', icon: '📞', detail: 'Phone Call' },
  { value: 4, label: 'District', icon: '🏢', detail: 'District Office' },
  { value: 5, label: 'Other', icon: '📋', detail: 'Other format' },
]

const sentiments: readonly { value: MeetingSentiment; label: string; symbol: string }[] = [
  { value: 1, label: 'Very Supportive', symbol: '★★★' },
  { value: 2, label: 'Supportive', symbol: '★★☆' },
  { value: 3, label: 'Neutral', symbol: '★☆☆' },
  { value: 4, label: 'Non-committal', symbol: '◐○○' },
  { value: 5, label: 'Opposed', symbol: '✕✕✕' },
]

const emptyDraft: MeetingReportDraft = {
  subject: '',
  date: '',
  representativeId: '',
  districtId: '',
  meetingFormat: null,
  staffIds: [],
  volunteerIds: [],
  issuesDiscussed: '',
  outcomesNextSteps: '',
  followUpActions: '',
  sentiment: null,
}

type MeetingReportFormProps = {
  readonly user: PortalUser
}

export default function MeetingReportForm({ user }: MeetingReportFormProps) {
  const { reportId } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(reportId)
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<MeetingReportProfile | null>(null)
  const [draft, setDraft] = useState<MeetingReportDraft>(emptyDraft)
  const [representative, setRepresentative] = useState<ContactOption | null>(null)
  const [district, setDistrict] = useState<DistrictOption | null>(null)
  const [staff, setStaff] = useState<readonly ContactOption[]>([])
  const [volunteers, setVolunteers] = useState<readonly ContactOption[]>([])
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadRetry, setLoadRetry] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingOperations, setPendingOperations] = useState<readonly RelationshipOperation[]>([])
  const [creationOutcomeUnknown, setCreationOutcomeUnknown] = useState(false)
  const [persistedReportId, setPersistedReportId] = useState<string | null>(reportId ?? null)
  const sectionHeading = useRef<HTMLHeadingElement>(null)
  const originalRelationships = useRef<RelationshipSelection>({ staffIds: [], volunteerIds: [] })
  const submitLock = useRef(false)

  useEffect(() => {
    document.title = `${isEdit ? 'Edit' : 'New'} Meeting Report — OIAC Engage`
  }, [isEdit])

  useEffect(() => {
    if (step > 0) sectionHeading.current?.focus()
  }, [step])

  useEffect(() => {
    const controller = new AbortController()
    setLoadStatus('loading')
    setFormError(null)

    if (!user.contactId) {
      setLoadStatus('error')
      setFormError('Your authenticated Contact could not be identified. Sign out and sign in again.')
      return () => controller.abort()
    }

    const profileRequest = getMeetingReportProfile(user.contactId, controller.signal)
    const reportRequest = reportId ? getMeetingReport(reportId, controller.signal) : Promise.resolve(null)
    Promise.all([profileRequest, reportRequest])
      .then(([loadedProfile, loadedReport]) => {
        if (controller.signal.aborted) return
        setProfile(loadedProfile)
        if (loadedReport) {
          setDraft({
            subject: loadedReport.subject,
            date: loadedReport.date,
            representativeId: loadedReport.representativeId,
            districtId: loadedReport.districtId,
            meetingFormat: loadedReport.meetingFormat,
            staffIds: loadedReport.staffIds,
            volunteerIds: loadedReport.volunteerIds,
            issuesDiscussed: loadedReport.issuesDiscussed,
            outcomesNextSteps: loadedReport.outcomesNextSteps,
            followUpActions: loadedReport.followUpActions,
            sentiment: loadedReport.sentiment,
          })
          setRepresentative(loadedReport.representative)
          setDistrict(loadedReport.district)
          setStaff(loadedReport.staff)
          setVolunteers(loadedReport.volunteers)
          originalRelationships.current = {
            staffIds: loadedReport.staffIds,
            volunteerIds: loadedReport.volunteerIds,
          }
          setPersistedReportId(loadedReport.id)
        } else if (loadedProfile.districtId && loadedProfile.districtName) {
          setDistrict({ id: loadedProfile.districtId, name: loadedProfile.districtName })
          setDraft((current) => ({ ...current, districtId: loadedProfile.districtId ?? '' }))
        }
        setLoadStatus('ready')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setLoadStatus('error')
        setFormError(reportId
          ? 'This report could not be loaded. It may not exist or you may not have permission to update it.'
          : 'Your profile could not be loaded. Try again.')
      })

    return () => controller.abort()
  }, [loadRetry, reportId, user.contactId])

  function updateTextField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target
    setDraft((current) => ({ ...current, [name]: value }))
    setFormError(null)
  }

  function chooseRepresentative(value: ContactOption | null) {
    setRepresentative(value)
    setDraft((current) => ({ ...current, representativeId: value?.id ?? '' }))
    setFormError(null)
  }

  function chooseDistrict(value: DistrictOption | null) {
    setDistrict(value)
    setDraft((current) => ({ ...current, districtId: value?.id ?? '' }))
    setFormError(null)
  }

  function chooseStaff(values: readonly ContactOption[]) {
    setStaff(values)
    setDraft((current) => ({ ...current, staffIds: values.map((value) => value.id) }))
  }

  function chooseVolunteers(values: readonly ContactOption[]) {
    setVolunteers(values)
    setDraft((current) => ({ ...current, volunteerIds: values.map((value) => value.id) }))
  }

  function validateMeetingStep(): string | null {
    if (!draft.subject.trim()) return 'Enter a Meeting Title.'
    if (!draft.date) return 'Select the Date of Meeting.'
    if (!draft.representativeId) return 'Select a Representative / Office.'
    if (!draft.districtId) return 'Select a State / District.'
    if (!draft.meetingFormat) return 'Select a Meeting Format.'
    return null
  }

  async function continueForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    if (step === 0) {
      setStep(1)
      return
    }
    if (step === 1) {
      const validationMessage = validateMeetingStep()
      if (validationMessage) {
        setFormError(validationMessage)
        return
      }
      setStep(2)
      return
    }
    if (!draft.issuesDiscussed.trim()) {
      setFormError('Describe the Issues Discussed before submitting the report.')
      return
    }
    await saveReport()
  }

  async function saveReport() {
    if (submitLock.current || !user.contactId) return
    submitLock.current = true
    setIsSubmitting(true)
    setFormError(null)
    try {
      let id = persistedReportId
      let operations: readonly RelationshipOperation[]
      if (isEdit) {
        if (!id) throw new Error('The report identifier is unavailable.')
        await updateMeetingReport(id, draft)
        operations = buildRelationshipOperations(originalRelationships.current, {
          staffIds: draft.staffIds,
          volunteerIds: draft.volunteerIds,
        })
      } else {
        id = await createMeetingReport(draft, user.contactId)
        setPersistedReportId(id)
        operations = buildRelationshipOperations(
          { staffIds: [], volunteerIds: [] },
          { staffIds: draft.staffIds, volunteerIds: draft.volunteerIds },
        )
      }

      const failures = await runRelationshipOperations(id, operations)
      if (failures.length > 0) {
        setPendingOperations(failures)
        setFormError('The report was saved, but some contact links could not be completed. Retry the contact links without creating another report.')
        return
      }
      finishSave()
    } catch (error) {
      if (error instanceof MeetingReportCreateOutcomeUnknownError) {
        setCreationOutcomeUnknown(true)
        setFormError('The save result could not be confirmed. Do not submit this report again because it may already exist. Return to Meeting Reports and check the list before taking further action.')
      } else {
        setFormError(`The report could not be ${isEdit ? 'updated' : 'saved'}. Check the required fields and try again.`)
      }
    } finally {
      submitLock.current = false
      setIsSubmitting(false)
    }
  }

  async function retryContactLinks() {
    if (submitLock.current || !persistedReportId || pendingOperations.length === 0) return
    submitLock.current = true
    setIsSubmitting(true)
    setFormError(null)
    try {
      const failures = await runRelationshipOperations(persistedReportId, pendingOperations)
      if (failures.length > 0) {
        setPendingOperations(failures)
        setFormError('Some contact links still could not be completed. You can retry again.')
        return
      }
      setPendingOperations([])
      finishSave()
    } catch {
      setFormError('The contact links could not be completed. Try again.')
    } finally {
      submitLock.current = false
      setIsSubmitting(false)
    }
  }

  function finishSave() {
    navigate('/report', { state: isEdit ? { reportUpdated: true } : { reportSaved: true } })
  }

  const formLocked = isSubmitting || pendingOperations.length > 0 || creationOutcomeUnknown

  return (
    <div className="page page--meeting-report page--report-form">
      <Link className="report-page__back" to="/report"><LuChevronLeft aria-hidden="true" /><span>Back</span></Link>
      <header className="report-page__header">
        <div><h1>Meeting Reports</h1><p>Submit and track your congressional and organizational meeting reports.</p></div>
      </header>

      <section className="report-form-card" aria-label={isEdit ? 'Edit meeting report' : 'New meeting report'}>
        {loadStatus === 'loading' ? (
          <p className="report-form__loading" role="status"><LuLoaderCircle aria-hidden="true" /> Loading report details…</p>
        ) : null}
        {loadStatus === 'error' ? (
          <div className="form-alert report-form__load-error" role="alert">
            <p>{formError}</p>
            {user.contactId ? <button className="button button--quiet" type="button" onClick={() => setLoadRetry((value) => value + 1)}>Try again</button> : null}
          </div>
        ) : null}
        {loadStatus === 'ready' && profile ? (
          <>
            <ol className="report-stepper" aria-label="Report progress">
              {steps.map(({ label, icon: Icon }, index) => (
                <li className={index <= step ? 'report-stepper__step report-stepper__step--reached' : 'report-stepper__step'} key={label} aria-current={index === step ? 'step' : undefined}>
                  <span className="report-stepper__icon" aria-hidden="true">{index < step ? <LuCheck /> : <Icon />}</span>
                  <span>{label}</span>
                </li>
              ))}
            </ol>

            <form className="report-form" onSubmit={continueForm}>
              {formError ? (
                <div className="form-alert report-form__error" role="alert">
                  <span>{formError}</span>
                  {pendingOperations.length > 0 ? (
                    <button type="button" className="button button--quiet" onClick={retryContactLinks} disabled={isSubmitting}>Retry contact links</button>
                  ) : null}
                </div>
              ) : null}

              {step === 0 ? (
                <div className="report-form__step">
                  <SectionHeading icon={<LuUserRound />} title="Volunteer Information" detail="Confirmed details from your Power Pages profile" headingRef={sectionHeading} />
                  <div className="form-grid report-form__grid">
                    <ReadOnlyField label="Full Name" value={profile.fullName} required />
                    <ReadOnlyField label="Email" value={profile.email} required type="email" />
                    <ReadOnlyField label="State / District" value={profile.districtName || profile.stateOrProvince} />
                    <ReadOnlyField label="City" value={profile.city} />
                  </div>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="report-form__step">
                  <SectionHeading icon={<LuCalendarDays />} title="Meeting Details" detail="Who did you meet with and how?" headingRef={sectionHeading} />
                  <div className="form-grid report-form__grid">
                    <label className="field field--full"><span>Meeting Title <Required /></span><input aria-label="Meeting Title" name="subject" placeholder="e.g. Advocacy meeting with Sen. Miller's office" value={draft.subject} onChange={updateTextField} required disabled={formLocked} /></label>
                    <label className="field"><span>Date of Meeting <Required /></span><input aria-label="Date of Meeting" name="date" type="date" value={draft.date} onChange={updateTextField} required disabled={formLocked} /></label>
                    <ContactLookup label="Representative / Office" value={representative} onChange={chooseRepresentative} required disabled={formLocked} loadOptions={(search, signal) => searchContacts('representative', search, signal)} />
                    <DistrictLookup label="State / District" value={district} onChange={chooseDistrict} required disabled={formLocked} loadOptions={searchDistricts} />
                    <fieldset className="report-choice-field field--full"><legend>Meeting Format <Required /></legend><div className="report-choice-grid report-choice-grid--formats">
                      {meetingFormats.map((format) => <label className="report-choice" key={format.value}><input type="radio" name="meetingFormat" value={format.value} checked={draft.meetingFormat === format.value} onChange={() => setDraft((current) => ({ ...current, meetingFormat: format.value }))} disabled={formLocked} /><span className="report-choice__symbol" aria-hidden="true">{format.icon}</span><strong>{format.label}</strong><small>{format.detail}</small></label>)}
                    </div></fieldset>
                    <MultiContactLookup label="Tag OIAC Staff Members" kind="staff" values={staff} onChange={chooseStaff} disabled={formLocked} loadOptions={(search, signal) => searchContacts('staff', search, signal)} />
                    <MultiContactLookup label="Tag Volunteers" kind="volunteer" values={volunteers} onChange={chooseVolunteers} disabled={formLocked} loadOptions={(search, signal) => searchContacts('volunteer', search, signal)} />
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="report-form__step">
                  <SectionHeading icon={<LuFileText />} title="Report Content" detail="Summarize what was discussed and what happens next" headingRef={sectionHeading} />
                  <div className="form-grid report-form__grid">
                    <label className="field field--full"><span>Issues Discussed <Required /></span><textarea aria-label="Issues Discussed" name="issuesDiscussed" rows={5} placeholder="Describe the main topics and issues discussed..." value={draft.issuesDiscussed} onChange={updateTextField} required disabled={formLocked} /></label>
                    <label className="field field--full"><span>Outcomes &amp; Next Steps</span><textarea aria-label="Outcomes & Next Steps" name="outcomesNextSteps" rows={4} placeholder="What was the response? What are the agreed next steps?" value={draft.outcomesNextSteps} onChange={updateTextField} disabled={formLocked} /></label>
                    <label className="field field--full"><span>Follow-up Actions</span><textarea aria-label="Follow-up Actions" name="followUpActions" rows={3} placeholder="Materials to send, follow-up calls, commitments made..." value={draft.followUpActions} onChange={updateTextField} disabled={formLocked} /></label>
                    <fieldset className="report-choice-field field--full"><legend>Overall Sentiment</legend><div className="report-choice-grid report-choice-grid--sentiments">
                      {sentiments.map((sentiment) => <label className={`report-choice report-choice--sentiment report-choice--${sentiment.label.toLowerCase().replace(/[^a-z]+/g, '-')}`} key={sentiment.value}><input type="radio" name="sentiment" value={sentiment.value} checked={draft.sentiment === sentiment.value} onChange={() => setDraft((current) => ({ ...current, sentiment: sentiment.value }))} disabled={formLocked} /><span className="report-choice__rating" aria-hidden="true">{sentiment.symbol}</span><strong>{sentiment.label}</strong></label>)}
                    </div></fieldset>
                    <p className="report-form__notice field--full"><LuInfo aria-hidden="true" /> This report is securely saved to Power Pages and Dataverse.</p>
                  </div>
                </div>
              ) : null}

              <div className="report-form__actions">
                {step > 0 ? <button className="button button--quiet" type="button" onClick={() => { setFormError(null); setStep((current) => current - 1) }} disabled={formLocked}><LuArrowLeft aria-hidden="true" />Back</button> : <span />}
                {step === 2 && (isSubmitting || pendingOperations.length > 0) ? <button className="button button--quiet report-form__cancel" type="button" disabled>Cancel</button> : null}
                {step === 2 && !isSubmitting && pendingOperations.length === 0 ? <Link className="button button--quiet report-form__cancel" to="/report">{creationOutcomeUnknown ? 'Return to Meeting Reports' : 'Cancel'}</Link> : null}
                <button className="button button--primary" type="submit" disabled={formLocked}>
                  {isSubmitting ? 'Saving…' : step === 0 ? 'Next: Meeting Details' : step === 1 ? 'Next: Report Content' : isEdit ? 'Update Report' : 'Submit Report'}
                  {!isSubmitting && step < 2 ? <LuArrowRight aria-hidden="true" /> : null}
                </button>
              </div>
            </form>
          </>
        ) : null}
      </section>
    </div>
  )
}

function Required() {
  return <span className="required-mark" aria-hidden="true">*</span>
}

function ReadOnlyField({ label, value, required = false, type = 'text' }: { readonly label: string; readonly value: string; readonly required?: boolean; readonly type?: string }) {
  return <label className="field"><span>{label} {required ? <Required /> : null}</span><input aria-label={label} type={type} value={value} readOnly /></label>
}

function SectionHeading({ icon, title, detail, headingRef }: { readonly icon: React.ReactNode; readonly title: string; readonly detail: string; readonly headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  return <header className="report-form__section-heading"><span aria-hidden="true">{icon}</span><div><h2 ref={headingRef} tabIndex={-1}>{title}</h2><p>{detail}</p></div></header>
}
