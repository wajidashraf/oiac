# Home Dashboard Live Data and Registration Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let every authenticated user register for Events and render Contact-owned report counts, active registration counts, and registered future Events on Home.

**Architecture:** Keep Dataverse access in the existing meeting-report, event-registration, and event services. Add one report-count operation and a focused React dashboard hook that composes those services with isolated status handling and AbortController cleanup; Home only renders the returned state.

**Tech Stack:** React 19, TypeScript 5.7, React Router, Power Pages Web API, Vitest, Testing Library.

## Global Constraints

- Registration is available to every signed-in account through the built-in `Authenticated Users` role; anonymous users remain blocked.
- Direct Web API remains the integration path; do not restore Server Logic dependencies.
- Count unique registrations whose status is exactly `Registered`; exclude Cancelled and Waitlisted.
- Upcoming Events contains only future Events registered by the current Contact, ordered ascending, limited to three.
- Preserve shared request verification, same-origin credentials, common errors, and AbortController behavior in `powerPagesApi.ts`.
- Do not change implemented navigation or Coming Soon behavior.

---

### Task 1: Authenticated Event lookup permission

**Files:**
- Modify: `.powerpages-site/table-permissions/Events-Global-Read.tablepermission.yml`
- Modify: `src/features/eventRegistrations/eventRegistrationPowerPagesConfig.test.ts`

**Interfaces:**
- Consumes: built-in Authenticated Users role ID `0353acdd-7b95-4c07-8997-ae95dafd978d`.
- Produces: Event read/append-to permission for every authenticated account.

- [ ] **Step 1: Write the failing role test**

Assert that `Events Global Read` contains the Authenticated Users role ID, excludes the Anonymous Users role ID, and retains `read: true`, `appendto: true`, and all mutation flags false.

- [ ] **Step 2: Run the permission test and confirm RED**

Run: `npm test -- src/features/eventRegistrations/eventRegistrationPowerPagesConfig.test.ts`

Expected: failure because the permission currently contains the Volunteer role ID.

- [ ] **Step 3: Apply the minimal permission change**

Replace the `adx_entitypermission_webrole` value with `0353acdd-7b95-4c07-8997-ae95dafd978d`; keep the existing flags unchanged.

- [ ] **Step 4: Run the permission test and confirm GREEN**

Run: `npm test -- src/features/eventRegistrations/eventRegistrationPowerPagesConfig.test.ts`

Expected: pass.

### Task 2: Exact Contact-owned Meeting Report count

**Files:**
- Modify: `src/features/meetingReports/meetingReportService.ts`
- Modify: `src/features/meetingReports/meetingReportService.test.ts`

**Interfaces:**
- Produces: `getMeetingReportCount(signal?: AbortSignal): Promise<number>`.
- Consumes: shared `powerPagesFetch` and the existing Contact-scoped Meeting Report table permission.

- [ ] **Step 1: Write failing count-query tests**

Add a test that mocks `{ '@odata.count': 7, value: [] }`, expects `7`, and verifies a request to `/_api/mss_meetingreports` with `$select=mss_meetingreportid`, `$count=true`, and `$top=1`. Add rejection coverage for a missing or invalid non-negative integer count.

- [ ] **Step 2: Run the service test and confirm RED**

Run: `npm test -- src/features/meetingReports/meetingReportService.test.ts`

Expected: failure because `getMeetingReportCount` does not exist.

- [ ] **Step 3: Implement the count service**

Add the exported function using `powerPagesFetch`, forward `signal`, validate `@odata.count` with `Number.isInteger(count) && count >= 0`, and throw `Dataverse returned an invalid Meeting Report count.` otherwise.

- [ ] **Step 4: Run the service test and confirm GREEN**

Run: `npm test -- src/features/meetingReports/meetingReportService.test.ts`

Expected: pass.

### Task 3: Dashboard data hook

**Files:**
- Create: `src/features/dashboard/useHomeDashboardData.ts`
- Create: `src/features/dashboard/useHomeDashboardData.test.tsx`

**Interfaces:**
- Consumes: `getMeetingReports`, `getMeetingReportCount`, `getEventRegistrations`, `getCalendarEvents`, `EVENT_REGISTRATION_STATUS.registered`.
- Produces: `useHomeDashboardData(contactId?: string)` returning `reports`, `reportCount`, `registeredEventCount`, `upcomingEvents`, `reportsStatus`, `registrationsStatus`, and `retry()`.

- [ ] **Step 1: Write failing hook tests**

Cover parallel report/count/registration startup, unique Registered Event IDs, exclusion of Cancelled and Waitlisted, dependent Event loading, first-three chronological events, missing Contact error, retry, and unmount abort behavior.

- [ ] **Step 2: Run the hook tests and confirm RED**

Run: `npm test -- src/features/dashboard/useHomeDashboardData.test.tsx`

Expected: failure because the hook module does not exist.

- [ ] **Step 3: Implement the minimal hook**

Use one effect keyed by `contactId` and retry number. Start latest-report, report-count, and registration promises without sequential awaits. Resolve report state separately. Filter and deduplicate registered Event IDs, set the KPI from all unique active IDs, then load Event details and retain the first three. Ignore results after abort and abort on cleanup.

- [ ] **Step 4: Run the hook tests and confirm GREEN**

Run: `npm test -- src/features/dashboard/useHomeDashboardData.test.tsx`

Expected: pass.

### Task 4: Live Home rendering

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Home.test.tsx`
- Modify: `src/data/dashboardData.ts`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: `useHomeDashboardData(contactId)` and `EventItem.startDateTime/title`.
- Produces: `<Home contactId={session.user.contactId} />`, live KPI values, live registered-event list, and the friendly no-registration state.

- [ ] **Step 1: Write failing Home tests**

Mock the dashboard hook and assert live report/registration counts, real event titles/dates, maximum three events, the no-registration copy and `/activity/events` link, unavailable markers during errors, and unchanged My Calendar footer navigation.

- [ ] **Step 2: Run the Home tests and confirm RED**

Run: `npm test -- src/pages/Home.test.tsx src/App.test.tsx`

Expected: failures because Home still reads `dashboardMetrics` and `dashboardEvents`.

- [ ] **Step 3: Implement live Home rendering**

Pass `contactId` from App, replace the two relevant static metric values, render actual registered Events, remove the unused static dashboard Event records, and add a theme-consistent empty/error state. Preserve the other static zero metrics and all Coming Soon sections.

- [ ] **Step 4: Run the Home tests and confirm GREEN**

Run: `npm test -- src/pages/Home.test.tsx src/App.test.tsx`

Expected: pass.

### Task 5: Regression verification

**Files:**
- Verify only; no new production files.

**Interfaces:**
- Consumes: all changes from Tasks 1–4.
- Produces: evidence that registration, dashboard, Events, My Calendar, and report behavior remain compatible.

- [ ] **Step 1: Run focused regressions**

Run: `npm test -- src/features/eventRegistrations src/features/events src/features/meetingReports src/features/dashboard src/pages/Home.test.tsx src/pages/Events.test.tsx src/pages/MyCalendar.test.tsx src/App.test.tsx`

Expected: all pass with no unhandled errors.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite build pass and emit a new `dist` bundle.

- [ ] **Step 3: Review the final diff**

Confirm only approved permission, dashboard data, Home rendering, tests, styles, generated bundle metadata, and documentation changed. Do not include unrelated dirty-worktree files.
