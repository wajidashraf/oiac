import { useRef, useState, type FormEvent } from 'react'

type FormValues = {
  name: string
  email: string
  subject: string
  message: string
}

type FormErrors = Partial<Record<keyof FormValues, string>>

const emptyValues: FormValues = { name: '', email: '', subject: '', message: '' }

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {}
  if (!values.name.trim()) errors.name = 'Enter your name.'
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.'
  if (!values.subject.trim()) errors.subject = 'Enter a subject.'
  if (!values.message.trim()) errors.message = 'Enter your message.'
  return errors
}

export default function ContactForm() {
  const [values, setValues] = useState<FormValues>(emptyValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const fieldRefs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    subject: useRef<HTMLInputElement>(null),
    message: useRef<HTMLTextAreaElement>(null),
  }

  function updateField(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitted(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setSubmitted(false)
      const firstInvalidField = (Object.keys(nextErrors) as (keyof FormValues)[])[0]
      fieldRefs[firstInvalidField].current?.focus()
      return
    }
    setSubmitted(true)
    setValues(emptyValues)
  }

  return (
    <form className="contact-form" noValidate onSubmit={handleSubmit}>
      {Object.keys(errors).length > 0 ? <div className="form-alert" role="alert">Review the highlighted fields.</div> : null}
      {submitted ? <div className="form-success" role="status"><strong>Message ready.</strong> This UI preview did not send or store your message.</div> : null}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="contact-name">Name</label>
          <input ref={fieldRefs.name} id="contact-name" name="name" autoComplete="name" required value={values.name} onChange={(event) => updateField('name', event.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'contact-name-error' : undefined} />
          {errors.name ? <span className="field__error" id="contact-name-error">{errors.name}</span> : null}
        </div>
        <div className="field">
          <label htmlFor="contact-email">Email</label>
          <input ref={fieldRefs.email} id="contact-email" name="email" type="email" autoComplete="email" required value={values.email} onChange={(event) => updateField('email', event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'contact-email-error' : undefined} />
          {errors.email ? <span className="field__error" id="contact-email-error">{errors.email}</span> : null}
        </div>
        <div className="field field--full">
          <label htmlFor="contact-subject">Subject</label>
          <input ref={fieldRefs.subject} id="contact-subject" name="subject" autoComplete="off" required value={values.subject} onChange={(event) => updateField('subject', event.target.value)} aria-invalid={Boolean(errors.subject)} aria-describedby={errors.subject ? 'contact-subject-error' : undefined} />
          {errors.subject ? <span className="field__error" id="contact-subject-error">{errors.subject}</span> : null}
        </div>
        <div className="field field--full">
          <label htmlFor="contact-message">Message</label>
          <textarea ref={fieldRefs.message} id="contact-message" name="message" autoComplete="off" required rows={6} value={values.message} onChange={(event) => updateField('message', event.target.value)} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'contact-message-help contact-message-error' : 'contact-message-help'} />
          <span className="field__help" id="contact-message-help">Do not include sensitive personal information in this UI preview.</span>
          {errors.message ? <span className="field__error" id="contact-message-error">{errors.message}</span> : null}
        </div>
      </div>
      <button className="button button--primary" type="submit">Prepare message</button>
    </form>
  )
}
