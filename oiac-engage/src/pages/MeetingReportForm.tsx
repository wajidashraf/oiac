import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  LuArrowLeft,
  LuArrowRight,
  LuCalendarDays,
  LuCheck,
  LuChevronLeft,
  LuFileText,
  LuInfo,
  LuUserRound,
} from 'react-icons/lu'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { meetingReports } from '../data/dashboardData'

const steps = [
  { label: 'Your Info', icon: LuUserRound },
  { label: 'Meeting', icon: LuCalendarDays },
  { label: 'Report', icon: LuFileText },
] as const

type ReportFormData = {
  fullName: string
  email: string
  state: string
  city: string
  meeting: string
  representative: string
  date: string
  district: string
  relatedEvent: string
  meetingFormat: string
  staffMembers: string
  volunteers: string
  issuesDiscussed: string
  outcomesNextSteps: string
  followUpActions: string
  sentiment: string
}

function createInitialForm(reportId?: string): ReportFormData {
  const report = meetingReports.find((item) => item.id === reportId)

  return {
    fullName: 'Sara Rahimi',
    email: 'sara.rahimi@email.com',
    state: 'DC',
    city: 'Washington',
    meeting: report?.meeting ?? '',
    representative: report?.representative ?? '',
    date: report?.dateTime ?? '',
    district: '',
    relatedEvent: '',
    meetingFormat: '',
    staffMembers: '',
    volunteers: '',
    issuesDiscussed: '',
    outcomesNextSteps: '',
    followUpActions: '',
    sentiment: report?.outcome ?? '',
  }
}

const meetingFormats = [
  { value: 'In-person', icon: '🏛️', detail: 'Capitol Hill' },
  { value: 'Teams', icon: '💻', detail: 'Microsoft Teams' },
  { value: 'Phone', icon: '📞', detail: 'Phone Call' },
  { value: 'District', icon: '🏢', detail: 'District Office' },
  { value: 'Other', icon: '📋', detail: 'Other format' },
] as const

const sentiments = [
  { value: 'Very Supportive', symbol: '★★★' },
  { value: 'Supportive', symbol: '★★☆' },
  { value: 'Neutral', symbol: '★☆☆' },
  { value: 'Non-committal', symbol: '◐○○' },
  { value: 'Opposed', symbol: '✕✕✕' },
] as const

export default function MeetingReportForm() {
  const { reportId } = useParams()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<ReportFormData>(() => createInitialForm(reportId))
  const sectionHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    document.title = `${reportId ? 'Edit' : 'New'} Meeting Report — OIAC Engage`
  }, [reportId])

  useEffect(() => {
    if (step > 0) sectionHeading.current?.focus()
  }, [step])

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function continueForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step < steps.length - 1) {
      setStep((current) => current + 1)
      return
    }
    navigate('/report', { state: { reportSaved: true } })
  }

  return (
    <div className="page page--meeting-report page--report-form">
      <Link className="report-page__back" to="/report">
        <LuChevronLeft aria-hidden="true" />
        <span>Back</span>
      </Link>

      <header className="report-page__header">
        <div>
          <h1>Meeting Reports</h1>
          <p>Submit and track your congressional and organizational meeting reports.</p>
        </div>
      </header>

      <section className="report-form-card" aria-label={reportId ? 'Edit meeting report' : 'New meeting report'}>
        <ol className="report-stepper" aria-label="Report progress">
          {steps.map(({ label, icon: Icon }, index) => (
            <li
              className={index <= step ? 'report-stepper__step report-stepper__step--reached' : 'report-stepper__step'}
              key={label}
              aria-current={index === step ? 'step' : undefined}
            >
              <span className="report-stepper__icon" aria-hidden="true">
                {index < step ? <LuCheck /> : <Icon />}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        <form className="report-form" onSubmit={continueForm}>
          {step === 0 ? (
            <div className="report-form__step">
              <header className="report-form__section-heading">
                <span aria-hidden="true"><LuUserRound /></span>
                <div>
                  <h2 ref={sectionHeading} tabIndex={-1}>Volunteer Information</h2>
                  <p>Confirm your details — pre-filled from your profile</p>
                </div>
              </header>
              <div className="form-grid report-form__grid">
                <label className="field">
                  <span>Full Name <span className="required-mark" aria-hidden="true">*</span></span>
                  <input aria-label="Full Name" name="fullName" value={form.fullName} onChange={updateField} required />
                </label>
                <label className="field">
                  <span>Email <span className="required-mark" aria-hidden="true">*</span></span>
                  <input aria-label="Email" name="email" type="email" value={form.email} onChange={updateField} required />
                </label>
                <label className="field">
                  <span>State</span>
                  <input name="state" value={form.state} onChange={updateField} />
                </label>
                <label className="field">
                  <span>City</span>
                  <input name="city" value={form.city} onChange={updateField} />
                </label>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="report-form__step">
              <header className="report-form__section-heading">
                <span aria-hidden="true"><LuCalendarDays /></span>
                <div>
                  <h2 ref={sectionHeading} tabIndex={-1}>Meeting Details</h2>
                  <p>Who did you meet with and how?</p>
                </div>
              </header>
              <div className="form-grid report-form__grid">
                <label className="field field--full">
                  <span>Meeting Title <span className="required-mark" aria-hidden="true">*</span></span>
                  <input aria-label="Meeting Title" name="meeting" placeholder="e.g. Advocacy meeting with Sen. Miller's office" value={form.meeting} onChange={updateField} required />
                </label>
                <label className="field">
                  <span>Date of Meeting <span className="required-mark" aria-hidden="true">*</span></span>
                  <input aria-label="Date of Meeting" name="date" type="date" value={form.date} onChange={updateField} required />
                </label>
                <label className="field">
                  <span>Representative / Office <span className="required-mark" aria-hidden="true">*</span></span>
                  <input aria-label="Representative / Office" name="representative" placeholder="Name of senator, representative, or staff" value={form.representative} onChange={updateField} required />
                </label>
                <label className="field">
                  <span>State / District</span>
                  <input aria-label="State / District" name="district" placeholder="e.g. DC / Virginia" value={form.district} onChange={updateField} />
                </label>
                <label className="field">
                  <span>Related Event</span>
                  <input aria-label="Related Event" name="relatedEvent" placeholder="Search or link an event..." value={form.relatedEvent} onChange={updateField} />
                </label>
                <fieldset className="report-choice-field field--full">
                  <legend>Meeting Format</legend>
                  <div className="report-choice-grid report-choice-grid--formats">
                    {meetingFormats.map((format) => (
                      <label className="report-choice" key={format.value}>
                        <input type="radio" name="meetingFormat" value={format.value} checked={form.meetingFormat === format.value} onChange={updateField} />
                        <span className="report-choice__symbol" aria-hidden="true">{format.icon}</span>
                        <strong>{format.value}</strong>
                        <small>{format.detail}</small>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="field field--full">
                  <span>Tag OIAC Staff Members</span>
                  <input aria-label="Tag OIAC Staff Members" name="staffMembers" placeholder="Search and select..." value={form.staffMembers} onChange={updateField} />
                </label>
                <label className="field field--full">
                  <span>Tag Volunteers</span>
                  <input aria-label="Tag Volunteers" name="volunteers" placeholder="Search and select..." value={form.volunteers} onChange={updateField} />
                </label>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="report-form__step">
              <header className="report-form__section-heading">
                <span aria-hidden="true"><LuFileText /></span>
                <div>
                  <h2 ref={sectionHeading} tabIndex={-1}>Report Content</h2>
                  <p>Summarize what was discussed and what happens next</p>
                </div>
              </header>
              <div className="form-grid report-form__grid">
                <label className="field field--full">
                  <span>Issues Discussed <span className="required-mark" aria-hidden="true">*</span></span>
                  <textarea aria-label="Issues Discussed" name="issuesDiscussed" rows={5} placeholder="Describe the main topics and issues discussed..." value={form.issuesDiscussed} onChange={updateField} required />
                </label>
                <label className="field field--full">
                  <span>Outcomes &amp; Next Steps</span>
                  <textarea aria-label="Outcomes & Next Steps" name="outcomesNextSteps" rows={4} placeholder="What was the response? What are the agreed next steps?" value={form.outcomesNextSteps} onChange={updateField} />
                </label>
                <label className="field field--full">
                  <span>Follow-up Actions</span>
                  <textarea aria-label="Follow-up Actions" name="followUpActions" rows={3} placeholder="Materials to send, follow-up calls, commitments made..." value={form.followUpActions} onChange={updateField} />
                </label>
                <fieldset className="report-choice-field field--full">
                  <legend>Overall Sentiment</legend>
                  <div className="report-choice-grid report-choice-grid--sentiments">
                    {sentiments.map((sentiment) => (
                      <label className={`report-choice report-choice--sentiment report-choice--${sentiment.value.toLowerCase().replace(/[^a-z]+/g, '-')}`} key={sentiment.value}>
                        <input type="radio" name="sentiment" value={sentiment.value} checked={form.sentiment === sentiment.value} onChange={updateField} />
                        <span className="report-choice__rating" aria-hidden="true">{sentiment.symbol}</span>
                        <strong>{sentiment.value}</strong>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <p className="report-form__notice field--full"><LuInfo aria-hidden="true" /> This report syncs to Power Pages and confirmed appointments will also appear in your Outlook calendar.</p>
              </div>
            </div>
          ) : null}

          <div className="report-form__actions">
            {step > 0 ? (
              <button className="button button--quiet" type="button" onClick={() => setStep((current) => current - 1)}>
                <LuArrowLeft aria-hidden="true" />
                Back
              </button>
            ) : <span />}
            {step === 2 ? <Link className="button button--quiet report-form__cancel" to="/report">Cancel</Link> : null}
            <button className="button button--primary" type="submit">
              {step === 0 ? 'Next: Meeting Details' : null}
              {step === 1 ? 'Next: Report Content' : null}
              {step === 2 ? 'Submit Report' : <LuArrowRight aria-hidden="true" />}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
