import { useEffect, useRef, useState } from 'react'
import { LuChevronDown, LuMenu } from 'react-icons/lu'
import { NavLink, useLocation } from 'react-router-dom'
import { getPrimaryRole } from '../auth/authorization'
import type { PortalUser } from '../auth/powerPagesSession'
import ComingSoonBadge from './ComingSoonBadge'

const topLevelLinks = [
  { label: 'Home', to: '/' },
  { label: 'Meeting Report', to: '/report' },
  { label: 'My Calendar', to: '/my-calendar' },
  { label: 'Contact', to: '/contact' },
]

const activityLinks = [
  { label: 'Activity Log', to: '/activity/activity-log', comingSoon: true },
  { label: 'Events', to: '/activity/events', comingSoon: false },
  { label: 'Appointments', to: '/activity/appointments', comingSoon: true },
]

const secondaryLinks = [
  { label: 'Press Coverage', to: '/press-coverage', comingSoon: true },
]

function navClassName({ isActive }: { isActive: boolean }) {
  return isActive ? 'portal-nav__link portal-nav__link--active' : 'portal-nav__link'
}

export default function PortalNav({ user }: { user: PortalUser }) {
  const location = useLocation()
  const activityActive = location.pathname.startsWith('/activity')
  const roleLabel = getPrimaryRole({ status: 'authenticated', user }) ?? 'Authenticated User'
  const [menuOpen, setMenuOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const activityGroup = useRef<HTMLDivElement>(null)
  const accountGroup = useRef<HTMLDivElement>(null)
  const accountButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMenuOpen(false)
    setActivityOpen(false)
    setAccountOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!activityOpen) return

    function closeActivityOnOutsideClick(event: PointerEvent) {
      if (!activityGroup.current?.contains(event.target as Node)) {
        setActivityOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeActivityOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeActivityOnOutsideClick)
  }, [activityOpen])

  useEffect(() => {
    if (!accountOpen) return

    function closeAccountOnOutsideClick(event: PointerEvent) {
      if (!accountGroup.current?.contains(event.target as Node)) setAccountOpen(false)
    }

    function closeAccountOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setAccountOpen(false)
      accountButton.current?.focus()
    }

    document.addEventListener('pointerdown', closeAccountOnOutsideClick)
    document.addEventListener('keydown', closeAccountOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeAccountOnOutsideClick)
      document.removeEventListener('keydown', closeAccountOnEscape)
    }
  }, [accountOpen])

  return (
    <div className="portal-nav">
      <button
        className="portal-nav__menu-toggle"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="portal-navigation-list"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <LuMenu aria-hidden="true" />
        <span>Menu</span>
      </button>

      <div className={menuOpen ? 'portal-nav__items portal-nav__items--open' : 'portal-nav__items'} id="portal-navigation-list">
        <nav className="portal-nav__links" aria-label="Primary navigation">
          {topLevelLinks.map((link) => (
            <NavLink key={link.to} className={navClassName} to={link.to} end={link.to === '/'}>
              {link.label}
            </NavLink>
          ))}

          <div className="portal-nav__group" ref={activityGroup}>
            <button
              className={activityActive ? 'portal-nav__link portal-nav__link--active portal-nav__activity-toggle' : 'portal-nav__link portal-nav__activity-toggle'}
              type="button"
              aria-expanded={activityOpen}
              aria-controls="activity-navigation-list"
              onClick={() => setActivityOpen((open) => !open)}
            >
              <span>Activity</span>
              <LuChevronDown className="portal-nav__chevron" aria-hidden="true" />
            </button>
            {activityOpen ? (
              <div className="portal-nav__submenu" id="activity-navigation-list">
                {activityLinks.map((link) => (
                  link.comingSoon ? (
                    <span
                      key={link.to}
                      className="portal-nav__link portal-nav__link--disabled portal-nav__link--coming-soon"
                      aria-disabled="true"
                    >
                      <span>{link.label}</span>
                      <ComingSoonBadge />
                    </span>
                  ) : (
                    <NavLink
                      key={link.to}
                      className={navClassName}
                      to={link.to}
                      onClick={() => {
                        setActivityOpen(false)
                        setMenuOpen(false)
                      }}
                    >
                      {link.label}
                    </NavLink>
                  )
                ))}
              </div>
            ) : null}
          </div>

          {secondaryLinks.map((link) => (
            link.comingSoon ? (
              <span
                key={link.to}
                className="portal-nav__link portal-nav__link--disabled portal-nav__link--coming-soon"
                aria-disabled="true"
              >
                <span>{link.label}</span>
                <ComingSoonBadge />
              </span>
            ) : (
              <NavLink key={link.to} className={navClassName} to={link.to}>
                {link.label}
              </NavLink>
            )
          ))}
        </nav>

        <div className="portal-nav__account" role="group" aria-label="Account">
          <div className="portal-nav__account-menu" ref={accountGroup}>
            <button
              ref={accountButton}
              className="portal-nav__account-toggle"
              type="button"
              aria-label={`Account menu for ${roleLabel}`}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              aria-controls="portal-account-menu"
              onClick={() => setAccountOpen((open) => !open)}
            >
              <span className="portal-nav__avatar" aria-hidden="true">{roleLabel.charAt(0).toLocaleUpperCase()}</span>
              <span>{roleLabel}</span>
              <LuChevronDown className="portal-nav__account-chevron" aria-hidden="true" />
            </button>

            {accountOpen ? (
              <div className="portal-nav__account-dropdown" id="portal-account-menu" role="menu">
                <NavLink
                  className="portal-nav__account-action"
                  to="/user-profile"
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false)
                    setMenuOpen(false)
                  }}
                >
                  Profile
                </NavLink>
                <a
                  className="portal-nav__account-action"
                  href="/Account/Login/LogOff?returnUrl=%2F"
                  role="menuitem"
                >
                  Sign out
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
