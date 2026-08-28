# District-Scoped Contacts Web API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Contacts page's mock data with a read-only, district-scoped Power Pages Web API directory with server paging, debounced server search, resilient request handling, and enforceable table permissions.

**Architecture:** A shared CSRF-aware API client sends same-origin portal Web API requests. A Contact service owns GUID validation, OData query construction, district discovery, and record mapping; a React hook owns debounce, paging, cancellation, stale-response prevention, and state; the Contacts page renders only the resulting directory. Power Pages table permissions enforce the same-district boundary independently of the browser query.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Vitest, Testing Library, Power Pages portal Web API, OData, Power Pages table-permission and site-setting metadata.

## Global Constraints

- Use `/_api` and `shell.getTokenDeferred()` with the `__RequestVerificationToken` header; never use `Xrm.WebApi`.
- Apply access to the built-in `Authenticated Users` role ID `0353acdd-7b95-4c07-8997-ae95dafd978d`; grant nothing to Anonymous Users.
- Discover the portal Contact ID from the existing Power Pages session and the District GUID from `_mss_district_value`; hard-coded record GUIDs are forbidden.
- Display 15 Contacts per page while using a sixteenth server result only as a Next-page look-ahead.
- Every collection filter must include `_mss_district_value eq <validated-guid>` even when search is present.
- Select only `contactid`, `fullname`, `emailaddress1`, `mobilephone`, `address1_city`, `address1_stateorprovince`, and `_mss_district_value` from Contact responses.
- Grant read only; do not grant Create, Write, Delete, Append, or Append To.
- Preserve unrelated working-tree changes and stage only files belonging to this feature.

---

### Task 1: CSRF-Aware Power Pages API Client

**Files:**
- Create: `src/shared/powerPagesApi.ts`
- Create: `src/shared/powerPagesApi.test.ts`

**Interfaces:**
- Consumes: browser `window.shell.getTokenDeferred()` and `fetch`.
- Produces: `powerPagesFetch<T>(path: string, options?: PowerPagesRequestOptions): Promise<T>` and `PowerPagesApiError`.

- [ ] **Step 1: Write failing API-client tests**

Cover token success, token failure, request headers, `AbortSignal` forwarding, successful JSON parsing, empty responses, and sanitized error extraction. Model the deferred API with `.done(callback).fail(callback)` so tests reflect the Power Pages runtime.

```ts
await powerPagesFetch<{ value: string }>('/_api/test', { signal })
expect(fetch).toHaveBeenCalledWith('/_api/test', expect.objectContaining({
  credentials: 'same-origin',
  signal,
  headers: expect.objectContaining({
    Accept: 'application/json',
    __RequestVerificationToken: 'csrf-token',
  }),
}))
```

- [ ] **Step 2: Verify the focused tests fail**

Run: `npm test -- src/shared/powerPagesApi.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL because `powerPagesApi.ts` does not exist.

- [ ] **Step 3: Implement the client**

Define the minimal runtime types locally and request a fresh token for each request:

```ts
export type PowerPagesRequestOptions = Omit<RequestInit, 'headers'> & {
  readonly headers?: HeadersInit
}

export async function powerPagesFetch<T>(
  path: string,
  options: PowerPagesRequestOptions = {},
): Promise<T> {
  const token = await getRequestVerificationToken()
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      __RequestVerificationToken: token,
      ...options.headers,
    },
  })
  if (!response.ok) throw await PowerPagesApiError.fromResponse(response)
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>
}
```

Token failures and non-JSON failures must become non-sensitive `PowerPagesApiError` instances. Preserve `AbortError` unchanged.

- [ ] **Step 4: Run the focused tests**

Run: `npm test -- src/shared/powerPagesApi.test.ts --no-file-parallelism --maxWorkers=1`

Expected: PASS.

- [ ] **Step 5: Commit the client**

```powershell
git add -- src/shared/powerPagesApi.ts src/shared/powerPagesApi.test.ts
git commit -m "Add Power Pages Web API client"
```

---

### Task 2: Contact Types, Query Builder, and Read Service

**Files:**
- Create: `src/features/contacts/contactTypes.ts`
- Create: `src/features/contacts/contactService.ts`
- Create: `src/features/contacts/contactService.test.ts`
- Delete: `src/data/contacts.ts`

**Interfaces:**
- Consumes: `powerPagesFetch<T>()` from Task 1.
- Produces: `CONTACT_PAGE_SIZE`, `getLoggedInUserDistrict(contactId, signal)`, `buildContactsQuery({ districtId, page, search })`, and `getDistrictContacts(params, signal)`.

- [ ] **Step 1: Write failing service tests**

Test these exact behaviors:

```ts
expect(buildContactsQuery({
  districtId: '367d7420-d8a2-f111-b8da-7ced8d70f293',
  page: 2,
  search: "O'Connor",
})).toContain("_mss_district_value+eq+367d7420-d8a2-f111-b8da-7ced8d70f293")
```

- `$select` contains exactly the seven required response properties.
- `$orderby=fullname asc,contactid asc`, `$skip=15`, and `$top=16` are present.
- The search group contains all five searchable fields and `O''Connor`, and remains joined to the district filter with `and`.
- Invalid Contact or District IDs are rejected before a request.
- `getLoggedInUserDistrict` requests only `_mss_district_value` from the session Contact.
- A response with 16 rows returns 15 items and `hasNext: true`; 15 rows returns `hasNext: false`.
- Null and missing values map to `null` rather than empty invented strings.

- [ ] **Step 2: Verify the focused tests fail**

Run: `npm test -- src/features/contacts/contactService.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL because the Contact feature files do not exist.

- [ ] **Step 3: Implement Contact types and service**

Use the following public models:

```ts
export type ContactRecord = {
  readonly contactid: string
  readonly fullname?: string | null
  readonly emailaddress1?: string | null
  readonly mobilephone?: string | null
  readonly address1_city?: string | null
  readonly address1_stateorprovince?: string | null
  readonly _mss_district_value?: string | null
}

export type ContactPage = {
  readonly contacts: readonly ContactRecord[]
  readonly hasNext: boolean
}
```

`buildContactsQuery` must call `escapeODataString`, build the district clause first, append the grouped search clause only for a non-empty trimmed search, then serialize parameters with `URLSearchParams`. `getDistrictContacts` must fetch 16 records and return only the first 15.

- [ ] **Step 4: Remove local Contact data and run tests**

Delete `src/data/contacts.ts` after all imports have moved to the service.

Run: `npm test -- src/features/contacts/contactService.test.ts --no-file-parallelism --maxWorkers=1`

Expected: PASS.

- [ ] **Step 5: Commit the service**

```powershell
git add -- src/shared src/features/contacts src/data/contacts.ts
git commit -m "Add district Contact query service"
```

---

### Task 3: Debounced District Contacts Hook

**Files:**
- Create: `src/features/contacts/useDistrictContacts.ts`
- Create: `src/features/contacts/useDistrictContacts.test.tsx`

**Interfaces:**
- Consumes: `getLoggedInUserDistrict`, `getDistrictContacts`, `ContactPage`, and the authenticated portal Contact ID.
- Produces: `useDistrictContacts(contactId?: string)` with `contacts`, `search`, `setSearch`, `page`, `hasNext`, `isLoading`, `status`, `errorMessage`, `nextPage`, `previousPage`, and `retry`.

- [ ] **Step 1: Write failing hook tests**

Use fake timers and mocked service functions to cover:

- No collection call until district discovery succeeds.
- Missing Contact ID yields `missing-session`.
- Null district yields `missing-district`.
- Search waits 350 ms, resets page to 1, and sends only the latest value.
- Next and Previous request server pages and do not move below page 1.
- Repeated state with the same district, page, and search does not send a duplicate request.
- A superseded request is aborted.
- A late result from an older request cannot overwrite the current result.
- Aborts do not surface as errors; API failures yield `error` and Retry repeats the current request.

- [ ] **Step 2: Verify the focused tests fail**

Run: `npm test -- src/features/contacts/useDistrictContacts.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook state machine**

Use an `AbortController`, request sequence ref, last completed/requested query-key ref, and a 350 ms debounce effect. Keep raw search text separate from debounced search text. Increment a retry counter to intentionally repeat a failed query without allowing accidental duplicates.

```ts
export type DistrictContactsStatus =
  | 'loading-district'
  | 'loading-contacts'
  | 'ready'
  | 'missing-session'
  | 'missing-district'
  | 'error'
```

Disable page transitions while loading and compute Previous availability from `page > 1`.

- [ ] **Step 4: Run the focused tests**

Run: `npm test -- src/features/contacts/useDistrictContacts.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: PASS.

- [ ] **Step 5: Commit the hook**

```powershell
git add -- src/features/contacts/useDistrictContacts.ts src/features/contacts/useDistrictContacts.test.tsx
git commit -m "Add resilient district Contacts state"
```

---

### Task 4: Contacts Page and Responsive Presentation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Replace: `src/pages/Contact.tsx`
- Replace: `src/pages/Contact.test.tsx`
- Modify: `src/styles/theme.css`
- Modify: `src/styles/designRegression.test.ts`

**Interfaces:**
- Consumes: `PortalUser` and `useDistrictContacts(contactId)`.
- Produces: `<Contact user={session.user} />`, semantic directory markup, and page-scoped responsive styles.

- [ ] **Step 1: Replace page tests with failing Web API directory tests**

Mock the hook and assert:

- App passes the authenticated user to Contact.
- The table has only Full Name, Mobile Phone, Email, State / Province, and City columns.
- No View button, actions column, record link, or Contact details form exists.
- Missing fields show an em dash.
- Search uses the hook setter and has the placeholder `Search by name, email, phone, city, or state...`.
- Previous, `Page 1`, and Next render with correct disabled states.
- Loading, missing-session, missing-district, empty-district, empty-search, and error/Retry states render accessible status or alert text.

- [ ] **Step 2: Verify the page tests fail**

Run: `npm test -- src/pages/Contact.test.tsx src/App.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: FAIL because Contact still renders mock data and a View action.

- [ ] **Step 3: Implement semantic page markup**

Change the route to:

```tsx
<Route path="/contact" element={<Contact user={session.user} />} />
```

Render text values, not Contact record links. Keep the table inside the existing focusable scroll region. Use `aria-busy`, `role="status"`, and `role="alert"` only on the appropriate state containers. Keep the search input available in ready and empty-search states.

- [ ] **Step 4: Replace obsolete detail styles with scoped responsive styles**

Remove `.contact-directory__viewer*` and `.contact-directory__view` rules. Add `.page--contacts .contact-directory__pagination`, state, retry, disabled button, and loading styles. Preserve the existing visual tokens and ensure mobile layout stacks pagination without changing global Bootstrap selectors.

- [ ] **Step 5: Run page and regression tests**

Run: `npm test -- src/pages/Contact.test.tsx src/App.test.tsx src/styles/designRegression.test.ts --no-file-parallelism --maxWorkers=1`

Expected: PASS.

- [ ] **Step 6: Commit the page**

```powershell
git add -- src/App.tsx src/App.test.tsx src/pages/Contact.tsx src/pages/Contact.test.tsx src/styles/theme.css src/styles/designRegression.test.ts
git commit -m "Build district-scoped Contacts directory"
```

---

### Task 5: Power Pages Read-Only Security Metadata

**Files:**
- Create: `.powerpages-site/table-permissions/Contact-Self-Read.tablepermission.yml`
- Create: `.powerpages-site/table-permissions/Authenticated-User-District-Read.tablepermission.yml`
- Create: `.powerpages-site/table-permissions/District-Contacts-Read.tablepermission.yml`
- Create: `.powerpages-site/site-settings/Webapi-contact-enabled.sitesetting.yml`
- Create: `.powerpages-site/site-settings/Webapi-contact-fields.sitesetting.yml`
- Create: `.powerpages-site/site-settings/Webapi-contact-disableodatafilter.sitesetting.yml`
- Create: `.powerpages-site/site-settings/Webapi-error-innererror.sitesetting.yml`
- Create: `src/features/contacts/contactPowerPagesConfig.test.ts`

**Interfaces:**
- Consumes: Authenticated Users role ID and relationship `mss_contact_District_mss_district`.
- Produces: deployed Power Pages settings and a Self → Contact-scoped District → Parent Contact read-permission chain.

- [ ] **Step 1: Write failing metadata tests**

Read the expected YAML files as raw text and assert:

- Contact Web API is enabled.
- The fields setting is exactly `contactid,fullname,emailaddress1,mobilephone,address1_city,address1_stateorprovince,mss_district,_mss_district_value`.
- OData filtering is enabled and inner errors are disabled.
- Every permission has `read: true` and all mutation privileges false.
- The Self Contact and Contact-scoped District permissions reference Authenticated Users.
- The child Contact permission references the District permission and relationship.
- No permission references the Anonymous Users role.

- [ ] **Step 2: Verify metadata tests fail**

Run: `npm test -- src/features/contacts/contactPowerPagesConfig.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL because the metadata files do not exist.

- [ ] **Step 3: Generate table permissions with deterministic scripts**

Create the missing `table-permissions` directory, then run:

```powershell
$pluginRoot = 'C:\Users\Administrator\.codex\plugins\cache\power-platform-skills\power-pages\2.6.2'
$projectRoot = 'C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage'
$roleId = '0353acdd-7b95-4c07-8997-ae95dafd978d'
New-Item -ItemType Directory -Path "$projectRoot\.powerpages-site\table-permissions" -Force | Out-Null
node "$pluginRoot\scripts\create-table-permission.js" --projectRoot $projectRoot --permissionName 'Contact Self Read' --tableName contact --webRoleIds $roleId --scope Self --read
$districtPermission = node "$pluginRoot\scripts\create-table-permission.js" --projectRoot $projectRoot --permissionName 'Authenticated User District Read' --tableName mss_district --webRoleIds $roleId --scope Contact --contactRelationshipName mss_contact_District_mss_district --read | ConvertFrom-Json
node "$pluginRoot\scripts\create-table-permission.js" --projectRoot $projectRoot --permissionName 'District Contacts Read' --tableName contact --webRoleIds $roleId --scope Parent --parentPermissionId $districtPermission.id --parentRelationshipName mss_contact_District_mss_district --read
```

- [ ] **Step 4: Generate Web API site settings**

```powershell
node "$pluginRoot\scripts\create-site-setting.js" --projectRoot $projectRoot --name 'Webapi/contact/enabled' --value true --description 'Enable read-only Contact Web API access' --type boolean
node "$pluginRoot\scripts\create-site-setting.js" --projectRoot $projectRoot --name 'Webapi/contact/fields' --value 'contactid,fullname,emailaddress1,mobilephone,address1_city,address1_stateorprovince,mss_district,_mss_district_value' --description 'Allow only Contact directory fields through the Web API'
node "$pluginRoot\scripts\create-site-setting.js" --projectRoot $projectRoot --name 'Webapi/contact/disableodatafilter' --value false --description 'Allow secured OData filters for the Contact directory' --type boolean
node "$pluginRoot\scripts\create-site-setting.js" --projectRoot $projectRoot --name 'Webapi/error/innererror' --value false --description 'Keep detailed Web API errors disabled' --type boolean
```

- [ ] **Step 5: Run metadata tests and inspect generated YAML**

Run: `npm test -- src/features/contacts/contactPowerPagesConfig.test.ts --no-file-parallelism --maxWorkers=1`

Expected: PASS. Also verify `rg -n "create: true|write: true|delete: true|append: true|appendto: true" .powerpages-site/table-permissions` returns no matches.

- [ ] **Step 6: Commit security metadata**

```powershell
git add -- .powerpages-site/table-permissions .powerpages-site/site-settings/Webapi-contact-*.yml .powerpages-site/site-settings/Webapi-error-innererror.sitesetting.yml src/features/contacts/contactPowerPagesConfig.test.ts
git commit -m "Secure district Contact Web API access"
```

---

### Task 6: Full Verification and Runtime Handoff

**Files:**
- Modify only if verification exposes a feature regression.

**Interfaces:**
- Consumes: all feature code and Power Pages metadata.
- Produces: verified build artifacts and a deployment-ready runtime test checklist.

- [ ] **Step 1: Run all automated tests**

Run: `npm test -- --no-file-parallelism --maxWorkers=1`

Expected: all tests PASS.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite build PASS.

- [ ] **Step 3: Review the feature diff and permissions**

Run:

```powershell
git diff HEAD~4 -- src .powerpages-site docs/superpowers
git status --short
```

Confirm no unrelated files are staged or modified, `Xrm.WebApi` is absent, no hard-coded district GUID exists in production source, and every Contact collection filter originates from `buildContactsQuery`.

- [ ] **Step 4: Execute deployed-site test cases after deployment is authorized**

Test these cases in separate sessions:

1. District A user sees only District A records.
2. District B user sees only District B records using the same frontend bundle.
3. A user without `mss_district` receives the missing-district state and no collection request.
4. An anonymous user cannot access the authenticated Contacts route or Contact API.
5. A no-match search displays the search empty state and the request retains the district filter.
6. Blocking `/_api/contacts` produces the error/Retry state.
7. A district with more than 15 Contacts enables Next, preserves 15 displayed rows, and correctly disables Previous/Next at boundaries.
8. Rapidly changing search text shows only the latest response.

- [ ] **Step 5: Commit any verification-only corrections**

If and only if verification required corrections, stage only those exact feature files and commit them with `Fix Contacts Web API verification issues`.
