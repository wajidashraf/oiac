# Three-Zone Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the authenticated header into intrinsic brand and account zones with a flexible, centered, space-between navigation zone.

**Architecture:** Keep `AppShell` responsible for the brand and header container. Refactor `PortalNav` so its responsive panel contains a semantic Primary navigation section and a distinct account section; CSS grid makes navigation flexible and account intrinsic on desktop, then stacks both inside the existing mobile panel.

**Tech Stack:** React 19, React Router, CSS Grid/Flexbox, Vitest, Testing Library, Playwright.

## Global Constraints

- Preserve the user's current logo, typography, colors, navigation destinations, Activity behavior, role badge, and Sign Out destination.
- Desktop columns behave as `max-content minmax(0, 1fr) max-content` across the brand, navigation, and account zones.
- The navigation group is centered within the flexible middle zone and distributes links with `space-between`.
- Mobile keeps navigation and account controls available through Menu without horizontal overflow.
- Scoped header styles must resist Power Pages global theme overrides.

---

### Task 1: Header zones and responsive behavior

**Files:**
- Modify: `src/components/PortalNav.test.tsx`
- Modify: `src/components/PortalNav.tsx`
- Modify: `src/styles/theme.css`
- Create: `scripts/verify-header-layout.mjs`

**Interfaces:**
- Consumes: existing `PortalNav()` API with no props and existing routes.
- Produces: `.portal-nav__links` flexible navigation zone and `.portal-nav__account` intrinsic account zone inside `.portal-nav__items`.

- [ ] **Step 1: Write the failing component test**

Add assertions that the Primary navigation contains the route links but not `Volunteer` or `Sign out`, and that an accessible `Account` group contains the role label and Sign Out link.

```tsx
const primary = screen.getByRole('navigation', { name: 'Primary navigation' })
expect(within(primary).getByRole('link', { name: 'Home' })).toBeInTheDocument()
expect(within(primary).queryByText('Volunteer')).not.toBeInTheDocument()
const account = screen.getByRole('group', { name: 'Account' })
expect(within(account).getByText('Volunteer')).toBeInTheDocument()
expect(within(account).getByRole('link', { name: 'Sign out' })).toBeInTheDocument()
```

- [ ] **Step 2: Run the focused test and verify RED**

Run `npm test -- src/components/PortalNav.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose` and expect failure because the current `nav` contains the account controls and no Account group exists.

- [ ] **Step 3: Implement the semantic zones**

Change the `PortalNav` root to a wrapper, keep the Menu button, and structure the panel as:

```tsx
<div className="portal-nav">
  <button className="portal-nav__menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="portal-navigation-list" onClick={() => setMenuOpen((open) => !open)}>
    <LuMenu aria-hidden="true" />
    <span>Menu</span>
  </button>
  <div className="portal-nav__items">
    <nav className="portal-nav__links" aria-label="Primary navigation">
      {topLevelLinks.map((link) => <NavLink key={link.to} className={navClassName} to={link.to} end={link.to === '/'}>{link.label}</NavLink>)}
      <div className="portal-nav__group">
        <button className={activityActive ? 'portal-nav__link portal-nav__link--active portal-nav__activity-toggle' : 'portal-nav__link portal-nav__activity-toggle'} type="button" aria-expanded={activityOpen} aria-controls="activity-navigation-list" onClick={() => setActivityOpen((open) => !open)}>
          <span>Activity</span><LuChevronDown className="portal-nav__chevron" aria-hidden="true" />
        </button>
        {activityOpen ? <div className="portal-nav__submenu" id="activity-navigation-list">{activityLinks.map((link) => <NavLink key={link.to} className={navClassName} to={link.to}>{link.label}</NavLink>)}</div> : null}
      </div>
      {secondaryLinks.map((link) => <NavLink key={link.to} className={navClassName} to={link.to}>{link.label}</NavLink>)}
    </nav>
    <div className="portal-nav__account" role="group" aria-label="Account">
      <span className="portal-nav__user"><span className="portal-nav__avatar" aria-hidden="true">V</span><span>Volunteer</span></span>
      <a className="portal-nav__signin" href="/Account/Login/LogOff?returnUrl=%2F"><span>Sign out</span></a>
    </div>
  </div>
</div>
```

Preserve all existing route mapping and state handlers.

- [ ] **Step 4: Implement desktop and mobile CSS**

Use a flexible header and nested grid:

```css
.site-header__inner { display: grid; grid-template-columns: max-content minmax(0, 1fr); }
.portal-nav__items { display: grid; grid-template-columns: minmax(0, 1fr) max-content; }
.portal-nav__links { width: min(100%, 47rem); justify-self: center; justify-content: space-between; }
.portal-nav__account { width: max-content; }
```

At `max-width: 64rem`, retain the existing Menu panel and stack `.portal-nav__links` and `.portal-nav__account` at full width.

- [ ] **Step 5: Run the focused component test and verify GREEN**

Run the same focused Vitest command and expect all PortalNav tests to pass.

- [ ] **Step 6: Add and run browser verification**

Create `scripts/verify-header-layout.mjs` using Vite and Playwright. At desktop, assert brand/account widths fit their content, navigation width is larger, nav midpoint is aligned with its section midpoint, links use `space-between`, and page overflow is zero. Inject hostile global `header`, `nav`, `a`, and `button` styles and assert scoped computed styles remain. At mobile, open Menu and assert Primary navigation, Account group, role, and Sign Out are visible with zero page overflow.

- [ ] **Step 7: Run full verification**

Run:

```text
npm test -- --no-file-parallelism --maxWorkers=1
node scripts/verify-header-layout.mjs
npm run build
```

Expected: 27 test files pass, browser verification exits 0 for desktop and mobile, and Vite production build exits 0.

- [ ] **Step 8: Commit only header implementation files**

```text
git add src/components/PortalNav.test.tsx src/components/PortalNav.tsx src/styles/theme.css scripts/verify-header-layout.mjs
git commit -m "feat: split header into three responsive zones"
```
