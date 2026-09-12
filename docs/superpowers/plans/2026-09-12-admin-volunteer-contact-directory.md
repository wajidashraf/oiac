# Admin Volunteer Contact Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users with the exact Power Pages `Administrators` role list every Contact whose job title contains `volunteer` and edit approved Contact fields in an accessible same-page modal while keeping email read-only and preserving the existing non-admin district directory.

**Architecture:** Extend the existing Contact types and Web API service with a separate admin-volunteer query and a safe PATCH operation. Add an explicit admin mode to the current directory hook, keep modal draft/save state in a focused component, and let the Contact page coordinate selection and reload. React role visibility is paired with an administrator-only Global Contact write permission; existing district and self-service permissions remain unchanged.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, React Icons, Power Pages Web API, Dataverse, PAC CLI, Power Pages metadata YAML.

## Global Constraints

- Use the exact existing role name `Administrators`; role comparisons remain case-insensitive through `hasRole`.
- Admin collection requests must always include `contains(jobtitle,'volunteer')`, including searches and continuation pages.
- Non-admin users retain the existing signed-in-Contact District lookup and district-scoped read-only directory.
- Email is rendered read-only and must never appear in an admin PATCH body.
- Contact ID and derived Full Name are never editable.
- Editable fields are First Name, Last Name, Job Title, Mobile Phone, City, State/Province, Postal Code, and District.
- Last Name is required; other editable fields and District may be cleared.
- Admin search and both directory modes retain 15-record Dataverse cursor pagination.
- Modal Close, Escape, and backdrop dismissal are blocked while saving.
- Do not add dependencies or create/delete Contact capabilities.
- Generate Power Pages YAML with deterministic plugin scripts; do not hand-author generated metadata.
- Do not deploy or publish without separate explicit user approval.

---

### Task 1: Admin Contact Query, Mapping, and Safe Update Service

**Files:**
- Modify: `oiac-engage/src/features/contacts/contactTypes.ts`
- Modify: `oiac-engage/src/features/contacts/contactService.ts`
- Modify: `oiac-engage/src/features/contacts/contactService.test.ts`

**Interfaces:**
- Consumes: `powerPagesFetch` from `src/shared/powerPagesApi.ts`.
- Produces expanded `ContactRecord` and `DistrictContact` types plus:

```ts
export type AdminContactQuery = {
  readonly search: string
  readonly nextLink?: string | null
}

export type AdminContactUpdate = {
  readonly firstName: string
  readonly lastName: string
  readonly jobTitle: string
  readonly mobilePhone: string
  readonly city: string
  readonly stateOrProvince: string
  readonly postalCode: string
  readonly districtId: string | null
}

export function buildAdminContactsQuery(query: AdminContactQuery): string
export function getAdminVolunteerContacts(
  query: AdminContactQuery,
  signal?: AbortSignal,
): Promise<ContactPage>
export function updateAdminContact(
  contactId: string,
  values: AdminContactUpdate,
): Promise<void>
```

- [ ] **Step 1: Expand the service tests before production code**

Add failing tests that require mapped Contacts to contain these values:

```ts
expect(result.contacts[0]).toEqual({
  id: CONTACT_ID,
  fullName: 'Sara Rahimi',
  firstName: 'Sara',
  lastName: 'Rahimi',
  email: 'sara@example.org',
  jobTitle: 'Volunteer Coordinator',
  mobilePhone: '202-555-0100',
  city: 'Washington',
  stateOrProvince: 'DC',
  postalCode: '20001',
  districtName: 'District 1',
  districtId: DISTRICT_ID,
})
```

Update missing-value coverage so optional values, including `districtId`, map to `null`. Preserve malformed GUID and collection-envelope rejection coverage.

- [ ] **Step 2: Add failing tests for the bounded admin query**

Parse `buildAdminContactsQuery({ search: '' })` with `URLSearchParams` and assert:

```ts
expect(params.get('$select')).toBe(
  'contactid,address1_city,address1_stateorprovince,address1_postalcode,'
  + '_mss_district_value,emailaddress1,firstname,jobtitle,lastname,mobilephone',
)
expect(params.get('$filter')).toBe("contains(jobtitle,'volunteer')")
expect(params.get('$orderby')).toBe('lastname asc,firstname asc,contactid asc')
```

For search text ` O'Connor `, assert the filter is the volunteer boundary followed by an escaped OR group over `firstname`, `lastname`, `emailaddress1`, `mobilephone`, `jobtitle`, `address1_city`, `address1_stateorprovince`, and `address1_postalcode`. Assert the query has no `$skip` or `$top`.

Mock a page response with `@odata.nextLink`, call `getAdminVolunteerContacts`, and assert the request uses the existing `odata.maxpagesize=15` preference. Pass a valid same-origin Contacts continuation link and assert it is used unchanged; pass a cross-origin or non-Contacts link and assert it is rejected.

- [ ] **Step 3: Add failing safe-update tests**

Call `updateAdminContact(CONTACT_ID, values)` and assert the exact PATCH:

```ts
expect(powerPagesFetch).toHaveBeenCalledWith(`/_api/contacts(${CONTACT_ID})`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', 'If-Match': '*' },
  body: JSON.stringify({
    firstname: 'Sara',
    lastname: 'Rahimi',
    jobtitle: 'Volunteer Coordinator',
    mobilephone: null,
    address1_city: 'Washington',
    address1_stateorprovince: 'DC',
    address1_postalcode: '20001',
    'mss_District@odata.bind': `/mss_districts(${DISTRICT_ID})`,
  }),
})
```

Assert blank optional strings become `null`, a cleared District produces `'mss_District@odata.bind': null`, and the serialized body contains neither `emailaddress1`, `contactid`, nor `fullname`. Assert invalid Contact or District IDs and an empty trimmed Last Name reject before any request.

- [ ] **Step 4: Run the service tests and verify RED**

```powershell
npm test -- src/features/contacts/contactService.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because the expanded mapping, admin query, and update operation do not exist.

- [ ] **Step 5: Implement the minimal types, query, mapping, and PATCH operation**

Keep `getDistrictContacts` and `getLoggedInUserDistrict` public behavior intact. Share the exact admin select list and existing continuation-link validator. Build the search filter from a fixed `ADMIN_SEARCH_FIELDS` tuple and `escapeODataString`.

Map Full Name from trimmed First Name and Last Name so the admin query does not need to select the derived `fullname` field:

```ts
const fullName = [firstName, lastName].filter(Boolean).join(' ') || null
```

Normalize GUID braces/case, permit a null District, validate the collection envelope, and forward abort signals. Implement PATCH using only the approved fields and `If-Match: *`.

- [ ] **Step 6: Run the service tests and verify GREEN**

Run the Task 1 test command. Expected: all Contact service tests PASS.

- [ ] **Step 7: Commit the service slice**

```powershell
git add oiac-engage/src/features/contacts/contactTypes.ts oiac-engage/src/features/contacts/contactService.ts oiac-engage/src/features/contacts/contactService.test.ts
git commit -m "feat: add admin volunteer contact service"
```

---

### Task 2: Explicit Admin Mode in Contact Directory State

**Files:**
- Modify: `oiac-engage/src/features/contacts/useDistrictContacts.ts`
- Modify: `oiac-engage/src/features/contacts/useDistrictContacts.test.tsx`

**Interfaces:**
- Consumes: `getAdminVolunteerContacts`, `getDistrictContacts`, and `getLoggedInUserDistrict` from Task 1.
- Produces:

```ts
export type ContactDirectoryOptions = {
  readonly isAdmin?: boolean
}

export type DistrictContactsState = {
  // existing fields
  readonly reload: () => void
}

export function useDistrictContacts(
  contactId?: string,
  options?: ContactDirectoryOptions,
): DistrictContactsState
```

- [ ] **Step 1: Write failing hook tests for administrator mode**

Mock `getAdminVolunteerContacts`. Render:

```ts
const { result } = renderHook(() => useDistrictContacts(CONTACT_ID, { isAdmin: true }))
```

Assert admin mode immediately calls `getAdminVolunteerContacts({ search: '', nextLink: null }, signal)`, never calls `getLoggedInUserDistrict` or `getDistrictContacts`, and becomes ready. Capture the admin request signal and assert unmount aborts it.

Exercise debounced search and cursor pagination in admin mode. Assert every request remains routed through `getAdminVolunteerContacts`, search resets to page 1, and a late aborted result cannot replace a newer result.

- [ ] **Step 2: Write failing tests for reload, errors, and preserved district mode**

Reject the admin request and assert the existing non-sensitive Contacts error, then call `retry` and assert only the admin collection reloads. Call the new `reload` callback after a ready response and assert the current query runs again.

Retain the existing district-mode tests and update calls to pass `{ isAdmin: false }` where explicit behavior improves clarity. Confirm a missing Contact or District still produces the existing states only in district mode.

- [ ] **Step 3: Run the hook tests and verify RED**

```powershell
npm test -- src/features/contacts/useDistrictContacts.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because admin mode and `reload` are absent.

- [ ] **Step 4: Implement mode-specific effects without coupling their dependencies**

Derive `const isAdmin = options?.isAdmin === true`. In the District-resolution effect, reset state and return without requesting the signed-in Contact when `isAdmin` is true. In the collection effect, request when either admin mode is active or `districtId` is present:

```ts
const request = isAdmin
  ? getAdminVolunteerContacts({ search: debouncedSearch, nextLink: currentNextLink }, signal)
  : getDistrictContacts({ districtId: districtId!, search: debouncedSearch, nextLink: currentNextLink }, signal)
```

Use primitive dependencies, preserve request-ID and abort guards, and keep cursor history isolated when mode, search, or page changes. Implement `reload` as a stable functional retry-key increment; `retry` selects District retry only for a non-admin missing/failed District and otherwise reloads Contacts.

- [ ] **Step 5: Run the hook tests and verify GREEN**

Run the Task 2 test command. Expected: all directory-hook tests PASS.

- [ ] **Step 6: Commit the hook slice**

```powershell
git add oiac-engage/src/features/contacts/useDistrictContacts.ts oiac-engage/src/features/contacts/useDistrictContacts.test.tsx
git commit -m "feat: load admin volunteer contact directory"
```

---

### Task 3: Accessible Admin Contact Edit Modal

**Files:**
- Create: `oiac-engage/src/features/contacts/AdminContactEditModal.tsx`
- Create: `oiac-engage/src/features/contacts/AdminContactEditModal.test.tsx`
- Modify: `oiac-engage/src/styles/theme.css`

**Interfaces:**
- Consumes: `DistrictContact`, `AdminContactUpdate`, `updateAdminContact`, the existing `DistrictLookup`, and existing `searchDistricts` behavior.
- Produces:

```ts
export type AdminContactEditModalProps = {
  readonly contact: DistrictContact
  readonly returnFocusTo: HTMLButtonElement | null
  readonly onClose: () => void
  readonly onSaved: () => void
}
```

- [ ] **Step 1: Write failing rendering and form tests**

Render a complete Contact and assert a named `dialog` and `form` contain labeled controls initialized from the Contact. Assert Email has `readOnly`, remains enabled for copying, and Contact ID and Full Name are absent as form fields. Assert Last Name has `required` and the other editable text controls do not.

Mock the District lookup service, focus its combobox, enter search text, select a returned District, and assert the selection is visible. Clear it and assert the selection is removed.

- [ ] **Step 2: Write failing save-state and safe-payload interaction tests**

Mock `updateAdminContact`. Edit all fields, choose a District, submit, and assert `updateAdminContact(contact.id, values)` receives no email property. While its promise is pending, assert Save reads `Saving…`, Save and Close are disabled, Escape and backdrop clicks do not close, and a repeat submit makes only one update call.

Resolve the request and assert `onSaved` runs once. Reject it and assert the modal stays open with `Contact changes could not be saved. Try again.`. Clear Last Name and assert `Last Name is required.` without calling the service.

- [ ] **Step 3: Write failing accessibility lifecycle tests**

Assert Close receives initial focus, Tab and Shift+Tab wrap inside the dialog, direct backdrop click closes when idle, an inside click does not, Escape closes when idle, body overflow is locked while mounted and restored on cleanup, and focus returns to `returnFocusTo`.

- [ ] **Step 4: Run modal tests and verify RED**

```powershell
npm test -- src/features/contacts/AdminContactEditModal.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because the modal does not exist.

- [ ] **Step 5: Implement modal draft, validation, and save lifecycle**

Initialize controlled strings once from `contact`, and initialize District as:

```ts
const [district, setDistrict] = useState<DistrictOption | null>(
  contact.districtId
    ? { id: contact.districtId, name: contact.districtName ?? 'Assigned district' }
    : null,
)
```

On submit, trim-check Last Name, acquire a synchronous `savingRef` lock, call `updateAdminContact`, then invoke `onSaved`. Keep a user-facing error in component state and always release the lock in `finally`. Do not call `onClose` after success; the page's `onSaved` callback owns selection removal and reload.

Use a labeled `role="dialog"`, `aria-modal="true"`, and `<form aria-label="Edit volunteer contact">`. Implement focus trap, Escape, backdrop, body-scroll lock, and restoration using the same proven lifecycle pattern as `TeamAnnouncementModal`, adding the `isSaving` guard.

- [ ] **Step 6: Add modal and lookup styling**

Create `.admin-contact-modal` as a fixed dimmed backdrop and `.admin-contact-modal__dialog` as a centered, bounded, responsive surface. Use a two-column form grid that collapses on mobile, visible required/error states, sticky-safe actions, and 44-pixel controls. Reuse existing colors, typography, radii, and buttons.

Make the existing `.meeting-report-lookup` rules apply to both `.page--report-form` and `.admin-contact-modal` using grouped `:is(...)` scopes, without changing Meeting Report rendering.

- [ ] **Step 7: Run modal and existing lookup tests and verify GREEN**

```powershell
npm test -- src/features/contacts/AdminContactEditModal.test.tsx src/features/meetingReports/meetingReportLookups.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: all new modal tests and existing lookup regressions PASS.

- [ ] **Step 8: Commit the modal slice**

```powershell
git add oiac-engage/src/features/contacts/AdminContactEditModal.tsx oiac-engage/src/features/contacts/AdminContactEditModal.test.tsx oiac-engage/src/styles/theme.css
git commit -m "feat: add admin contact edit modal"
```

---

### Task 4: Role-Gated Contact Page Integration

**Files:**
- Modify: `oiac-engage/src/App.tsx`
- Modify: `oiac-engage/src/App.test.tsx`
- Modify: `oiac-engage/src/pages/Contact.tsx`
- Modify: `oiac-engage/src/pages/Contact.test.tsx`
- Modify: `oiac-engage/src/styles/theme.css`

**Interfaces:**
- Consumes: Task 2 `useDistrictContacts(contactId, { isAdmin })` and Task 3 `AdminContactEditModal`.
- Produces `Contact({ user, isAdmin }: { user: PortalUser; isAdmin: boolean })` and the complete role-specific directory experience.

- [ ] **Step 1: Write failing Contact page role tests**

Update the default fixture for Task 1's expanded Contact shape and include a `reload` mock. Render non-admin mode and preserve all current assertions: district copy, no Actions header, no Edit button, no modal, and `useDistrictContacts(user.contactId, { isAdmin: false })`.

Render admin mode and assert:

```ts
expect(screen.getByText('Volunteer contacts across all districts.')).toBeInTheDocument()
expect(useDistrictContacts).toHaveBeenCalledWith(user.contactId, { isAdmin: true })
expect(within(table).getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()
expect(within(table).getByRole('button', { name: 'Edit Sara Rahimi' })).toBeInTheDocument()
```

Assert the admin empty state reads `No volunteer contacts are available.` and admin search-empty state names the search without mentioning the user's District.

- [ ] **Step 2: Write failing page-to-modal interaction tests**

Click `Edit Sara Rahimi`, assert the contact modal opens, close it, and assert focus returns to the Edit button. Submit a successful edit through the modal and assert the modal closes and `reload` runs exactly once. Verify a failed save keeps the modal open and does not reload.

- [ ] **Step 3: Write failing App role-wiring test**

Render `/contact` with an `Administrators` session and assert admin copy/actions appear. Render it with `Volunteer` and `Authenticated Users` roles and assert district copy with no Edit action. Mock only the Contact directory boundary needed to keep the route test deterministic.

- [ ] **Step 4: Run page and App tests and verify RED**

```powershell
npm test -- src/pages/Contact.test.tsx src/App.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because Contact does not accept `isAdmin`, render actions, or open the modal.

- [ ] **Step 5: Wire exact role detection in App**

Change the route to:

```tsx
<Route
  path="/contact"
  element={(
    <Contact
      user={completedSession.user}
      isAdmin={hasRole(completedSession, 'Administrators')}
    />
  )}
/>
```

- [ ] **Step 6: Implement role-specific table and modal coordination**

Pass `{ isAdmin }` to the directory hook. Use role-specific header, empty-state, table label, and final Actions column. Store selected state as the Contact plus `event.currentTarget`. Render one Edit button only in admin rows.

Render `AdminContactEditModal` when selected. Idle Close clears selection. `onSaved` clears selection and calls `directory.reload()`. Keep the table mounted during a reload so the modal cleanup can restore focus to its trigger.

- [ ] **Step 7: Add focused admin action styling**

Style `.contact-directory__edit` as a compact quiet action with visible hover/focus states. Increase the admin table minimum width for its Actions column without changing the non-admin mobile horizontal-scroll behavior.

- [ ] **Step 8: Run page, App, modal, and hook tests and verify GREEN**

```powershell
npm test -- src/pages/Contact.test.tsx src/App.test.tsx src/features/contacts/AdminContactEditModal.test.tsx src/features/contacts/useDistrictContacts.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: all role, page, modal, and hook tests PASS.

- [ ] **Step 9: Commit the page integration**

```powershell
git add oiac-engage/src/App.tsx oiac-engage/src/App.test.tsx oiac-engage/src/pages/Contact.tsx oiac-engage/src/pages/Contact.test.tsx oiac-engage/src/styles/theme.css
git commit -m "feat: let administrators edit volunteer contacts"
```

---

### Task 5: Administrator Contact Write Configuration

**Files:**
- Modify: `oiac-engage/src/features/contacts/contactPowerPagesConfig.test.ts`
- Create: `oiac-engage/scripts/update-powerpages-site-setting.mjs`
- Create: `oiac-engage/scripts/update-powerpages-site-setting.test.mjs`
- Modify through deterministic script: `oiac-engage/.powerpages-site/site-settings/Webapi-contact-fields.sitesetting.yml`
- Create through deterministic script: `oiac-engage/.powerpages-site/table-permissions/Administrators-Contact-Global-Update.tablepermission.yml`

**Interfaces:**
- Consumes: live OIAC Test/UAT Contact metadata and Administrators role ID `6ec72c3e-4f1b-420f-9565-d20047b12c1f`.
- Produces: server-enforced Global Contact update access for Administrators and browser allowlisting for Postal Code.

- [ ] **Step 1: Validate exact live Contact and relationship names**

Temporarily select the existing PAC profile for `https://org97063a46.crm.dynamics.com/`, run `pac modelbuilder build` for `contact` into a verified workspace-local temporary directory, and restore the previously active PAC profile in `finally`.

Confirm the generated model contains the exact attributes `contactid`, `firstname`, `lastname`, `emailaddress1`, `jobtitle`, `mobilephone`, `address1_city`, `address1_stateorprovince`, `address1_postalcode`, and `_mss_district_value`, plus the single-valued District navigation property used for `mss_District@odata.bind`. If the navigation property differs, update Task 1's tests and implementation to the generated case-sensitive name before proceeding. Safely delete only the validated temporary metadata directory.

- [ ] **Step 2: Write a failing deterministic-updater test**

Create a Node built-in test that writes a temporary site-setting fixture, invokes:

```js
updateSiteSetting({
  filePath,
  expectedName: 'Webapi/contact/fields',
  expectedId: '6dcbad52-ea17-47a3-ae96-d2854e9d30d8',
  value: 'contactid,firstname,address1_postalcode',
})
```

Assert the output preserves the fixture's description, ID, and name; replaces only
the value with a safely quoted YAML scalar; writes keys in alphabetical order; and
ends with one newline. Add rejection cases for a mismatched name, mismatched ID,
missing file, duplicate key, and unsupported multiline value. The CLI must expose
`--filePath`, `--expectedName`, `--expectedId`, and `--value` arguments and emit a
JSON object containing the updated path.

- [ ] **Step 3: Run the updater test and verify RED**

```powershell
node --test scripts/update-powerpages-site-setting.test.mjs
```

Expected: FAIL because `update-powerpages-site-setting.mjs` does not exist.

- [ ] **Step 4: Implement the deterministic existing-setting updater**

Export `updateSiteSetting({ filePath, expectedName, expectedId, value })`. Resolve the
file path, require a `.sitesetting.yml` suffix, parse only single-line `key: value`
entries, reject duplicates or malformed lines, unwrap quoted scalar values for name
and ID comparison, replace `value`, then serialize sorted keys using the same scalar
quoting rules as the Power Pages generator. Use `fs.writeFileSync` only after every
validation passes. Add a direct-execution CLI guard and required-argument errors.

- [ ] **Step 5: Run the updater test and verify GREEN**

Run the Task 5 Step 3 command. Expected: every updater test PASS.

- [ ] **Step 6: Write the failing Power Pages configuration assertions**

Update the Contact fields assertion to require exactly:

```text
contactid,firstname,lastname,fullname,emailaddress1,mobilephone,address1_city,address1_stateorprovince,address1_postalcode,jobtitle,mss_district,_mss_district_value
```

Use an eager `import.meta.glob` map for table permissions so the absent administrator file produces an assertion failure instead of an import-resolution error. Assert `Administrators-Contact-Global-Update.tablepermission.yml` references only role ID `6ec72c3e-4f1b-420f-9565-d20047b12c1f`, uses `entitylogicalname: contact`, Global scope `756150000`, `read: true`, `write: true`, and `create`, `delete`, `append`, and `appendto` false.

- [ ] **Step 7: Run the configuration test and verify RED**

```powershell
npm test -- src/features/contacts/contactPowerPagesConfig.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because Postal Code is absent from the allowlist and the administrator permission does not exist.

- [ ] **Step 8: Update the Contact fields setting through the tested script**

Run the deterministic updater with the existing setting identity and complete value:

```powershell
node scripts/update-powerpages-site-setting.mjs --filePath ".powerpages-site/site-settings/Webapi-contact-fields.sitesetting.yml" --expectedName "Webapi/contact/fields" --expectedId "6dcbad52-ea17-47a3-ae96-d2854e9d30d8" --value "contactid,firstname,lastname,fullname,emailaddress1,mobilephone,address1_city,address1_stateorprovince,address1_postalcode,jobtitle,mss_district,_mss_district_value"
```

Read the output and confirm the existing setting ID, name, and description are preserved. Do not use `create-site-setting.js` for this update because it correctly refuses duplicate setting names, and do not hand-edit the YAML.

- [ ] **Step 9: Generate administrator-only Global write permission**

```powershell
node C:/Users/Administrator/.codex/plugins/cache/power-platform-skills/power-pages/2.6.2/scripts/create-table-permission.js --projectRoot C:/Users/Administrator/Videos/PersonalPics/OAIC/oiac-engage --permissionName "Administrators Contact Global Update" --tableName "contact" --webRoleIds "6ec72c3e-4f1b-420f-9565-d20047b12c1f" --scope "Global" --read --write
```

Do not add create, delete, append, or append-to flags. Administrators already inherit the existing authenticated Contact/District association permissions needed for District binding.

- [ ] **Step 10: Validate configuration and verify GREEN**

```powershell
node C:/Users/Administrator/.codex/plugins/cache/power-platform-skills/power-pages/2.6.2/scripts/validate-permissions-schema.js --projectRoot C:/Users/Administrator/Videos/PersonalPics/OAIC/oiac-engage --fail-on-error
node --test scripts/update-powerpages-site-setting.test.mjs
npm test -- src/features/contacts/contactPowerPagesConfig.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: schema validation has zero findings and every Contact configuration test PASS.

- [ ] **Step 11: Commit the configuration slice**

```powershell
git add oiac-engage/scripts/update-powerpages-site-setting.mjs oiac-engage/scripts/update-powerpages-site-setting.test.mjs oiac-engage/src/features/contacts/contactPowerPagesConfig.test.ts oiac-engage/.powerpages-site/site-settings/Webapi-contact-fields.sitesetting.yml oiac-engage/.powerpages-site/table-permissions/Administrators-Contact-Global-Update.tablepermission.yml
git commit -m "feat: configure administrator contact updates"
```

---

### Task 6: Final Verification and Power Pages Skill Tracking

**Files:**
- Modify through required tracking script: `oiac-engage/.powerpages-site/site-settings/Site-AI-Skills-IntegrateWebApi.sitesetting.yml`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: a verified local implementation ready for separately authorized deployment.

- [ ] **Step 1: Run all focused feature tests**

```powershell
npm test -- src/features/contacts/contactService.test.ts src/features/contacts/useDistrictContacts.test.tsx src/features/contacts/AdminContactEditModal.test.tsx src/pages/Contact.test.tsx src/App.test.tsx src/features/contacts/contactPowerPagesConfig.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: all focused Contact tests PASS.

- [ ] **Step 2: Run the complete regression suite**

```powershell
npm test -- --run
```

Expected: every test file and test PASS with exit code 0.

- [ ] **Step 3: Run the production build**

```powershell
npm run build
```

Expected: `tsc -b` and `vite build` complete with exit code 0.

- [ ] **Step 4: Review the final implementation against the spec**

Run `git diff --check`, inspect `git status --short`, and review the feature diff from the design commit. Confirm the admin query always contains the volunteer filter, non-admin behavior is unchanged, email never enters the update payload, no temporary PAC model directory remains, and the unrelated `Minimal Volunteer Portal Design.make/` directory remains untouched.

- [ ] **Step 5: Record Power Pages skill usage**

Read `C:/Users/Administrator/.codex/plugins/cache/power-platform-skills/power-pages/2.6.2/references/skill-tracking-reference.md`, then run:

```powershell
node C:/Users/Administrator/.codex/plugins/cache/power-platform-skills/power-pages/2.6.2/scripts/update-skill-tracking.js --projectRoot C:/Users/Administrator/Videos/PersonalPics/OAIC/oiac-engage --skillName "IntegrateWebApi" --authoringTool "Codex"
```

Commit only the tracking setting if changed:

```powershell
git commit -m "chore: record admin contact web api integration"
```

- [ ] **Step 6: Hand off without deploying**

Report exact test counts, production-build result, configuration validation, commits, and changed behavior. State that React role checks control UI visibility, administrator write permission enforces mutations, and the existing authenticated Global Contact read permission means the admin-only collection view is not a field-level secrecy boundary. State that the feature is local until separately approved deployment.
