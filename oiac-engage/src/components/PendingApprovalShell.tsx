import { useEffect, useRef, type PropsWithChildren } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function PendingApprovalShell({ children }: PropsWithChildren) {
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
    <div className="portal-shell portal-shell--pending">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="pending-header">
        <div className="pending-header__inner site-container">
          <Link
            className="pending-header__brand"
            to="/pending-approval"
            aria-label="OIAC Engage pending approval"
          >
            <img src="/logo.png" alt="" width="392" height="154" />
            <span aria-hidden="true">OIAC Engage</span>
          </Link>
          <a
            className="pending-header__signout"
            href="/Account/Login/LogOff?returnUrl=%2F"
          >
            Sign Out
          </a>
        </div>
      </header>
      <main className="pending-main" id="main-content" tabIndex={-1}>
        <div className="site-container">{children}</div>
      </main>
    </div>
  )
}
