# OIAC Engage Make Theme and Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the supplied Minimal Volunteer Portal Design theme into the existing OIAC Engage SPA and add Volunteer, Staff, and Applicant Power Pages roles without regressing existing routes or accessibility.

**Architecture:** Keep the current React Router page/component structure and replace its visual tokens and shell presentation with the Make reference design. Store role labels and descriptions in a small typed module used by the Home page, while real authorization roles remain Power Pages YAML metadata under `.powerpages-site/web-roles`.

**Tech Stack:** React 19, TypeScript 5.7, React Router 7, CSS custom properties, Vitest, Testing Library, Power Pages code-site YAML.

## Global Constraints

- Preserve every existing public route and current test behavior.
- Use `#596e6a`, `#3d4e4b`, `#eef1f0`, `#f9fafa`, and `#dde3e2` as the Make-derived core palette.
- Use Source Serif 4 for display text and Inter for body text.
- Treat UI role descriptions as presentation only; Power Pages web roles are the authorization boundary.
- Preserve Administrators, Anonymous Users, and Authenticated Users unchanged.
- Create Volunteer, Staff, and Applicant with both default-role flags set to `false`.
- Do not deploy without a separate explicit request.
- Retain the create-webroles plugin's required usage-tracking site setting for the next deployment.

---

### Task 1: Typed portal role contract

**Files:**
- Create: `oiac-engage/src/data/portalRoles.test.ts`
- Create: `oiac-engage/src/data/portalRoles.ts`

**Interfaces:**
- Produces: `PortalRoleId`, `PortalRole`, and `portalRoles: readonly PortalRole[]`.

- [ ] **Step 1: Write the failing role-contract test**

```ts
expect(portalRoles.map((role) => role.name)).toEqual([
  'Member', 'Volunteer', 'Staff', 'Applicant',
])
expect(new Set(portalRoles.map((role) => role.id)).size).toBe(portalRoles.length)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/data/portalRoles.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL because `portalRoles.ts` does not exist.

- [ ] **Step 3: Implement the role metadata**

Create immutable records for Member, Volunteer, Staff, and Applicant with concise user-facing descriptions and a destination already present in the SPA.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/data/portalRoles.test.ts --no-file-parallelism --maxWorkers=1`

Expected: PASS.

### Task 2: Make-themed shell and role entry points

**Files:**
- Modify: `oiac-engage/src/components/AppShell.tsx`
- Modify: `oiac-engage/src/components/PortalNav.tsx`
- Modify: `oiac-engage/src/pages/Home.tsx`
- Modify: `oiac-engage/src/pages/Home.test.tsx`
- Modify: `oiac-engage/src/components/PortalNav.test.tsx`

**Interfaces:**
- Consumes: `portalRoles`.
- Produces: a compact Make-style wordmark header, a Power Pages sign-in link, and role cards on Home.

- [ ] **Step 1: Extend tests for the requested shell behavior**

```tsx
expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
  'href', '/SignIn?returnUrl=%2F',
)
expect(screen.getByRole('heading', { name: 'Ways to participate' })).toBeInTheDocument()
expect(screen.getByRole('link', { name: /Volunteer/ })).toBeInTheDocument()
expect(screen.getByRole('link', { name: /Staff/ })).toBeInTheDocument()
expect(screen.getByRole('link', { name: /Applicant/ })).toBeInTheDocument()
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/pages/Home.test.tsx src/components/PortalNav.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: FAIL because the sign-in link and role entry points are absent.

- [ ] **Step 3: Implement the minimal shell and Home markup**

Keep semantic landmarks, keyboard navigation, route focus management, and responsive-menu behavior unchanged. Add role entry links that point only to existing routes.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- src/pages/Home.test.tsx src/components/PortalNav.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: PASS.

### Task 3: Make visual system

**Files:**
- Modify: `oiac-engage/src/styles/theme.css`
- Modify: `oiac-engage/index.html`

**Interfaces:**
- Consumes: all existing component class names plus new shell and role-card classes.
- Produces: Make-derived palette, typography, spacing, borders, states, and responsive layouts.

- [ ] **Step 1: Replace the global design tokens**

Set the exact core palette from Global Constraints, use compact radii and near-flat surfaces, and retain visible focus and reduced-motion rules.

- [ ] **Step 2: Restyle the shell, navigation, hero, cards, lists, forms, and responsive states**

Use the reference design's quiet green header, serif editorial headings, thin rules, low-density dashboard grid, and one signature vertical brand rule on the welcome panel.

- [ ] **Step 3: Update font imports and metadata**

Load Inter and Source Serif 4 in `index.html`; keep the existing language, title, and description behavior.

- [ ] **Step 4: Verify the production compiler**

Run: `npm run build`

Expected: TypeScript and Vite exit 0.

### Task 4: Power Pages web-role metadata

**Files:**
- Create: `oiac-engage/.powerpages-site/web-roles/volunteer.webrole.yml` with ID `b743c85b-4db3-484a-bd49-ff5ff975ec2b`
- Create: `oiac-engage/.powerpages-site/web-roles/staff.webrole.yml` with ID `89a4fe62-4c85-48cb-b848-7603374faca2`
- Create: `oiac-engage/.powerpages-site/web-roles/applicant.webrole.yml` with ID `c0ff381c-44a5-497b-b738-a442d62b07c1`

**Interfaces:**
- Produces: three Power Pages web roles with generated UUID v4 identifiers.

- [ ] **Step 1: Generate one UUID per role using the plugin script**

Use the generated IDs assigned to the files above. They were produced by running the plugin's `generate-uuid.js` script once per role.

- [ ] **Step 2: Create each four-field YAML record**

```yaml
anonymoususersrole: false
authenticatedusersrole: false
id: b743c85b-4db3-484a-bd49-ff5ff975ec2b
name: Volunteer
```

- [ ] **Step 3: Validate every role file**

Confirm all six role IDs are unique, UUID v4 syntax is valid, and only the existing Anonymous Users and Authenticated Users records carry their respective default flags.

### Task 5: Full verification

**Files:**
- Modify only files implicated by concrete failures.

**Interfaces:**
- Produces: verified unit, build, and accessibility results.

- [ ] **Step 1: Run the full unit suite**

Run: `npm test -- --no-file-parallelism --maxWorkers=1`

Expected: all test files and tests pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 3: Run the browser accessibility audit**

Run: `npm run audit:a11y`

Expected: zero WCAG violations across all registered routes.

- [ ] **Step 4: Review the final diff**

Confirm the Make export itself remains untouched and deployment metadata changes are limited to the three requested role records plus the plugin-required CreateWebroles tracking counter.
