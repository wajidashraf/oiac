# Upcoming Meetings Join Links Design

## Goal

Replace the static sample rows in the dashboard's **Teams & Resources → Upcoming Meetings** card with every future `mss_meetinginvites` record that is eligible for the signed-in user. Display the nearest meeting first and give each meeting with a safe URL an accessible **Join Link** that opens its meeting platform in a new browser tab.

## Eligibility and Date Rules

Reuse the existing `getMeetingInvites(contactId)` request and its established eligibility rules. A meeting is eligible when at least one of these conditions is true:

- `mss_meetingforall` is true.
- The signed-in Contact is directly related to the meeting invite.
- The meeting invite is related to the signed-in Contact's District.

The Upcoming Meetings card will derive its list from that eligible collection. Include a meeting when its start date is valid and its start instant is greater than or equal to the current instant. Exclude invalid dates and meetings whose start instant is in the past.

Show every matching future meeting without applying the three-item limit used by the separate Upcoming Events card. Sort by start instant ascending, then by meeting-invite ID ascending when two meetings have the same start time. The existing Meeting Invites card continues to receive the full eligible collection and retains its current acceptance behavior.

## Data Contract and Query

Add the Dataverse logical column `mss_meetinglink` to:

- The Meeting Invite Web API site-setting field allowlist.
- The Meeting Invite `$select` query.
- The raw-record mapper and `MeetingInvite` TypeScript type.

Expose the mapped value as `meetingLink: string | null`. Accept trimmed `http://` and `https://` URLs only. Map unsupported protocols, malformed values, blank values, and non-string values to `null`. This prevents unsafe schemes such as `javascript:` from reaching an anchor.

Keep the current three-request profile/invite/participant flow. Do not add another Dataverse request or a custom endpoint.

## Dashboard Architecture

Add a small pure selector for the dashboard that accepts eligible meeting invites and the current time, filters future meetings, and returns a deterministic ascending list. Passing the current time as an argument makes the boundary behavior testable without coupling the selector to React.

`useHomeDashboardData` will expose the derived `upcomingMeetings` alongside the existing `meetingInvites`. Both values come from the same successful invite load and share `invitesStatus` and `retryInvites`; accepting an invite updates both views through the existing collection state.

Remove the `upcoming-meetings` sample group from `dashboardData.ts`. Keep the static Important Channels and Recent Documents data unchanged.

## Presentation

The **Teams & Resources** section becomes an active section because it now contains an interactive live card. Remove the section-level `aria-disabled` and Coming Soon label. Mark only the Important Channels and Recent Documents cards as disabled and Coming Soon.

The Upcoming Meetings card will remain visually consistent with the existing dashboard cards. Each row contains:

- Meeting title.
- Start date and time formatted in `America/New_York`, with the `ET` suffix used elsewhere on the dashboard.
- A **Join Link** action with a meeting/video icon.

For a safe meeting link, render a real anchor with `target="_blank"` and `rel="noreferrer"`. Its accessible name will identify the meeting and announce that it opens in a new tab, for example, `Join District Briefing in a new tab`.

For a missing or unsafe meeting link, render non-interactive `Link unavailable` text instead of an anchor. Do not redirect through an internal route and do not attempt to identify or special-case Microsoft Teams, Outlook, Zoom, or other providers; the browser opens the supplied safe URL and the destination platform handles it.

Use a restrained join/video icon from the project's existing icon library. Preserve visible keyboard focus and ensure the action remains comfortably tappable on mobile.

## Loading, Empty, and Error States

- While eligible meeting invites load, show `Loading upcoming meetings…` in the card.
- If the shared invite request fails, show `Upcoming meetings could not be loaded.` with a retry button wired to `retryInvites`.
- If the request succeeds but no eligible future meetings remain, show `No upcoming meetings.`
- A missing link affects only its row and does not turn the whole card into an error state.

The existing Meeting Invites card keeps its current loading, error, empty, acceptance, and retry behavior.

## Accessibility and Security

- Use semantic lists and real anchors for available links.
- Give icon-only decoration `aria-hidden="true"`.
- Include `target="_blank"` and `rel="noreferrer"` on external links.
- Never render unsafe protocols into `href`.
- Do not expose meetings outside the existing Contact/District/Meeting For All eligibility rules.
- Keep disabled Coming Soon cards non-interactive and individually marked as unavailable.

## Verification

- Service tests prove `mss_meetinglink` is selected, trimmed, safely mapped, and rejects unsafe schemes.
- Configuration tests prove the Power Pages Web API allowlist includes `mss_meetinglink`.
- Selector tests prove the current-time boundary, past/invalid exclusion, all-record behavior, ascending order, and deterministic ID tie-break.
- Hook tests prove `upcomingMeetings` is derived from the same eligible collection and remains synchronized after invite acceptance.
- Home tests prove live rows replace static samples, links open in a new tab with accessible names and icons, missing links are non-interactive, and loading/error/empty states are clear.
- Home tests also prove the Teams & Resources section is active while Important Channels and Recent Documents remain disabled Coming Soon cards.
- Run focused service, hook, configuration, and Home tests; then run the complete Vitest suite and production build.

## Deployment Boundary

This change prepares deployable React and Power Pages configuration source. Deployment, publishing, Dataverse schema changes, and live-site cache restart are outside scope unless separately requested. The `mss_meetinglink` column is assumed to already exist in Dataverse as provided.
