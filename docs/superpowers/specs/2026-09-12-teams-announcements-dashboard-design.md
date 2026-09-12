# Live Teams Announcements Dashboard Design

## Goal

Replace the static, disabled Teams Announcements card on the authenticated Home dashboard with live Dataverse announcements. The card will show only announcements active at the current date and time, and selecting a row will open its complete content in an accessible modal with a backdrop.

## Data source

The React application will read the `mss_teamsannouncements` table through the Power Pages Web API entity set `/_api/mss_teamsannouncementses`.

The query will request only:

- `mss_teamsannouncementsid`
- `mss_announcementlink`
- `mss_content`
- `mss_enddate`
- `mss_startdate`
- `mss_title`

An announcement is eligible only when both dates are valid and the current instant is inclusively between them:

```text
start date <= current date/time <= end date
```

Records with a missing or invalid start or end date will be excluded. The service will apply the active-window constraint in its OData query and repeat the same validation after mapping the response. Active records will be sorted by start date, newest first, with the record ID as a deterministic tie-breaker.

This direct Web API filtering minimizes transferred data, but it is not a row-level security boundary. Authenticated users with global table read permission can construct other allowed Web API queries. Future or expired announcements must not contain data that is confidential from authenticated portal users.

## Service and dashboard state

A focused Teams Announcements service will:

- validate and normalize GUIDs and returned values;
- reject malformed collection envelopes safely;
- normalize title and content strings;
- accept only valid HTTP or HTTPS announcement links;
- return invalid or blank links as `null`;
- support an `AbortSignal` so Home unmounts cancel the request.

`useHomeDashboardData` will load announcements in an independent effect and expose announcement data, loading status, and a dedicated retry action. A failure in announcements will not remove Meeting Reports, Events, or Meeting Invites, and retrying announcements will not reload those other sections.

## Announcement list

The existing Teams Announcements `Coming Soon` state will be removed. The live card will provide loading, empty, error, and ready states using the dashboard's existing visual language.

Each ready-state row will show only:

- the announcement title;
- the formatted start date;
- a link icon when and only when the normalized announcement link is available.

The link icon is an informational indicator. It will not navigate independently or interfere with selecting the row. The whole row will be implemented as an accessible button that opens the announcement modal.

The list viewport will show at most five normal row heights. When there are more than five rows, it will scroll vertically while hiding the visual scrollbar in supported browsers. The region remains keyboard focusable and scrollable.

## Announcement modal

Selecting a row opens a reusable announcement-details modal over a backdrop. The modal will display:

- title;
- formatted start date;
- complete multiline content with its line breaks preserved;
- an `Open announcement` button only when a valid HTTP or HTTPS link exists;
- a Close control.

The end date is used for eligibility filtering and will not be displayed in either the list or modal. The external-link button will open the announcement URL in a new tab with `noopener,noreferrer` protection.

The modal will use dialog semantics, move focus into the dialog, trap keyboard focus while open, close with the Close button, Escape, or a direct backdrop click, and restore focus to the selected announcement row after closing. Clicking inside the dialog will not close it. Background page scrolling will be disabled while the modal is open and restored afterward.

## Power Pages configuration

The integration will add:

- `Webapi/mss_teamsannouncements/enabled = true`;
- a minimal `Webapi/mss_teamsannouncements/fields` allowlist containing the six queried columns;
- `Webapi/mss_teamsannouncements/disableodatafilter = false`;
- an authenticated-users Global table permission with read access only.

The permission will not grant create, write, delete, append, or append-to access. Exact table, entity-set, primary-key, and column names will be validated against the OIAC Test/UAT Dataverse metadata before generating configuration files.

## Error handling

Malformed or failed Web API responses will produce the existing inline dashboard error treatment and a `Try again` action. Errors will not use browser alerts. Invalid links will be treated as absent instead of being rendered or opened.

## Testing

Automated tests will cover:

- exact query fields and inclusive active-window filtering;
- exclusion of missing, invalid, future, and expired date ranges;
- newest-first deterministic sorting;
- valid HTTP/HTTPS link normalization and rejection of unsafe schemes;
- independent dashboard loading, failure, cancellation, and retry state;
- removal of the Teams Announcements `Coming Soon` state;
- title/start-date rows and conditional link icons;
- five-row hidden-scroll styling;
- modal content, conditional external-link button, keyboard behavior, backdrop closing, focus restoration, and scroll locking;
- least-privilege Power Pages settings and table permission metadata;
- the complete application test suite and production build.

Deployment remains a separate action and requires explicit environment confirmation.
