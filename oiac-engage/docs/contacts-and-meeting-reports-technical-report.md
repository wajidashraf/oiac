# Contacts and Meeting Reports: Technical Implementation Report

**Audience:** OIAC Engage Team Lead  
**System:** React-based Power Pages SPA with Dataverse Web API  
**Report date:** August 29, 2026  
**Implementation status:** Implemented and deployed to OIAC Dev

## 1. Executive summary

OIAC Engage uses the supported Power Pages Web API to retrieve Contacts and to create, retrieve, and update Meeting Reports in Dataverse. Authentication is supplied by Power Pages, and all API requests run in the signed-in user's browser session.

The two primary access rules are:

1. The Contacts page obtains the logged-in Contact's District and adds that District GUID to every directory query. The page therefore displays Contacts assigned to the same District as the logged-in user.
2. Meeting Reports are linked to the submitting Contact through the `Reported By` lookup. A Contact-scoped Power Pages table permission uses that relationship to return only reports owned by the logged-in Contact.

Meeting Report submission is a two-part transaction from the SPA's perspective:

1. Create or update the main `mss_meetingreport` record.
2. Add or remove Contact relationships for selected OIAC Staff Members and Volunteers through two Dataverse many-to-many relationships.

The application protects this workflow with validation, duplicate prevention, request cancellation, loading states, explicit error handling, and retry logic that retries only failed relationship operations instead of creating a second Meeting Report.

## 2. Main Dataverse tables and relationships

| Purpose | Dataverse table | Entity set used by the Web API |
|---|---|---|
| Portal users, representatives, staff, volunteers, and directory entries | `contact` | `contacts` |
| District records | `mss_district` | `mss_districts` |
| Meeting Reports | `mss_meetingreport` | `mss_meetingreports` |

The Meeting Report workflow uses these relationships:

| Relationship | Type | Purpose |
|---|---|---|
| `mss_meetingreport_Reportedby_contact` | Contact to Meeting Report, one-to-many | Identifies the authenticated Contact who owns/submitted the report and provides the security scope for report access. |
| `mss_Representative` | Meeting Report lookup to Contact | Stores the representative or office associated with the meeting. |
| `mss_District` | Meeting Report lookup to District | Stores the District explicitly selected for the meeting. |
| `mss_MeetingReport_Contact_Staff` | Meeting Report to Contact, many-to-many | Associates multiple OIAC Staff Contacts with a report. |
| `mss_MeetingReport_Contact_Volunteers` | Meeting Report to Contact, many-to-many | Associates multiple Volunteer Contacts with a report. |

The Contact and District tables are also related through `mss_contact_District_mss_district`. This relationship is used to obtain the logged-in user's District and to describe the intended District-to-Contacts permission chain.

## 3. Shared Power Pages Web API client

All Contact and Meeting Report services call the shared client in `src/shared/powerPagesApi.ts`. The SPA does not use `Xrm.WebApi`, because that API is not the supported client API for Power Pages pages.

### Request verification token

For `POST`, `PATCH`, and `DELETE` requests, the client:

1. Requests `/_layout/tokenhtml` using the current same-origin Power Pages session.
2. Extracts the value of the hidden `__RequestVerificationToken` input from the returned HTML.
3. Caches the parsed token so simultaneous write requests do not create duplicate token requests.
4. Adds the token to the `__RequestVerificationToken` request header.

`GET` and `HEAD` requests do not require the verification token. Every request includes `credentials: "same-origin"` and requests JSON responses.

### Diagnostics and errors

The client logs request preparation, request start, response status, content type, token activity, and sanitized errors to the browser console. Dataverse error codes and messages are captured in `PowerPagesApiError`, while raw HTML error pages are not echoed into application logs.

## 4. Logged-in user identity and profile loading

Power Pages exposes the authenticated portal user's Contact identifier to the SPA session. The Contact GUID is the key used for both features.

For Meeting Report Step 1, the SPA requests:

```text
GET /_api/contacts(<logged-in-contact-guid>)
    ?$select=contactid,fullname,emailaddress1,address1_city,
             address1_stateorprovince,_mss_district_value
```

If `_mss_district_value` is present, the District name/number is retrieved separately:

```text
GET /_api/mss_districts(<district-guid>)
    ?$select=mss_districtid,mss_number
```

Step 1 then displays the following read-only values:

- Full Name
- Email
- District, preferring the District name and falling back to the Contact's state/province

For a new report, Step 2 starts without a District selection even when the profile contains a valid District lookup. The user must explicitly select the meeting District. Existing reports retain their saved District when loaded for editing.

If the Power Pages session does not contain a valid Contact GUID, the Contacts page and Meeting Report form stop loading data and display a sign-in/profile error rather than making an unrestricted request.

## 5. Contacts page retrieval process

### 5.1 Resolve the user's District

The Contacts page first requests only the logged-in Contact's District lookup:

```text
GET /_api/contacts(<logged-in-contact-guid>)
    ?$select=_mss_district_value
```

The value is normalized and validated as a GUID. No District GUID is hard-coded in the application.

If no District is assigned, the page displays an administrator-contact message and does not query the directory.

### 5.2 Retrieve same-District Contacts

After resolving the District, each Contacts request selects only these fields:

- `contactid`
- `fullname`
- `emailaddress1`
- `mobilephone`
- `address1_city`
- `address1_stateorprovince`
- `_mss_district_value`

The base filter is always:

```text
_mss_district_value eq <logged-in-user-district-guid>
```

The results are ordered by `fullname asc, contactid asc` so pagination is deterministic. Missing field values are displayed as an em dash rather than causing rendering failures.

### 5.3 Search behavior

The search box is debounced for 350 milliseconds. A search value is applied to these Dataverse fields:

- Full name
- Email
- Mobile phone
- City
- State/province

The generated filter has this logical shape:

```text
district-filter AND
(
  name contains search OR
  email contains search OR
  mobile contains search OR
  city contains search OR
  state/province contains search
)
```

The District condition is included even when search is active. Apostrophes are escaped according to OData string rules. A search change clears all stored continuation links and returns the user to page 1.

### 5.4 Server-side pagination

The Contacts page requests `Prefer: odata.maxpagesize=15`. Dataverse returns up to 15 records and may include `@odata.nextLink`.

The application stores the continuation link for each visited page. Next uses the Dataverse-provided continuation link; Previous uses the stored link for the prior page. The implementation does not use `$skip`, because Power Pages does not support `$skip` for this Web API scenario.

Before a continuation link is reused, its origin and path are validated. Only a same-origin `/_api/contacts` continuation link is accepted.

### 5.5 Request lifecycle

The Contact hook uses both `AbortController` and monotonically increasing request IDs. When the search, page, user, or retry state changes, the previous request is aborted. A response is ignored if it belongs to an older request. This prevents duplicate requests and stale search results from replacing newer data.

The UI provides dedicated states for:

- Loading the user's District
- Loading Contacts
- Missing authenticated Contact
- Missing District
- No matching results
- API failure with Retry

## 6. How Meeting Reports are retrieved

### 6.1 Security basis

Meeting Report list queries do not add a client-side owner filter. Ownership is enforced by the Power Pages table permission named **Authenticated Owned Meeting Report Manage**.

That permission has Contact scope and uses:

```text
mss_meetingreport_Reportedby_contact
```

When the report is created, the SPA binds `mss_Reportedby` to the logged-in Contact. Power Pages then evaluates the Contact-scoped permission and returns only Meeting Reports connected to that Contact through the `Reported By` relationship.

This is stronger than relying only on a browser-generated filter: a user cannot gain access to another Contact's report merely by removing or changing a query-string filter.

### 6.2 List query and ordering

The list retrieves only the summary fields required by the UI:

- `mss_meetingreportid`
- `mss_subject`
- `mss_startdateandtime`
- `mss_dateofmeeting`
- `_mss_representative_value`
- `mss_overallsentiment`

Reports are ordered by:

```text
mss_startdateandtime desc, mss_meetingreportid asc
```

The Start Date and Time descending rule defines “latest.” The record ID is a deterministic secondary order when multiple reports have the same start time. `mss_dateofmeeting` remains selected only as a display fallback for legacy records that do not have `mss_startdateandtime`.

### 6.3 Home and Reports pages

- The Home page requests a maximum of 5 latest reports and defensively renders no more than 5.
- The Meeting Reports page requests a server-side page size of 15.
- The full Reports page uses Dataverse `@odata.nextLink` continuation pagination with Previous, Next, and the current page indicator.
- Continuation links are restricted to the same origin and the exact `/_api/mss_meetingreports` path.

Loading, empty, retryable error, and success states are rendered on both pages.

### 6.4 Loading a report for editing

An edit request retrieves the main report fields and expands both many-to-many Contact navigation properties:

```text
mss_MeetingReport_Contact_Staff
mss_MeetingReport_Contact_Volunteers
```

The returned Contact records populate the selected Staff and Volunteer values. The original relationship IDs are stored separately so the application can calculate additions and removals when the user saves an update.

## 7. Meeting Report form and validation

The form has three steps.

### Step 1: Volunteer Information

Displays the authenticated Contact profile as read-only data. This confirms who is submitting the report and which District is associated with the user.

### Step 2: Meeting Details

Collects:

- Subject
- Start Date and Time
- End Date and Time
- Representative lookup
- District lookup with no automatic selection for new reports
- Meeting Format
- OIAC Staff Members multi-select
- Volunteers multi-select

Required validation checks Subject, both date-time values, Representative, District, and Meeting Format before Step 3 is opened. End Date and Time must be strictly later than Start Date and Time.

### Step 3: Report Content

Collects:

- Write Down What the Staff Said, Not What You Said, required
- Follow-Up Note (Once the Meeting Ended)
- Documents Provided, optional single-line text
- Overall Sentiment

The staff-said narrative is validated again before submission. The service also validates required values, the date-time range, and GUID formats before creating the Dataverse payload, so invalid identifiers cannot be inserted into OData binding paths.

## 8. Meeting Report field mapping

| Form value | Dataverse payload |
|---|---|
| Subject | `mss_subject` |
| Start Date and Time | `mss_startdateandtime` |
| End Date and Time | `mss_enddateandtime` |
| Representative | `mss_Representative@odata.bind: /contacts(<guid>)` |
| District | `mss_District@odata.bind: /mss_districts(<guid>)` |
| Meeting Format | `mss_meetingformat` |
| Write Down What the Staff Said, Not What You Said | `mss_writedownwhatthestaffsaidnotwhatyousaid` |
| Follow-Up Note (Once the Meeting Ended) | `mss_followupnoteoncethemeetingended` |
| Documents Provided | `mss_documentsprovided` |
| Overall Sentiment | `mss_overallsentiment` |
| Logged-in report owner, create only | `mss_Reportedby@odata.bind: /contacts(<logged-in-contact-guid>)` |

The two `datetime-local` form values are interpreted in the user's browser timezone and converted to ISO timestamps for Dataverse. When editing, Dataverse timestamps are converted back to local date-time control values. Legacy `mss_dateofmeeting` values remain readable and are shown as noon on the legacy calendar date; new saves use only the start and end date-time columns.

Meeting Format uses values `1` through `5` for In-person, Microsoft Teams, Phone, District, and Other. Overall Sentiment uses `1` through `5` for Very Supportive, Supportive, Neutral, Non-committal, and Opposed.

## 9. Create workflow

The final create process is:

1. Acquire the submit lock so repeated clicks cannot start duplicate saves.
2. Show the reusable full-page `LoadingBackdrop` with “Saving report.”
3. Validate required text, dates, choices, and lookup GUIDs.
4. `POST /_api/mss_meetingreports` with the main report payload and the logged-in Contact in `mss_Reportedby@odata.bind`.
5. Read the new Meeting Report GUID from the response `entityid` header.
6. Build one add operation for each selected Staff and Volunteer Contact.
7. Execute the many-to-many relationship operations.
8. If all operations succeed, navigate to `/report` with a `reportSaved` success state.

The main report must exist before N:N links can be created because each relationship request needs the new Meeting Report GUID.

## 10. Update workflow

The update process is:

1. Load the existing report and both N:N Contact collections.
2. Preserve the original Staff and Volunteer Contact GUID sets.
3. `PATCH /_api/mss_meetingreports(<report-guid>)` with the updated main fields. The owner binding is intentionally not changed during update.
4. Compare the original and newly selected Contact sets.
5. Add newly selected relationships and remove deselected relationships.
6. Navigate to `/report` with a `reportUpdated` success state after all operations succeed.

The Contact-scoped report permission provides read and write access only when the report is related to the logged-in Contact through `Reported By`.

## 11. Multi-select lookup logic

Two reusable multi-select instances are used in Step 2.

### OIAC Staff Members

The Contact query includes:

```text
contains(jobtitle,'Staff')
```

### Volunteers

The Contact query includes:

```text
contains(jobtitle,'Volunteer')
```

For either lookup, typed search adds a name-or-email filter. Results are ordered by full name and Contact ID and limited to 15 options per lookup request.

The multi-select control:

- Displays `Select options` when empty and `<count> selected` when values exist.
- Opens a dropdown containing a search box and checkbox list.
- Keeps selected Contacts in the option set even when the current search result changes.
- Uses a `Set` of Contact GUIDs for selected-state checks.
- Prevents duplicate values by merging options in a map keyed by Contact GUID.
- Supports deselection through the checkbox list.
- Closes on an outside pointer action or Escape.
- Includes loading, no-results, error, and retry states.
- Uses a 350 ms debounce and aborts stale lookup searches.

The single Representative and District lookups use the same debounced lookup hook. Their selected value remains visually inside the field and can be cleared or replaced.

Lookup queries are currently available across all Districts. Staff and Volunteer eligibility is based on text contained in the Contact `jobtitle` column, not a dedicated role relationship or Choice column.

## 12. N:N association and disassociation API calls

For a selected Contact, the application adds a relationship using:

```text
POST /_api/mss_meetingreports(<report-guid>)/<relationship-schema>/$ref
```

with this body:

```json
{
  "@odata.id": "https://<portal-origin>/_api/contacts(<contact-guid>)"
}
```

For a deselected Contact during update, the application removes the relationship using:

```text
DELETE /_api/mss_meetingreports(<report-guid>)/<relationship-schema>/$ref
       ?$id=<encoded-contact-api-url>
```

The relationship schema is selected from an internal allow-list; it is never supplied from arbitrary user input.

Before execution, operations are normalized and deduplicated by action, relationship type, and Contact GUID. Operations run concurrently with `Promise.allSettled`, allowing the application to identify only the failed links.

If the report saves but some N:N links fail, the persisted report GUID is retained and only failed relationship operations are offered for retry. The application does not create another report. If the initial create request has an unknown network outcome and no `entityid` can be confirmed, the form warns the user not to resubmit because Dataverse may already have created the record.

## 13. Power Pages Web API site settings

The following Web API settings are enabled:

| Table | Enabled setting | Exposed columns |
|---|---|---|
| Contact | `Webapi/contact/enabled` | Contact ID, name, email, mobile, city, state/province, job title, and District lookup fields |
| District | `Webapi/mss_district/enabled` | District ID and District number |
| Meeting Report | `Webapi/mss_meetingreport/enabled` | Required report columns, lookup fields, owner fields, and both N:N navigation properties |

`disableodatafilter` is `false` for all three tables so the secured OData filters and searches used by the SPA are allowed.

The field allow-lists reduce accidental Web API exposure to the columns required by these workflows.

## 14. Table permissions and web role

All permissions below are assigned to the Power Pages **Authenticated Users** web role.

| Permission | Scope and rights | Purpose |
|---|---|---|
| Contact Self Read | Self; Read | Allows the portal user to retrieve their own profile and District lookup. |
| Authenticated User District Read | Contact scope through `mss_contact_District_mss_district`; Read | Allows retrieval of the District related to the logged-in Contact. |
| District Contacts Read | Parent scope under the user's District; Read | Defines the intended District-to-Contacts read chain. |
| Authenticated Contact Directory Read and Append | Global; Read, Append, Append To | Allows cross-District Representative, Staff, and Volunteer lookup and N:N relationship operations. No Contact create, update, or delete is granted. |
| Authenticated District Global Read | Global; Read, Append, Append To | Allows District lookup across all Districts and binding a District to a report. No District create, update, or delete is granted. |
| Authenticated Owned Meeting Report Manage | Contact scope through `mss_meetingreport_Reportedby_contact`; Read, Create, Write, Append, Append To | Allows users to create, read, update, and relate their own reports. Delete is not granted. |

## 15. Important Contact-directory security limitation

Power Pages table permissions are additive. The global Contact read permission required by the current cross-District report lookups means an authenticated user is technically authorized to request Contacts outside their District through the Contact Web API.

Therefore:

- The Contacts page itself always applies the logged-in user's District filter and displays same-District Contacts.
- The parent/child District permissions describe the intended directory access model.
- However, the global Contact read permission broadens the effective server-side Contact authorization. The District filter in the browser is not, by itself, a complete security boundary while that global permission remains assigned to the same web role.

This does **not** affect Meeting Report ownership enforcement, which remains server-side and Contact-scoped through `Reported By`.

### Recommended remediation

If strict District-level Contact confidentiality is required while Staff, Volunteer, and Representative lookups must remain cross-District, the two access requirements should be separated. Recommended options are:

1. Create dedicated lookup/membership tables containing only the minimal globally visible Staff, Volunteer, and Representative data, and remove global read access from the main Contact table.
2. Provide a Power Pages Server Logic or controlled custom API endpoint that returns only approved lookup records and columns, while keeping direct Contact Web API access District-scoped.
3. Use a dedicated business-role/data model for lookup eligibility instead of `contains(jobtitle, ...)`, which is text-based and can produce unintended matches.

Assigning another web role alone will not solve the conflict if the same user simultaneously has both the District role and a global Contact-read role, because Power Pages combines the permissions.

## 16. Operational safeguards

The current implementation includes:

- GUID normalization before IDs enter API paths.
- OData string escaping for search values.
- Same-origin continuation-link validation.
- Request cancellation and stale-response prevention.
- Submission locking to prevent duplicate saves.
- Loading backdrop during report persistence.
- Separate loading, empty, missing-profile, missing-District, and error states.
- Retry for failed profile/list requests.
- Retry of only failed N:N operations.
- Sanitized diagnostic console logging.
- Navigation back to the Meeting Reports list with create/update success feedback.

## 17. Primary implementation files

| Area | File |
|---|---|
| Shared Power Pages Web API and CSRF handling | `src/shared/powerPagesApi.ts` |
| Contact query construction and mapping | `src/features/contacts/contactService.ts` |
| Contact debounce, pagination, cancellation, and states | `src/features/contacts/useDistrictContacts.ts` |
| Contacts page UI | `src/pages/Contact.tsx` |
| Meeting Report API, payloads, retrieval, and relationships | `src/features/meetingReports/meetingReportService.ts` |
| Meeting Report domain types | `src/features/meetingReports/meetingReportTypes.ts` |
| Shared lookup request lifecycle | `src/features/meetingReports/useMeetingReportLookup.ts` |
| Single Contact and District lookups | `src/features/meetingReports/ContactLookup.tsx` |
| Staff and Volunteer multi-select | `src/features/meetingReports/MultiContactLookup.tsx` |
| Create/update form orchestration | `src/pages/MeetingReportForm.tsx` |
| Full Meeting Reports list | `src/pages/Report.tsx` |
| Latest five reports on Home | `src/pages/Home.tsx` |
| Power Pages permissions | `.powerpages-site/table-permissions/` |
| Power Pages Web API settings | `.powerpages-site/site-settings/` |

## 18. Conclusion

The Meeting Report implementation has a clear server-enforced ownership model: each new report is bound to the authenticated Contact, and Contact-scoped table permission controls later read and update access. Main report data and N:N participant links are intentionally saved in sequence, with targeted retry behavior to avoid duplicate reports.

The Contacts page provides the required same-District user experience, server-side search, and continuation pagination. The team should nevertheless treat the global Contact read permission as an explicit security decision. If Contact data must be confidential by District, the globally available reporting lookups should be moved behind a separate table or server-controlled endpoint so the Contact directory can remain securely District-scoped at the Power Pages permission layer.
