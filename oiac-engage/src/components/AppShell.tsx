import { useEffect, useRef, type PropsWithChildren } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { PortalUser } from '../auth/powerPagesSession'
import PortalNav from './PortalNav'

type AppShellProps = PropsWithChildren<{ user: PortalUser }>

export default function AppShell({ children, user }: AppShellProps) {
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
    <div className="portal-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <div className="site-header__inner site-container">
          <Link className="site-brand" to="/" aria-label="OIAC Engage home">
            <img className="site-brand__logo" src="/logo.png" alt="" width="392" height="154" />
            <span className="site-brand__wordmark" aria-hidden="true">
              <strong>OIAC Engage</strong>
            </span>
          </Link>
          <PortalNav user={user} />
        </div>
      </header>
      <main className="site-main" id="main-content" tabIndex={-1}>
        <div className="site-container">{children}</div>
      </main>
      <footer className="site-footer">
        <div className="site-footer__inner site-container">
          <div className="site-footer__identity">
            <img src="/logo.png" alt="" width="392" height="154" />
            <span>Organization of Iranian American Communities — U.S.</span>
          </div>
          <nav aria-label="Footer navigation">
            <a href="https://oiac.org">oiac.org</a>
            <Link to="/resources">Resources</Link>
            <Link to="/contact">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
