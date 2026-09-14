# Admin Volunteer Contact Edit Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show administrators only exact Volunteer Contacts, restore District updates, and make the Contact edit modal compact and visibly interactive in Power Pages.

**Architecture:** Keep the existing React modal, service, pagination, and administrator table permission. Tighten the Contact OData predicate at query construction, correct the case-sensitive Power Pages Contact field allowlist, and harden modal-scoped CSS against host-page overrides without changing the update payload.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Dataverse OData Web API, Power Pages site settings, CSS.

## Global Constraints

- Return only Contacts whose Job Title is exactly `Volunteer` using a server-side OData filter.
- Keep the existing Contact directory columns and do not display a new Job Title column.
- Keep Email read-only and preserve the existing administrator-only Contact write permission.
- Allow District writes with exact attribute name `mss_District` and reads with `_mss_district_value`; never use a wildcard Web API allowlist.
- Keep the modal responsive, accessible, keyboard-operable, and theme-consistent.
- Do not deploy or publish as part of implementation.

---

## File Structure

- `src/features/contacts/contactService.ts`: build the exact Volunteer-only OData filter.
- `src/features/contacts/contactService.test.ts`: prove unsearched and searched queries keep the exact filter.
- `.powerpages-site/site-settings/Webapi-contact-fields.sitesetting.yml`: correct the District write attribute casing.
- `src/features/contacts/contactPowerPagesConfig.test.ts`: lock the case-sensitive Contact allowlist.
- `src/features/contacts/AdminContactEditModal.tsx`: add modal-specific field classes needed for resilient scoped styling.
- `src/features/contacts/AdminContactEditModal.test.tsx`: prove the modal exposes the intended compact styling hooks.
- `src/styles/theme.css`: implement compact spacing, durable input borders, and a visible Close control.
- `src/styles/designRegression.test.ts`: lock the critical host-resistant visual rules.

### Task 1: Enforce exact Volunteer directory filtering

**Files:**
- Modify: `src/features/contacts/contactService.test.ts`
- Modify: `src/features/contacts/contactService.ts`

**Interfaces:**
- Consumes: `buildAdminContactsQuery({ search }: AdminContactQuery): string`.
- Produces: an encoded OData query whose filter begins with `jobtitle eq 'Volunteer'`.

- [ ] **Step 1: Write failing query tests**

Update the existing administrator query assertions so a decoded query without search contains `$filter=jobtitle eq 'Volunteer'`. For a search value, assert the same predicate is followed by `and (...)`. Assert neither result contains `contains(jobtitle,'volunteer')`.

- [ ] **Step 2: Run the focused test and confirm RED**

```powershell
npm test -- src/features/contacts/contactService.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: the updated query assertions fail because the implementation still uses `contains(jobtitle,'volunteer')`.

- [ ] **Step 3: Implement the exact server-side predicate**

Replace the administrator base filter with:

```ts
const volunteerFilter = "jobtitle eq 'Volunteer'"
```

Keep the current escaped search expression, `$select`, `$orderby`, pagination, and fetch behavior unchanged.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run the Step 2 command. Expected: all Contact service tests pass.

### Task 2: Repair the case-sensitive District Web API allowlist

**Files:**
- Modify: `src/features/contacts/contactPowerPagesConfig.test.ts`
- Modify: `.powerpages-site/site-settings/Webapi-contact-fields.sitesetting.yml`

**Interfaces:**
- Consumes: the existing update property `'mss_District@odata.bind'` and read property `_mss_district_value`.
- Produces: `Webapi/contact/fields` containing `mss_District,_mss_district_value`.

- [ ] **Step 1: Write a failing configuration assertion**

Change the expected exact fields value to:

```text
contactid,firstname,lastname,fullname,emailaddress1,mobilephone,address1_city,address1_stateorprovince,address1_postalcode,jobtitle,mss_District,_mss_district_value
```

Also assert the comma-delimited value does not contain the lowercase write attribute `mss_district`.

- [ ] **Step 2: Run the configuration test and confirm RED**

```powershell
npm test -- src/features/contacts/contactPowerPagesConfig.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: the exact allowlist assertion fails on the current lowercase entry.

- [ ] **Step 3: Correct only the field casing**

Replace `mss_district` with `mss_District` in `Webapi-contact-fields.sitesetting.yml`. Retain `_mss_district_value`, all other fields, secured OData filtering, and current table permissions.

- [ ] **Step 4: Run the configuration and update tests and confirm GREEN**

```powershell
npm test -- src/features/contacts/contactPowerPagesConfig.test.ts src/features/contacts/contactService.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: both files pass and the existing PATCH payload assertion still uses `mss_District@odata.bind`.

### Task 3: Make the Contact edit modal compact and host-resistant

**Files:**
- Modify: `src/features/contacts/AdminContactEditModal.test.tsx`
- Modify: `src/features/contacts/AdminContactEditModal.tsx`
- Modify: `src/styles/designRegression.test.ts`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: the existing `.admin-contact-modal` dialog structure and `.button` theme primitives.
- Produces: `.admin-contact-modal__field` hooks, compact layout, bordered inputs, and a visible `.admin-contact-modal__close` button.

- [ ] **Step 1: Write failing component and CSS regression tests**

Assert every standard editable/read-only input is inside `.admin-contact-modal__field`. Add scoped CSS assertions for a maximum dialog width of `40rem`, explicit input `appearance`, `box-sizing`, and `border`, and explicit Close button `display`, `place-items`, `border`, `background`, and `color` declarations.

- [ ] **Step 2: Run modal and design tests and confirm RED**

```powershell
npm test -- src/features/contacts/AdminContactEditModal.test.tsx src/styles/designRegression.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: the component-class and compact visual-contract assertions fail.

- [ ] **Step 3: Add the modal-specific field hooks**

Add `admin-contact-modal__field` alongside `field` for First Name, Last Name, Email, Job Title, Mobile Phone, City, State / Province, Postal Code, and the District field wrapper. Preserve labels, state bindings, validation, read-only Email, and submit behavior.

- [ ] **Step 4: Implement compact resilient styling**

Reduce the dialog width to `min(40rem, 100%)`; tighten header/form/grid spacing and padding while keeping a `2.75rem` Close touch target. Use `.admin-contact-modal__dialog .admin-contact-modal__field > input` for standard fields with `appearance: none`, `box-sizing: border-box`, and an explicit solid theme border. Give `.admin-contact-modal__close` an inline-grid layout, centered content, theme border/background/color, hover/focus-visible states, and explicit SVG stroke width. Keep the existing small-screen one-column layout.

- [ ] **Step 5: Run modal and design tests and confirm GREEN**

Run the Step 2 command. Expected: all modal behavior and CSS regression tests pass.

### Task 4: Verify the integrated repair

**Files:**
- Test: all files changed in Tasks 1–3

**Interfaces:**
- Consumes: the complete query, configuration, component, and CSS changes.
- Produces: fresh evidence for behavioral correctness and production compilation.

- [ ] **Step 1: Run the focused regression set**

```powershell
npm test -- src/features/contacts/contactService.test.ts src/features/contacts/contactPowerPagesConfig.test.ts src/features/contacts/AdminContactEditModal.test.tsx src/pages/Contact.test.tsx src/styles/designRegression.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: every focused test passes with zero failures.

- [ ] **Step 2: Run the complete test suite**

```powershell
npm test -- --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: all test files and tests pass.

- [ ] **Step 3: Build the production bundle**

```powershell
npm run build
```

Expected: TypeScript and Vite finish with exit code 0.

- [ ] **Step 4: Review the final diff**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors and no unrelated file modifications.
