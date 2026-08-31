# Event Registration Design

## Goal

Connect each signed-in Power Pages Contact to Events through `mss_eventregistration`, make registration idempotent, and show only Registered event registrations in My Calendar.

## Approved lifecycle

- Registered (`1`): keep the existing row and report that the user is already registered.
- Cancelled (`2`): update the same row to Registered and refresh `mss_registrationdate`.
- Waitlisted (`3`): preserve the row, disable Register/Add to Calendar, and exclude the event from My Calendar.
- No row: create one Registered row with the Event and Contact lookup bindings.
- `mss_registrationnumber` is omitted so Dataverse can populate it when configured as an auto-number. It is not needed by the portal workflow.

## Architecture

The React client uses the existing CSRF-aware `powerPagesApi` client for direct Event Registration Web API reads and mutations. The service performs a Contact + Event pre-check before POST and uses PATCH for Cancelled rows. A per-event pending state prevents two buttons in the same browser from starting duplicate mutations.

Power Pages table permissions scope Event Registration rows through the `mss_contact` lookup to the signed-in Contact. Event and Contact lookup target permissions provide Append To access. The database should eventually receive an alternate key on Contact + Event if hard uniqueness across simultaneous browser sessions is required; the requested pre-check prevents ordinary portal duplicates but cannot make two independent POST requests atomic.

My Calendar loads the current Contact's Registered registrations, then sends only those Event IDs to a role-protected `calendar-events` Server Logic endpoint. That endpoint returns future Published, Registration Open, and Registration Closed event details, so closing registration does not remove an already registered event from My Calendar and the full Event table is not exposed through the browser Web API. It does not treat the Events page calendar as My Calendar: the Events calendar continues to show every event visible in the Events list, while My Calendar contains only status `1` registrations. Static accepted-meeting examples remain until their separate backend process is integrated; static event examples are replaced by registered Dataverse events.

## UI behavior

- Registration Open event with no registration: Register and Add to Calendar both register the user.
- Published event with no registration: Add to Calendar registers the user; Register remains hidden under the existing event rules.
- Registered: show `Registered` and `In My Calendar`; both are disabled.
- Waitlisted: show `Waitlisted`; registration actions are disabled.
- Cancelled: expose the normal action; clicking it reactivates the row.
- While a request is pending, both actions for that event are disabled and show progress.
- Success and failure messages use accessible live regions.

## Dataverse contract

Table logical name: `mss_eventregistration`

Entity set: `mss_eventregistrations`

Fields:

- `mss_eventregistrationid`
- `_mss_contact_value`
- `_mss_event_value`
- `mss_registrationdate`
- `mss_registrationnumber`
- `mss_registrationstatus`
- `mss_Contact` lookup navigation property for `@odata.bind`
- `mss_Event` lookup navigation property for `@odata.bind`

The Contact-scoped permission uses the inferred Dataverse relationship schema name `mss_eventregistration_Contact_contact`. This must be validated against live metadata before deployment if the environment uses a different relationship schema casing/name.

## Error handling

- Invalid Contact/Event GUIDs fail before a request is sent.
- Malformed Dataverse responses fail closed.
- A failed registration operation leaves the card actionable and displays a retryable message.
- My Calendar shows loading, error/retry, and empty states without rendering stale static event records.

## Verification

- Unit-test query construction, response mapping, create bindings, status outcomes, Cancelled reactivation, and Waitlisted preservation.
- Component-test card state and Add to Calendar registration.
- Component-test dynamic My Calendar loading and Registered-only mapping.
- Configuration-test Web API allowlists and contact-scoped permissions.
- Run the focused tests, full test suite, TypeScript/Vite build, and local Power Pages permission validator.
