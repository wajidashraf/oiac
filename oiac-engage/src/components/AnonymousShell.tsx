import { useEffect, useRef, type PropsWithChildren } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { buildSignInUrl } from '../auth/signInUrl'

export default function AnonymousShell({ children }: PropsWithChildren) {
  const location = useLocation()
  const previousPath = useRef(location.pathname)

  useEffect(() => {
    if (previousPath.current === location.pathname) return
    previousPath.current = location.pathname

    const heading = document.querySelector<HTMLElement>('#main-content h1')
    if (heading) {
      heading.tabIndex = -1
      heading.focus()
    }
  }, [location.pathname])

  return (
    <div className="portal-shell portal-shell--anonymous">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="anonymous-header">
        <div className="anonymous-header__inner site-container">
          <Link className="anonymous-brand" to="/" aria-label="OIAC Engage home">
            <img src="/logo.png" alt="Organization of Iranian American Communities" width="392" height="154" />
            <span>OIAC Engage</span>
          </Link>
          <a className="button button--primary" href={buildSignInUrl('/')}>Sign In</a>
        </div>
      </header>
      <main className="anonymous-main site-container" id="main-content" tabIndex={-1}>{children}</main>
      <footer className="anonymous-footer">
        <div className="anonymous-footer__inner site-container">
          <div className="anonymous-footer__identity">
            <img src="/logo.png" alt="" width="392" height="154" />
            <span>Organization of Iranian American Communities – U.S.</span>
          </div>
          <nav aria-label="Footer navigation">
            <a href="https://oiac.org/" target="_blank" rel="noreferrer">oiac.org</a>
            <Link to="/resources">Resources</Link>
            <Link to="/contact">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
