# Administrator Event Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure administrator-only inline form that creates and updates Dataverse Events while keeping the Events and My Calendar data scopes distinct.

**Architecture:** Extend the existing Administrator-only `admin-events` Server Logic record with POST and PUT operations. Keep field normalization in the Events feature service and place the reusable controlled form in `src/features/events/EventForm.tsx`; `Events.tsx` owns open/edit/reload state.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Power Pages Server Logic, Dataverse connector, Power Pages metadata YAML.

## Global Constraints

- Only Administrators can render or call create/update behavior.
- New events default to Event Status Draft (`866530000`).
- In Person requires Venue, Virtual requires Meeting URL, and Hybrid requires both.
- End Date & Time must be later than Start Date & Time.
- Events List and Events Calendar consume the same visible collection; My Calendar is unchanged.
- Register and Add to Calendar remain non-persistent.

---

### Task 1: Event mutation contracts

**Files:**
- Modify: `oiac-engage/src/features/events/eventTypes.ts`
- Modify: `oiac-engage/src/features/events/eventService.ts`
- Modify: `oiac-engage/src/features/events/eventService.test.ts`

**Interfaces:**
- Produces: `EventInput`, `createEvent(input)`, and `updateEvent(id, input)`.
- Consumes: existing `powerPagesFetch` and Server Logic envelope.

- [ ] **Step 1: Write failing service tests**

Add tests asserting POST to `/_api/serverlogics/admin-events` and PUT to `/_api/serverlogics/admin-events?id=<guid>` with JSON bodies containing `title`, ISO datetimes, choice numbers, venue, meeting URL, and description. Assert malformed or error envelopes reject with `Event could not be saved.`.

- [ ] **Step 2: Verify the service tests fail**

Run `npm test -- src/features/events/eventService.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose` and confirm `createEvent`/`updateEvent` are missing.

- [ ] **Step 3: Implement the typed service contract**

Define:

```ts
export type EventInput = {
  readonly title: string
  readonly startDateTime: string
  readonly endDateTime: string
  readonly eventTypeValue: number
  readonly eventFormatValue: number
  readonly eventStatusValue: number
  readonly venueName: string | null
  readonly meetingUrl: string | null
  readonly description: string | null
}
```

Add raw type/format values and description to `EventItem`. Reuse one private envelope parser for GET, POST, and PUT.

- [ ] **Step 4: Verify service tests pass**

Run the Task 1 command and confirm all service tests pass.

### Task 2: Administrator Server Logic mutations

**Files:**
- Modify: `oiac-engage/.powerpages-site/server-logic/admin-events/admin-events.js`
- Create: `oiac-engage/.powerpages-site/table-permissions/Events-Admin-Manage.tablepermission.yml`
- Modify: `oiac-engage/.powerpages-site/server-logic/open-events/open-events.js`
- Modify: `oiac-engage/src/features/events/eventsServerLogic.test.mjs`

**Interfaces:**
- Consumes: `EventInput` JSON through `Server.Context.Body`.
- Produces: `{ status: "success", id }` for POST and `{ status: "success", id }` for PUT.

- [ ] **Step 1: Write failing executable Server Logic tests**

Execute `post()` and `put()` in the existing VM harness. Assert server-side rejection for missing fields, invalid choice numbers, end-before-start, missing conditional venue/URL, non-HTTP(S) URL, and invalid update GUID. Assert valid requests map only approved Dataverse columns and new records default to Draft when status is absent.

- [ ] **Step 2: Verify Server Logic tests fail**

Run `npm test -- src/features/events/eventsServerLogic.test.mjs --no-file-parallelism --maxWorkers=1 --reporter=verbose` and confirm POST/PUT are not defined.

- [ ] **Step 3: Implement POST, PUT, and read mapping**

Add `post()` and `put()` as allowed top-level functions with try/catch, `Server.Logger`, synchronous Dataverse connector calls, and JSON string returns. Add `mss_description` to GET projections and return `eventTypeValue`, `eventFormatValue`, and `description` for editing.

- [ ] **Step 4: Add Administrator mutation permission**

Create a Global permission for logical table `mss_events`, assigned only to role GUID `6ec72c3e-4f1b-420f-9565-d20047b12c1f`, with `read`, `create`, and `write` true and `delete`, `append`, and `appendto` false.

- [ ] **Step 5: Verify backend artifacts**

Run the Task 2 Vitest command and `node C:/Users/Administrator/.codex/plugins/cache/power-platform-skills/power-pages/2.6.2/skills/add-server-logic/scripts/validate-serverlogic.js`; confirm both exit zero.

### Task 3: Reusable administrator event form

**Files:**
- Create: `oiac-engage/src/features/events/EventForm.tsx`
- Create: `oiac-engage/src/features/events/EventForm.test.tsx`
- Modify: `oiac-engage/src/styles/theme.css`

**Interfaces:**
- Consumes: optional `EventItem`, `onSave(EventInput)`, and `onCancel()`.
- Produces: accessible create/edit form submission and validation behavior.

- [ ] **Step 1: Write failing form behavior tests**

Render the real form and assert: create defaults to Draft; In Person shows/requires Venue only; Virtual shows/requires Meeting URL only; Hybrid requires both; invalid date order blocks `onSave`; edit values hydrate; valid local datetime inputs become ISO strings.

- [ ] **Step 2: Verify form tests fail**

Run `npm test -- src/features/events/EventForm.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose` and confirm the component does not exist.

- [ ] **Step 3: Implement the controlled form**

Use native `datetime-local`, `select`, `url`, `input`, and `textarea` controls. Use the provided numeric choice values for Type, Format, and Status. Render accessible field errors and a request error alert, focus the first invalid control, and disable Save while pending.

- [ ] **Step 4: Add scoped styles and verify**

Add Events-prefixed form selectors matching the portal theme, then rerun Task 3 tests until they pass.

### Task 4: Events page create/edit integration

**Files:**
- Modify: `oiac-engage/src/pages/Events.tsx`
- Modify: `oiac-engage/src/pages/Events.test.tsx`
- Modify: `oiac-engage/src/pages/EmptyStates.test.tsx`

**Interfaces:**
- Consumes: `EventForm`, `createEvent`, `updateEvent`, and existing `getEvents`.
- Produces: Administrator-only create/edit workflow followed by Events reload.

- [ ] **Step 1: Write failing page integration tests**

Assert volunteers have no Create Event or Edit controls. Assert administrators can open create mode, edit a specific card, cancel, submit create/update, see request errors, and trigger a data reload after successful mutation. Assert List and Calendar still show the same visible records.

- [ ] **Step 2: Verify page tests fail**

Run `npm test -- src/pages/Events.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose` and confirm admin controls are missing.

- [ ] **Step 3: Wire the form and mutation state**

Add the admin header button, admin-only Edit action, one form mode state (`create` or selected `EventItem`), mutation error/pending state, and successful reload. Preserve active list/calendar and status-filter behavior.

- [ ] **Step 4: Verify page tests pass**

Run the Task 4 command and confirm all page tests pass.

### Task 5: Full verification and review

**Files:**
- Review all files changed by Tasks 1-4.

- [ ] **Step 1: Run focused tests**

Run `npm test -- src/features/events/EventForm.test.tsx src/features/events/eventService.test.ts src/features/events/eventsServerLogic.test.mjs src/pages/Events.test.tsx src/pages/EmptyStates.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose`.

- [ ] **Step 2: Run the production build**

Run `npm run build` and confirm TypeScript and Vite exit zero.

- [ ] **Step 3: Run the complete regression suite**

Run `npm test -- --no-file-parallelism --maxWorkers=1 --reporter=verbose` and confirm zero failures.

- [ ] **Step 4: Validate and review Server Logic**

Run the Server Logic validator, inspect exact Administrator role/permission bindings, and request an independent code review. Fix every Critical and Important issue and rerun affected verification.
