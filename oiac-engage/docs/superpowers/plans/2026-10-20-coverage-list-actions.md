# Coverage list actions design and execution plan

User-specified layout: remove attachment names and icons from listing rows, and show Edit then View in one horizontal line. Keep creator/Administrator Edit permission, View for all readers, headline viewing, and attachment display/download inside forms unchanged. Implement by removing only the list file-link rendering/import and changing the existing page-local actions CSS. Do not hide attachment components globally.

- [x] Update the existing listing test for the changed presentation; retain all existing permission and form behavior checks.
- [x] Remove row attachment rendering; order Edit before View; page-local non-wrapping flex row with consistent spacing.
- [x] Run Press Coverage tests and production build in isolated source; integrate only the three scoped paths after baseline checks.
- [x] Deploy to previously authorized OIAC Test/UAT using a fresh preservation download, exact environment/site guards and no backend/schema/settings changes.
- [x] Verify deployed assets/protected metadata and hosted horizontal order/no attachment presentation; update ledger.

The screenshot and explicit instruction authorize this precise layout. No further design decision or approval needed. Dirty Git preserved; no commit/staging. Prior Channel and Coverage behavior preserved. No new tests beyond updating the now-obsolete existing row-download test. Local UI correction is reversible.
