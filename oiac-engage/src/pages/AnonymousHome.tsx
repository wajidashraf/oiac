import { useEffect } from 'react'
import { LuArrowRight } from 'react-icons/lu'
import { buildSignInUrl } from '../auth/signInUrl'

export default function AnonymousHome() {
  useEffect(() => {
    document.title = 'OIAC Engage'
  }, [])

  return (
    <section className="anonymous-hero" aria-labelledby="anonymous-hero-title">
      <div className="anonymous-hero__copy">
        <p className="anonymous-hero__eyebrow">Welcome to</p>
        <h1 id="anonymous-hero-title">OIAC Engage</h1>
        <p>The Organization of Iranian American Communities' secure portal for volunteers, members, and advocates.</p>
      </div>
      <a className="anonymous-hero__action" href={buildSignInUrl('/')}>
        <span>Sign In to Get Started</span><LuArrowRight aria-hidden="true" />
      </a>
    </section>
  )
}
