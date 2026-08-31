# Home Dashboard Live Data and Registration Permissions Design

## Goal

Allow every authenticated portal user to register for an Event and replace the Home dashboard's static report, registration, and upcoming-event data with data owned by the signed-in Contact.

## Authorization

`Events Global Read` will be associated with the built-in `Authenticated Users` web role. It keeps Global scope, `read: true`, and `appendto: true`, while create, write, and delete remain false. `Authenticated Owned Event Registration Manage` remains Contact-scoped with create, read, write, and append enabled. Anonymous users receive neither permission.

This produces the lookup privilege pair required by the create payload: the new `mss_eventregistration` row may append to an existing `mss_events` row. The React payload continues binding `mss_Event` and `mss_Contact`; client code will not attempt to bypass Dataverse authorization.

## Dashboard Data

The Home route receives the signed-in Contact ID from `App`. A focused `useHomeDashboardData` hook coordinates existing domain services and exposes independent report and registration states.

The report pipeline requests the five latest Contact-owned meeting reports and an exact OData count in parallel. The registration pipeline requests all Event Registration rows visible through the Contact-scoped permission, keeps only status `Registered`, deduplicates by Event ID, and uses those IDs to load future registered Event records. `Cancelled` and `Waitlisted` rows do not contribute to the KPI or Upcoming Events.

`Reports Submitted` displays the exact report count. `Events Registered` displays the number of unique active registered Event IDs, including past registrations. Other existing KPIs remain unchanged because no implemented Dataverse source exists for them.

## Upcoming Events

Home displays at most the first three future registered events returned in ascending start-date order. Each item uses the existing date-tile design and actual Event name and start date. The footer continues linking to My Calendar.

When the Contact has no future registered events, the panel shows: “You have no registered events yet. Browse available events and select Add to Calendar to register.” A `Browse events` link opens `/activity/events`.

## Loading and Errors

All requests use the shared Power Pages API wrapper and one AbortController per dashboard load. Independent requests start concurrently; the Event detail request begins after registrations resolve because it depends on their IDs. Aborted requests do not update state.

Report and registration failures remain isolated. A failed report request does not hide registered events, and a failed registration request does not hide recent reports. Failed KPI values render an unavailable marker instead of an incorrect zero, and each affected area provides the existing retry behavior.

## Testing

Tests will verify the Authenticated Users permission association, required append/append-to flags, exact report-count query, status filtering, deduplication, live KPI rendering, three-event limit, chronological display, empty state, error state, retry, and AbortController cleanup. Existing Event, My Calendar, report, and Home tests must remain green, followed by a production build.
