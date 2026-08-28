# Meeting Report Web API Implementation Plan

> Execute on `master` as requested. Follow test-driven development and commit each coherent unit.

**Goal:** Implement authenticated Dataverse create and update workflows for the three-step meeting report form, including global lookup search and Staff/Volunteer N:N synchronization.

**Architecture:** Extend the shared Power Pages API client with raw-response support. Add a meeting-report feature service for mapping, retrieval, mutation, and relationship diffing, plus focused React lookup hooks/components. Keep the existing page shell and visual language while replacing demo state with Dataverse-backed state. Add least-privilege site settings and table permissions for Authenticated Users.

**Stack:** React 19, TypeScript, React Router, Vitest/Testing Library, Power Pages Web API, Power Pages metadata YAML.

---

## Task 1: Preserve response metadata in the shared API client

**Files:**
- Modify: `src/shared/powerPagesApi.ts`
- Modify: `src/shared/powerPagesApi.test.ts`

1. Add failing tests for a raw request that exposes the `entityid` response header, forwards headers/options, and retains typed/sanitized failures.
2. Implement `powerPagesRequest` and refactor `powerPagesFetch` to parse successful responses through it.
3. Run `npm test -- src/shared/powerPagesApi.test.ts`.
4. Commit.

## Task 2: Add meeting-report types, queries, payload mapping, and mutations

**Files:**
- Create: `src/features/meetingReports/meetingReportTypes.ts`
- Create: `src/features/meetingReports/meetingReportService.ts`
- Create: `src/features/meetingReports/meetingReportService.test.ts`

1. Write failing tests for GUID normalization, escaped global Contact searches, job-role filters, profile/District mapping, create headers, report retrieval, PATCH, and exact field mappings.
2. Implement read and write functions using the verified entity sets and schema names.
3. Add failing tests for deduplicated N:N additions/removals, relationship diffing, and failure collection.
4. Implement create/update orchestration with retryable relationship operations.
5. Run the feature service tests and commit.

## Task 3: Add reusable asynchronous lookup controls

**Files:**
- Create: `src/features/meetingReports/useMeetingReportLookup.ts`
- Create: `src/features/meetingReports/ContactLookup.tsx`
- Create: `src/features/meetingReports/MultiContactLookup.tsx`
- Create: `src/features/meetingReports/meetingReportLookups.test.tsx`

1. Write failing tests for 350 ms debounce, request cancellation/stale-result prevention, loading/empty/error states, single selection, multi-selection, removal, and duplicate prevention.
2. Implement accessible combobox/listbox controls and the lookup hook.
3. Run lookup tests and commit.

## Task 4: Connect create and update flows to the wizard

**Files:**
- Modify: `src/pages/MeetingReportForm.tsx`
- Modify: `src/pages/Report.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

1. Replace demo-form expectations with failing tests for authenticated profile loading, read-only Step 1, create submission, update hydration/PATCH, validation, in-flight locking, errors, and partial relationship retry.
2. Pass the authenticated `PortalUser` into create and edit routes.
3. Load profile/report data, map numeric choices, integrate global lookups, and wire create/update orchestration.
4. Preserve values across steps and navigate with create/update success feedback.
5. Run page and app tests and commit.

## Task 5: Make the report list supply real update record IDs

**Files:**
- Modify: `src/features/meetingReports/meetingReportService.ts`
- Modify: `src/features/meetingReports/meetingReportService.test.ts`
- Modify: `src/pages/Report.tsx`
- Modify: `src/pages/Report.test.tsx`

1. Add failing tests for retrieving permitted reports and rendering real GUID edit links, including loading, empty, and error states.
2. Implement the owned-report list query and page integration.
3. Run report tests and commit.

## Task 6: Style the live lookup, loading, and feedback states

**Files:**
- Modify: `src/styles/theme.css`

1. Add responsive, Power Pages theme-resistant styles scoped beneath `.page--report-form`.
2. Verify focus visibility, selected chips, narrow layouts, disabled controls, and alert contrast in component tests/build.
3. Commit.

## Task 7: Configure Web API exposure and table permissions

**Files:**
- Modify: `.powerpages-site/site-settings/Webapi-contact-fields.sitesetting.yml`
- Create: `.powerpages-site/site-settings/Webapi-mss_district-enabled.sitesetting.yml`
- Create: `.powerpages-site/site-settings/Webapi-mss_district-fields.sitesetting.yml`
- Create: `.powerpages-site/site-settings/Webapi-mss_district-disableodatafilter.sitesetting.yml`
- Create: `.powerpages-site/site-settings/Webapi-mss_meetingreport-enabled.sitesetting.yml`
- Create: `.powerpages-site/site-settings/Webapi-mss_meetingreport-fields.sitesetting.yml`
- Create: `.powerpages-site/site-settings/Webapi-mss_meetingreport-disableodatafilter.sitesetting.yml`
- Create: `.powerpages-site/table-permissions/Authenticated-Contact-Directory-Read-Append.tablepermission.yml`
- Create: `.powerpages-site/table-permissions/Authenticated-District-Global-Read.tablepermission.yml`
- Create: `.powerpages-site/table-permissions/Authenticated-Owned-Meeting-Report-Manage.tablepermission.yml`
- Create: `src/features/meetingReports/meetingReportPowerPagesConfig.test.ts`
- Modify: `src/features/contacts/contactPowerPagesConfig.test.ts`

1. Write failing metadata tests for exact field allowlists, global all-district lookup access, Contact Append without Write, Contact-scoped report Create/Read/Write/Append/AppendTo without Delete, Authenticated Users assignment, and no anonymous role.
2. Add the site settings and table-permission metadata.
3. Run metadata tests and commit.

## Task 8: Verify the complete implementation

1. Run focused meeting-report tests.
2. Run `npm test`.
3. Run `npm run build`.
4. Inspect `git diff --check` and `git status --short`; ensure unrelated untracked files remain untouched.
5. Commit any final corrective changes and report what was implemented. Deployment is not included unless separately requested.
