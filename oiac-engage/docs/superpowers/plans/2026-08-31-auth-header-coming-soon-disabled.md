# Authentication Header and Coming Soon Disabled States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a branded header on every native authentication page and make all unfinished navigation and Home content visibly disabled without changing implemented features.

**Architecture:** Render the authentication header server-side through the existing Power Pages `OIAC-Auth-Header` web template because native account pages are outside the React SPA. Use route-scoped Liquid and isolated inline header CSS so the disabled full-form stylesheet remains inactive. Add explicit React modifier classes and targeted theme rules for Coming Soon content.

**Tech Stack:** Power Pages Liquid/web templates, React 19, TypeScript, CSS, Vitest, Testing Library.

## Global Constraints

- Render the header on Sign In, Register, Redeem Invitation, and Forgot Password pages.
- Logo navigation targets `/`.
- Sign In uses a same-page form target only on `/SignIn`; other authentication routes target `/SignIn?returnUrl=%2F`.
- Keep the existing full authentication form stylesheet disabled.
- Keep Coming Soon items visible, noninteractive, and marked with `aria-disabled="true"`.
- Do not alter implemented feature navigation or behavior.

---

### Task 1: Native Authentication Header

**Files:**
- Modify: `.powerpages-site/web-templates/oiac-auth-header/OIAC-Auth-Header.webtemplate.source.html`
- Modify: `src/auth/powerPagesAuthTheme.test.ts`

**Interfaces:**
- Consumes: Power Pages Liquid `request.path`; existing `/logo.png` asset.
- Produces: `.auth-site-header`, `.auth-site-brand`, and `.auth-site-button` markup on supported native authentication routes.

- [ ] **Step 1: Replace the disabled-shell assertion with failing header behavior assertions**

Assert that the web template contains route detection, `/`, `/SignIn?returnUrl=%2F`, `#ContentContainer_MainContent_MainContent_LocalLogin`, the three auth header classes, and scoped responsive CSS. Continue asserting that the literal `<link rel="stylesheet" href="/auth.css?v=3">` remains commented and no auth footer is introduced.

- [ ] **Step 2: Run the auth theme test and verify failure**

Run:

```powershell
npm test -- src/auth/powerPagesAuthTheme.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the current template contains only the commented stylesheet link.

- [ ] **Step 3: Implement route-scoped Liquid header markup**

Use this structure in `OIAC-Auth-Header.webtemplate.source.html`:

```liquid
<!-- <link rel="stylesheet" href="/auth.css?v=3"> -->
{% assign auth_path = request.path | downcase %}
{% assign is_signin_page = false %}
{% if auth_path == '/signin' %}{% assign is_signin_page = true %}{% endif %}
{% if auth_path == '/signin' or auth_path == '/register' or auth_path contains '/account/login' %}
  <style>
    .auth-site-header { border-bottom: 1px solid #dde3e2; background: #fff; color: #49605c; font-family: Inter, "Segoe UI", Arial, sans-serif; }
    .auth-site-header__inner { display: flex; width: min(80rem, calc(100% - 2rem)); min-height: 6.5rem; margin: 0 auto; align-items: center; justify-content: space-between; gap: 1.5rem; }
    .auth-site-brand { display: flex; align-items: center; gap: .85rem; color: #3d4e4b; font-family: Georgia, serif; font-size: 1.2rem; font-weight: 600; text-decoration: none; }
    .auth-site-brand img { width: 6.75rem; height: auto; }
    .auth-site-button { display: inline-flex; min-height: 2.75rem; align-items: center; justify-content: center; border: 1px solid #3d4e4b; border-radius: .4rem; padding: .7rem 1.4rem; background: #3d4e4b; color: #fff; font-weight: 600; text-decoration: none; }
    .auth-site-brand:focus-visible, .auth-site-button:focus-visible { outline: 3px solid #c78528; outline-offset: 3px; }
    @media (max-width: 720px) { .auth-site-header__inner { min-height: 5.5rem; } .auth-site-brand span { display: none; } .auth-site-brand img { width: 6rem; } }
  </style>
  <header class="auth-site-header">
    <div class="auth-site-header__inner">
      <a class="auth-site-brand" href="/" aria-label="OIAC Engage home">
        <img src="/logo.png" alt="Organization of Iranian American Communities" width="392" height="154">
        <span>OIAC Engage</span>
      </a>
      {% if is_signin_page %}
        <a class="auth-site-button" href="#ContentContainer_MainContent_MainContent_LocalLogin">Sign In</a>
      {% else %}
        <a class="auth-site-button" href="/SignIn?returnUrl=%2F">Sign In</a>
      {% endif %}
    </div>
  </header>
{% endif %}
```

Style only `.auth-site-*` selectors. Match the anonymous header with a white surface, `#dde3e2` border, `#3d4e4b` action, 6.75rem desktop logo, 6rem mobile logo, visible gold focus outline, and a 720px responsive breakpoint.

- [ ] **Step 4: Run the auth theme test and verify pass**

Run the Step 2 command. Expected: all assertions PASS.

- [ ] **Step 5: Commit the native header task**

```powershell
git add .powerpages-site/web-templates/oiac-auth-header/OIAC-Auth-Header.webtemplate.source.html src/auth/powerPagesAuthTheme.test.ts
git commit -m "feat: restore native authentication header"
```

### Task 2: Disabled Coming Soon Visual Treatment

**Files:**
- Modify: `src/components/ContentCard.tsx`
- Modify: `src/components/PortalNav.tsx`
- Modify: `src/components/PortalNav.test.tsx`
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Home.test.tsx`
- Modify: `src/styles/theme.css`
- Modify: `src/styles/designRegression.test.ts`

**Interfaces:**
- Consumes: existing `comingSoon` booleans and `ComingSoonBadge`.
- Produces: explicit `portal-nav__link--coming-soon`, `dashboard-shortcut--coming-soon`, `dashboard-panel--coming-soon`, and `dashboard-section--coming-soon` modifiers.

- [ ] **Step 1: Add failing semantic and class assertions**

In `PortalNav.test.tsx`, require every disabled navigation item to have `portal-nav__link--coming-soon` in addition to `aria-disabled="true"`.

In `Home.test.tsx`, require:

```tsx
expect(activityShortcut).toHaveClass('dashboard-shortcut--coming-soon')
expect(meetingInvites).toHaveClass('dashboard-panel--coming-soon')
expect(teams).toHaveClass('dashboard-section--coming-soon')
expect(submissions).toHaveClass('dashboard-section--coming-soon')
```

Also assert section-level `aria-disabled="true"`, while Events, Resources, Upcoming Events, and implemented links remain active.

In `designRegression.test.ts`, require targeted selectors for the four modifiers and ensure no broad `:has(.coming-soon-badge)` selector is introduced.

- [ ] **Step 2: Run the focused UI tests and verify failure**

```powershell
npm test -- src/components/PortalNav.test.tsx src/pages/Home.test.tsx src/styles/designRegression.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the new modifiers and section-level disabled semantics do not exist.

- [ ] **Step 3: Add explicit modifiers in React markup**

- Add `portal-nav__link--coming-soon` to Activity Log, Appointments, and Press Coverage spans.
- Add `dashboard-shortcut--coming-soon` to Activity and Appointments shortcuts.
- Add `dashboard-panel--coming-soon` and `aria-disabled="true"` to Meeting Invites, Teams Announcements, and Training Resources. Extend `ContentCardProps` with optional `ariaDisabled?: boolean` and render `aria-disabled` only when true.
- Add `dashboard-section--coming-soon` and `aria-disabled="true"` to Teams & Resources and Volunteer Submissions sections.

- [ ] **Step 4: Add targeted faded styling**

Add CSS that:

- Gives disabled navigation and shortcuts `opacity: 0.58` and `cursor: not-allowed` without hover activation.
- Gives Coming Soon panels and section content a muted `#f5f7f6` surface or reduced saturation.
- Applies reduced opacity only to inactive bodies/grids/tables, not headings or `.coming-soon-badge`.
- Uses `pointer-events: none` only on inactive action/content areas, not entire semantic containers.
- Preserves readable title and badge contrast.

- [ ] **Step 5: Run focused UI tests and verify pass**

Run the Step 2 command. Expected: all focused tests PASS.

- [ ] **Step 6: Commit the Coming Soon task**

```powershell
git add src/components/PortalNav.tsx src/components/PortalNav.test.tsx src/components/ContentCard.tsx src/pages/Home.tsx src/pages/Home.test.tsx src/styles/theme.css src/styles/designRegression.test.ts
git commit -m "feat: fade disabled coming soon features"
```

### Task 3: Full Verification

**Files:**
- Verify only; no expected production file changes.

**Interfaces:**
- Consumes: completed Tasks 1 and 2.
- Produces: verified implementation ready for a separately authorized deployment.

- [ ] **Step 1: Run the complete test suite**

```powershell
npm test -- --no-file-parallelism --maxWorkers=1
```

Expected: 42 test files and 259 or more tests PASS.

- [ ] **Step 2: Run the production build**

```powershell
npm run build
```

Expected: TypeScript and Vite complete with exit code 0.

- [ ] **Step 3: Inspect the final diff**

Confirm only the approved authentication header, Coming Soon UI, tests, generated build artifacts, and skill-tracking metadata changed. Do not include `Minimal Volunteer Portal Design.make`.
