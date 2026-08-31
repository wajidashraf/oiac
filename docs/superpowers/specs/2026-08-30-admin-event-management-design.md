# Administrator Event Management Design

## Goal

Allow Power Pages users with the `Administrators` web role to create and update `mss_events` records from the Events page while preserving the existing volunteer/admin visibility rules.

## Calendar behavior

- The Events page List and Calendar views use the same loaded and status-filtered event collection.
- Volunteers see future Published and Registration Open events in both Events views.
- Administrators see all events in both Events views and can filter both views by Event Status.
- My Calendar remains separate: it contains accepted meetings and events registered by the signed-in user.

## User interface

The Events page shows `+ Create Event` only to administrators. Selecting it opens one inline form above the toolbar. Administrator event cards also show `Edit`; selecting it opens the same form populated from that event.

The form contains:

- Event Subject (`mss_eventname`), required.
- Start Date & Time (`mss_startdatetime`), required.
- End Date & Time (`mss_enddatetime`), required and later than Start.
- Event Type (`mss_eventtype`), required.
- Event Format (`mss_eventformat`), required.
- Event Status (`mss_eventstatus`), required; new events default to Draft (`866530000`).
- Venue Name (`mss_venuename`), required for In Person and Hybrid.
- Meeting URL (`mss_meetingurl`), required for Virtual and Hybrid and limited to HTTP(S) URLs.
- Description (`mss_description`), optional multiline text.

Changing Event Format removes values that do not apply: In Person clears Meeting URL; Virtual clears Venue Name; Hybrid retains both.

## Backend and authorization

The existing `admin-events` Server Logic record remains restricted to the Administrators web role. Its `get()` method continues returning all events. New `post()` and `put()` functions validate inputs server-side and call the Dataverse connector with EntitySetName `mss_eventses`.

`post()` creates a record and returns its ID. `put()` requires an event GUID query parameter and updates that record. Neither operation accepts a table name or role flag from the browser.

A separate global table permission grants Create and Write only to Administrators. The current read-only permission remains assigned to both Administrators and Volunteer, so volunteers never gain mutation permissions.

## Data contract

Read responses add raw choice values for Event Type and Event Format plus `description`, allowing the edit form to populate stable numeric values. The frontend sends a normalized payload containing title, ISO start/end timestamps, numeric type/format/status values, venue, meeting URL, and description.

## Errors and interaction

Client validation focuses the first invalid field and displays an accessible message. The form disables Save during requests. Successful create/update closes the form and reloads the Events collection. Failed requests keep the form open and show a non-sensitive retryable error.

Create, Edit, and save controls are never rendered for volunteers. Register and Add to Calendar remain non-persistent in this feature.

## Testing

- Page tests cover role visibility, create/edit modes, conditional fields, date validation, successful reload, and failure state.
- Service tests cover POST and PUT endpoint contracts and Server Logic envelope parsing.
- Server Logic tests execute `post()` and `put()` with mocked Dataverse connectors to verify validation, field mapping, and administrator-only deployment metadata.
- Full Vitest, TypeScript/Vite build, Server Logic validation, and an independent code review complete the change.
