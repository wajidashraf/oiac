# Portal Role Route Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow authenticated portal entry only when the Power Pages user has at least one of the `Administrators`, `Staff`, `Volunteer`, or `Applicant` web roles.

**Architecture:** Replace the current “any custom role” approval rule with one explicit, fail-closed allowlist in the authorization module. Move the pending experience behind a focused `RequirePortalRole` boundary, and make `App` subscribe to route changes so it rereads the Power Pages browser session before rendering each requested SPA route.

**Tech Stack:** React 19, TypeScript 5.7, React Router 7, Power Pages SPA user context, Vitest, Testing Library.

## Global Constraints

- Only `Administrators`, `Staff`, `Volunteer`, and `Applicant` grant authenticated portal access.
- Match role names case-insensitively after trimming surrounding whitespace.
- Empty, missing, implicit-only, and unknown-role lists must fail closed to `/pending-approval`.
- Keep anonymous visitors on the existing public landing experience.
- Do not mount `AppShell`, protected page content, or page-owned data loading until the role check passes.
- Keep the existing pending-approval UI, copy, Sign Out URL, and history-replacing redirect behavior.
- Do not change web-role assignments, Dataverse table permissions, authentication settings, deployed files, or the Power Pages site cache.
- Preserve the unrelated untracked `Minimal Volunteer Portal Design.make/` directory.

---

## File Structure

- `src/auth/authorization.ts`: own the immutable approved-role allowlist and pure portal-access predicates.
- `src/auth/authorization.test.ts`: prove the allowlist, normalization, mixed-role, implicit-role, unknown-role, and anonymous behavior.
- `src/components/RequirePortalRole.tsx`: render either the existing pending experience or approved protected children for an authenticated session.
- `src/App.tsx`: reread the browser session on route changes and place the complete authenticated route tree behind `RequirePortalRole`.
- `src/App.test.tsx`: prove every protected path fails closed, all four allowed roles pass, protected requests do not start for denied users, and client-side navigation rechecks the browser roles.

---

### Task 1: Explicit Portal Role Allowlist

**Files:**
- Modify: `src/auth/authorization.ts`
- Test: `src/auth/authorization.test.ts`

**Interfaces:**
- Consumes: `AuthSession` from `src/auth/powerPagesSession.ts` and existing `hasAnyRole(session, roleNames)` normalization.
- Produces: `PORTAL_ACCESS_ROLES`, `PortalAccessRole`, `hasPortalAccess(session: AuthSession): boolean`, and the stricter `requiresProfileApproval(session: AuthSession): boolean`.

- [ ] **Step 1: Replace the permissive approval expectations with failing allowlist tests**

In `src/auth/authorization.test.ts`, import `hasPortalAccess` and `PORTAL_ACCESS_ROLES`. Replace the existing `profile approval role gate` describe block with:

```ts
describe('portal access role gate', () => {
  test('publishes the complete approved role allowlist', () => {
    expect(PORTAL_ACCESS_ROLES).toEqual([
      'Administrators',
      'Staff',
      'Volunteer',
      'Applicant',
    ])
  })

  test.each(PORTAL_ACCESS_ROLES)('allows the %s role', (role) => {
    const approvedSession: AuthSession = {
      status: 'authenticated',
      user: { userName: 'member@oiac.org', userRoles: ['Authenticated Users', role] },
    }

    expect(hasPortalAccess(approvedSession)).toBe(true)
    expect(requiresProfileApproval(approvedSession)).toBe(false)
  })

  test('matches approved roles case-insensitively after trimming whitespace', () => {
    const approvedSession: AuthSession = {
      status: 'authenticated',
      user: { userName: 'member@oiac.org', userRoles: [' authenticated users ', ' volunteer '] },
    }

    expect(hasPortalAccess(approvedSession)).toBe(true)
    expect(requiresProfileApproval(approvedSession)).toBe(false)
  })

  test.each([
    [],
    ['Authenticated Users'],
    ['Anonymous Users', 'Authenticated Users'],
    ['Authenticated Users', 'Regional Coordinator'],
  ])('denies authenticated roles %j', (userRoles) => {
    const deniedSession: AuthSession = {
      status: 'authenticated',
      user: { userName: 'pending@oiac.org', userRoles },
    }

    expect(hasPortalAccess(deniedSession)).toBe(false)
    expect(requiresProfileApproval(deniedSession)).toBe(true)
  })

  test('allows a mixed role list when one role is approved', () => {
    const approvedSession: AuthSession = {
      status: 'authenticated',
      user: {
        userName: 'member@oiac.org',
        userRoles: ['Authenticated Users', 'Regional Coordinator', 'Staff'],
      },
    }

    expect(hasPortalAccess(approvedSession)).toBe(true)
    expect(requiresProfileApproval(approvedSession)).toBe(false)
  })

  test('does not grant portal access or pending status to an anonymous session', () => {
    const anonymousSession: AuthSession = { status: 'anonymous' }

    expect(hasPortalAccess(anonymousSession)).toBe(false)
    expect(requiresProfileApproval(anonymousSession)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run:

```powershell
npm test -- src/auth/authorization.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because `PORTAL_ACCESS_ROLES` and `hasPortalAccess` do not exist, and the current predicate incorrectly approves `Regional Coordinator`.

- [ ] **Step 3: Implement the minimal fail-closed predicate**

In `src/auth/authorization.ts`, replace `functionalRolePriority` and the body of `requiresProfileApproval` with this shared allowlist and predicates:

```ts
export const PORTAL_ACCESS_ROLES = [
  'Administrators',
  'Staff',
  'Volunteer',
  'Applicant',
] as const

export type PortalAccessRole = (typeof PORTAL_ACCESS_ROLES)[number]

const functionalRolePriority = PORTAL_ACCESS_ROLES

export function hasPortalAccess(session: AuthSession): boolean {
  return session.status === 'authenticated'
    && hasAnyRole(session, PORTAL_ACCESS_ROLES)
}

export function requiresProfileApproval(session: AuthSession): boolean {
  return session.status === 'authenticated' && !hasPortalAccess(session)
}
```

Keep `implicitRoles` because `getPrimaryRole` still uses it. Do not alter the existing `hasRole`, `hasAnyRole`, `hasAllRoles`, or `getPrimaryRole` behavior.

- [ ] **Step 4: Run the focused test and verify the green state**

Run:

```powershell
npm test -- src/auth/authorization.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: PASS, including denial of `Regional Coordinator` when it is the only non-implicit role.

- [ ] **Step 5: Commit the authorization rule**

```powershell
git add src/auth/authorization.ts src/auth/authorization.test.ts
git commit -m "fix: restrict portal access to approved roles"
```

---

### Task 2: Route-Level Portal Access Boundary

**Files:**
- Create: `src/components/RequirePortalRole.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: authenticated `AuthSession`, `hasPortalAccess`, the existing `PendingApprovalShell`, `PendingApproval`, and React Router location and redirect primitives.
- Produces: `RequirePortalRole({ session, children })`, which renders protected children only for an approved authenticated session.

- [ ] **Step 1: Add failing coverage for every protected route and all approved roles**

In `src/App.test.tsx`, declare reusable route and denied-session fixtures after `authenticatedSession`:

```tsx
const protectedRoutes = [
  '/',
  '/my-reports',
  '/my-calendar',
  '/contact',
  '/user-profile',
  '/activity',
  '/activity/events',
  '/report',
  '/report/new',
  '/report/11111111-1111-4111-8111-111111111111/edit',
  '/resources',
  '/unknown',
] as const

const deniedSession: AuthSession = {
  status: 'authenticated',
  user: {
    userName: 'pending@oiac.org',
    contactId: '11111111-1111-4111-8111-111111111111',
    userRoles: ['Authenticated Users', 'Regional Coordinator'],
  },
}
```

Replace the current pending-role test and the test that approves `Regional Coordinator` with:

```tsx
test.each(protectedRoutes)('redirects a denied signed-in user from %s', async (route) => {
  renderApp(route, deniedSession)

  expect(screen.getByRole('heading', { name: 'Your profile is under review', level: 1 })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/pending-approval'))
})

test.each(['Administrators', 'Staff', 'Volunteer', 'Applicant'])(
  'allows an authenticated user with the %s role into the portal',
  (role) => {
    renderApp('/resources', {
      status: 'authenticated',
      user: {
        userName: 'approved@oiac.org',
        userRoles: ['Authenticated Users', role],
      },
    })

    expect(screen.getByRole('heading', { name: 'Resources', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument()
  },
)

test('does not show the pending page to an approved user', () => {
  renderApp('/pending-approval')

  expect(screen.getByRole('heading', { name: 'Page not found', level: 1 })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Your profile is under review' })).not.toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Add a failing assertion that denied routes do not start protected data requests**

Add this test to `src/App.test.tsx`:

```tsx
test('does not start protected page requests before portal access is approved', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')

  renderApp('/activity/events', deniedSession)

  expect(fetchSpy).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Add a failing client-navigation test that changes the browser role context**

Add `afterEach` to the Vitest import and reset stubbed globals:

```tsx
import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
```

Add a renderer that intentionally does not supply a test session:

```tsx
function renderAppFromPowerPages(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  )
}
```

Then add:

```tsx
test('rechecks Power Pages roles before rendering a client-side destination', async () => {
  const user = userEvent.setup()
  const portalUser = {
    userName: 'member@oiac.org',
    contactId: '11111111-1111-4111-8111-111111111111',
    userRoles: ['Authenticated Users', 'Volunteer'],
  }

  vi.stubGlobal('Microsoft', {
    Dynamic365: { Portal: { User: portalUser } },
  })
  renderAppFromPowerPages('/resources')
  expect(screen.getByRole('heading', { name: 'Resources', level: 1 })).toBeInTheDocument()

  portalUser.userRoles = ['Authenticated Users']
  await user.click(screen.getByRole('link', { name: 'Contact' }))

  expect(screen.getByRole('heading', { name: 'Your profile is under review', level: 1 })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Contacts', level: 1 })).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/pending-approval'))
})
```

- [ ] **Step 4: Run the application tests and verify the red state**

Run:

```powershell
npm test -- src/App.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL only for the client-navigation recheck because Task 1 already denies `Regional Coordinator`, while `App` does not yet subscribe to location changes and reread the browser session.

- [ ] **Step 5: Create the shared route boundary**

Create `src/components/RequirePortalRole.tsx`:

```tsx
import type { PropsWithChildren } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { hasPortalAccess } from '../auth/authorization'
import type { AuthSession } from '../auth/powerPagesSession'
import PendingApproval from '../pages/PendingApproval'
import PendingApprovalShell from './PendingApprovalShell'

type AuthenticatedSession = Extract<AuthSession, { status: 'authenticated' }>

type RequirePortalRoleProps = PropsWithChildren<{
  session: AuthenticatedSession
}>

export default function RequirePortalRole({ session, children }: RequirePortalRoleProps) {
  if (hasPortalAccess(session)) return children

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

- [ ] **Step 6: Put the complete authenticated route tree behind the boundary**

In `src/App.tsx`:

1. Import `useLocation` from `react-router-dom`.
2. Remove the imports of `requiresProfileApproval`, `PendingApprovalShell`, and `PendingApproval`.
3. Import `RequirePortalRole` from `./components/RequirePortalRole`.
4. Call `useLocation()` as the first statement in `App`; this subscribes `App` to every SPA location change so `readPowerPagesSession()` runs again when no session prop is supplied.
5. Remove the existing inline `requiresProfileApproval` branch.
6. Wrap the existing approved `AppShell` and its complete `Routes` block with `<RequirePortalRole session={session}>`.

The resulting component shape must be:

```tsx
export default function App({ session: suppliedSession }: AppProps) {
  useLocation()
  const session = suppliedSession ?? readPowerPagesSession()

  if (session.status === 'anonymous') {
    return (
      <AnonymousShell>
        <Routes>
          <Route path="*" element={<AnonymousHome />} />
        </Routes>
      </AnonymousShell>
    )
  }

  return (
    <RequirePortalRole session={session}>
      <AppShell user={session.user}>
        <Routes>
          <Route path="/" element={<Home contactId={session.user.contactId} />} />
          <Route path="/my-reports" element={<MyReports />} />
          <Route path="/my-calendar" element={<MyCalendar contactId={session.user.contactId} />} />
          <Route path="/contact" element={<Contact user={session.user} />} />
          <Route path="/user-profile" element={<UserProfile user={session.user} />} />
          <Route path="/activity" element={<Navigate to="/activity/events" replace />} />
          <Route
            path="/activity/events"
            element={<Events isAdmin={hasRole(session, 'Administrators')} contactId={session.user.contactId} />}
          />
          <Route path="/report" element={<Report />} />
          <Route path="/report/new" element={<MeetingReportForm user={session.user} />} />
          <Route path="/report/:reportId/edit" element={<MeetingReportForm user={session.user} />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>
    </RequirePortalRole>
  )
}
```

Retain the two existing commented-out future routes in their current locations; do not enable them as part of this change.

- [ ] **Step 7: Run the focused authorization and application tests**

Run:

```powershell
npm test -- src/auth/authorization.test.ts src/App.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: PASS for the explicit role allowlist, every denied route, all four approved roles, request suppression, and the browser-role mutation during client navigation.

- [ ] **Step 8: Commit the route boundary**

```powershell
git add src/components/RequirePortalRole.tsx src/App.tsx src/App.test.tsx
git commit -m "fix: enforce roles at the portal route boundary"
```

---

### Task 3: Full Regression Verification

**Files:**
- Verify only: all tracked source and test files under `oiac-engage`

**Interfaces:**
- Consumes: the authorization predicate and route boundary completed in Tasks 1 and 2.
- Produces: test, build, and diff evidence that the portal fails closed without changing deployment artifacts or unrelated files.

- [ ] **Step 1: Run the complete test suite**

Run:

```powershell
npm test -- --no-file-parallelism --maxWorkers=1 --reporter=dot --silent
```

Expected: all test files and tests pass with exit code 0.

- [ ] **Step 2: Run the production build**

Run:

```powershell
npm run build
```

Expected: TypeScript compilation and the Vite production build complete with exit code 0. The ignored `dist/` output is verification-only and must not be copied into `.powerpages-site` in this task.

- [ ] **Step 3: Check formatting and scope**

Run from the repository root:

```powershell
git -c safe.directory='C:/Users/Administrator/Videos/PersonalPics/OAIC' diff --check
git -c safe.directory='C:/Users/Administrator/Videos/PersonalPics/OAIC' status --short
git -c safe.directory='C:/Users/Administrator/Videos/PersonalPics/OAIC' diff --stat HEAD~2..HEAD
```

Expected: no whitespace errors; the two implementation commits contain only the authorization, boundary, App, and test files named by this plan; the unrelated `Minimal Volunteer Portal Design.make/` directory remains untracked and unchanged.

- [ ] **Step 4: Perform the acceptance review**

Confirm from the focused test names and implementation diff that:

- Each allowed role reaches `/resources`.
- Unknown and implicit-only roles reach `/pending-approval` from every protected path.
- A route change rereads the Power Pages browser user context.
- No protected API request starts for a denied route.
- No `.powerpages-site` metadata or compiled web file changed.

If verification reveals an implementation defect, add the smallest failing regression test first, apply one focused fix, rerun the focused test, then repeat Steps 1–4.
