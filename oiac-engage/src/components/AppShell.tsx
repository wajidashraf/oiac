import { useEffect, useRef, type PropsWithChildren } from 'react'
import { Link, useLocation } from 'react-router-dom'
import PortalNav from './PortalNav'

export default function AppShell({ children }: PropsWithChildren) {
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
        <div className="site-header__inner">
          <Link className="site-brand" to="/" aria-label="OIAC Engage home">
            <span className="site-brand__mark" aria-hidden="true">OE</span>
            <span>OIAC Engage</span>
          </Link>
          <PortalNav />
        </div>
      </header>
      <main className="site-main" id="main-content" tabIndex={-1}>{children}</main>
      <footer className="site-footer">
        <p>OIAC Engage · Member portal</p>
      </footer>
    </div>
  )
}
