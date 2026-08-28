# District-Scoped Contacts Web API Design

**Date:** 2026-08-28  
**Status:** Approved  
**Scope:** Replace the Contacts page's local data and record-detail interaction with a read-only, district-scoped Power Pages Web API directory.

## Objective

The Contacts page will show only Dataverse Contact records assigned to the same `mss_district` as the signed-in portal user. It will use the Power Pages portal Web API, include the required CSRF token, perform search and pagination on the server, and enforce the district boundary through Power Pages table permissions rather than trusting the browser filter.

The integration applies to every user in the built-in **Authenticated Users** web role. Anonymous users receive no Contact or District table permission.

## Existing Context

- The site is a React and TypeScript Power Pages code site.
- The current Contacts page imports two local records from `src/data/contacts.ts`.
- The current page contains a View button and an inline read-only details form. Both are removed.
- Power Pages exposes the signed-in portal Contact identifier as `Microsoft.Dynamic365.Portal.User.contactId`; the existing authentication adapter already reads it.
- Dataverse metadata confirms:
  - Contact lookup logical name: `mss_district`
  - Lookup read property: `_mss_district_value`
  - District table logical name and entity set: `mss_district` / `mss_districts`
  - Contact entity set: `contacts`
  - Relationship schema name: `mss_contact_District_mss_district`
- The downloaded site metadata currently has no Contact Web API settings or table permissions.

## Architecture

The implementation is divided into small, reusable units:

1. **Power Pages API client**
   - Obtains a CSRF token through `shell.getTokenDeferred()`.
   - Sends same-origin `fetch` requests to `/_api/...` with `__RequestVerificationToken` and JSON headers.
   - Accepts an `AbortSignal` and normalizes Power Pages error responses.
   - Does not use `Xrm.WebApi` or an external Dataverse token.

2. **Contact types and service**
   - Defines the exact Web API response shape and the display model.
   - Validates and normalizes portal Contact and District GUIDs.
   - Retrieves the signed-in user's `_mss_district_value` from their own Contact record.
   - Builds district-scoped Contact queries.
   - Maps nullable Dataverse values without inventing data.

3. **District Contacts hook**
   - Owns district discovery, current page, debounced search, loading, empty, and error state.
   - Cancels the previous request when page or search changes.
   - Uses a monotonically increasing request identifier so late responses cannot overwrite newer results.
   - Avoids duplicate requests for the same effective district, page, and search combination.

4. **Contacts page**
   - Receives the authenticated portal user from `App` rather than reading global state repeatedly.
   - Renders semantic search, state messaging, table, and pagination controls.
   - Contains no View button, record route, record-detail form, or actions column.

5. **Scoped CSS**
   - Extends the existing `contact-directory__*` styles in `theme.css`.
   - Keeps Power Pages and Bootstrap theme rules from overriding the directory by using page-scoped selectors.
   - Provides a horizontal table region on narrow screens and full-width pagination controls when needed.

## Data Flow

### Identify the user and retrieve their district

1. The application authentication guard confirms an authenticated Power Pages session.
2. The Contacts page receives `session.user.contactId`.
3. The service validates it as a GUID. A missing or invalid identifier produces an authentication/session error and no collection request is sent.
4. The client requests:

   ```text
   GET /_api/contacts(<contact-id>)?$select=_mss_district_value
   ```

5. If `_mss_district_value` is absent, the page displays a missing-district state and does not query the Contact collection.

### Retrieve Contacts

Every collection query selects only:

```text
contactid
fullname
emailaddress1
mobilephone
address1_city
address1_stateorprovince
_mss_district_value
```

The base filter is always:

```text
_mss_district_value eq <validated-district-guid>
```

Search adds a grouped `contains` expression for `fullname`, `emailaddress1`, `mobilephone`, `address1_city`, and `address1_stateorprovince`. The expression is joined to the district filter with `and`; no code path can construct a search-only query.

Results are ordered by `fullname asc,contactid asc` for deterministic paging. The query uses `$skip=(page-1)*15` and `$top=16`. At most 15 records are displayed; the sixteenth record is a server-side look-ahead used only to determine whether Next is enabled. This avoids downloading the full district and avoids relying on the Web API's 5,000-row `$count` limit.

### Safe search

- The raw input is never inserted into a URL.
- Leading and trailing whitespace is removed.
- OData string literals escape each apostrophe as two apostrophes.
- `URLSearchParams` encodes the complete query string.
- Search is debounced for approximately 350 milliseconds.
- An effective search change resets the current page to 1 before requesting data.
- A cleared search restores the district-only query.

## User Interface

The page keeps the existing Back link, Contacts heading, and district-directory visual language. The hard-coded district names in the introductory sentence are removed because the page does not request the District display name.

The table columns are:

1. Full Name
2. Mobile Phone
3. Email
4. State / Province
5. City

Phone and email values are displayed as text. There is no row action, record URL, or interaction that opens an individual Contact record. Missing values render as an em dash with accessible fallback wording where necessary.

Pagination contains Previous, `Page N`, and Next. Previous is disabled on page 1. Next is disabled when the server response contains 15 or fewer records after look-ahead processing. Both buttons are disabled while a request is active to prevent duplicate navigation requests.

## Loading and Failure States

- **Initial loading:** announce that the user's district is being loaded.
- **Page/search loading:** preserve the page shell, disable controls, and announce Contact loading.
- **Unauthenticated:** explain that sign-in is required; no API request runs. The application guard normally prevents this state, but the component handles it defensively.
- **Missing portal Contact ID:** explain that the Power Pages session could not identify the Contact.
- **Missing district:** explain that no district is assigned and no contacts can be shown.
- **No results without search:** explain that the district has no available contacts.
- **No search matches:** show a search-specific empty message without removing the search input.
- **API or CSRF failure:** show a non-sensitive error message and a Retry action. Detailed inner errors remain disabled in production.
- **Missing field value:** display an em dash without failing the row.

Aborted requests are not rendered as errors. A late response is ignored unless its request identifier is still current.

## Power Pages Security

Client-side filtering is not the authorization boundary. The following read-only permission chain is associated with **Authenticated Users**:

1. **Contact Self Read**
   - Table: `contact`
   - Access: Self
   - Privileges: Read only
   - Purpose: permits retrieval of the signed-in user's `_mss_district_value`, including a null value.

2. **Current Contact District Read**
   - Table: `mss_district`
   - Access: Contact
   - Relationship: `mss_contact_District_mss_district`
   - Privileges: Read only
   - Purpose: identifies the District record related to the signed-in Contact.

3. **District Contacts Read**
   - Table: `contact`
   - Access: Parent/child permission under Current Contact District Read
   - Relationship: `mss_contact_District_mss_district`
   - Privileges: Read only
   - Purpose: permits Contact records related to the authorized District record.

No permission grants Create, Write, Delete, Append, or Append To. No Contact or District permission is assigned to Anonymous Users. No Global Contact permission is created.

The existing direct Contact-to-District relationship is sufficient for this one-level parent/child model, so no Dataverse schema change is required. If that relationship is removed, made polymorphic, or replaced by an unconnected district value, secure same-district access would require a published relationship or a Contact-to-District membership/assignment table before the directory could remain enabled.

## Web API Site Settings

The site metadata will define active settings for:

- `Webapi/contact/enabled = true`
- `Webapi/contact/fields` with the explicit Contact field allowlist required by the two read operations, including the lookup logical name and its `_mss_district_value` read property
- `Webapi/contact/disableodatafilter = false`
- `Webapi/error/innererror = false`

The wildcard field setting is not used. `mss_district` itself does not need Web API enablement because the frontend never requests the District table; it participates only in server-side table-permission evaluation.

## Testing

Automated tests will cover:

- CSRF token acquisition and request headers.
- Portal Contact and District GUID validation.
- Query selection, deterministic order, server paging, district filter, and combined search filter.
- Apostrophe and special-character escaping.
- Mapping missing Dataverse values.
- Initial district lookup and Contact retrieval.
- Debounce and page reset after search changes.
- Previous/Next disabled states and result sets larger than 15.
- Aborted and stale requests not changing rendered results.
- Unauthenticated, missing contact ID, missing district, empty, no-match, loading, and API failure states.
- Absence of View buttons, record links, details form, and action column.
- Read-only permission and explicit Web API setting metadata.

Runtime tests in the deployed Power Pages site will use at least two authenticated users assigned to different districts, one user without a district, and an anonymous browser session. Network inspection will verify that every collection request contains the expected district filter and never returns records disallowed by table permissions.

## Acceptance Criteria

- The Contacts page no longer imports local Contact data.
- No Contact record can be opened from the directory.
- The user's district GUID is discovered at runtime and is never hard-coded.
- Every Contact collection query combines the district boundary with optional search criteria.
- Only 15 rows are displayed per page and all paging is server-side.
- Search covers all five required text columns and resets to page 1.
- Duplicate and stale requests cannot update the UI.
- All required states are clear and accessible.
- Power Pages table permissions enforce the district boundary for Authenticated Users.
- Web API exposure is read-only and limited to the required Contact columns.
- The production build and automated tests pass.
