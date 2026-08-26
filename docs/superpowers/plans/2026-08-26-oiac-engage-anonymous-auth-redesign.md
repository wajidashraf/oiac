# OIAC Engage Anonymous Authentication Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an authentication-aware OIAC Engage SPA with a Figma-matched anonymous landing page, a protected footer-only Resources page, and invitation-only native Power Pages local-account screens.

**Architecture:** Read the supported Power Pages SPA user object through a small adapter and inject that session into the React route boundary. Anonymous visitors receive a dedicated shell and public hero, while authenticated visitors retain the existing member shell; native Power Pages pages continue to own credentials, invitations, and password recovery and are themed through tracked portal templates and CSS.

**Tech Stack:** React 19, TypeScript 5.7, React Router 7, Vite 6, Vitest, Testing Library, CSS custom properties, Playwright/axe, Power Pages Liquid templates and site-setting YAML.

## Global Constraints

- Use `window["Microsoft"].Dynamic365.Portal.User` as the supported deployed-session source documented for Power Pages SPA code sites.
- Keep credentials and invitation codes entirely inside native Power Pages endpoints.
- Enable local account sign-in and invitation redemption.
- Disable open registration, external login, and Microsoft Entra ID login.
- Anonymous users see only the anonymous header, hero, footer, and redirect states; never render member content while session state is anonymous or unavailable.
- Use `oiac-engage/public/logo.png` and `oiac-engage/public/MainHomeImage.jpg` without modifying the source assets.
- Keep the hero photograph continuous behind the CTA area on desktop and mobile; do not introduce a separate bottom panel, horizontal gradient, or solid-color block.
- Use Source Serif 4 for display text, Inter for body/interface text, and the existing OIAC green-gray palette centered on `#596e6a` and `#3d4e4b`.
- Keep `/resources` out of both anonymous and authenticated navbars; expose it only through the footer and authenticated route table.
- Preserve Dataverse table permissions and Power Pages web roles as the authorization boundary.
- Do not redesign existing signed-in page content beyond shell/logo/auth-control consistency.
- Do not deploy without a separate explicit request.
- Preserve all unrelated user files and generated Power Pages metadata.
- Before Task 5, invoke the `power-pages:setup-auth` skill and follow its current instructions for native authentication configuration.

## File map

- `oiac-engage/src/auth/powerPagesSession.ts`: typed adapter for the documented Power Pages global user object.
- `oiac-engage/src/auth/signInUrl.ts`: safe native sign-in and return-URL builder.
- `oiac-engage/src/components/AnonymousShell.tsx`: anonymous header, footer, and shared landmarks.
- `oiac-engage/src/components/SignInRedirect.tsx`: hard-navigation boundary for anonymous protected-route requests.
- `oiac-engage/src/pages/AnonymousHome.tsx`: public hero using the supplied image.
- `oiac-engage/src/pages/Resources.tsx`: protected footer-only resources directory.
- `oiac-engage/src/data/resources.ts`: typed local resource records with real internal/external destinations.
- `oiac-engage/src/App.tsx`: session-aware shell and route selection.
- `oiac-engage/src/components/AppShell.tsx`: authenticated shell using the supplied logo.
- `oiac-engage/src/components/PortalNav.tsx`: authenticated navigation and native sign-out action; never includes Resources.
- `oiac-engage/src/styles/theme.css`: React anonymous layout, responsive hero, Resources page, focus, and reduced-motion styling.
- `oiac-engage/.powerpages-site/site-settings/Authentication-Registration-*.sitesetting.yml`: invitation-only/local-only platform policy.
- `oiac-engage/.powerpages-site/web-templates/header/Header.webtemplate.source.html`: native authentication header.
- `oiac-engage/.powerpages-site/web-templates/footer/Footer.webtemplate.source.html`: native authentication footer.
- `oiac-engage/.powerpages-site/web-files/theme.css/theme.css`: scoped native authentication-page styling.
- `oiac-engage/scripts/audit-accessibility.mjs`: anonymous and injected-authenticated route audit.
- `oiac-engage/scripts/capture-auth-redesign.mjs`: repeatable desktop/mobile anonymous screenshots.

---

### Task 1: Power Pages session and sign-in URL contracts

**Files:**
- Create: `oiac-engage/src/auth/powerPagesSession.ts`
- Create: `oiac-engage/src/auth/powerPagesSession.test.ts`
- Create: `oiac-engage/src/auth/signInUrl.ts`
- Create: `oiac-engage/src/auth/signInUrl.test.ts`

**Interfaces:**
- Produces: `PortalUser`, `AuthSession`, `ANONYMOUS_SESSION`, `readPowerPagesSession(source?: unknown): AuthSession`, and `buildSignInUrl(returnUrl?: string): string`.

- [ ] **Step 1: Write the failing session-adapter tests**

```ts
import { describe, expect, test } from 'vitest'
import { readPowerPagesSession } from './powerPagesSession'

describe('readPowerPagesSession', () => {
  test('returns anonymous when the Power Pages global is missing', () => {
    expect(readPowerPagesSession({})).toEqual({ status: 'anonymous' })
  })

  test('returns the authenticated Power Pages user', () => {
    const source = {
      Microsoft: {
        Dynamic365: {
          Portal: {
            User: {
              userName: 'member@oiac.org',
              firstName: 'OIAC',
              lastName: 'Member',
              contactId: 'contact-001',
            },
          },
        },
      },
    }

    expect(readPowerPagesSession(source)).toEqual({
      status: 'authenticated',
      user: {
        userName: 'member@oiac.org',
        firstName: 'OIAC',
        lastName: 'Member',
        contactId: 'contact-001',
      },
    })
  })

  test('treats an empty user name as anonymous', () => {
    expect(readPowerPagesSession({
      Microsoft: { Dynamic365: { Portal: { User: { userName: '   ' } } } },
    })).toEqual({ status: 'anonymous' })
  })
})
```

- [ ] **Step 2: Write the failing sign-in URL tests**

```ts
import { expect, test } from 'vitest'
import { buildSignInUrl } from './signInUrl'

test.each([
  ['/', '/SignIn?returnUrl=%2F'],
  ['/resources', '/SignIn?returnUrl=%2Fresources'],
  ['/contact?from=footer', '/SignIn?returnUrl=%2Fcontact%3Ffrom%3Dfooter'],
])('builds a local Power Pages sign-in URL for %s', (returnUrl, expected) => {
  expect(buildSignInUrl(returnUrl)).toBe(expected)
})

test.each(['https://example.com', '//example.com', 'resources'])('rejects unsafe return URL %s', (returnUrl) => {
  expect(buildSignInUrl(returnUrl)).toBe('/SignIn?returnUrl=%2F')
})
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run: `npm test -- src/auth/powerPagesSession.test.ts src/auth/signInUrl.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement the typed session adapter**

```ts
export type PortalUser = {
  readonly userName: string
  readonly firstName?: string
  readonly lastName?: string
  readonly contactId?: string
}

export type AuthSession =
  | { readonly status: 'anonymous' }
  | { readonly status: 'authenticated'; readonly user: PortalUser }

export const ANONYMOUS_SESSION: AuthSession = { status: 'anonymous' }

type PowerPagesWindow = {
  Microsoft?: {
    Dynamic365?: {
      Portal?: {
        User?: Partial<PortalUser>
      }
    }
  }
}

export function readPowerPagesSession(source: unknown = window): AuthSession {
  const user = (source as PowerPagesWindow)?.Microsoft?.Dynamic365?.Portal?.User
  const userName = user?.userName?.trim()
  if (!userName) return ANONYMOUS_SESSION

  return {
    status: 'authenticated',
    user: {
      userName,
      firstName: user.firstName,
      lastName: user.lastName,
      contactId: user.contactId,
    },
  }
}
```

- [ ] **Step 5: Implement the safe sign-in URL builder**

```ts
export function buildSignInUrl(returnUrl = '/'): string {
  const safeReturnUrl = returnUrl.startsWith('/') && !returnUrl.startsWith('//')
    ? returnUrl
    : '/'
  return `/SignIn?${new URLSearchParams({ returnUrl: safeReturnUrl }).toString()}`
}
```

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run: `npm test -- src/auth/powerPagesSession.test.ts src/auth/signInUrl.test.ts --no-file-parallelism --maxWorkers=1`

Expected: both test files pass.

- [ ] **Step 7: Commit the contracts**

```powershell
git add -- oiac-engage/src/auth/powerPagesSession.ts oiac-engage/src/auth/powerPagesSession.test.ts oiac-engage/src/auth/signInUrl.ts oiac-engage/src/auth/signInUrl.test.ts
git commit -m "Add Power Pages session contract"
```

### Task 2: Authentication-aware shells and anonymous route boundary

**Files:**
- Create: `oiac-engage/src/components/AnonymousShell.tsx`
- Create: `oiac-engage/src/components/AnonymousShell.test.tsx`
- Create: `oiac-engage/src/components/SignInRedirect.tsx`
- Create: `oiac-engage/src/pages/AnonymousHome.tsx`
- Modify: `oiac-engage/src/App.tsx`
- Modify: `oiac-engage/src/App.test.tsx`
- Modify: `oiac-engage/src/components/AppShell.tsx`
- Modify: `oiac-engage/src/components/PortalNav.tsx`
- Modify: `oiac-engage/src/components/PortalNav.test.tsx`
- Add: `oiac-engage/public/logo.png`
- Add: `oiac-engage/public/MainHomeImage.jpg`

**Interfaces:**
- Consumes: `AuthSession`, `readPowerPagesSession()`, and `buildSignInUrl()` from Task 1.
- Produces: `ExternalNavigate = (href: string) => void`, `AnonymousShell({ children })`, `SignInRedirect({ navigate })`, `AnonymousHome()`, and `App({ session?, navigate? })`.

- [ ] **Step 1: Refactor the existing App route test helper to supply an authenticated session**

```tsx
const authenticatedSession: AuthSession = {
  status: 'authenticated',
  user: { userName: 'member@oiac.org', firstName: 'OIAC', lastName: 'Member' },
}

function renderApp(route: string, session: AuthSession = authenticatedSession, navigate = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App session={session} navigate={navigate} />
    </MemoryRouter>,
  )
}
```

Update every existing route assertion in `App.test.tsx` to use `renderApp(route)` so current member behavior remains explicitly authenticated.

- [ ] **Step 2: Write failing anonymous-boundary tests**

```tsx
test('shows only the public experience to anonymous visitors', () => {
  renderApp('/', { status: 'anonymous' })

  expect(screen.getByRole('heading', { name: 'OIAC Engage', level: 1 })).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /sign in/i })).toHaveLength(2)
  expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument()
  expect(screen.queryByText('My Reports')).not.toBeInTheDocument()
})

test('redirects an anonymous protected route with its return URL', async () => {
  const navigate = vi.fn()
  renderApp('/my-reports', { status: 'anonymous' }, navigate)

  await waitFor(() => {
    expect(navigate).toHaveBeenCalledWith('/SignIn?returnUrl=%2Fmy-reports')
  })
  expect(screen.queryByRole('heading', { name: 'My Reports' })).not.toBeInTheDocument()
})
```

- [ ] **Step 3: Write failing anonymous-shell tests**

```tsx
test('uses the supplied branding and footer-only resource link', () => {
  render(<MemoryRouter><AnonymousShell><p>Page content</p></AnonymousShell></MemoryRouter>)

  expect(screen.getByRole('img', { name: 'Organization of Iranian American Communities' }))
    .toHaveAttribute('src', '/logo.png')
  expect(screen.getByRole('link', { name: 'Sign In' }))
    .toHaveAttribute('href', '/SignIn?returnUrl=%2F')
  expect(screen.getByRole('link', { name: 'Resources' })).toHaveAttribute('href', '/resources')
  expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact')
  expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument()
})
```

- [ ] **Step 4: Update the authenticated navigation test**

Replace the `Sign in` assertion with:

```tsx
expect(screen.getByRole('link', { name: 'Sign out' })).toHaveAttribute(
  'href', '/Account/Login/LogOff?returnUrl=%2F',
)
expect(screen.queryByRole('link', { name: 'Resources' })).not.toBeInTheDocument()
```

- [ ] **Step 5: Run the focused tests and verify RED**

Run: `npm test -- src/App.test.tsx src/components/AnonymousShell.test.tsx src/components/PortalNav.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: FAIL because the anonymous shell, injected session boundary, redirect component, real-logo markup, and authenticated sign-out action do not exist.

- [ ] **Step 6: Implement the anonymous shell and public hero**

Use this semantic structure in `AnonymousShell.tsx`:

```tsx
<div className="portal-shell portal-shell--anonymous">
  <a className="skip-link" href="#main-content">Skip to main content</a>
  <header className="anonymous-header">
    <div className="anonymous-header__inner">
      <Link className="anonymous-brand" to="/" aria-label="OIAC Engage home">
        <img src="/logo.png" alt="Organization of Iranian American Communities" />
        <span>OIAC Engage</span>
      </Link>
      <a className="button button--primary" href={buildSignInUrl('/')}>Sign In</a>
    </div>
  </header>
  <main className="anonymous-main" id="main-content" tabIndex={-1}>{children}</main>
  <footer className="anonymous-footer">
    <div className="anonymous-footer__inner">
      <div className="anonymous-footer__identity">
        <img src="/logo.png" alt="" />
        <span>Organization of Iranian American Communities – U.S.</span>
      </div>
      <nav aria-label="Footer navigation">
        <a href="https://oiac.org/" target="_blank" rel="noreferrer">oiac.org</a>
        <Link to="/resources">Resources</Link>
        <Link to="/contact">Contact</Link>
      </nav>
    </div>
  </footer>
</div>
```

Use this hero content in `AnonymousHome.tsx`; the background image belongs in CSS so the heading remains the semantic hero content:

```tsx
<section className="anonymous-hero" aria-labelledby="anonymous-hero-title">
  <div className="anonymous-hero__copy">
    <p className="anonymous-hero__eyebrow">Welcome to</p>
    <h1 id="anonymous-hero-title">OIAC Engage</h1>
    <p>The Organization of Iranian American Communities' secure portal for volunteers, members, and advocates.</p>
  </div>
  <a className="anonymous-hero__action" href={buildSignInUrl('/')}>Sign In to Get Started <span aria-hidden="true">→</span></a>
</section>
```

- [ ] **Step 7: Implement the hard-navigation redirect component**

```tsx
export type ExternalNavigate = (href: string) => void

export default function SignInRedirect({ navigate }: { navigate: ExternalNavigate }) {
  const location = useLocation()
  const returnUrl = `${location.pathname}${location.search}${location.hash}`
  const signInUrl = buildSignInUrl(returnUrl)

  useEffect(() => navigate(signInUrl), [navigate, signInUrl])

  return (
    <section className="signin-redirect" aria-labelledby="signin-redirect-title">
      <h1 id="signin-redirect-title">Sign in required</h1>
      <p>You need to sign in to view this page.</p>
      <a className="button button--primary" href={signInUrl}>Continue to sign in</a>
    </section>
  )
}
```

- [ ] **Step 8: Make App session-aware**

```tsx
type AppProps = {
  session?: AuthSession
  navigate?: ExternalNavigate
}

const browserNavigate: ExternalNavigate = (href) => window.location.assign(href)

export default function App({
  session = readPowerPagesSession(),
  navigate = browserNavigate,
}: AppProps) {
  if (session.status === 'anonymous') {
    return (
      <AnonymousShell>
        <Routes>
          <Route path="/" element={<AnonymousHome />} />
          <Route path="*" element={<SignInRedirect navigate={navigate} />} />
        </Routes>
      </AnonymousShell>
    )
  }

  return <AppShell>{/* preserve the existing authenticated route table */}</AppShell>
}
```

Keep the existing route-focus behavior inside both shells. Update `AppShell` to render `/logo.png` in the home link. Replace `PortalNav`'s `Sign in` link with the native `Sign out` URL and do not add Resources to its link arrays.

- [ ] **Step 9: Run the focused tests and verify GREEN**

Run: `npm test -- src/App.test.tsx src/components/AnonymousShell.test.tsx src/components/PortalNav.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: all focused tests pass, including every pre-existing authenticated route assertion.

- [ ] **Step 10: Commit the shell boundary and supplied assets**

```powershell
git add -- oiac-engage/src/App.tsx oiac-engage/src/App.test.tsx oiac-engage/src/components/AnonymousShell.tsx oiac-engage/src/components/AnonymousShell.test.tsx oiac-engage/src/components/SignInRedirect.tsx oiac-engage/src/components/AppShell.tsx oiac-engage/src/components/PortalNav.tsx oiac-engage/src/components/PortalNav.test.tsx oiac-engage/src/pages/AnonymousHome.tsx oiac-engage/public/logo.png oiac-engage/public/MainHomeImage.jpg
git commit -m "Add anonymous authentication boundary"
```

### Task 3: Protected footer-only Resources page

**Files:**
- Create: `oiac-engage/src/data/resources.ts`
- Create: `oiac-engage/src/data/resources.test.ts`
- Create: `oiac-engage/src/pages/Resources.tsx`
- Create: `oiac-engage/src/pages/Resources.test.tsx`
- Modify: `oiac-engage/src/App.tsx`
- Modify: `oiac-engage/src/App.test.tsx`

**Interfaces:**
- Produces: `ResourceRecord`, `resources: readonly ResourceRecord[]`, the authenticated `/resources` route, and document title `Resources — OIAC Engage`.

- [ ] **Step 1: Write the failing resource-data contract test**

```ts
expect(resources.map((resource) => resource.id)).toHaveLength(new Set(resources.map((resource) => resource.id)).size)
expect(resources).toEqual(expect.arrayContaining([
  expect.objectContaining({ title: 'OIAC official website', href: 'https://oiac.org/', destination: 'external' }),
  expect.objectContaining({ title: 'Press coverage', href: '/press-coverage', destination: 'internal' }),
  expect.objectContaining({ title: 'Contact OIAC', href: '/contact', destination: 'internal' }),
]))
```

- [ ] **Step 2: Write the failing Resources page tests**

```tsx
test('renders available resources with correct link behavior', () => {
  render(<MemoryRouter><Resources /></MemoryRouter>)

  expect(screen.getByRole('heading', { name: 'Resources', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /OIAC official website/ })).toHaveAttribute('target', '_blank')
  expect(screen.getByRole('link', { name: /Press coverage/ })).toHaveAttribute('href', '/press-coverage')
  expect(screen.getByRole('link', { name: /Contact OIAC/ })).toHaveAttribute('href', '/contact')
  expect(document.title).toBe('Resources — OIAC Engage')
})

test('renders an explicit empty state', () => {
  render(<MemoryRouter><Resources items={[]} /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'No resources available' })).toBeInTheDocument()
})
```

- [ ] **Step 3: Extend the App routing tests**

```tsx
test('renders Resources only for an authenticated session', async () => {
  renderApp('/resources')
  expect(screen.getByRole('heading', { name: 'Resources', level: 1 })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Resources' })).not.toBeInTheDocument()
})

test('redirects anonymous Resources access to sign in', async () => {
  const navigate = vi.fn()
  renderApp('/resources', { status: 'anonymous' }, navigate)
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/SignIn?returnUrl=%2Fresources'))
})
```

- [ ] **Step 4: Run the focused tests and verify RED**

Run: `npm test -- src/data/resources.test.ts src/pages/Resources.test.tsx src/App.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: FAIL because the data module, page, and authenticated route do not exist.

- [ ] **Step 5: Implement immutable resource records with real destinations**

```ts
export type ResourceRecord = {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly type: 'Website' | 'Portal page'
  readonly href: string
  readonly destination: 'internal' | 'external'
}

export const resources: readonly ResourceRecord[] = [
  {
    id: 'resource-oiac-site',
    title: 'OIAC official website',
    description: 'Read public organizational news, statements, and information.',
    type: 'Website',
    href: 'https://oiac.org/',
    destination: 'external',
  },
  {
    id: 'resource-press-coverage',
    title: 'Press coverage',
    description: 'Review reporting and commentary connected to OIAC priorities.',
    type: 'Portal page',
    href: '/press-coverage',
    destination: 'internal',
  },
  {
    id: 'resource-contact',
    title: 'Contact OIAC',
    description: 'Reach the OIAC team for portal or membership support.',
    type: 'Portal page',
    href: '/contact',
    destination: 'internal',
  },
]
```

- [ ] **Step 6: Implement the page and authenticated route**

Render a `PageHeader`, an accessible list of resource cards, internal links with React Router `Link`, external links with `target="_blank" rel="noreferrer"`, and `EmptyState` for an empty injected list. Register `<Route path="/resources" element={<Resources />} />` only in the authenticated route table.

- [ ] **Step 7: Run the focused tests and verify GREEN**

Run: `npm test -- src/data/resources.test.ts src/pages/Resources.test.tsx src/App.test.tsx src/components/PortalNav.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: all tests pass and PortalNav still contains no Resources link.

- [ ] **Step 8: Commit the protected Resources page**

```powershell
git add -- oiac-engage/src/data/resources.ts oiac-engage/src/data/resources.test.ts oiac-engage/src/pages/Resources.tsx oiac-engage/src/pages/Resources.test.tsx oiac-engage/src/App.tsx oiac-engage/src/App.test.tsx
git commit -m "Add protected Resources page"
```

### Task 4: Responsive anonymous and Resources visual system

**Files:**
- Modify: `oiac-engage/src/styles/theme.css`
- Modify: `oiac-engage/index.html`

**Interfaces:**
- Consumes: class names introduced in Tasks 2 and 3.
- Produces: Figma-aligned anonymous header, continuous-image hero, footer, protected resource cards, responsive layouts, focus states, and reduced-motion behavior.

- [ ] **Step 1: Add the anonymous design tokens and shared button rules**

Keep the current core tokens and add explicit anonymous layout values:

```css
:root {
  --anonymous-max-width: 97.5rem;
  --anonymous-gutter: clamp(1rem, 4vw, 2.5rem);
  --anonymous-hero-radius: 1rem;
  --anonymous-overlay: rgb(42 62 58 / 78%);
}

.button {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  padding: 0.65rem 1.25rem;
  font-weight: 700;
  text-decoration: none;
}

.button--primary {
  background: var(--color-primary);
  color: #fff;
}
```

- [ ] **Step 2: Implement the continuous-image hero**

The image must exist on the hero itself and the overlay must cover the same full rectangle. Do not create a lower pseudo-element or background layer.

```css
.anonymous-hero {
  position: relative;
  isolation: isolate;
  display: flex;
  min-height: clamp(31rem, 54vw, 39rem);
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  border-radius: var(--anonymous-hero-radius);
  background-image: url('/MainHomeImage.jpg');
  background-position: center;
  background-size: cover;
  color: #fff;
  padding: clamp(2rem, 5vw, 3.75rem);
}

.anonymous-hero::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background: linear-gradient(90deg, var(--anonymous-overlay) 0%, rgb(42 62 58 / 34%) 50%, transparent 78%);
  content: '';
}
```

The permitted gradient runs only left-to-right across the full photograph for text contrast. There must be no top-to-bottom gradient, separate CTA panel, or opaque lower block.

- [ ] **Step 3: Style the anonymous shell and Resource cards**

Align `.anonymous-header__inner`, `.anonymous-main`, and `.anonymous-footer__inner` to `--anonymous-max-width`; size the header logo without distortion; keep the footer divider, organization identity, and footer navigation quiet; and reuse existing card/border tokens for `.resource-grid` and `.resource-card`.

- [ ] **Step 4: Add tablet and mobile rules**

```css
@media (max-width: 720px) {
  .anonymous-brand span { display: none; }
  .anonymous-brand img { width: 7.5rem; }
  .anonymous-hero {
    min-height: 37rem;
    background-position: 52% center;
    padding: 2rem 1.5rem;
  }
  .anonymous-hero__action { align-self: stretch; }
  .anonymous-footer__inner { align-items: flex-start; flex-direction: column; }
  .anonymous-footer nav { flex-wrap: wrap; }
  .resource-grid { grid-template-columns: 1fr; }
}
```

Retain the existing `prefers-reduced-motion: reduce` block and visible `:focus-visible` rule.

- [ ] **Step 5: Verify compilation and inspect CSS for forbidden hero treatments**

Run: `npm run build`

Expected: TypeScript and Vite exit 0.

Run: `rg -n "anonymous-hero|linear-gradient|bottom" src/styles/theme.css`

Expected: the hero has one left-to-right overlay on the full image and no separate bottom pseudo-element or top-to-bottom gradient.

- [ ] **Step 6: Commit the responsive visual system**

```powershell
git add -- oiac-engage/src/styles/theme.css oiac-engage/index.html
git commit -m "Style anonymous OIAC experience"
```

### Task 5: Invitation-only local Power Pages policy

**Files:**
- Create: `oiac-engage/src/auth/powerPagesAuthSettings.test.ts`
- Modify: `oiac-engage/.powerpages-site/site-settings/Authentication-Registration-Enabled.sitesetting.yml`
- Modify: `oiac-engage/.powerpages-site/site-settings/Authentication-Registration-OpenRegistrationEnabled.sitesetting.yml`
- Modify: `oiac-engage/.powerpages-site/site-settings/Authentication-Registration-InvitationEnabled.sitesetting.yml`
- Modify: `oiac-engage/.powerpages-site/site-settings/Authentication-Registration-LocalLoginEnabled.sitesetting.yml`
- Modify: `oiac-engage/.powerpages-site/site-settings/Authentication-Registration-ExternalLoginEnabled.sitesetting.yml`
- Modify: `oiac-engage/.powerpages-site/site-settings/Authentication-Registration-AzureADLoginEnabled.sitesetting.yml`

**Interfaces:**
- Produces: tracked Power Pages metadata with registration enabled, open registration disabled, invitations enabled, local login enabled, external login disabled, and Azure AD login disabled.

- [ ] **Step 1: Invoke the Power Pages authentication skill**

Read and follow `power-pages:setup-auth` before editing native authentication metadata. Do not deploy during this task.

- [ ] **Step 2: Write the failing metadata test**

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const settings = {
  Enabled: true,
  OpenRegistrationEnabled: false,
  InvitationEnabled: true,
  LocalLoginEnabled: true,
  ExternalLoginEnabled: false,
  AzureADLoginEnabled: false,
} as const

describe('Power Pages authentication policy', () => {
  test.each(Object.entries(settings))('%s is %s', (fileName, expected) => {
    const yaml = readFileSync(
      new URL(`../../.powerpages-site/site-settings/Authentication-Registration-${fileName}.sitesetting.yml`, import.meta.url),
      'utf8',
    )
    expect(yaml).toMatch(new RegExp(`value:\\s*${expected}$`, 'm'))
  })
})
```

- [ ] **Step 3: Run the metadata test and verify RED**

Run: `npm test -- src/auth/powerPagesAuthSettings.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL for `OpenRegistrationEnabled`, `ExternalLoginEnabled`, and `AzureADLoginEnabled`, which are currently `true`.

- [ ] **Step 4: Change only the six required YAML values**

Set the files to these exact values without altering their IDs or names:

```text
Authentication/Registration/Enabled: true
Authentication/Registration/OpenRegistrationEnabled: false
Authentication/Registration/InvitationEnabled: true
Authentication/Registration/LocalLoginEnabled: true
Authentication/Registration/ExternalLoginEnabled: false
Authentication/Registration/AzureADLoginEnabled: false
```

- [ ] **Step 5: Run the metadata test and verify GREEN**

Run: `npm test -- src/auth/powerPagesAuthSettings.test.ts --no-file-parallelism --maxWorkers=1`

Expected: all six policy assertions pass.

- [ ] **Step 6: Review the metadata-only diff**

Run: `git diff -- oiac-engage/.powerpages-site/site-settings/Authentication-Registration-*.sitesetting.yml`

Expected: only the three conflicting `value:` lines change from `true` to `false`; the three already-correct files remain byte-for-byte unchanged and need not be staged.

- [ ] **Step 7: Commit the invitation-only policy**

```powershell
git add -- oiac-engage/src/auth/powerPagesAuthSettings.test.ts oiac-engage/.powerpages-site/site-settings/Authentication-Registration-OpenRegistrationEnabled.sitesetting.yml oiac-engage/.powerpages-site/site-settings/Authentication-Registration-ExternalLoginEnabled.sitesetting.yml oiac-engage/.powerpages-site/site-settings/Authentication-Registration-AzureADLoginEnabled.sitesetting.yml
git commit -m "Enforce invitation-only local registration"
```

### Task 6: Native Power Pages authentication shell and form theme

**Files:**
- Create: `oiac-engage/src/auth/powerPagesAuthTheme.test.ts`
- Modify: `oiac-engage/.powerpages-site/web-templates/header/Header.webtemplate.source.html`
- Modify: `oiac-engage/.powerpages-site/web-templates/footer/Footer.webtemplate.source.html`
- Modify: `oiac-engage/.powerpages-site/web-files/theme.css/theme.css`

**Interfaces:**
- Consumes: native Power Pages `.nav-account`, form, button, validation, Header, and Footer rendering contracts.
- Produces: branded anonymous native shell and scoped form styling without replacing Power Pages submission or validation logic.

- [ ] **Step 1: Write the failing tracked-theme contract test**

```ts
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const portalRoot = new URL('../../.powerpages-site/', import.meta.url)
const readPortalFile = (path: string) => readFileSync(new URL(path, portalRoot), 'utf8')

test('native auth templates use the OIAC anonymous shell', () => {
  const header = readPortalFile('web-templates/header/Header.webtemplate.source.html')
  const footer = readPortalFile('web-templates/footer/Footer.webtemplate.source.html')

  expect(header).toContain('class="auth-site-header"')
  expect(header).toContain('src="/logo.png"')
  expect(header).toContain('href="/SignIn?returnUrl=%2F"')
  expect(footer).toContain('class="auth-site-footer"')
  expect(footer).toContain('href="/resources"')
  expect(footer).toContain('href="/contact"')
})

test('native account styling is scoped and responsive', () => {
  const css = readPortalFile('web-files/theme.css/theme.css')
  expect(css).toContain('body:has(.nav-account)')
  expect(css).toContain('body:has(.forgot-password)')
  expect(css).toContain('.auth-site-header')
  expect(css).toContain('.auth-site-footer')
  expect(css).toContain('@media (max-width: 720px)')
})
```

- [ ] **Step 2: Run the theme contract test and verify RED**

Run: `npm test -- src/auth/powerPagesAuthTheme.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL because both tracked templates currently contain only `<div/>` and the auth namespace is absent from portal `theme.css`.

- [ ] **Step 3: Implement the native Header template**

```liquid
<header class="auth-site-header">
  <div class="auth-site-header__inner">
    <a class="auth-site-brand" href="/" aria-label="OIAC Engage home">
      <img src="/logo.png" alt="Organization of Iranian American Communities">
      <span>OIAC Engage</span>
    </a>
    {% unless user %}
      <a class="auth-site-button" href="/SignIn?returnUrl=%2F">Sign In</a>
    {% endunless %}
  </div>
</header>
```

- [ ] **Step 4: Implement the native Footer template**

```liquid
<footer class="auth-site-footer">
  <div class="auth-site-footer__inner">
    <div class="auth-site-footer__identity">
      <img src="/logo.png" alt="">
      <span>Organization of Iranian American Communities – U.S.</span>
    </div>
    <nav aria-label="Footer navigation">
      <a href="https://oiac.org/" target="_blank" rel="noopener noreferrer">oiac.org</a>
      <a href="/resources">Resources</a>
      <a href="/contact">Contact</a>
    </nav>
  </div>
</footer>
```

- [ ] **Step 5: Append a scoped native authentication theme**

Add one clearly delimited `OIAC native authentication` section to the end of tracked portal `theme.css`. Apply the same rules to the native account tabs and password-recovery surface by grouping `body:has(.nav-account)` and `body:has(.forgot-password)`; style these concrete surfaces:

```css
.auth-site-header,
.auth-site-footer { background: #fff; color: #49605c; }

.auth-site-header { border-bottom: 1px solid #dde3e2; }
.auth-site-footer { border-top: 1px solid #dde3e2; }

.auth-site-header__inner,
.auth-site-footer__inner {
  display: flex;
  width: min(97.5rem, calc(100% - 2rem));
  margin: 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.auth-site-brand img,
.auth-site-footer__identity img { width: 6.75rem; height: auto; }

:is(body:has(.nav-account), body:has(.forgot-password)) .wrapper-body {
  min-height: 46rem;
  background: #f9fafa;
  padding: clamp(3rem, 7vw, 6rem) 1rem;
}

:is(body:has(.nav-account), body:has(.forgot-password)) .page-copy {
  width: min(50rem, 100%);
  margin: 0 auto;
}

body:has(.nav-account) .nav-account {
  display: flex;
  overflow-x: auto;
  border-bottom: 1px solid #dde3e2;
}

body:has(.nav-account) .form-control {
  min-height: 3rem;
  border: 1px solid #9ab0ad;
  border-radius: 0.35rem;
}

body:has(.nav-account) .btn-primary,
.auth-site-button {
  min-height: 2.75rem;
  border-color: #3d4e4b;
  background: #3d4e4b;
  color: #fff;
}

@media (max-width: 720px) {
  .auth-site-brand span { display: none; }
  .auth-site-footer__inner { align-items: flex-start; flex-direction: column; }
  body:has(.nav-account) .form-horizontal .control-label { text-align: left; }
  body:has(.nav-account) .form-control,
  body:has(.nav-account) .btn { width: 100%; }
}
```

Also style focus, active tab, help text, validation summary, required markers, `Remember me`, and password-recovery link within the same grouped authentication namespace. Do not hide validation elements or rewrite native form markup with JavaScript.

- [ ] **Step 6: Run the theme contract and policy tests**

Run: `npm test -- src/auth/powerPagesAuthTheme.test.ts src/auth/powerPagesAuthSettings.test.ts --no-file-parallelism --maxWorkers=1`

Expected: both test files pass.

- [ ] **Step 7: Commit the native authentication presentation**

```powershell
git add -- oiac-engage/src/auth/powerPagesAuthTheme.test.ts oiac-engage/.powerpages-site/web-templates/header/Header.webtemplate.source.html oiac-engage/.powerpages-site/web-templates/footer/Footer.webtemplate.source.html oiac-engage/.powerpages-site/web-files/theme.css/theme.css
git commit -m "Theme native Power Pages authentication"
```

### Task 7: Accessibility and responsive visual verification tooling

**Files:**
- Create: `oiac-engage/scripts/capture-auth-redesign.mjs`
- Modify: `oiac-engage/scripts/audit-accessibility.mjs`
- Modify: `oiac-engage/package.json`

**Interfaces:**
- Produces: `npm run capture:auth` screenshots and an accessibility audit that covers anonymous Home plus every authenticated route, including Resources.

- [ ] **Step 1: Add an authenticated browser fixture to the accessibility audit**

Replace the flat route list with scenarios:

```js
const scenarios = [
  { name: 'anonymous-home', route: '/', authenticated: false },
  { name: 'member-home', route: '/', authenticated: true },
  { name: 'my-reports', route: '/my-reports', authenticated: true },
  { name: 'my-calendar', route: '/my-calendar', authenticated: true },
  { name: 'contact', route: '/contact', authenticated: true },
  { name: 'activity-log', route: '/activity/activity-log', authenticated: true },
  { name: 'events', route: '/activity/events', authenticated: true },
  { name: 'appointments', route: '/activity/appointments', authenticated: true },
  { name: 'press-coverage', route: '/press-coverage', authenticated: true },
  { name: 'resources', route: '/resources', authenticated: true },
]
```

Before navigating an authenticated scenario, inject the documented global:

```js
await page.addInitScript(() => {
  window.Microsoft = {
    Dynamic365: {
      Portal: {
        User: {
          userName: 'audit.member@oiac.org',
          firstName: 'Audit',
          lastName: 'Member',
          contactId: 'audit-contact',
        },
      },
    },
  }
})
```

- [ ] **Step 2: Create the repeatable screenshot script**

Reuse the audit script's Vite-server and Chromium-fallback pattern. Capture anonymous `/` at:

```js
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
]
```

Write full-page PNG files to `artifacts/auth-redesign/<name>.png`; create that exact directory with `mkdirSync(..., { recursive: true })` and close every page, context, browser, and Vite server in `finally` blocks.

- [ ] **Step 3: Add the package script**

```json
"capture:auth": "node scripts/capture-auth-redesign.mjs"
```

- [ ] **Step 4: Run the browser accessibility audit**

Run: `npm run audit:a11y`

Expected: zero WCAG 2 A/AA, 2.1 A/AA, and 2.2 AA violations for anonymous Home and all authenticated scenarios.

- [ ] **Step 5: Capture and inspect all three responsive screenshots**

Run: `npm run capture:auth`

Expected: `desktop.png`, `tablet.png`, and `mobile.png` exist under `oiac-engage/artifacts/auth-redesign/`.

Inspect each image and verify:

- the header contains only the logo/wordmark and Sign In;
- the hero photograph continues behind the lower CTA;
- no horizontal bottom gradient or solid panel appears;
- the mobile image crop remains intentional and the CTA does not overflow;
- the footer follows content and stacks cleanly on mobile.

- [ ] **Step 6: Keep generated screenshots out of source control**

Add `artifacts/` to `oiac-engage/.gitignore`; retain screenshots locally for review but do not stage them.

- [ ] **Step 7: Commit verification tooling**

```powershell
git add -- oiac-engage/scripts/capture-auth-redesign.mjs oiac-engage/scripts/audit-accessibility.mjs oiac-engage/package.json oiac-engage/.gitignore
git commit -m "Verify anonymous auth experience"
```

### Task 8: Complete verification and deployment handoff

**Files:**
- Modify only files implicated by concrete test, build, accessibility, or screenshot findings.

**Interfaces:**
- Produces: a locally verified source tree and an explicit real-site smoke-test checklist; does not deploy.

- [ ] **Step 1: Run the full unit suite**

Run: `npm test -- --no-file-parallelism --maxWorkers=1`

Expected: every test file and test passes.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite exit 0 and emit the current bundle into `dist/`.

- [ ] **Step 3: Rerun accessibility and visual verification**

Run: `npm run audit:a11y`

Expected: zero reported violations.

Run: `npm run capture:auth`

Expected: all three screenshots regenerate successfully and retain the approved continuous-image hero.

- [ ] **Step 4: Verify the Power Pages metadata boundary**

Run:

```powershell
git diff d0ab3db -- oiac-engage/.powerpages-site/site-settings oiac-engage/.powerpages-site/web-templates/header oiac-engage/.powerpages-site/web-templates/footer oiac-engage/.powerpages-site/web-files/theme.css
```

Expected: changes are limited to the three authentication policy values, Header/Footer source templates, and the appended scoped authentication CSS.

- [ ] **Step 5: Check repository hygiene**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: user-owned reference PNGs and Make export remain untouched; generated `artifacts/` and build output are ignored; no temporary `.codex-figma-*.png` file is staged.

- [ ] **Step 6: Prepare the real-site smoke-test checklist**

After a separately approved deployment, verify on the activated Power Pages URL:

1. Anonymous `/` shows only the approved landing shell.
2. Header and hero Sign In actions open the native local-account page.
3. External identity-provider buttons and demo-role chips are absent.
4. Register shows invitation-only guidance and a Redeem invitation path.
5. Invalid, expired, and already-redeemed codes show native accessible errors.
6. A valid invitation completes native account creation.
7. `/resources` redirects anonymous users with `returnUrl=%2Fresources` and returns them there after sign-in.
8. Authenticated users see the existing member navigation and can sign out.
9. Native auth header, form, tabs, errors, and footer match the approved responsive design.

- [ ] **Step 7: Stop before deployment**

Report the local verification evidence and ask for explicit deployment approval. Do not run `pac pages upload-code-site` or upload the tracked portal metadata in this task.

## Primary references

- Approved design specification: `docs/superpowers/specs/2026-08-26-oiac-engage-anonymous-auth-redesign-design.md`
- Supplied design: <https://wolf-flask-48679482.figma.site/>
- Microsoft Learn, SPA code sites and user context: <https://learn.microsoft.com/en-us/power-pages/configure/create-code-sites>
- Microsoft Learn, Power Pages authentication: <https://learn.microsoft.com/en-us/power-pages/security/authentication/configure-site>
