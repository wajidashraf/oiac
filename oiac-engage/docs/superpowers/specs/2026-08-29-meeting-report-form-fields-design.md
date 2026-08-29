# Meeting Report Form Fields Design

## Goal

Update the multi-step Meeting Report form to collect the new Dataverse start/end date-time values, use the requested field labels, require explicit district selection for new reports, remove obsolete fields, and persist the new Documents Provided value.

## Scope

The change covers the React form, Meeting Report domain types, Dataverse Web API payload and response mapping, list ordering and date display, Power Pages Web API field configuration, automated tests, and the contacts/meeting-reports technical report. Existing unrelated pagination and deployment work must be preserved.

## Form behavior

### Step 1: Volunteer Information

- Keep Full Name, Email, and State / District as read-only profile information.
- Remove the City field from this step.
- The profile may still contain a city value because other features or data mappings can use it; only this form presentation changes.

### Step 2: Meeting Details

- Rename `Meeting Title` to `Subject` while continuing to store the value in `mss_subject`.
- Replace the date-only `Date of Meeting` input with two `datetime-local` inputs:
  - `Start Date and Time`, mapped to `mss_startdateandtime`.
  - `End Date and Time`, mapped to `mss_enddateandtime`.
- Both values are required.
- End Date and Time must be strictly later than Start Date and Time. The user remains on step 2 and receives a clear validation message when the range is invalid.
- Rename `Representative / Office` to `Representative`.
- Rename `State / District` to `District`.
- A new report must start with no District selection even when the signed-in Contact has a district. The user must select one before continuing.
- An existing report being edited retains and displays its saved District.
- Keep Meeting Format, tagged OIAC Staff, and tagged Volunteers unchanged.

### Step 3: Report Content

- Rename `Issues Discussed` to `Write Down What the Staff Said, Not What You Said`; it remains required and maps to `mss_writedownwhatthestaffsaidnotwhatyousaid`.
- Remove `Outcomes & Next Steps` from the UI and Meeting Report draft state.
- Rename `Follow-up Actions` to `Follow-Up Note (Once the Meeting Ended)` and keep its mapping to `mss_followupnoteoncethemeetingended`.
- Immediately after the follow-up field, add an optional single-line `Documents Provided` text input mapped to `mss_documentsprovided`.
- Keep Overall Sentiment unchanged.

## Data mapping and compatibility

The Meeting Report draft uses start and end date-time strings suitable for `datetime-local` controls. Before create or update, valid local date-time values are converted to ISO timestamps for Dataverse. Loading an existing record converts Dataverse timestamps back to local `datetime-local` values without discarding the time.

New submissions and updates write `mss_startdateandtime` and `mss_enddateandtime`; they no longer write `mss_dateofmeeting`. Reads retain `mss_dateofmeeting` as a fallback for legacy reports that do not yet contain `mss_startdateandtime`. A fallback legacy date is represented at midday so an old report can still be opened and displayed, but the user must supply a valid end date/time before saving if none exists.

The Meeting Reports list sorts by `mss_startdateandtime` descending and displays the start date/time. It can fall back to `mss_dateofmeeting` when rendering legacy data returned by Dataverse. The Home-page limited query uses the same ordering and mapping through the shared service.

The Power Pages field allowlist must include `mss_startdateandtime`, `mss_enddateandtime`, and `mss_documentsprovided`. The legacy `mss_dateofmeeting` remains readable for compatibility.

## Validation and errors

Step 2 validation requires Subject, Start Date and Time, End Date and Time, Representative, District, and Meeting Format. It rejects invalid date-time strings and a range whose end is equal to or before its start. The service repeats these checks before building a Dataverse payload so callers cannot bypass form validation.

Step 3 continues to require the staff-said narrative under its new label. Documents Provided and Follow-Up Note are optional and are submitted as trimmed strings.

## Testing

Component tests will verify that City and Outcomes & Next Steps are absent; new labels are accessible; District is not preselected on a new report; saved District values hydrate during editing; both date/time inputs are required; invalid ranges block navigation; and new values reach create/update calls.

Service tests will verify payload keys and ISO values, invalid date ranges, response hydration, legacy-date fallback, list selection and ordering, and the Power Pages field allowlist. Existing relationship, retry, pagination, and authorization tests must continue to pass.

The production build and relevant Vitest suites must pass before completion.
