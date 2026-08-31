# Event Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register the signed-in Power Pages Contact for an Event without duplicate rows and populate My Calendar from Registered Event Registration rows.

**Architecture:** Add a focused Event Registration service over the existing CSRF-aware Power Pages client, then pass `contactId` from `App` into Events and My Calendar. Keep Event visibility in server logic: use the existing endpoints for the Events page and a role-protected `calendar-events` endpoint for future public/registration-closed details selected from Registered Event IDs. Add contact-scoped table permissions and explicit Web API field settings.

**Tech Stack:** React 19, TypeScript 5.7, Vitest/Testing Library, Power Pages Web API, Dataverse YAML metadata.

## Global Constraints

- Registration statuses are Registered `1`, Cancelled `2`, Waitlisted `3`.
- Cancelled rows are reactivated in place and receive a refreshed registration date.
- Waitlisted rows remain Waitlisted and do not appear in My Calendar.
- `mss_registrationnumber` is left to Dataverse.
- Do not deploy, commit, or overwrite unrelated dirty-worktree changes.

---

### Task 1: Event Registration service and Power Pages configuration

**Files:**
- Create: `src/features/eventRegistrations/eventRegistrationTypes.ts`
- Create: `src/features/eventRegistrations/eventRegistrationService.ts`
- Create: `src/features/eventRegistrations/eventRegistrationService.test.ts`
- Create: `src/features/eventRegistrations/eventRegistrationPowerPagesConfig.test.ts`
- Create: `.powerpages-site/site-settings/Webapi-mss_eventregistration-enabled.sitesetting.yml`
- Create: `.powerpages-site/site-settings/Webapi-mss_eventregistration-fields.sitesetting.yml`
- Create: `.powerpages-site/site-settings/Webapi-mss_eventregistration-disableodatafilter.sitesetting.yml`
- Create: `.powerpages-site/table-permissions/Authenticated-Owned-Event-Registration-Manage.tablepermission.yml`
- Modify: `.powerpages-site/table-permissions/Events-Global-Read.tablepermission.yml`

**Interfaces:**
- Produces: `getEventRegistrations(contactId)`, `registerForEvent(contactId, eventId)`, `RegistrationStatus`, `EventRegistration`.
- `registerForEvent` returns `registered`, `already-registered`, or `waitlisted` plus the normalized row.

- [ ] **Step 1: Write failing service tests** for GUID validation, Contact + Event filtering, lookup bindings, duplicate Registered behavior, Waitlisted preservation, and Cancelled PATCH.
- [ ] **Step 2: Run the focused test and verify failure:** `npm test -- src/features/eventRegistrations/eventRegistrationService.test.ts --no-file-parallelism --maxWorkers=1`.
- [ ] **Step 3: Implement the types and minimal service** using `powerPagesFetch` for GET and `powerPagesRequest` for POST/PATCH.
- [ ] **Step 4: Run the focused service tests and verify pass.**
- [ ] **Step 5: Write failing configuration tests** that require enabled/filter/field settings and Contact-scoped CRUD-without-delete permission.
- [ ] **Step 6: Add YAML metadata** with explicit field allowlist, authenticated role, Contact scope, and required Append/Append To privileges.
- [ ] **Step 7: Run both Task 1 tests and verify pass.**

### Task 2: Events registration state and actions

**Files:**
- Modify: `src/pages/Events.tsx`
- Modify: `src/pages/Events.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `getEventRegistrations(contactId)` and `registerForEvent(contactId, eventId)`.
- Produces: contact-aware registration state on every visible Event card.

- [ ] **Step 1: Replace the inert-action test** with failing tests for initial statuses, Add to Calendar create, Cancelled reactivation outcome, Waitlisted disabled state, per-event pending protection, and retryable errors.
- [ ] **Step 2: Add an App routing test** proving the authenticated `contactId` reaches Events.
- [ ] **Step 3: Run the focused tests and verify failure:** `npm test -- src/pages/Events.test.tsx src/App.test.tsx --no-file-parallelism --maxWorkers=1`.
- [ ] **Step 4: Implement contact-aware props and state** in `Events`, load registrations in parallel with visible events, and route both buttons through one guarded handler.
- [ ] **Step 5: Render accessible status/progress/error copy** while preserving admin form mutation behavior.
- [ ] **Step 6: Pass `session.user.contactId` from `App` and run the focused tests until green.**

### Task 3: Dynamic registered events in My Calendar

**Files:**
- Modify: `src/data/calendarData.ts`
- Modify: `src/data/calendarData.test.ts`
- Modify: `src/pages/MyCalendar.tsx`
- Modify: `src/pages/MyCalendar.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: current Contact ID, Registered registration rows, and visible Event details.
- Produces: `eventToCalendarItem(event)` and a dynamic My Calendar event collection.

- [ ] **Step 1: Write failing mapping tests** for event date, time, venue/online location, and nullable navigation URL.
- [ ] **Step 2: Write failing page tests** for loading, Registered-only dynamic results, empty state, and retry.
- [ ] **Step 3: Run focused calendar tests and verify failure:** `npm test -- src/data/calendarData.test.ts src/pages/MyCalendar.test.tsx src/App.test.tsx --no-file-parallelism --maxWorkers=1`.
- [ ] **Step 4: Implement the mapping and loader** without restoring static event samples; preserve only accepted meeting items until their backend exists.
- [ ] **Step 5: Make calendar items without a meeting URL non-link content** and keep virtual items safe external links.
- [ ] **Step 6: Pass `contactId` from App and run the focused tests until green.**

### Task 4: Verification and review

**Files:**
- Review all files changed by Tasks 1-3.

**Interfaces:**
- Consumes: completed implementation.
- Produces: verification evidence and code-review findings.

- [ ] **Step 1: Run all event/registration/calendar tests** with one worker.
- [ ] **Step 2: Run the full suite:** `npm test -- --no-file-parallelism --maxWorkers=1`.
- [ ] **Step 3: Run the production build:** `npm run build`.
- [ ] **Step 4: Run the Power Pages configuration validator** from the installed Power Pages skill package.
- [ ] **Step 5: Inspect `git diff --check` and the scoped diff.**
- [ ] **Step 6: Request a focused code review and resolve Critical/Important findings.**
