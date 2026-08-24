import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const topLevelLinks = [
  { label: 'Home', to: '/' },
  { label: 'My Reports', to: '/my-reports' },
  { label: 'My Calendar', to: '/my-calendar' },
]

const activityLinks = [
  { label: 'Activity Log', to: '/activity/activity-log' },
  { label: 'Events', to: '/activity/events' },
  { label: 'Appointments', to: '/activity/appointments' },
]

const secondaryLinks = [
  { label: 'Press Coverage', to: '/press-coverage' },
  { label: 'Contact', to: '/contact' },
]

function navClassName({ isActive }: { isActive: boolean }) {
  return isActive ? 'portal-nav__link portal-nav__link--active' : 'portal-nav__link'
}

export default function PortalNav() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(location.pathname.startsWith('/activity'))

  return (
    <nav className="portal-nav" aria-label="Primary navigation">
      <button
        className="portal-nav__menu-toggle"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="portal-navigation-list"
        onClick={() => setMenuOpen((open) => !open)}
      >
        Menu
      </button>

      <div className={menuOpen ? 'portal-nav__items portal-nav__items--open' : 'portal-nav__items'} id="portal-navigation-list">
        {topLevelLinks.map((link) => (
          <NavLink key={link.to} className={navClassName} to={link.to} end={link.to === '/'}>
            {link.label}
          </NavLink>
        ))}

        <div className="portal-nav__group">
          <button
            className="portal-nav__link portal-nav__activity-toggle"
            type="button"
            aria-expanded={activityOpen}
            aria-controls="activity-navigation-list"
            onClick={() => setActivityOpen((open) => !open)}
          >
            <span>Activity</span>
            <span aria-hidden="true">⌄</span>
          </button>
          {activityOpen ? (
            <div className="portal-nav__submenu" id="activity-navigation-list">
              {activityLinks.map((link) => (
                <NavLink key={link.to} className={navClassName} to={link.to}>
                  {link.label}
                </NavLink>
              ))}
            </div>
          ) : null}
        </div>

        {secondaryLinks.map((link) => (
          <NavLink key={link.to} className={navClassName} to={link.to}>
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
