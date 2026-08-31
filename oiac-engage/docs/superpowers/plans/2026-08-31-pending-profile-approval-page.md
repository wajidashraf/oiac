# Pending Profile Approval Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route authenticated users without an assigned functional web role to a themed pending-approval page that exposes only the OIAC brand and Sign Out action.

**Architecture:** Add one pure authorization predicate that distinguishes implicit Power Pages roles from assigned functional roles. Apply that predicate once in `App.tsx`, ahead of the authenticated application shell, so pending users receive a dedicated shell and a catch-all redirect to `/pending-approval`. The page and shell use isolated theme classes; Dataverse table permissions remain unchanged because this gate is intentionally UI-only.

**Tech Stack:** React 19, TypeScript, React Router 7, React Icons, Vitest, Testing Library, CSS.

## Global Constraints

- Treat `Authenticated Users` and `Anonymous Users` as implicit roles that do not approve a profile.
- Treat any non-empty, non-implicit role as approval, including existing `Administrators`, `Staff`, `Volunteer`, and `Applicant` roles.
- Keep anonymous users on the existing public landing experience.
- Pending users may see only the OIAC logo, a Sign Out action, and the approval message; do not render the normal portal navigation or footer.
- Redirect every pending-user SPA path to `/pending-approval` with history replacement.
- Use the exact approved copy from the design specification.
- Keep this as a UI-only gate; do not change Power Pages table permissions or web roles.
- Preserve the unrelated untracked `Minimal Volunteer Portal Design.make/` directory.

---

### Task 1: Profile-approval role predicate

**Files:**
- Modify: `src/auth/authorization.ts`
- Test: `src/auth/authorization.test.ts`

**Interfaces:**
- Consumes: `AuthSession` from `src/auth/powerPagesSession.ts` and the existing implicit-role normalization rules.
- Produces: `requiresProfileApproval(session: AuthSession): boolean` for the central application gate.

- [ ] **Step 1: Write the failing predicate tests**

Add `requiresProfileApproval` to the import and append:

```ts
describe('profile approval role gate', () => {
  test.each([
    [[], true],
    [['Authenticated Users'], true],
    [[' anonymous users ', 'AUTHENTICATED USERS'], true],
    [['Authenticated Users', 'Volunteer'], false],
    [['Authenticated Users', 'Regional Coordinator'], false],
  ])('evaluates authenticated roles %j', (userRoles, expected) => {
    expect(requiresProfileApproval({
      status: 'authenticated',
      user: { userName: 'member@oiac.org', userRoles },
    })).toBe(expected)
  })

  test('does not treat anonymous visitors as pending profiles', () => {
    expect(requiresProfileApproval({ status: 'anonymous' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run: `npm test -- src/auth/authorization.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose`

Expected: FAIL because `requiresProfileApproval` is not exported.

- [ ] **Step 3: Implement the minimal predicate**

Add after `implicitRoles`:

```ts
export function requiresProfileApproval(session: AuthSession): boolean {
  if (session.status === 'anonymous') return false

  return !session.user.userRoles.some((role) => {
    const normalizedRole = role.trim().toLowerCase()
    return normalizedRole.length > 0 && !implicitRoles.has(normalizedRole)
  })
}
```

- [ ] **Step 4: Run the focused test and verify the green state**

Run: `npm test -- src/auth/authorization.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose`

Expected: PASS for existing role helpers and all new approval cases.

- [ ] **Step 5: Commit the predicate**

```bash
git add src/auth/authorization.ts src/auth/authorization.test.ts
git commit -m "feat: identify pending portal profiles"
```

---

### Task 2: Pending approval shell and page

**Files:**
- Create: `src/components/PendingApprovalShell.tsx`
- Create: `src/pages/PendingApproval.tsx`
- Create: `src/pages/PendingApproval.test.tsx`
- Modify: `src/styles/theme.css`
- Modify: `src/styles/designRegression.test.ts`

**Interfaces:**
- Consumes: shared `site-container`, `skip-link`, logo asset, theme tokens, and React Router location/link primitives.
- Produces: `PendingApprovalShell` and `PendingApproval`, both default exports.

- [ ] **Step 1: Write the failing page and shell tests**

Create `src/pages/PendingApproval.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import PendingApprovalShell from '../components/PendingApprovalShell'
import PendingApproval from './PendingApproval'

test('renders the approved pending-profile copy and minimal actions', () => {
  render(
    <MemoryRouter initialEntries={['/pending-approval']}>
      <PendingApprovalShell><PendingApproval /></PendingApprovalShell>
    </MemoryRouter>,
  )

  expect(screen.getByText('Approval pending')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Your profile is under review', level: 1 })).toBeInTheDocument()
  expect(screen.getByText('Thank you for creating your OIAC Engage account. Our team is reviewing your profile. We’ll notify you as soon as your access is approved.')).toBeInTheDocument()
  expect(screen.getByText('After approval, sign in again to access the portal.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'OIAC Engage pending approval' })).toHaveAttribute('href', '/pending-approval')
  expect(screen.getByRole('link', { name: 'Sign Out' })).toHaveAttribute('href', '/Account/Login/LogOff?returnUrl=%2F')
  expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Footer navigation' })).not.toBeInTheDocument()
})
```

Extend `src/styles/designRegression.test.ts` in its themed-component test:

```ts
expect(css).toContain('.pending-header')
expect(css).toContain('.pending-approval-page')
expect(css).toContain('.pending-approval-card')
```

- [ ] **Step 2: Run focused tests and verify the red state**

Run: `npm test -- src/pages/PendingApproval.test.tsx src/styles/designRegression.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose`

Expected: FAIL because the new shell/page modules and pending CSS do not exist.

- [ ] **Step 3: Implement the minimal pending shell**

Create `src/components/PendingApprovalShell.tsx` with a `PropsWithChildren` component. Render the skip link, a `.pending-header` containing a logo/wordmark `Link` to `/pending-approval`, an anchor to `/Account/Login/LogOff?returnUrl=%2F`, and `<main id="main-content" tabIndex={-1}>`. Reuse the location-change heading-focus effect from `AppShell`, but do not render `PortalNav` or the normal footer.

- [ ] **Step 4: Implement the pending page**

Create `src/pages/PendingApproval.tsx` with `LuClock3` as an `aria-hidden` decorative icon, an `aria-labelledby` section, and this exact content:

```tsx
<p className="pending-approval-card__status">Approval pending</p>
<h1 id="pending-approval-title">Your profile is under review</h1>
<p>Thank you for creating your OIAC Engage account. Our team is reviewing your profile. We’ll notify you as soon as your access is approved.</p>
<p className="pending-approval-card__note">After approval, sign in again to access the portal.</p>
```

Set `document.title` to `Profile under review — OIAC Engage` on mount.

- [ ] **Step 5: Add isolated themed styles**

Add CSS for `.pending-header`, `.pending-header__inner`, `.pending-header__signout`, `.pending-main`, `.pending-approval-page`, `.pending-approval-card`, `.pending-approval-card__icon`, `.pending-approval-card__status`, `.pending-approval-card h1`, `.pending-approval-card > p`, and `.pending-approval-card__note`. Use the existing color, spacing, radius, shadow, display-font, and container variables. Keep the header at `min-height: 4rem`, center a card with `max-width: 42rem`, and add mobile padding adjustments inside the existing `@media (max-width: 47.99rem)` block.

- [ ] **Step 6: Run focused tests and verify the green state**

Run: `npm test -- src/pages/PendingApproval.test.tsx src/styles/designRegression.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose`

Expected: PASS with exact copy, minimal landmarks/actions, and theme selectors present.

- [ ] **Step 7: Commit the themed pending experience**

```bash
git add src/components/PendingApprovalShell.tsx src/pages/PendingApproval.tsx src/pages/PendingApproval.test.tsx src/styles/theme.css src/styles/designRegression.test.ts
git commit -m "feat: add pending profile approval experience"
```

---

### Task 3: Central authenticated route gate

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `requiresProfileApproval`, `PendingApprovalShell`, and `PendingApproval` from Tasks 1 and 2.
- Produces: canonical `/pending-approval` routing for pending users and unchanged approved/anonymous route behavior.

- [ ] **Step 1: Write failing application-gate tests**

Import `useLocation` and `waitFor`; add a `LocationProbe` to the test router:

```tsx
function LocationProbe() {
  const location = useLocation()
  return <output data-testid="current-path">{location.pathname}</output>
}
```

Render `<LocationProbe />` after `<App />`. Add tests proving that empty roles and implicit-only roles render the pending heading, hide Primary navigation and the normal requested page, expose Sign Out, and redirect arbitrary routes to `/pending-approval` using `waitFor`. Add a test proving `['Authenticated Users', 'Regional Coordinator']` continues to `/resources`.

- [ ] **Step 2: Run the application test and verify the red state**

Run: `npm test -- src/App.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose`

Expected: FAIL because pending authenticated users still receive `AppShell` and normal routes.

- [ ] **Step 3: Add the central gate in `App.tsx`**

Import the predicate and components, then add this branch immediately after the anonymous branch and before `AppShell`:

```tsx
if (requiresProfileApproval(session)) {
  return (
    <PendingApprovalShell>
      <Routes>
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="*" element={<Navigate to="/pending-approval" replace />} />
      </Routes>
    </PendingApprovalShell>
  )
}
```

- [ ] **Step 4: Run the application test and verify the green state**

Run: `npm test -- src/App.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose`

Expected: PASS for pending, approved, anonymous, focus, and existing route coverage.

- [ ] **Step 5: Commit the route gate**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: gate unapproved portal profiles"
```

---

### Task 4: Skill tracking and final verification

**Files:**
- Modify if generated: `.powerpages-site/site-settings/Site-AI-Skills-SetupAuth.sitesetting.yml`

**Interfaces:**
- Consumes: all completed implementation tasks.
- Produces: verified build/test evidence and recorded Power Pages auth-skill usage.

- [ ] **Step 1: Record the Power Pages authentication skill usage**

Run:

```powershell
node "C:\Users\Administrator\.codex\plugins\cache\power-platform-skills\power-pages\2.6.2\scripts\update-skill-tracking.js" --projectRoot "C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage" --skillName "SetupAuth" --authoringTool "Codex"
```

Expected: the existing SetupAuth tracking site setting is updated without changing authentication providers, web roles, or table permissions.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test -- --no-file-parallelism --maxWorkers=1 --reporter=dot --silent`

Expected: all tests pass with no unhandled errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite production build complete successfully.

- [ ] **Step 4: Review the final diff and worktree**

Run: `git diff --check`, `git status --short`, and `git diff --stat HEAD~3..HEAD`.

Expected: no whitespace errors; only pending-approval implementation/tracking files and the pre-existing untracked `Minimal Volunteer Portal Design.make/` entry are present.

- [ ] **Step 5: Commit skill tracking if it changed**

```bash
git add .powerpages-site/site-settings/Site-AI-Skills-SetupAuth.sitesetting.yml
git commit -m "chore: record profile approval auth update"
```

- [ ] **Step 6: Report completion without deploying**

Summarize the implemented gate, tests, build, and security boundary. Do not deploy until the user explicitly requests deployment.
