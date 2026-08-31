# Contact District and Events Fresh Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the Contact District lookup label and prevent stale cached Event reads from producing empty event lists.

**Architecture:** Extend the existing Contacts Web API mapper to consume the lookup formatted-value annotation in the same paginated response. Update the existing feature-specific Power Pages server logic endpoints to use the documented `RetrieveMultipleRecords(entitySetName, options, skipCache)` overload without changing their filters, response shapes, or authorization.

**Tech Stack:** React 19, TypeScript 5.7, Vitest/Testing Library, Power Pages Web API, Power Pages Server Logic, Dataverse.

## Global Constraints

- Volunteer visibility remains future Published and Registration Open events only.
- Administrator visibility remains all events.
- My Calendar remains based only on the signed-in Contact's Registered Event Registration rows.
- Preserve existing web roles, table permissions, endpoint names, and normalized response shapes.
- Preserve unrelated dirty-worktree changes and do not commit or deploy without separate authorization.

---

### Task 1: Contact District label

**Files:**
- Modify: `src/features/contacts/contactTypes.ts`
- Modify: `src/features/contacts/contactService.ts`
- Modify: `src/features/contacts/contactService.test.ts`
- Modify: `src/features/contacts/useDistrictContacts.test.tsx`
- Modify: `src/pages/Contact.tsx`
- Modify: `src/pages/Contact.test.tsx`

**Interfaces:**
- Produces: `DistrictContact.districtName: string | null`.
- Consumes: `_mss_district_value@OData.Community.Display.V1.FormattedValue` from Dataverse.

- [ ] **Step 1: Write failing service tests** that require the formatted District annotation to map to `districtName` and require the `Prefer` header to include both formatted annotations and `odata.maxpagesize=15`.
- [ ] **Step 2: Write failing page tests** that require the `District` heading, the District label in the fourth cell, and the search hint `Search by name, email, phone, or city...`.
- [ ] **Step 3: Run the focused Contact tests and verify they fail for the missing behavior.**
- [ ] **Step 4: Add the formatted annotation type and `districtName` result property.**
- [ ] **Step 5: Map the annotation, combine the `Prefer` directives, and remove the hidden State search field.**
- [ ] **Step 6: Render `District` and `districtName`, then run the focused Contact tests until green.**

### Task 2: Fresh Event server reads

**Files:**
- Modify: `.powerpages-site/server-logic/open-events/open-events.js`
- Modify: `.powerpages-site/server-logic/admin-events/admin-events.js`
- Modify: `.powerpages-site/server-logic/calendar-events/calendar-events.js`
- Modify: `src/features/events/eventsServerLogic.test.mjs`

**Interfaces:**
- Consumes: `Server.Connector.Dataverse.RetrieveMultipleRecords(entitySetName, options, true)`.
- Produces: unchanged `{ status: "success", events: [...] }` endpoint payloads backed by fresh Dataverse reads.

- [ ] **Step 1: Write failing server logic tests** requiring `skipCache === true` for initial and continuation reads from `mss_eventses` and `mss_eventregistrations`.
- [ ] **Step 2: Run the focused server logic test and verify the expected argument failures.**
- [ ] **Step 3: Pass `true` on each paginated read in `open-events`, `admin-events`, and `calendar-events`.**
- [ ] **Step 4: Run the focused server logic tests until green and confirm filters and role-boundary tests remain unchanged.**

### Task 3: Verification

**Files:**
- Review all scoped files from Tasks 1 and 2.

**Interfaces:**
- Produces: fresh test, build, and diff evidence.

- [ ] **Step 1: Run all Contact and Events focused tests with one worker.**
- [ ] **Step 2: Run the full suite with one worker.**
- [ ] **Step 3: Run `npm run build`.**
- [ ] **Step 4: Run `git diff --check` and inspect the scoped diff for unrelated changes.**
- [ ] **Step 5: Validate server logic constraints and record AddServerLogic skill usage.**
- [ ] **Step 6: Ask separately before deploying and restarting the OIAC Dev site cache.**
