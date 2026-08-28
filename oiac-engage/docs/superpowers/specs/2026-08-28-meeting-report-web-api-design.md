# Meeting Report Power Pages Web API Design

## Goal

Replace the demo-only meeting report wizard with authenticated Dataverse create and update workflows for `mss_meetingreport`, including global Contact and District lookups and synchronization of the Staff and Volunteer many-to-many relationships.

## Scope

- Step 1 displays the signed-in Contact's read-only full name, email, district/state, and city.
- Step 2 edits the report subject, meeting date, representative Contact, District, meeting format, Staff contacts, and Volunteer contacts.
- Step 3 edits issues discussed, optional UI-only outcomes/next steps, follow-up actions, and overall sentiment.
- `/report/new` creates a new report.
- `/report/:reportId/edit` loads and updates an existing report that the signed-in user is permitted to access.
- Outcomes & Next Steps remains in client state and is not sent to Dataverse until a target Dataverse column is supplied.
- Related Event is removed from the persisted workflow because no Dataverse mapping was provided.

## Selected Approach

Use the Power Pages Web API directly from the React SPA. Every request uses the Power Pages request-verification token and same-origin credentials. Creation captures the record GUID from the `entityid` response header. Updates use `PATCH`. Staff and Volunteer links use their collection-valued N:N navigation properties and `$ref` requests.

This is preferred over a `$batch` change set because it is easier to support and recover from partial association failures in Power Pages. A server-side flow or custom endpoint would add infrastructure beyond the requested SPA Web API integration.

## Dataverse Mapping

The report entity set is `mss_meetingreports`.

| UI field | Dataverse field |
| --- | --- |
| Meeting Title | `mss_subject` |
| Date of Meeting | `mss_dateofmeeting` |
| Representative / Office | `mss_Representative@odata.bind` to `/contacts(<guid>)` |
| State / District | `mss_District@odata.bind` to `/mss_districts(<guid>)` |
| Meeting Format | `mss_meetingformat` |
| Issues Discussed | `mss_writedownwhatthestaffsaidnotwhatyousaid` |
| Follow-up Actions | `mss_followupnoteoncethemeetingended` |
| Overall Sentiment | `mss_overallsentiment` |
| Report owner | `mss_Reportedby@odata.bind` to the signed-in Contact |

Meeting format values are In-person `1`, Microsoft Teams `2`, Phone `3`, District `4`, and Other `5`. Sentiment values are Very Supportive `1`, Supportive `2`, Neutral `3`, Non-committal `4`, and Opposed `5`.

Staff contacts are associated through `mss_MeetingReport_Contact_Staff`. Volunteer contacts are associated through `mss_MeetingReport_Contact_Volunteers`.

## Data Loading and Lookup Behavior

The authenticated Contact ID comes from the Power Pages session, never from an editable form field. The profile query loads only `contactid`, `fullname`, `emailaddress1`, `address1_city`, `address1_stateorprovince`, and the Contact's District lookup/display value.

Representative, Staff, Volunteer, and District searches are available across all districts, as approved. Contact searches retrieve only required identifying fields. Staff queries always include `contains(jobtitle,'Staff')`; Volunteer queries always include `contains(jobtitle,'Volunteer')`. Search text is escaped before being inserted into an OData string literal. Requests are debounced, abortable, and sequence-checked so stale results cannot replace newer ones.

Multi-select controls use Contact IDs as identity, render removable selected chips, and reject duplicate selections.

## Create Workflow

1. Validate the authenticated user and all required fields before submission.
2. Disable navigation and submission while the request is in flight.
3. POST the report payload, including `mss_Reportedby@odata.bind`, to `/_api/mss_meetingreports`.
4. Read and normalize the new GUID from the `entityid` response header.
5. Associate each unique Staff and Volunteer through the corresponding N:N navigation `$ref` endpoint.
6. Show success feedback and return to the reports page when all operations succeed.
7. If the report was created but an association fails, retain the created report ID and retry only failed associations. Never create a second report during retry.

## Update Workflow

1. Load the permitted report and its current Staff and Volunteer relationships.
2. Populate all persisted wizard fields and selected Contact chips.
3. PATCH only the report's mapped scalar and lookup values.
4. Diff the original and selected relationship ID sets.
5. POST `$ref` requests for newly selected contacts and DELETE `$ref` requests for deselected contacts.
6. Track successes and failures per relationship operation. Retrying repeats only failed operations and never replays the successful PATCH or successful relationship changes.
7. A report that is not found or not permitted displays a safe access/error state and cannot be updated.

## Error and Loading States

- Step 1 has loading, missing-session, missing-profile, and retry states.
- Lookup controls expose loading, empty, and request-failure states without clearing valid selections.
- Submission errors are shown in an accessible alert and preserve entered form data.
- Partial N:N failures clearly state that the report itself was saved and offer a relationship-only retry.
- Duplicate submissions are blocked with a single in-flight submission guard.

## API Client

The shared API module exposes a raw-response request function so callers can inspect headers while preserving the existing JSON convenience wrapper. Both paths use the same token, credentials, header merging, abort signal, and sanitized `PowerPagesApiError` handling.

## Security and Power Pages Configuration

All permissions apply to the Authenticated Users web role only.

- Contact: global Read and Append, no Create/Write/Delete, with the Web API field allowlist limited to the profile and lookup fields used by this feature. This global scope is necessary because all-district Contact search was explicitly approved. It also means authenticated users can query those allowlisted Contact columns directly through the portal API; client-side role filters are usability filters, not a security boundary.
- District: global Read only, with only district ID and display name exposed.
- Meeting Report: Contact-scoped through `mss_reportedby`, with Read, Create, Write, Append, and Append To as required for owned report updates and N:N association management; no Delete.
- Anonymous users receive no permissions for these tables.

The Contact-scoped Meeting Report permission depends on the existing `mss_reportedby` relationship and every created report being bound to the authenticated Contact. If that relationship cannot be selected by Power Pages table permissions in the target environment, secure creator-scoped updates cannot be enforced with this model; the relationship must be made available/configurable before deployment rather than falling back to a global report permission.

## Testing

- API tests cover token handling, response headers, JSON/no-content responses, errors, and aborts.
- Service tests cover safe query construction, exact payload mapping, GUID normalization, create/update endpoints, global role filters, N:N add/remove requests, deduplication, and partial-failure retries.
- UI tests cover profile loading, create and edit hydration, validation, selection behavior, step preservation, loading/error states, duplicate-submit prevention, success navigation, and relationship-only retry.
- Metadata tests verify site settings, allowlisted columns, Authenticated Users assignments, global lookup permissions, creator-scoped report permissions, and absence of anonymous access.
- The complete test suite and production build run before completion.
