import { useEffect } from 'react'
import ContactForm from '../components/ContactForm'
import ContentCard from '../components/ContentCard'
import PageHeader from '../components/PageHeader'

export default function Contact() {
  useEffect(() => {
    document.title = 'Contact — OIAC Engage'
  }, [])

  return (
    <div className="page">
      <PageHeader
        eyebrow="Member support"
        title="Contact"
        description="Send a question to the member services team or review the available contact details."
      />
      <div className="contact-layout">
        <ContentCard title="Prepare a message">
          <p className="form-intro">This UI-first form validates your message locally. Delivery will be connected in a later integration phase.</p>
          <ContactForm />
        </ContentCard>
        <aside className="contact-details" aria-labelledby="contact-details-title">
          <h2 id="contact-details-title">Member services</h2>
          <p>For questions about reports, appointments, events, or your member account.</p>
          <dl>
            <div><dt>Email</dt><dd>members@oiac.example</dd></div>
            <div><dt>Hours</dt><dd>Monday–Friday, 9:00 AM–5:00 PM</dd></div>
            <div><dt>Response time</dt><dd>Within two working days</dd></div>
          </dl>
        </aside>
      </div>
    </div>
  )
}
