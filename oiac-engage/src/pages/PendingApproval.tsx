import { useEffect } from 'react'
import { LuClock3 } from 'react-icons/lu'

export default function PendingApproval() {
  useEffect(() => {
    document.title = 'Profile under review — OIAC Engage'
  }, [])

  return (
    <section className="pending-approval-page" aria-labelledby="pending-approval-title">
      <article className="pending-approval-card">
        <div className="pending-approval-card__icon" aria-hidden="true">
          <LuClock3 />
        </div>
        <p className="pending-approval-card__status">Approval pending</p>
        <h1 id="pending-approval-title">Your profile is under review</h1>
        <p>
          Thank you for creating your OIAC Engage account. Our team is reviewing your profile.
          We’ll notify you as soon as your access is approved.
        </p>
        <p className="pending-approval-card__note">
          After approval, sign in again to access the portal.
        </p>
      </article>
    </section>
  )
}
