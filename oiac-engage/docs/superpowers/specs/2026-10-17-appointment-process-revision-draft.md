# Appointment process revision — proposed design

Status: first-delivery scope confirmed by the user's My Calendar-only selection and explicit administrator visibility instruction, 17 October 2026. The reschedule-confirmation and cancellation commands below remain recommendations for a separately agreed follow-up. This amends the earlier approved appointment design and preserves the existing theme, 110px collapsed desktop/tablet cards, single-contact lookup and unrelated application behavior.

## Current behavior confirmed in source

- Pending requests already offer Accept and Request Reschedule to their actual recipient. The server independently enforces recipient identity, Pending status and row version.
- Administrator reads currently bypass participant filters for incoming, outgoing and calendar queries. This can put another person's requests under a personal heading without response buttons. Do not solve this by letting administrators accept for another person.
- Accepted appointment records already become meeting items in My Calendar. The calendar source supports requester-or-recipient visibility and does not create a duplicate Event or Meeting Invite record.
- Teams acceptance currently requires the recipient to provide an existing HTTPS meeting link. The application does not provision Teams meetings or Outlook invitations.
- Rescheduling currently saves a proposal and excludes it from the calendar. There is no requester confirmation transition yet. Cancelled rows can be displayed, but there is no portal cancellation command.

## Options

1. Recommended: retain one appointment as the shared meeting record. Acceptance makes that same record appear once in each participant's My Calendar. This uses the current model, avoids duplicate invitations and gives cancellation/rescheduling one authoritative state.
2. Create a separate linked CRM Meeting Invite on acceptance. This is appropriate only if another CRM workflow requires that table. It needs a durable unique appointment-to-meeting link, transactional creation and synchronized state, permissions and cleanup.
3. Add Outlook invitations and automatic Teams provisioning as well as My Calendar. This adds an external organizer identity, account/consent requirements and retry-safe external creation/update/cancellation. Confirm this requirement before designing that integration.

Confirmed: this application's My Calendar only. No Outlook invitations, Teams provisioning or linked CRM Meeting Invite records. Administrators must retain access to all appointments through a separate administrator-only view.

## Proposed first delivery

### Cards and personal lists

- Move all status badges, including Pending, Accepted and Cancelled, to the right-hand action area. Display Pending consistently instead of the current Requested substitute.
- Keep avatar and the three existing content lines on the left. Preserve 110px collapsed cards on desktop/tablet, current theme and usable mobile wrapping. Proposal details remain available through an accessible disclosure.
- Incoming means the signed-in Contact is the recipient; outgoing means the signed-in Contact is the requester. Enforce this in server queries as well as the UI, including for administrators. Administrators have a separate **All Appointments** view; regular users cannot access its server command. The default **My Appointments** view shows the personal incoming/outgoing lists. Switching views follows the existing unsaved-draft and saving locks. All Appointments cards identify both participants, retain paging and allow responses only to the actual recipient of a Pending request.
- On an incoming Pending card, show the Pending badge with **Accept** and **Request Reschedule**. Accept is an action; Accepted is the resulting status. Outgoing Pending cards have the badge and no recipient response buttons. Accepted/Cancelled/Rejected cards have no Pending response buttons. Accepted online cards retain Join meeting.

### Acceptance and My Calendar

- Accept uses the existing recipient-only, version-checked server transition. Teams requires a valid meeting link under the app-calendar-only option; Phone Call and In Person do not.
- After a successful server response, show “Appointment accepted and added to both calendars.” Refresh the affected lists and the application's appointment calendar source.
- Calendar membership is derived from the committed Accepted record and participant IDs, with exactly one item per appointment per user. Pending, Cancelled, Rejected and unconfirmed reschedule proposals are excluded.
- Keep My Calendar participant-scoped for administrators too. Preserve existing Events and Meeting Invite sources and their independent loading/error handling.
- Recheck the appointment source when the calendar is opened or regains focus. Do not claim push updates between already-open sessions unless a separate refresh mechanism is implemented and tested.
- Preserve Eastern Time conversion and DST validation, trusted requester stamping, authorization, duplicate-submit locks and conditional writes. A retry must not create a second calendar item.

## Recommended follow-up: finish the reschedule agreement

The present proposal workflow stops before confirmation. A useful next step is: recipient proposes a new date/time and reason; requester sees **Accept new time**; only requester confirmation makes it Accepted and eligible for both calendars at the agreed time. Until then, the proposal is unconfirmed and outside My Calendar. Both participants see the proposal details.

This needs a separately reviewed state transition and explicit confirmed-time/history storage decision. The current response contract treats the original preferred time as immutable; do not silently overwrite it or infer agreement from a suggested date. Preserve legacy/imported rows and identify the proposing party before supporting proposals by either participant. Do not expand this first delivery into an unagreed schema change.

Cancellation can follow with a confirmed participant-only action that marks the shared appointment Cancelled and removes it from both calendar views. The requested Cancelled badge is in scope now; adding that cancellation action requires agreement on who may cancel and when. Cancellation is not deletion.

## Verification and delivery boundary

Add meaningful regression checks for badge placement and labels, incoming/outgoing ownership for ordinary users and administrators, recipient-only response actions, accepted calendar visibility for both participants and exclusion for an unrelated user. Exercise 110px cards, responsive controls and keyboard access. Retain backend version-conflict checks and verify no duplicate calendar items after refresh/retry.

Before claiming the complete two-person workflow works in hosted UAT, use two separate real signed-in participants to create, accept and verify both calendars; use an unrelated user for denial checks. The previous administrative save checks do not establish this behavior. Use only uniquely named verification records and remove only those records afterward.

Run the relevant tests, full regression and production build; review the implementation and deploy to the already authorized Test/UAT site only. Preserve existing site metadata. No Production deployment or site restart is included.

## Design review checklist

- [x] Inspect current UI, server transitions and My Calendar source.
- [x] Identify the administrator personal-list ambiguity and preserve recipient-only writes.
- [x] Compare shared-record, linked-CRM-record and external-calendar approaches.
- [x] Draft the card and first-delivery flow and separate broader workflow changes.
- [x] Resolve calendar/invitation scope with the user: app My Calendar only.
- [x] Confirm first-delivery requirements from the user's selection and administrator visibility correction. Broader workflow changes remain separate.
- [x] Write the implementation plan and implement/test/deploy the agreed first-delivery scope. See `../plans/2026-10-17-appointment-personal-and-admin-views.md` and `../../alm/appointment-views-uat-deployment.json`; broader reschedule agreement/cancellation remains separate.
