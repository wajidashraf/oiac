# My Calendar History and Accepted Meetings Design

## Goal

Update **My Calendar** so the signed-in Contact sees every past and future event for which they have a `Registered` Event Registration, together with every past and future Meeting Invite they have accepted.

## Record Eligibility

### Registered events

The Event Registration remains the ownership boundary. Load registrations for the signed-in Contact and include only rows whose `mss_registrationstatus` is `Registered` (`1`). Deduplicate their Event IDs before loading Event details.

Remove the current `mss_startdatetime >= now` restriction from the registered-event detail query. Keep the existing Event status allowlist: Published (`866530001`), Registration Open (`866530002`), and the two Registration Closed values (`866530003` and `866530004`). Past and future matching Events are both eligible. Waitlisted and Cancelled Event Registrations remain excluded.

Fetch Event details in bounded batches so more than 100 distinct Registered Event IDs cannot make the entire calendar fail. Merge the batch results and sort them by start timestamp, then Event ID for deterministic ties.

### Accepted meeting invites

Reuse `getMeetingInvites(contactId)` and its existing Contact, District, and Meeting For All eligibility rules. Include an invite only when its selected participant row has `mss_invitationstatus` equal to `Accepted` (`1`). Include both past and future accepted invites. Pending, rejected, and unresponded invites remain excluded.

Meeting Invites with invalid start timestamps cannot be placed on the month grid and are excluded from calendar items. Missing or unsafe meeting links remain non-interactive.

## Calendar Item Mapping

Keep the existing `CalendarItem` presentation contract.

Registered Events map as they do today:

- `id`: Event ID.
- `date`: browser-local calendar date derived from Event start time.
- `title`: Event name.
- `kind`: `event`.
- `status`: `Registered`.
- `time`: browser-local start/end time.
- `location`: venue, online label, or venue-to-be-announced fallback.
- `joinUrl`: normalized HTTP/HTTPS Event meeting URL, otherwise `null`.

Accepted Meeting Invites map as follows:

- `id`: Meeting Invite ID.
- `date`: browser-local calendar date derived from meeting start time.
- `title`: Meeting title.
- `kind`: `meeting`.
- `status`: `Accepted`.
- `time`: browser-local start/end time.
- `location`: `Online meeting` when a safe meeting link exists; otherwise `Meeting location unavailable` because Meeting Invites do not expose a venue field.
- `joinUrl`: the existing safely normalized Meeting Invite link, otherwise `null`.

Sort selected-month items by their actual start instant and then ID, not by formatted display-time text. Extend `CalendarItem` with an internal sortable start timestamp while keeping it out of visible copy.

## Data Flow

`MyCalendar` continues to receive the signed-in Contact ID from `App`. On load or retry it starts the independent Meeting Invite request alongside the Event Registration request. Event details begin after the registered Event IDs are known. The page waits for both branches, maps their eligible rows, combines them with any explicitly supplied test/base items, and then renders the existing month grid and selected-month list.

Use one shared loading, ready, and error state to preserve the current page behavior. If either data branch fails, show the existing calendar error and retry action; retry reloads both branches. Abort all active requests when the page unmounts or reloads.

## Presentation

Preserve the current layout, responsive horizontal scrolling, legend, month navigation, grid, and monthly list. Event items retain the Registered styling, and accepted Meeting Invites use the existing meeting styling and Accepted badge.

Update empty-state copy so it covers both record types. When no eligible rows exist, explain that the user has no registered events or accepted meetings and retain the link to browse Events.

The selected month remains component state; URL synchronization and calendar export/synchronization are outside this change.

## Security and Accessibility

- Continue using the signed-in Contact ID for registration ownership and Meeting Invite eligibility.
- Do not render meeting or Event links unless they use HTTP or HTTPS.
- External links continue to use `target="_blank"` and `rel="noreferrer"` with record-specific accessible names.
- Preserve real buttons for month navigation, visible focus states, grid semantics, labeled dates, and the live loading/error status treatment.

## Testing and Verification

- Event service tests prove registered-event queries no longer apply a current-time cutoff, preserve the Event status allowlist, batch more than 100 IDs, merge results, and sort deterministically.
- Calendar-data tests prove past and future accepted Meeting Invites map correctly, invalid meeting dates are excluded, and same-day items sort by actual timestamps.
- My Calendar tests prove past and future registered Events and past and future accepted Meeting Invites appear together.
- My Calendar tests prove pending, rejected, and unresponded Meeting Invites remain absent.
- Existing tests continue to cover request abortion, safe and unsafe links, month navigation, empty state, and retry behavior.
- Run focused calendar, Event, Event Registration, and Meeting Invite tests.
- Run the complete Vitest suite and the production build.

## Scope

This change updates the React application and existing Power Pages Web API usage only. It does not create Dataverse tables or columns, change table permissions, deploy or publish the site, synchronize with Outlook, or add event/meeting editing from the calendar.
