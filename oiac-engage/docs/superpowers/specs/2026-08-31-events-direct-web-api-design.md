# Events Direct Web API Design

## Goal

Replace the Events and My Calendar dependencies on the `open-events`, `admin-events`, and `calendar-events` Power Pages Server Logic endpoints with direct Power Pages Web API access to the confirmed `mss_eventses` entity set.

## Data flow

`Events.tsx` continues calling `getEvents(isAdmin)` and retains its current role detection, loading/error states, list/calendar rendering, retry behavior, and cleanup guard. `eventService.ts` builds one explicit OData query and calls `powerPagesFetch`, keeping credentials, verification-token behavior, abort signals, and errors inside `powerPagesApi.ts`.

Administrators request every Event ordered by `mss_startdatetime asc`. Volunteers request only records whose status is Published (`866530001`) or Registration Open (`866530002`) and whose start time is at or after the current UTC timestamp. Responses are read from the Web API `value` array and mapped to the existing `EventItem` contract using formatted choice annotations with the existing label fallbacks.

To remove the `admin-events` dependency completely without breaking the administrator form, event creation moves to `POST /_api/mss_eventses` and update moves to `PATCH /_api/mss_eventses(<id>)` through `powerPagesRequest`.

My Calendar first reads the signed-in Contact's contact-scoped Event Registration rows through the Web API and retains only Registered (`1`) rows. It deduplicates those Event IDs, then requests the matching future Published, Registration Open, or Registration Closed Events directly from `/_api/mss_eventses`. This preserves the registered-only calendar behavior without the `calendar-events` Server Logic endpoint. One AbortController covers both sequential requests and is aborted during React effect cleanup.

## Configuration and security

Add `Webapi/mss_events/enabled=true` and an explicit allowlist containing the requested Event columns. Preserve the existing Administrator and Volunteer Events table permissions and web-role assignments. The Volunteer OData filter is a UI visibility rule, not a security boundary, because Volunteer currently has Global Read access.

## Validation

Service tests will prove the exact administrator, volunteer, and registered-calendar queries, UTC filtering, response mapping, abort-signal forwarding, malformed-response rejection, and direct create/update requests. A configuration test will prove the Web API settings and unchanged permission scopes. Existing Events and My Calendar tests plus the full build will guard unchanged UI behavior.
