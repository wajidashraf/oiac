# OIAC Engage React SPA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a theme-ready React Power Pages SPA starter for authenticated external members with eight requested pages and nested Activity navigation.

**Architecture:** A Vite React application uses React Router for client-side routes and a shared `AppShell` for semantic layout and responsive navigation. Page modules render realistic static UI through focused reusable primitives; live authentication, Dataverse calls, and final OIAC branding remain behind future provider and service boundaries.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, React Router 7, Vitest, Testing Library, CSS custom properties, axe-core/Playwright accessibility audit.

## Global Constraints

- Create the project at `oiac-engage/` in the current workspace.
- Keep every route accessible during development; authentication is deferred.
- Use local static data only; Dataverse and other live integrations are deferred.
- Provide useful static UI structures rather than empty page placeholders.
- Keep styles minimal, accessible, responsive, and replaceable by the existing OIAC theme.
- Use `/activity` only as a redirect to `/activity/activity-log`.
- Do not deploy until the user approves the running local site.

## File map

- `oiac-engage/src/App.tsx`: route table and fallback route.
- `oiac-engage/src/components/AppShell.tsx`: shared semantic layout.
- `oiac-engage/src/components/PortalNav.tsx`: responsive top-level and nested Activity navigation.
- `oiac-engage/src/components/PageHeader.tsx`: page heading contract.
- `oiac-engage/src/components/ContentCard.tsx`: reusable content surface.
- `oiac-engage/src/components/StatusBadge.tsx`: accessible status label.
- `oiac-engage/src/pages/*.tsx`: one route component per page plus `NotFound`.
- `oiac-engage/src/data/portalData.ts`: typed static reports, agenda, activity, events, appointments, and press records.
- `oiac-engage/src/styles/theme.css`: replaceable design tokens, responsive layout, focus, and reduced-motion rules.
- `oiac-engage/src/test/setup.ts`: DOM test setup.
- `oiac-engage/src/**/*.test.tsx`: route, navigation, page, and form behavior tests.

---

### Task 1: Scaffold and test infrastructure

**Files:**
- Create: `oiac-engage/` from the Power Pages React asset template
- Modify: `oiac-engage/package.json`
- Create: `oiac-engage/src/test/setup.ts`
- Create: `oiac-engage/src/App.test.tsx`

**Interfaces:**
- Consumes: Power Pages React scaffold placeholders `__SITE_NAME__`, `__SITE_SLUG__`, and `__SITE_DESCRIPTION__`.
- Produces: `npm run dev`, `npm run build`, and `npm test`; a mountable `App` component.

- [ ] Copy the React scaffold, replace placeholders with `OIAC Engage`, `oiac-engage`, and `A member engagement portal for reports, calendars, activities, appointments, and press coverage`, rename `gitignore` to `.gitignore`, and copy the shared Power Pages icon.
- [ ] Add scripts `"test": "vitest run"` and `"test:watch": "vitest"`; add Vitest, jsdom, `@testing-library/react`, `@testing-library/jest-dom`, and `@testing-library/user-event` as development dependencies.
- [ ] Add `src/test/setup.ts` containing `import '@testing-library/jest-dom/vitest'` and configure Vitest for jsdom with that setup file.
- [ ] Add a smoke test that renders `<App />` inside `MemoryRouter` and expects `screen.getByRole('heading', { name: /oiac engage/i })`.
- [ ] Run `npm test`; expect the smoke test to fail until the scaffold Home heading is available, then confirm it passes.
- [ ] Run `npm run build`; expect a successful TypeScript and Vite build.
- [ ] Commit with `Initial scaffold: OIAC Engage (React)`.

### Task 2: Shared portal shell and route contract

**Files:**
- Create: `oiac-engage/src/components/AppShell.tsx`
- Create: `oiac-engage/src/components/PortalNav.tsx`
- Create: `oiac-engage/src/components/PageHeader.tsx`
- Create: `oiac-engage/src/components/ContentCard.tsx`
- Create: `oiac-engage/src/components/StatusBadge.tsx`
- Create: `oiac-engage/src/components/PortalNav.test.tsx`
- Modify: `oiac-engage/src/App.tsx`

**Interfaces:**
- Produces: `AppShell({ children }: PropsWithChildren)`, `PortalNav()`, `PageHeader({ eyebrow?, title, description? })`, `ContentCard({ title, children, meta? })`, and `StatusBadge({ children, tone? })`.

- [ ] Write a navigation test expecting links for Home, My Reports, My Calendar, Contact, Press Coverage, and an Activity toggle exposing Activity Log, Events, and Appointments.
- [ ] Run the navigation test and confirm it fails because `PortalNav` does not exist.
- [ ] Implement the components with semantic `header`, `nav`, `main`, and `footer` landmarks; make the Activity toggle a real button with `aria-expanded` and `aria-controls`.
- [ ] Replace the scaffold layout usage in `App.tsx` with `AppShell` and register all final route paths, `/activity` redirect, and wildcard fallback imports.
- [ ] Run the navigation and smoke tests; expect both to pass.
- [ ] Commit shared components individually, then commit routing and navigation changes.

### Task 3: Static data contracts

**Files:**
- Create: `oiac-engage/src/data/portalData.ts`
- Create: `oiac-engage/src/data/portalData.test.ts`

**Interfaces:**
- Produces: typed exports `reports`, `agendaItems`, `activityItems`, `events`, `appointments`, and `pressCoverage` with stable `id` fields.

- [ ] Write tests asserting every collection has at least two records, unique IDs, and the display fields required by its page.
- [ ] Run the data tests and confirm failure because the module does not exist.
- [ ] Implement readonly TypeScript types and representative records for each collection.
- [ ] Run the data tests and expect them to pass.
- [ ] Commit with `Add static portal data contracts`.

### Task 4: Home page

**Files:**
- Replace: `oiac-engage/src/pages/Home.tsx`
- Create: `oiac-engage/src/pages/Home.test.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `ContentCard`, and summary counts from `portalData`.
- Produces: Home route UI and document title `OIAC Engage`.

- [ ] Write a route test expecting the welcome heading, shortcut links to Reports and Calendar, and an activity overview.
- [ ] Run the test and confirm it fails against the scaffold loader.
- [ ] Implement the member welcome, three portal shortcuts, and concise static overview; set the title on mount.
- [ ] Run the test and expect it to pass.
- [ ] Commit with `Add Home page`.

### Task 5: My Reports and My Calendar pages

**Files:**
- Create: `oiac-engage/src/pages/MyReports.tsx`
- Create: `oiac-engage/src/pages/MyCalendar.tsx`
- Create: `oiac-engage/src/pages/MyReports.test.tsx`
- Create: `oiac-engage/src/pages/MyCalendar.test.tsx`

**Interfaces:**
- Consumes: `reports`, `agendaItems`, `ContentCard`, and `StatusBadge`.
- Produces: report-list and agenda UIs with page-specific document titles.

- [ ] Write the Reports test expecting a `My Reports` heading, report titles, and statuses; run it and confirm failure.
- [ ] Implement report summary cards and a semantic report list; run the Reports test and expect success; commit `Add My Reports page`.
- [ ] Write the Calendar test expecting a `My Calendar` heading and dated agenda entries; run it and confirm failure.
- [ ] Implement an agenda-led calendar structure with upcoming items; run the Calendar test and expect success; commit `Add My Calendar page`.

### Task 6: Activity Log, Events, and Appointments pages

**Files:**
- Create: `oiac-engage/src/pages/ActivityLog.tsx`
- Create: `oiac-engage/src/pages/Events.tsx`
- Create: `oiac-engage/src/pages/Appointments.tsx`
- Create: `oiac-engage/src/pages/ActivityRoutes.test.tsx`

**Interfaces:**
- Consumes: `activityItems`, `events`, `appointments`, `ContentCard`, and `StatusBadge`.
- Produces: three nested Activity route UIs and titles.

- [ ] Write parameterized route tests that render each Activity URL and expect its unique heading and representative static record; confirm all three fail.
- [ ] Implement the chronological Activity Log with a static filter control; run its test and commit `Add Activity Log page`.
- [ ] Implement upcoming and past event sections; run its test and commit `Add Events page`.
- [ ] Implement appointment summaries and appointment list actions rendered as non-submitting buttons; run its test and commit `Add Appointments page`.
- [ ] Render `/activity`, assert navigation lands on Activity Log, and expect the redirect assertion to pass.

### Task 7: Press Coverage page

**Files:**
- Create: `oiac-engage/src/pages/PressCoverage.tsx`
- Create: `oiac-engage/src/pages/PressCoverage.test.tsx`

**Interfaces:**
- Consumes: `pressCoverage` and `ContentCard`.
- Produces: `/press-coverage` list UI and document title `Press Coverage — OIAC Engage`.

- [ ] Write a test expecting the `Press Coverage` heading plus publication, date, headline, and summary content; confirm it fails.
- [ ] Implement an accessible article list with external-link affordances that do not depend on network access during tests.
- [ ] Run the test and expect it to pass.
- [ ] Commit with `Add Press Coverage page`.

### Task 8: Contact form behavior

**Files:**
- Create: `oiac-engage/src/pages/Contact.tsx`
- Create: `oiac-engage/src/components/ContactForm.tsx`
- Create: `oiac-engage/src/components/ContactForm.test.tsx`

**Interfaces:**
- Produces: `ContactForm()` with controlled `name`, `email`, `subject`, and `message` fields, inline errors, and local success feedback.

- [ ] Write a user-event test that submits empty fields and expects associated validation messages, then fills valid values and expects `Message ready` local confirmation.
- [ ] Run the test and confirm it fails because `ContactForm` does not exist.
- [ ] Implement labeled controls, field-level validation, an error summary announced with `role="alert"`, and a local-only successful state that retains no backend data.
- [ ] Implement the Contact page around the form and set `Contact — OIAC Engage` as its title.
- [ ] Run the form test and expect it to pass.
- [ ] Commit the form and Contact page separately.

### Task 9: Not-found route and theme-ready styling

**Files:**
- Create: `oiac-engage/src/pages/NotFound.tsx`
- Replace: `oiac-engage/src/styles/theme.css`
- Modify: `oiac-engage/index.html`
- Create: `oiac-engage/src/pages/NotFound.test.tsx`

**Interfaces:**
- Consumes: all shared component class names.
- Produces: wildcard route recovery and the replaceable CSS token contract.

- [ ] Write a test rendering an unknown route and expecting a `Page not found` heading and Home link; confirm failure.
- [ ] Implement `NotFound` and run its test; commit `Add not-found route`.
- [ ] Rewrite CSS with named tokens for color, typography, spacing, radius, shadow, focus, breakpoints, and reduced motion; provide wide and narrow navigation layouts without introducing OIAC branding.
- [ ] Set `lang="en"`, the OIAC Engage description, and a suitable initial title in `index.html`.
- [ ] Run the complete unit suite and production build; expect success.
- [ ] Commit with `Add accessible theme-ready styling`.

### Task 10: Runtime and accessibility verification

**Files:**
- Delete: `oiac-engage/public/scaffold-status.json` after the real Home page is active
- Modify only files implicated by verification findings.

**Interfaces:**
- Consumes: the running Vite server and all eight public routes.
- Produces: verified SPA bundle with zero critical or serious axe findings.

- [ ] Start `npm run dev`, open the reported local URL, and verify the Home page accessibility tree.
- [ ] Navigate through `/`, `/my-reports`, `/my-calendar`, `/contact`, `/activity/activity-log`, `/activity/events`, `/activity/appointments`, and `/press-coverage`; verify headings, landmarks, links, and titles.
- [ ] Install Playwright as a development dependency and run the Power Pages `axe-audit.js` script across all eight routes.
- [ ] Fix each concrete violation in its owning component and rerun unit, build, and axe checks until there are zero critical and serious violations.
- [ ] Remove the scaffold status file, rerun `npm test` and `npm run build`, and commit `Verify OIAC Engage accessibility and build`.
- [ ] Share the local URL for user review; request changes or approval before offering Power Pages deployment.
