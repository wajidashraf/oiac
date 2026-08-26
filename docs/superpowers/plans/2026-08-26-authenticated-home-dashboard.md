# Authenticated Home Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the authenticated homepage with the responsive volunteer dashboard shown in `oiac-engage/homepageContent.png`, and route both Submit Report and Edit actions to one authenticated `/report` placeholder.

**Architecture:** The existing authenticated `AppShell`, navigation, footer, and anonymous branch remain intact. Typed static dashboard fixtures live in a focused data module, while `Home` composes semantic sections, tables, and existing internal routes. A small `Report` page reserves the shared authenticated route until its separate design is supplied.

**Tech Stack:** React 19, TypeScript 5.7, React Router 7, CSS, Vitest, Testing Library, Playwright/axe.

## Global Constraints

- Work directly on `master`, as explicitly requested by the user.
- Authenticated `/` changes; anonymous `/` remains unchanged.
- Both `+ Submit Report` and every Meeting Reports `Edit` action navigate to `/report` without IDs, query strings, or edit state.
- The Report page remains a minimal authenticated placeholder pending a separate design.
- Reuse the current OIAC palette, Source Serif 4/Inter typography, header, navigation, footer, and sign-out behavior.
- Use semantic tables, visible focus states, text status labels, stable React keys, and at least 44px interactive targets.
- Keep mobile tables inside keyboard-reachable horizontal overflow containers without page-level overflow.
- Do not add dependencies, network requests, backend integration, or deployment changes.

## Design Translation

- **Palette:** OIAC ink `#1a1f1e`, primary green-gray `#596e6a`, strong green-gray `#3d4e4b`, mist `#eef1f0`, page `#f9fafa`, surface `#ffffff`, border `#dde3e2`.
- **Type:** Source Serif 4 for the Volunteer identity and section headings; Inter for metrics, tables, labels, controls, and supporting content.
- **Layout:** compact centered 1180px workspace with a four-card metric row, full-width tables, and three-column operational/resource grids.
- **Signature:** the wide mist-colored Volunteer identity banner with a custom inline handshake mark and wrapping shortcut pills.
- **Self-critique:** omit generic gradients, oversized KPI decoration, and decorative animation. The supplied design is an operational workspace; visual distinction comes from the role banner and disciplined information density.

```text
┌ Volunteer banner                         shortcut pills ┐
├ metric ───── metric ───── metric ───── metric ─────────┤
├ Meeting Reports                          Submit Report ─┤
│ semantic table                                          │
├ Upcoming Events ┬ Meeting Invites ┬ Announcements ─────┤
│                 │                 ├ Training Resources  │
├ Teams & Resources                        Managed by Admin│
│ Meetings       │ Channels        │ Documents            │
├ Volunteer Submissions semantic table                   ─┤
```

---

### Task 1: Define typed dashboard preview data

**Files:**
- Create: `oiac-engage/src/data/dashboardData.ts`

**Interfaces:**
- Produces: `DashboardMetric`, `MeetingReport`, `DashboardEvent`, `MeetingInvite`, `DashboardAnnouncement`, `DashboardResource`, `TeamResourceGroup`, `VolunteerSubmission` and their readonly fixture arrays.
- Consumes: no runtime dependencies.

- [ ] **Step 1: Define the exact dashboard contracts and fixtures**

Create the module with readonly records matching the supplied reference:

```ts
export type DashboardMetric = { id: string; value: number; label: string }
export type MeetingReport = { id: string; meeting: string; representative: string; date: string; outcome: string }
export type DashboardEvent = { id: string; day: string; month: string; title: string }
export type MeetingInvite = { id: string; title: string; schedule: string; status: 'Pending' | 'Accepted' }
export type DashboardAnnouncement = { id: string; title: string; timestamp: string }
export type DashboardResource = { id: string; title: string; href: string }
export type TeamResourceItem = { id: string; title: string; detail: string; action: 'Join' | 'Open'; href: string }
export type TeamResourceGroup = { id: string; title: string; marker: string; items: readonly TeamResourceItem[] }
export type VolunteerSubmission = { id: string; type: 'Email' | 'Appointment' | 'Event Participation'; subject: string; date: string; status: 'Submitted' | 'Confirmed' | 'Completed' }
```

Populate values from `homepageContent.png`, including metrics `12`, `3`, `5`, `28`; the three meeting reports; three upcoming events; three invitations; three announcements; three training resources; the three Teams/resource groups; and three volunteer submissions. Existing internal destinations are `/activity/activity-log`, `/activity/events`, `/activity/appointments`, `/resources`, and `/my-calendar`.

- [ ] **Step 2: Type-check the data module through the production build**

Run: `npm run build`

Expected: exit `0`; all literal status/action values satisfy their unions.

- [ ] **Step 3: Commit the focused data module**

```powershell
git add -- oiac-engage/src/data/dashboardData.ts
git commit -m "Add volunteer dashboard preview data"
```

### Task 2: Replace authenticated Home with the volunteer dashboard

**Files:**
- Modify: `oiac-engage/src/pages/Home.test.tsx`
- Modify: `oiac-engage/src/pages/Home.tsx`

**Interfaces:**
- Consumes: every readonly fixture array from `../data/dashboardData`; React Router `Link`; existing `ContentCard` and `StatusBadge` components.
- Produces: authenticated dashboard DOM with a level-one `Volunteer` heading, named sections, two semantic tables, and report links whose exact href is `/report`.

- [ ] **Step 1: Replace the obsolete Home tests with failing dashboard behavior tests**

Test real rendered behavior:

```tsx
test('renders the volunteer dashboard and its operational sections', () => {
  render(<MemoryRouter><Home /></MemoryRouter>)

  expect(screen.getByRole('heading', { name: 'Volunteer', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Volunteer summary' })).toHaveTextContent('12')
  expect(screen.getByRole('heading', { name: 'Meeting Reports' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Upcoming Events' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Meeting Invites' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Teams Announcements' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Training Resources' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Teams & Resources' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Volunteer Submissions' })).toBeInTheDocument()
  expect(document.title).toBe('Volunteer Dashboard — OIAC Engage')
})

test('routes submit and every report edit action to the shared report page', () => {
  render(<MemoryRouter><Home /></MemoryRouter>)

  expect(screen.getByRole('link', { name: '+ Submit Report' })).toHaveAttribute('href', '/report')
  const editLinks = screen.getAllByRole('link', { name: /^Edit / })
  expect(editLinks).toHaveLength(3)
  editLinks.forEach((link) => expect(link).toHaveAttribute('href', '/report'))
})
```

Also assert the Meeting Reports table exposes column headers `Meeting`, `Representative`, `Date`, `Outcome`, and the Volunteer Submissions table exposes `Type`, `Subject`, `Date`, `Status`. The production changes caught are loss of a principal dashboard section, a non-semantic table, or any action pointing somewhere other than `/report`.

- [ ] **Step 2: Run the Home tests and verify RED**

Run: `npm test -- src/pages/Home.test.tsx --run`

Expected: FAIL because the existing page still renders `Welcome to OIAC Engage`, lacks the dashboard sections, and has no Report links.

- [ ] **Step 3: Implement the semantic dashboard markup**

Rewrite `Home.tsx` with module-level components (never components nested inside `Home`) for:

```ts
function HandshakeIcon(): ReactElement
function DashboardTable({ label, children }: PropsWithChildren<{ label: string }>): ReactElement
function Home(): ReactElement
```

Requirements:

- Set `document.title` to `Volunteer Dashboard — OIAC Engage`.
- Use `<header className="dashboard-identity">` with eyebrow `Dashboard`, level-one heading `Volunteer`, decorative inline SVG handshake, and four React Router shortcut links.
- Render all fixture lists using stable `id` keys.
- Wrap both real `<table>` elements in `<div className="dashboard-table-scroll" tabIndex={0} role="region" aria-label="…">`.
- Give each Edit link an accessible name such as `Edit Advocacy Briefing — Rep. Chen Office` while displaying `Edit` visually.
- Render invitation/submission statuses through text-bearing `StatusBadge` instances with positive/attention tones.
- Link `See all → My Calendar` to `/my-calendar`, training resources to `/resources`, meeting items to `/my-calendar`, and channel/document items to `/resources`.
- Keep announcements informational rather than fake links.

- [ ] **Step 4: Run the Home tests and verify GREEN**

Run: `npm test -- src/pages/Home.test.tsx --run`

Expected: both dashboard tests PASS with no React warnings.

- [ ] **Step 5: Commit the rendered dashboard behavior**

```powershell
git add -- oiac-engage/src/pages/Home.test.tsx oiac-engage/src/pages/Home.tsx
git commit -m "Build authenticated volunteer dashboard"
```

### Task 3: Add the shared authenticated Report route

**Files:**
- Create: `oiac-engage/src/pages/Report.tsx`
- Modify: `oiac-engage/src/App.test.tsx`
- Modify: `oiac-engage/src/App.tsx`

**Interfaces:**
- Produces: authenticated `/report` route with a level-one `Report` heading.
- Consumes: existing anonymous wildcard/`SignInRedirect` behavior and existing `PageHeader`/React Router `Link` components.

- [ ] **Step 1: Write failing authenticated and anonymous route tests**

Extend the authenticated route table case with `['/report', 'Report']`, then add:

```tsx
test('redirects anonymous Report access to sign in with its return URL', async () => {
  const navigate = vi.fn()
  renderApp('/report', { status: 'anonymous' }, navigate)

  await waitFor(() => {
    expect(navigate).toHaveBeenCalledWith('/SignIn?returnUrl=%2Freport')
  })
  expect(screen.queryByRole('heading', { name: 'Report' })).not.toBeInTheDocument()
})
```

The production changes caught are a missing authenticated route or a Report route accidentally exposed in the anonymous branch.

- [ ] **Step 2: Run the App tests and verify RED**

Run: `npm test -- src/App.test.tsx --run`

Expected: FAIL because authenticated `/report` currently reaches `Page not found`; the anonymous redirect assertion already follows the existing boundary.

- [ ] **Step 3: Add the placeholder page and authenticated route**

Create `Report.tsx`:

```tsx
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'

export default function Report() {
  useEffect(() => { document.title = 'Report — OIAC Engage' }, [])

  return (
    <div className="page page--centered">
      <PageHeader
        eyebrow="Meeting reports"
        title="Report"
        description="The meeting report page will be designed separately after the volunteer dashboard is finalized."
      />
      <Link className="button button--quiet" to="/">Return to dashboard</Link>
    </div>
  )
}
```

Import it directly in `App.tsx` and register `<Route path="/report" element={<Report />} />` only inside the authenticated route branch.

- [ ] **Step 4: Run the App and Home tests and verify GREEN**

Run: `npm test -- src/App.test.tsx src/pages/Home.test.tsx --run`

Expected: all targeted tests PASS.

- [ ] **Step 5: Commit the route**

```powershell
git add -- oiac-engage/src/pages/Report.tsx oiac-engage/src/App.test.tsx oiac-engage/src/App.tsx
git commit -m "Add shared authenticated report route"
```

### Task 4: Match the supplied dashboard design responsively

**Files:**
- Modify: `oiac-engage/src/styles/theme.css`

**Interfaces:**
- Consumes: the `dashboard-*` classes emitted by `Home.tsx`.
- Produces: reference-matched desktop layout and usable 1024px, 768px, and 375px layouts without changing anonymous selectors.

- [ ] **Step 1: Add scoped dashboard styles**

Add a dedicated block after the obsolete home/role rules, using these layout contracts:

```css
.page--dashboard { display: grid; gap: 1.75rem; }
.dashboard-identity { display: flex; align-items: center; justify-content: space-between; }
.dashboard-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.dashboard-operational-grid,
.dashboard-resource-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.dashboard-panel-stack { display: grid; align-content: start; gap: 1rem; }
.dashboard-table-scroll { max-width: 100%; overflow-x: auto; }
.dashboard-table { width: 100%; min-width: 48rem; border-collapse: collapse; }
```

Match the reference with fine borders, 4–7px radii, white surfaces, low/no shadow, compact headings, uppercase table headers, neutral date tiles, pale shortcut pills, a right-aligned Submit Report button, and restrained row separators. Keep body text at `1rem` on mobile and interactive links/buttons at least `2.75rem` high.

- [ ] **Step 2: Add responsive rules without affecting anonymous pages**

- At `max-width: 980px`, use two metric columns and two-column operational/resource grids; make the stacked announcements/resources panel span the available row when helpful.
- At `max-width: 720px`, stack the identity copy/shortcuts, section heading/action, operational cards, and resource cards; keep tables horizontally scrollable; prevent any dashboard child from forcing page overflow.
- Preserve the existing `prefers-reduced-motion` behavior and focus ring.

- [ ] **Step 3: Run targeted tests and production build**

Run: `npm test -- src/pages/Home.test.tsx src/App.test.tsx --run`

Run: `npm run build`

Expected: both commands exit `0`.

- [ ] **Step 4: Commit responsive presentation**

```powershell
git add -- oiac-engage/src/styles/theme.css
git commit -m "Style responsive volunteer dashboard"
```

### Task 5: Verify behavior, accessibility, and visual fidelity

**Files:**
- Modify only if verification reveals a failing requirement: the smallest relevant source/test file above.

**Interfaces:**
- Consumes: complete implemented dashboard and existing verification scripts.
- Produces: fresh evidence for tests, build, accessibility, responsive layout, and clean repository scope.

- [ ] **Step 1: Run the complete automated test suite**

Run: `npm test -- --no-file-parallelism --maxWorkers=1 --reporter=verbose`

Expected: all test files and tests PASS; no unhandled warnings.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite exit `0`.

- [ ] **Step 3: Start the site and run accessibility verification**

Run the existing Vite development command, then run `npm run audit:a11y` against the locally served authenticated preview configuration used by the repository.

Expected: no critical or serious axe violations on the authenticated dashboard; if the script only covers the anonymous page, use Playwright to render `Home` in the authenticated shell and run axe there.

- [ ] **Step 4: Capture and compare responsive screenshots**

Capture authenticated Home at approximately `1440×1200`, `768×1024`, and `375×812`. Compare against `oiac-engage/homepageContent.png` for hierarchy, density, spacing, muted palette, table treatment, and mobile overflow. Correct source defects through a new RED/GREEN cycle where behavior changes; correct purely visual CSS defects and recapture.

- [ ] **Step 5: Run the fresh completion gate**

Run:

```powershell
git diff --check
git status --short --branch
```

Confirm only intended tracked changes/commits exist and all user-owned reference/deployment files remain untracked and untouched.
