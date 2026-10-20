# Appointments and Press Coverage corrections

User-directed amendment to the approved module designs, 17 October 2026. The supplied card screenshot and explicit 110px height are the visual specification; existing application typography, controls, page width, colours and spacing remain the design system. Existing unrelated work stays intact. No Production changes or site restart.

## Task 1: Compact module UI

- [x] Make collapsed desktop appointment cards exactly 110px high including borders. Avatar left, title and status inline, one requester/date/ET metadata line, one agenda line, actions right. Remove separate format/date rows and other permanent extra content. Truncate long text safely; responsive cards may grow on small screens to keep actions usable. Expanded accept/reschedule forms may grow. Preserve response logic, proposal semantics, navigation and calendar rules.
- [x] Use a compact single-contact lookup on Appointments and Press Coverage: one selected value with a clear button in the same control, no replacement search input until cleared. Preserve existing Meeting Report/Invite lookup behavior by adding an opt-in presentation to the shared component. Keep keyboard access, single-value semantics and existing disabled/error behavior.
- [x] Align both module forms with existing global fields, buttons, labels, page structure and spacing. Fix the misaligned Press Coverage yes/no and Related Contact row using scoped styles; no global theme redesign.
- [x] Update affected meaningful interaction tests and browser checks; measure desktop card height, long-content overflow, selected lookups, small-screen usability and accessibility.

## Task 2: Restore reliable submissions

- [x] Finish the known Press Coverage date-function investigation. Hosted fixed-input probes confirmed that Power Pages rejects the built-in function through InvokeCustomApi (including query aliases). Add a separate read-only `mss_CoverageLocalTime` Custom API adapter that calls the native SDK LocalTimeFromUtcTimeRequest with fixed timezone129. Preserve historical rules, server creator stamping, file validation and disabled direct-table API. No business columns, permissions or existing Appointments action change.
- [x] Reproduce Appointments create failure through the authenticated UAT page/endpoint, inspect safe server diagnostics, and fix only its actual cause. Preserve requester stamping, eligible recipient checks and concurrency-safe responses.
- [x] Add regression coverage for each confirmed cause. Remove temporary diagnostic source from UAT; deploy final reviewed code only.
- [x] Verify actual UAT creates with uniquely named test records for these two modules, reload/read back their IDs and mapped values, and clean up only the records created by this test. Do not edit existing business records or impersonate another user. Separate-user security/race acceptance remains separate.

## Task 3: Verify and deliver

- [x] Run focused tests, full regression, production build and scoped real-browser checks.
- [x] Review the combined change; stage from fresh UAT metadata, preserve existing settings/permissions/roles, and deploy to the already approved Test/UAT site e7f400bd-1e04-4efa-b8b3-7a7a3b168662 in environment16838866-275a-e2e7-838f-57313f30a416. Restore the original PAC profile.
- [x] Recheck module submissions/read-back, existing Home/Events/Join Event/Calendar/Contacts/Meeting Reports, and update deployment evidence with actual results and remaining limitations.

Completed 17 October 2026: final reviewed UAT upload/read-back, 857 tests in 73 files, production build, 16 coverage-time SDK tests, 15 scoped correction accessibility checks, actual form saves/refresh/file roundtrip, trusted field read-back and exact test-record cleanup passed. Appointments already saved after the earlier hosted compatibility fixes; no additional Appointments service/action logic change was needed. Seven-page crawl and observed API reads passed. Existing settings/permissions/roles unchanged. Separate-user authorization/race and maximum-size file acceptance remain explicitly outside these verified checks. Evidence: `docs/alm/module-corrections-uat-verification.json` and `docs/alm/last-test-site.json`.
