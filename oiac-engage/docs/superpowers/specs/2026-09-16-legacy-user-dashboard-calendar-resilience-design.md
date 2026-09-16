# Legacy User Dashboard and Calendar Resilience Design

## Goal

Keep dashboard scheduling widgets and My Calendar usable when an authenticated Contact owns legacy Dataverse child rows whose parent lookup has been cleared, while preserving valid records, existing eligibility rules, and current security boundaries.

## Confirmed Root Cause

The failing older Contact and working newer Contact both have valid Contact IDs, names, and District lookups. Their user-specific child records differ:

- The failing Event Registration is `Registered` but has `_mss_event_value: null`.
- The failing Meeting Invite Participant is `Accepted` but has `_mss_meetinginvite_value: null`.
- The working Contact's Event Registration and Meeting Invite Participant rows contain valid parent lookup GUIDs.

The Power Pages Web API correctly returns HTTP 200 with JSON. The frontend then rejects the complete response while mapping one orphaned row:

- `eventRegistrationService.ts` converts a missing Event lookup to an empty ID and throws.
- `meetingInviteService.ts` passes a missing Meeting Invite lookup to strict GUID validation and throws.
- Meeting Invites and Upcoming Meetings share the rejected invite collection.
- My Calendar awaits registered Events and Meeting Invites with `Promise.all`, so either rejected branch hides both datasets.

## Data Contract

Collection envelopes remain strict: an HTTP 200 body without a `value` array is a frontend processing failure. Individual legacy rows are handled independently:

- Event Registration rows missing a valid registration ID, Contact ID, Event ID, or recognized status are skipped.
- Meeting Invite Participant rows missing a valid participant ID, Contact ID, Meeting Invite ID, or recognized status are skipped.
- Meeting Invite rows missing a valid invite ID, title, or start date are skipped.
- Missing or null Contact/District relationship expansions are treated as empty arrays.
- Invalid entries inside relationship expansions are ignored rather than invalidating the invite collection.
- Contact, District, Event, Registration, Meeting Invite, and Participant GUIDs are normalized by trimming whitespace/braces and using lowercase before storage or comparison.
- A null District remains a supported Contact state and matches only direct or meeting-for-all invitations.
- A missing Contact full name does not prevent invite reads. Acceptance continues to require a safe non-empty participant display name, using a neutral fallback when necessary.

Skipped rows produce sanitized diagnostic warnings containing the source collection and skipped count, never names, email addresses, record payloads, flow URLs, or access tokens.

## Meeting Invite Eligibility

An otherwise valid Meeting Invite is shown when at least one condition is true:

1. `mss_meetingforall === true`.
2. The normalized signed-in Contact ID occurs in the invite's normalized Contact relationship IDs.
3. The Contact has a normalized District ID and it occurs in the invite's normalized District relationship IDs.

Empty or absent relationship arrays are valid and contribute no match. A participant is attached only when its normalized Meeting Invite lookup matches the normalized invite ID.

## Dashboard Isolation and Error Classification

Dashboard report, registration, invitation, and announcement requests remain independently managed; there is no new page-wide `Promise.all`. Upcoming Meetings remains a derived view of successfully loaded Meeting Invites.

The shared data-loading boundary distinguishes:

- `api`: network failure or non-success HTTP response.
- `processing`: HTTP success whose JSON envelope cannot be parsed or whose collection envelope is invalid.
- `empty`: a successful valid response with no usable rows; represented as `ready` with an empty collection, not an error.

The dashboard stores a safe failure kind per affected section. API failures retain retryable connection copy. Processing failures explain that returned account data could not be processed. Empty collections retain the existing friendly empty states.

## My Calendar Partial Success

My Calendar loads registered Events and Meeting Invites concurrently but settles each branch independently.

- If both branches succeed, render their combined chronological items.
- If one branch succeeds, render its items and show a scoped warning for the failed branch with the existing retry action.
- If both branches fail, show the full calendar error state.
- If both branches succeed with no usable items, show the combined empty state.
- Retry starts both branches again and preserves abort-on-unmount behavior.

No rejected, pending, unanswered, orphaned, or invalid record is shown. Past and future Registered Events and Accepted Meeting Invites remain eligible.

## My Calendar Authentication and Roles

My Calendar is authenticated-user functionality, not functional-role functionality.

- Administrators, Staff, Volunteers, Applicants, and multi-role users retain the existing App Shell navigation and `/my-calendar` route.
- An authenticated user without one of the functional portal roles can still see and open a My Calendar link from the restricted authenticated experience.
- `/my-calendar` bypasses only the functional-role gate; other protected routes remain gated exactly as today.
- Anonymous users remain outside the authenticated SPA.
- Client visibility does not replace Dataverse table permissions or Contact ownership enforcement.

## Components and Files

- `src/shared/powerPagesApi.ts`: identify JSON-decoding failures from successful HTTP responses.
- A small shared load-failure utility: classify API/network versus processing failures for UI state.
- `src/features/eventRegistrations/eventRegistrationService.ts`: normalize and retain valid rows while skipping orphaned legacy registrations.
- `src/features/meetingInvites/meetingInviteService.ts`: tolerate missing relationships and skip orphaned participants/invites while preserving eligibility.
- `src/features/dashboard/useHomeDashboardData.ts` and `src/pages/Home.tsx`: expose and render scoped failure kinds without coupling widgets.
- `src/pages/MyCalendar.tsx`: independently settle and render the Event and Meeting branches.
- `src/App.tsx`, `src/components/RequirePortalRole.tsx`, and the restricted authenticated shell/page as needed: permit and expose My Calendar without widening other route access.
- Existing colocated tests: reproduce the supplied legacy payloads and cover authenticated-only, admin, multi-role, missing-District, empty, partial-success, and valid-response behavior.

## Test Matrix

1. Older Contact: orphaned Event Registration and Meeting Invite Participant rows are skipped; valid sibling rows still render.
2. New Contact: complete rows map unchanged.
3. Administrator: My Calendar route and navigation are available.
4. Multi-role Contact: role ordering does not hide My Calendar.
5. Authenticated-only Contact: My Calendar is visible and routable while other role-protected routes remain blocked.
6. Missing District: meeting-for-all and direct Contact invites remain eligible; District-only invites do not match.
7. Empty responses: dashboard and calendar display empty states, not errors.
8. HTTP 200 valid JSON with orphaned rows: usable records render and skipped rows are diagnosed.
9. HTTP 200 invalid envelope or invalid JSON: processing-specific state is shown.
10. Network/non-2xx failure: API-specific retry state is shown.
11. Calendar partial success: a failed invite branch does not hide registered Events, and a failed Event branch does not hide accepted meetings.
12. Meeting eligibility: meeting-for-all, direct Contact, and District associations use normalized GUID comparisons and empty relationships remain valid.

## Non-Goals

- No Dataverse schema or production-row mutation.
- No table-permission redesign.
- No cleanup or deletion of orphaned production records.
- No dashboard visual redesign.
- No changes to meeting acceptance or event registration business status values.
- No changes to unrelated pages, flows, or deployment configuration.
