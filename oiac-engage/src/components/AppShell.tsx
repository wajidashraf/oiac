import type { PropsWithChildren } from 'react'
import { Link } from 'react-router-dom'
import PortalNav from './PortalNav'

export default function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="portal-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="site-brand" to="/" aria-label="OIAC Engage home">
            <span className="site-brand__mark" aria-hidden="true">OE</span>
            <span>OIAC Engage</span>
          </Link>
          <PortalNav />
        </div>
      </header>
      <main className="site-main" id="main-content">{children}</main>
      <footer className="site-footer">
        <p>OIAC Engage · Member portal</p>
      </footer>
    </div>
  )
}
