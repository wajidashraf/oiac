# Coming Soon UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mark unfinished Home and navigation features as visibly Coming Soon and remove their navigation behavior without changing implemented features.

**Architecture:** Add one presentational badge component, then use explicit `comingSoon` metadata to branch between React Router links and semantic disabled spans. Keep existing routes and data visible; tests assert requested unfinished controls have no anchor semantics while working routes remain links.

**Tech Stack:** React 19, TypeScript, React Router, Vitest, Testing Library, CSS theme tokens

## Global Constraints

- Coming Soon items are fully non-interactive and show no popup.
- Use the exact visible label `Coming Soon`.
- Keep planned content visible.
- Do not change the behavior of implemented features.
- Preserve all unrelated uncommitted work in the existing dirty worktree.
- Do not commit or deploy because the user requested implementation only and the worktree contains unrelated changes.

---

## File structure

- Create `src/components/ComingSoonBadge.tsx`: shared visual status label.
- Create `src/components/ComingSoonBadge.test.tsx`: badge rendering contract.
- Modify `src/pages/Home.tsx`: badge unfinished sections and replace unfinished links with disabled spans.
- Modify `src/pages/Home.test.tsx`: Home visibility and non-navigation regressions.
- Modify `src/components/PortalNav.tsx`: render unavailable navigation entries as disabled rows.
- Modify `src/components/PortalNav.test.tsx`: navigation accessibility and retained Events-link regressions.
- Modify `src/styles/theme.css`: shared badge and context-specific disabled states, including responsive layouts.

### Task 1: Shared Coming Soon badge

**Files:**
- Create: `src/components/ComingSoonBadge.tsx`
- Create: `src/components/ComingSoonBadge.test.tsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: existing theme CSS variables.
- Produces: `ComingSoonBadge(): JSX.Element`, rendered as `<span className="coming-soon-badge">Coming Soon</span>`.

- [ ] **Step 1: Write the failing component test**

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import ComingSoonBadge from './ComingSoonBadge'

test('renders a reusable visible Coming Soon status', () => {
  render(<ComingSoonBadge />)
  expect(screen.getByText('Coming Soon')).toHaveClass('coming-soon-badge')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/ComingSoonBadge.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: FAIL because `ComingSoonBadge` does not exist.

- [ ] **Step 3: Add the badge component**

```tsx
export default function ComingSoonBadge() {
  return <span className="coming-soon-badge">Coming Soon</span>
}
```

- [ ] **Step 4: Add compact theme-consistent styling**

```css
.coming-soon-badge {
  display: inline-flex;
  min-height: 1.35rem;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  line-height: 1;
  padding: 0.2rem 0.5rem;
  white-space: nowrap;
}
```

- [ ] **Step 5: Run the component test**

Run: `npm test -- src/components/ComingSoonBadge.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: PASS.

### Task 2: Home page unavailable states

**Files:**
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Home.test.tsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: `ComingSoonBadge` from Task 1 and existing `ContentCard.meta`.
- Produces: non-interactive Home shortcuts and content actions with `aria-disabled="true"`.

- [ ] **Step 1: Add failing Home behavior tests**

Add a test that scopes queries to the Home sections and verifies:

```tsx
const shortcuts = screen.getByRole('navigation', { name: 'Dashboard shortcuts' })
expect(within(shortcuts).queryByRole('link', { name: /Activity/ })).not.toBeInTheDocument()
expect(within(shortcuts).queryByRole('link', { name: /Appointments/ })).not.toBeInTheDocument()
expect(within(shortcuts).getByText('Activity').closest('[aria-disabled="true"]')).toBeInTheDocument()
expect(within(shortcuts).getByText('Appointments').closest('[aria-disabled="true"]')).toBeInTheDocument()
expect(within(shortcuts).getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/activity/events')
expect(within(shortcuts).getByRole('link', { name: 'Resources' })).toHaveAttribute('href', '/resources')

const training = screen.getByRole('heading', { name: 'Training Resources' }).closest('article')!
expect(within(training).getByText('Coming Soon')).toBeInTheDocument()
expect(within(training).queryByRole('link')).not.toBeInTheDocument()

const teams = screen.getByRole('heading', { name: 'Teams & Resources' }).closest('section')!
expect(within(teams).getByText('Coming Soon')).toBeInTheDocument()
expect(within(teams).queryByRole('link')).not.toBeInTheDocument()
```

Also assert Meeting Invites, Teams Announcements, and Volunteer Submissions contain the badge, and Upcoming Events still links to `/my-calendar`.

- [ ] **Step 2: Run the Home test to verify it fails**

Run: `npm test -- src/pages/Home.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: FAIL because unfinished cards have no badges and unfinished shortcuts/resources are still links.

- [ ] **Step 3: Mark shortcut availability and render disabled spans**

Add `comingSoon: true` to Activity and Appointments in `dashboardShortcuts`. In the mapping, render working shortcuts as `<Link>` and unavailable shortcuts as:

```tsx
<span className="dashboard-shortcut dashboard-shortcut--disabled" aria-disabled="true">
  <span>{shortcut.label}</span>
  <ComingSoonBadge />
</span>
```

- [ ] **Step 4: Badge unfinished Home sections**

Pass `<ComingSoonBadge />` through `ContentCard.meta` for Meeting Invites, Teams Announcements, and Training Resources. Add the badge next to the Teams & Resources heading/admin label and next to Volunteer Submissions.

- [ ] **Step 5: Remove unfinished resource navigation**

Replace Training Resource `<Link>` elements with `<span className="dashboard-training-list__label" aria-disabled="true">`. Replace Teams & Resources action links with `<span className="dashboard-team-list__action" aria-disabled="true">` while keeping action text and icons visible.

- [ ] **Step 6: Style working and disabled Home controls consistently**

Generalize the existing shortcut anchor styles to `.dashboard-shortcut`, apply muted/default-cursor styling to `.dashboard-shortcut--disabled`, and give the training labels/team actions the same layout as their former links without hover behavior. Update the mobile selectors so both links and disabled shortcuts retain the current responsive sizing.

- [ ] **Step 7: Run the Home test**

Run: `npm test -- src/pages/Home.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: PASS.

### Task 3: Activity and Press Coverage navigation states

**Files:**
- Modify: `src/components/PortalNav.tsx`
- Modify: `src/components/PortalNav.test.tsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: `ComingSoonBadge` from Task 1.
- Produces: Activity Log, Appointments, and Press Coverage as disabled non-link navigation rows; Events remains a `NavLink`.

- [ ] **Step 1: Update navigation tests to express the required contract**

After expanding Activity, assert:

```tsx
expect(screen.queryByRole('link', { name: /Activity Log/ })).not.toBeInTheDocument()
expect(screen.getByText('Activity Log').closest('[aria-disabled="true"]')).toBeInTheDocument()
expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/activity/events')
expect(screen.queryByRole('link', { name: /Appointments/ })).not.toBeInTheDocument()
expect(screen.getByText('Appointments').closest('[aria-disabled="true"]')).toBeInTheDocument()
```

Before opening Activity, assert Press Coverage has no link role, has `aria-disabled="true"`, and includes the Coming Soon badge.

- [ ] **Step 2: Run the navigation test to verify it fails**

Run: `npm test -- src/components/PortalNav.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: FAIL because all three entries are still links.

- [ ] **Step 3: Add availability metadata and conditional rendering**

Set `comingSoon: true` on Activity Log, Appointments, and Press Coverage. Render unavailable entries as:

```tsx
<span className="portal-nav__link portal-nav__link--disabled" aria-disabled="true">
  <span>{link.label}</span>
  <ComingSoonBadge />
</span>
```

Continue rendering Events and every implemented top-level entry with `NavLink` and existing close-menu handlers.

- [ ] **Step 4: Style disabled navigation rows**

Add a disabled selector after the current hover rule so unavailable rows keep a transparent background, muted color, and default cursor on hover. Compact the nested badge and allow the Activity submenu enough width for label plus badge.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/components/ComingSoonBadge.test.tsx src/pages/Home.test.tsx src/components/PortalNav.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: all focused tests PASS.

### Task 4: Regression verification

**Files:**
- Verify only; do not modify unless a test identifies a scoped regression.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: verified application state.

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --no-file-parallelism --maxWorkers=1`

Expected: all tests PASS.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite complete successfully.

- [ ] **Step 3: Review the final diff**

Run: `git diff -- src/components/ComingSoonBadge.tsx src/components/ComingSoonBadge.test.tsx src/components/PortalNav.tsx src/components/PortalNav.test.tsx src/pages/Home.tsx src/pages/Home.test.tsx src/styles/theme.css docs/superpowers/specs/2026-08-30-coming-soon-ui-design.md docs/superpowers/plans/2026-08-30-coming-soon-ui.md`

Expected: only the approved Coming Soon UI, tests, styles, spec, and plan appear in the scoped diff; unrelated worktree changes remain untouched.
