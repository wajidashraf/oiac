# Meeting Invites Dashboard Design

## Goal

Replace the dashboard's mocked, disabled Meeting Invites panel with a live Power Pages Web API experience. A signed-in user sees invitations that apply to everyone, their Contact, or their District and can accept any invitation that is not already accepted.

## Scope

This feature covers the existing Meeting Invites dashboard card, Dataverse reads from `mss_meetinginvites` and `mss_meetinginviteparticipant`, participant create/update operations, and the required Power Pages Web API settings and table permissions. It does not add invite administration, rejection controls, meeting-link navigation, a separate invitation page, or deployment.

## Confirmed Behavior

- Invitation status values are Accepted `1`, Pending `2`, and Rejected `3`.
- Accepted invitations show a read-only **Accepted** badge.
- Pending, Rejected, and invitations without a participant record show an active **Accept** button.
- If a participant exists, accepting patches it to status `1` and sets `mss_acceptedon` to the current ISO timestamp.
- If no participant exists, accepting creates one linked to the current Contact and Meeting Invite, with status `1`, the current acceptance timestamp, and `mss_name` formatted as `<Meeting title> - <Contact full name>`.
- An invitation is eligible when `mss_meetingforall` is true, the signed-in Contact belongs to its Contact relationship, or the Contact's District belongs to its District relationship.
- Accepted cannot be changed back to Pending from the portal.

## Architecture

Create a focused meeting-invite feature module containing normalized types and a service. The service uses the existing `powerPagesFetch` and `powerPagesRequest` helpers, validates GUIDs and response shapes, and exposes operations for loading eligible invitations and accepting one.

The dashboard hook remains the orchestration boundary. It loads invitations independently from reports and event registrations, owns invitation loading/error state, and exposes a per-invitation acceptance action to `Home`. This prevents an invite failure from blanking the rest of the dashboard.

The current Contact ID comes from the authenticated Power Pages session. The service reads the Contact's `fullname` and `_mss_district_value`, loads Meeting Invites with only Contact and District identifiers expanded, and applies the eligibility predicate. Participant records use a server-side `_mss_contact_value` filter before being joined by Meeting Invite ID.

## Dataverse Read Contract

### Current Contact

Read:

```text
/_api/contacts(<contactId>)?$select=contactid,fullname,_mss_district_value
```

The District lookup may be absent. A missing District does not prevent `meetingforall` or direct-Contact invitations from loading.

### Meeting Invites

Use the supplied entity set `mss_meetinginviteses`. Select:

```text
mss_meetinginvitesid,mss_meetingenddate,mss_meetingforall,mss_meetingstartdate,mss_meetingtitle
```

Expand only the identifiers needed for eligibility:

```text
mss_MeetingInvites_Contact_Contact($select=contactid),
mss_MeetingInvites_mss_District_mss_District($select=mss_districtid)
```

The frontend does not request `mss_meetinglink` because this design does not display or navigate to it.

Normalize every valid record into a `MeetingInvite` containing its ID, title, start/end values, and the current user's participant state. Invalid records fail the invitation collection safely rather than being rendered with unreliable identifiers.

### Participants

Use the supplied entity set `mss_meetinginviteparticipants` with:

```text
$select=mss_meetinginviteparticipantid,mss_acceptedon,_mss_contact_value,
mss_invitationstatus,_mss_meetinginvite_value,mss_name
$filter=_mss_contact_value eq <contactId>
```

When duplicate participant rows exist for one user/invitation, prefer Accepted, then Pending, then Rejected, using the latest `mss_acceptedon` as a deterministic tie-breaker. This prevents a stale row from replacing an accepted state.

Invitations are sorted by `mss_meetingstartdate` ascending, with missing or invalid dates last and ID as the final deterministic tie-breaker.

## Acceptance Contract

Lock an invitation synchronously before starting its request so rapid repeat clicks cannot create duplicate operations. Other invitation rows remain interactive.

For an existing Pending or Rejected participant, send:

```json
{
  "mss_invitationstatus": 1,
  "mss_acceptedon": "<current ISO timestamp>"
}
```

with `PATCH /_api/mss_meetinginviteparticipants(<participantId>)`.

For an invitation without a participant, send:

```json
{
  "mss_name": "<Meeting title> - <Contact full name>",
  "mss_invitationstatus": 1,
  "mss_acceptedon": "<current ISO timestamp>",
  "mss_Contact@odata.bind": "/contacts(<contactId>)",
  "mss_MeetingInvite@odata.bind": "/mss_meetinginviteses(<meetingInviteId>)"
}
```

with `POST /_api/mss_meetinginviteparticipants`.

The service reads the returned `entityid` header when present. If a POST response is uncertain or does not return an ID, it performs a narrow participant lookup for that Contact and Meeting Invite. Finding an Accepted participant recovers the successful outcome without asking the user to create another record.

After success, update only that invitation in local state to Accepted. On failure, retain the Accept button, clear the row lock in `finally`, and show the existing inline error UI rather than `alert()`.

## User Interface

Remove the Meeting Invites card's `dashboard-panel--coming-soon`, `aria-disabled`, and Coming Soon badge. Preserve the current OIAC palette, Inter typography, borders, row rhythm, and status badge styling.

Each row contains:

- Meeting title.
- Start date and time formatted in `America/New_York` with the `ET` suffix.
- A positive Accepted badge or compact Accept button.

The card displays loading, empty, and retryable error states using the dashboard's existing status and alert patterns. Acceptance errors appear inside this card and identify the invitation that could not be accepted.

The invitation list has a maximum block size of five standard dashboard row heights. It uses vertical overflow when more rows exist, hides the visual scrollbar with Firefox and WebKit rules, and remains focusable and keyboard-scrollable with an accessible region label.

On narrow screens, rows may wrap so the title and action remain readable. Buttons retain the app's minimum target size and visible focus treatment.

## Power Pages Configuration

Add minimal Web API settings for:

- `mss_meetinginvites`: enabled with the primary key, title, start/end date, `mss_meetingforall`, and the two relationship navigation properties required by `$expand`.
- `mss_meetinginviteparticipant`: enabled with the participant primary key, Contact lookup logical/read forms, Meeting Invite lookup logical/read forms, status, accepted date, and name.

The authenticated role needs read access to Meeting Invites and read/create/write/append/append-to access to its own participant records through the participant-to-Contact relationship. The Meeting Invite permission must allow append-to so a participant can bind to an invite. Existing Contact and District read permissions are reused.

Direct Web API filtering is a display boundary, not conditional row security for `mss_meetingforall`. A global authenticated Meeting Invite read permission allows a technically capable authenticated user to query other Meeting Invite rows directly. This design is acceptable only when invite metadata is not confidential. If targeted invite metadata must be private, replace the Meeting Invite read with a Server Logic endpoint that validates the current Contact and District server-side.

Before writing configuration, verify the exact case-sensitive navigation properties and table relationship names against available site metadata or the supplied Dataverse schema. Expected lookup navigation names are `mss_Contact` and `mss_MeetingInvite`; expected participant Contact relationship is `mss_meetinginviteparticipant_Contact_contact`.

## Error Handling

- Missing Contact session: show that invitations could not be loaded and provide the existing retry path after sign-in/session recovery.
- Invitation or participant read failure: show a retryable error only in Meeting Invites.
- Accept failure: show `<Meeting title> could not be accepted. Try again.` and restore the Accept button.
- Aborted requests: do not surface as errors or update unmounted state.
- Malformed Dataverse results: fail with safe application copy; do not expose Dataverse response bodies in the UI.

## Testing

Use test-driven development with focused service, hook, UI, and configuration tests.

Service tests cover:

- Exact Contact, Meeting Invite, and participant query contracts.
- Eligibility for all-users, direct-Contact, and District invitations and exclusion of unrelated invitations.
- Participant precedence and deterministic ordering.
- Existing participant PATCH payload.
- Missing participant POST payload, lookup binds, name, timestamp, and entity ID normalization.
- Recovery after an uncertain POST response.
- Invalid GUIDs, malformed responses, and request failures.

Dashboard-hook and component tests cover:

- Invitation loading independent of reports/events.
- Accepted read-only badge.
- Accept buttons for Pending, Rejected, and missing participants.
- Per-row loading and rapid-click locking.
- Successful in-place transition to Accepted.
- Inline acceptance errors and retryable collection errors.
- Empty state and request abortion.
- More than five rows rendered inside the focusable, scrollbar-hidden vertical viewport.
- Removal of the mocked invite data and Coming Soon treatment.

Configuration tests verify the two enabled settings, minimal case-sensitive field allowlists, authenticated-only table permissions, Contact ownership on participants, required mutation flags, and the absence of delete permission.

Final verification runs the focused tests, complete test suite, production build, source scan, and diff check.
