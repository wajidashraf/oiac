# Events Direct Web API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fetch and manage Events through the Power Pages Web API and remove the `open-events`, `admin-events`, and `calendar-events` Server Logic dependencies.

**Architecture:** Keep the React page contracts stable while changing `eventService.ts` from nested Server Logic envelopes to OData collection and record operations. My Calendar reads contact-scoped registrations first, then fetches only their matching Events directly.

**Tech Stack:** React 19, TypeScript, Vitest, Power Pages Web API, Dataverse OData.

## Global Constraints

- Use `/_api/mss_eventses` and the shared Power Pages API wrapper.
- Preserve Events list/calendar UI, role detection, state handling, and My Calendar's registered-only behavior.
- Keep current Events table permissions and web roles.
- Treat the Volunteer filter as visibility logic, not authorization.

---

### Task 1: Specify direct Events Web API behavior

**Files:**
- Modify: `src/features/events/eventService.test.ts`
- Create: `src/features/events/eventPowerPagesConfig.test.ts`

- [ ] Add tests for the exact admin query, volunteer UTC filter, formatted-value mapping, malformed `value` responses, AbortSignal forwarding, POST creation, and PATCH update.
- [ ] Add configuration tests for `Webapi/mss_events/enabled`, the exact explicit fields, and unchanged Administrator/Volunteer permissions.
- [ ] Run the focused tests and confirm they fail because the service and settings still use Server Logic.

### Task 2: Implement direct Web API access

**Files:**
- Modify: `src/features/events/eventService.ts`
- Create: `.powerpages-site/site-settings/Webapi-mss_events-enabled.sitesetting.yml`
- Create: `.powerpages-site/site-settings/Webapi-mss_events-fields.sitesetting.yml`

- [ ] Build OData queries with `URLSearchParams`, including ascending start order and the volunteer status/date filter.
- [ ] Map Web API records to the existing `EventItem` contract using formatted annotations and fallback choice labels.
- [ ] Replace Server Logic create/update with Web API POST/PATCH requests.
- [ ] Add the explicit Events Web API enablement and field allowlist settings.
- [ ] Run focused tests until green.

### Task 3: Remove obsolete Server Logic and verify behavior

**Files:**
- Delete: `.powerpages-site/server-logic/open-events/open-events.js`
- Delete: `.powerpages-site/server-logic/open-events/open-events.serverlogic.yml`
- Delete: `.powerpages-site/server-logic/admin-events/admin-events.js`
- Delete: `.powerpages-site/server-logic/admin-events/admin-events.serverlogic.yml`
- Delete: `.powerpages-site/server-logic/calendar-events/calendar-events.js`
- Delete: `.powerpages-site/server-logic/calendar-events/calendar-events.serverlogic.yml`

- [ ] Remove all three obsolete Event endpoint definitions.
- [ ] Pass one AbortSignal through My Calendar's registration and Event requests.
- [ ] Search runtime source and deployable metadata for remaining Event Server Logic references.
- [ ] Run focused service/configuration/page tests, the full test suite, and `npm run build`.
