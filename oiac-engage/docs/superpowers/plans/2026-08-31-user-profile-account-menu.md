# User Profile and Account Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible header account menu and a custom `/profile` page that lets an approved signed-in user read and update their own Contact through the Power Pages Web API.

**Architecture:** Keep Dataverse transport and mapping in a focused profile service built on `powerPagesFetch`, keep form state and validation in a dedicated React page, and keep account-menu interaction in `PortalNav`. The existing approved-user route gate remains the UI boundary, while a Self-scoped Contact table permission supplies the actual write boundary.

**Tech Stack:** React 19, React Router 7, TypeScript, Vitest, Testing Library, Power Pages Web API, Power Pages YAML metadata.

## Global Constraints

- Display and edit only `firstname`, `lastname`, `address1_city`, and `address1_stateorprovince`; never display email on the profile page.
- Use the current Power Pages session `contactId`; never accept an arbitrary Contact ID from the URL.
- Use the existing `powerPagesFetch` wrapper for GET and PATCH requests.
- Keep anonymous and pending-approval experiences unchanged; expose `/profile` only inside the existing approved-user application shell.
- Grant Contact update only through the existing Self-scoped authenticated permission; keep global and district Contact permissions read-only.
- Do not deploy as part of implementation.

---

### Task 1: Profile Web API service

**Files:**
- Create: `src/features/profile/profileTypes.ts`
- Create: `src/features/profile/profileService.ts`
- Test: `src/features/profile/profileService.test.ts`

**Interfaces:**
- Consumes: `powerPagesFetch<T>(path, init)` from `src/shared/powerPagesApi.ts`.
- Produces: `normalizeProfileContactId(value): string | null`, `getUserProfile(contactId, signal): Promise<UserProfileValues>`, and `updateUserProfile(contactId, values): Promise<UserProfileValues>`.

- [ ] **Step 1: Write failing service tests**

Cover GUID normalization, invalid-ID rejection without a fetch, the exact GET `$select`, null-to-empty mapping, the exact PATCH headers/body, and blank optional values becoming `null`.

```ts
expect(powerPagesFetch).toHaveBeenCalledWith(
  `/_api/contacts(${contactId})?$select=contactid,firstname,lastname,address1_city,address1_stateorprovince`,
  { signal },
)

expect(powerPagesFetch).toHaveBeenCalledWith(`/_api/contacts(${contactId})`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', 'If-Match': '*' },
  body: JSON.stringify({
    firstname: 'Ava',
    lastname: 'Rahimi',
    address1_city: null,
    address1_stateorprovince: 'Virginia',
  }),
})
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm test -- src/features/profile/profileService.test.ts`

Expected: FAIL because the profile service and types do not exist.

- [ ] **Step 3: Implement the profile types and service**

Define a small editable value model and raw Dataverse record model. Normalize GUID braces, trim save values, map nullable strings, and throw before calling `powerPagesFetch` when the ID is invalid.

```ts
export type UserProfileValues = {
  firstName: string
  lastName: string
  city: string
  state: string
}

export async function getUserProfile(
  contactId: string,
  signal?: AbortSignal,
): Promise<UserProfileValues>

export async function updateUserProfile(
  contactId: string,
  values: UserProfileValues,
): Promise<UserProfileValues>
```

- [ ] **Step 4: Run the focused tests and confirm pass**

Run: `npm test -- src/features/profile/profileService.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the service**

```powershell
git add src/features/profile
git commit -m "feat: add profile Web API service"
```

---

### Task 2: Custom profile page

**Files:**
- Create: `src/pages/UserProfile.tsx`
- Test: `src/pages/UserProfile.test.tsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: `PortalUser`, `normalizeProfileContactId`, `getUserProfile`, `updateUserProfile`.
- Produces: `UserProfile({ user }: { user: PortalUser })` for routing in Task 3.

- [ ] **Step 1: Write failing page tests**

Mock the profile service and verify loading, successful field population, absence of email, missing-session handling without an API call, retry after load failure, required-name validation/focus, disabled saving state, successful save status, and retained values after save failure.

```tsx
render(<MemoryRouter><UserProfile user={approvedUser} /></MemoryRouter>)
expect(await screen.findByLabelText('First Name')).toHaveValue('Ava')
expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- src/pages/UserProfile.test.tsx`

Expected: FAIL because `UserProfile` does not exist.

- [ ] **Step 3: Implement page state and accessible form**

Use an AbortController for the initial request and abort on cleanup. Render the approved copy from the design spec, move focus to the first invalid required name field, use `role="alert"` for errors and `role="status"` for loading/success, and keep form inputs disabled while saving.

```tsx
<form onSubmit={handleSubmit} noValidate>
  <label htmlFor="profile-first-name">First Name</label>
  <input id="profile-first-name" required value={values.firstName} />
  <button type="submit" disabled={saving}>
    {saving ? 'Saving…' : 'Save changes'}
  </button>
</form>
```

- [ ] **Step 4: Add isolated responsive profile styling**

Add `.page--profile`, `.profile-card`, `.profile-form`, `.profile-form__grid`, and message selectors that reuse existing colors, borders, spacing, typography, focus styles, and breakpoints without changing unrelated pages.

- [ ] **Step 5: Run the focused page tests and confirm pass**

Run: `npm test -- src/pages/UserProfile.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the profile page**

```powershell
git add src/pages/UserProfile.tsx src/pages/UserProfile.test.tsx src/styles/theme.css
git commit -m "feat: add editable user profile page"
```

---

### Task 3: Header account menu and approved route

**Files:**
- Modify: `src/components/PortalNav.tsx`
- Modify: `src/components/PortalNav.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: `UserProfile` from Task 2 and the existing `PortalUser` session object.
- Produces: an accessible account-menu button plus the approved `/profile` route.

- [ ] **Step 1: Write failing navigation and route tests**

Assert the role badge is a button with `aria-expanded`, opens Profile and Sign out items, has no separate Sign out control when closed, and closes on Profile navigation, outside click, and Escape. Add App coverage showing approved users can render `/profile` while pending users are redirected to `/pending-approval`.

```tsx
await user.click(screen.getByRole('button', { name: /account menu/i }))
expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile')
expect(screen.getByRole('link', { name: 'Sign out' })).toHaveAttribute(
  'href',
  '/Account/Login/LogOff?returnUrl=%2F',
)
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm test -- src/components/PortalNav.test.tsx src/App.test.tsx`

Expected: FAIL because the account menu and route do not exist.

- [ ] **Step 3: Implement the account menu behavior**

Add account state/ref, accessible toggle semantics, click-outside and Escape handling, route-change cleanup, internal Profile navigation, and the existing portal Sign out URL inside the dropdown. Keep the activity submenu behavior intact.

- [ ] **Step 4: Register the approved profile route**

```tsx
<Route path="/profile" element={<UserProfile user={session.user} />} />
```

Place it only in the authenticated approved-user route tree so the existing anonymous and pending gates remain authoritative for UI routing.

- [ ] **Step 5: Style the account menu**

Add isolated `.portal-nav__account-toggle`, `.portal-nav__account-menu`, and `.portal-nav__account-dropdown` selectors. Align the desktop popup beneath the role button and use full-width touch targets within the existing mobile navigation panel.

- [ ] **Step 6: Run focused tests and confirm pass**

Run: `npm test -- src/components/PortalNav.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit routing and navigation**

```powershell
git add src/components/PortalNav.tsx src/components/PortalNav.test.tsx src/App.tsx src/App.test.tsx src/styles/theme.css
git commit -m "feat: add profile account menu"
```

---

### Task 4: Power Pages Contact security and Web API configuration

**Files:**
- Modify: `.powerpages-site/table-permissions/Contact-Self-Read.tablepermission.yml` (or rename to `Contact-Self-Manage.tablepermission.yml` while retaining its ID)
- Modify: `.powerpages-site/site-settings/Webapi-contact-fields.sitesetting.yml`
- Modify: `src/features/contacts/contactPowerPagesConfig.test.ts`

**Interfaces:**
- Consumes: the standard Contact fields used by Task 1.
- Produces: a Self-scoped read/write permission for authenticated users and an explicit Contact Web API allowlist containing all profile columns.

- [ ] **Step 1: Write failing configuration assertions**

Update the test to require Self scope, `read: true`, `write: true`, `create: false`, `delete: false`, authenticated-role assignment, and allowlisted `firstname`/`lastname`. Retain read-only assertions for global and district Contact permissions.

```ts
expect(contactSelfManage.read).toBe(true)
expect(contactSelfManage.write).toBe(true)
expect(contactSelfManage.create).toBe(false)
expect(contactSelfManage.scope).toBe(756150004)
expect(contactFields.value.split(',')).toEqual(expect.arrayContaining([
  'contactid', 'firstname', 'lastname', 'address1_city', 'address1_stateorprovince',
]))
```

- [ ] **Step 2: Run the configuration test and confirm failure**

Run: `npm test -- src/features/contacts/contactPowerPagesConfig.test.ts`

Expected: FAIL because Self write and the two name fields are not configured.

- [ ] **Step 3: Update permission and site setting metadata**

Set only the existing Contact Self permission to `write: true`, keep create/delete false and its authenticated web-role association, and add `firstname,lastname` to `Webapi/contact/fields`. Do not change broader Contact permissions.

- [ ] **Step 4: Run the configuration test and confirm pass**

Run: `npm test -- src/features/contacts/contactPowerPagesConfig.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the Power Pages configuration**

```powershell
git add .powerpages-site/table-permissions .powerpages-site/site-settings/Webapi-contact-fields.sitesetting.yml src/features/contacts/contactPowerPagesConfig.test.ts
git commit -m "feat: allow users to update their profile"
```

---

### Task 5: Full verification and implementation record

**Files:**
- Modify only if required by failures: files changed in Tasks 1-4

**Interfaces:**
- Consumes: all prior deliverables.
- Produces: a tested production build ready for a separately approved deployment.

- [ ] **Step 1: Run all automated tests**

Run: `npm test`

Expected: all Vitest files pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite complete successfully.

- [ ] **Step 3: Review the final diff and security boundary**

Run: `git diff HEAD~4 --check` and `git status --short`.

Confirm no profile email UI exists, no arbitrary Contact ID route exists, no global Contact write was granted, and the unrelated `../Minimal Volunteer Portal Design.make/` directory remains untouched.

- [ ] **Step 4: Record any verification-only fixes**

If verification required code changes, stage only task-owned files and commit them:

```powershell
git add src .powerpages-site
git commit -m "fix: complete profile feature verification"
```

Expected: no additional commit when no fixes were required.

