# Press Coverage delivery and UAT handoff

19 October 2026 repair: the UAT transfer service now uses bounded 256 KiB browser chunks with server-held continuation state and verified commit receipts. Real hosted forms uploaded a 2 MiB featured PNG and a 10 MiB Press PDF, and row downloads matched the original SHA-256 hashes. Logo replacement preserved the coverage ID. Deliberately lost chunk responses resumed through file-only retry without duplicate records. Trusted creator/file association and cleared private upload state were verified in Dataverse; direct table API access remains disabled. Report uploads were preserved.

Hosted checks also isolated a separate create failure when optional Related Contact was blank. The Press Coverage bridge now omits an empty Contact binding on create while retaining explicit clearing on updates. Its regression failed before the fix and passed afterward; the deployed source was byte-verified and the blank-Contact create passed. The scoped suite passed 330 tests across 14 files. Only Press Coverage and Appointments changes were deployed; pending Activity UI edits were excluded. See [19 October verification](alm/coverage-appointments-uat-verification.json).

The hosted Contact-clear check then disproved compatibility of the previous null `@odata.bind` update. Clearing now sets the unannotated `mss_RelatedContact` navigation property to null, following [Microsoft's disassociation guidance](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/associate-disassociate-entities-using-web-api#disassociate-by-using-a-single-valued-navigation-property). Selection and clearing both passed through the actual form and preserved the file ID. All ten exact-marker verification records, including the prior upload probe and attached test files, were removed; native queries and clean reloads confirmed cleanup. The maximum-size/replacement/interruption items recorded as pending in the historical 17 October notes below are now verified in UAT. Separate ordinary-user permission sessions remain pending.

Status on 17 October 2026: the approved **OIAC Test/UAT correction upload succeeded**. Real Press and Featured forms save successfully and survive refresh. Read-back verified the trusted creator, selected Related Contact and correct business date. Featured logo upload/download passed with identical bytes. Both forms use the existing theme and a compact single-contact lookup. All seven existing pages passed the authenticated crawl with no error alerts or console errors. Production was not changed and no restart was performed. See [current verification](alm/module-corrections-uat-verification.json).

## Integration and preserved behavior

The existing React 19 / TypeScript SPA, React Router, app shell, theme, session reader, shared CSRF API utility and debounced ContactLookup are reused. Only Press Coverage navigation/routing and its page have been enabled. Pending users receive a narrow read-only coverage route; other approval restrictions are retained. No dependencies were added.

Existing Events, Calendar, Contacts, Meeting Reports, authentication services and upload flow were not changed for this feature. The existing **Join Event** label is retained, and its test expectations now agree with it. The pre-existing deleted root `flow.json` and untracked design folder were preserved.

Both variants use `mss_presscoverage` / `mss_presscoverages`; the classification is `mss_isfeatured`, never a new Coverage Type option. Listing shows both variants, featured records first, with pagination, missing-value fallbacks and readable dates/choice labels. Edit fetches the latest row, keeps its variant, and writes only changed fields belonging to that form.

The inline selector, full Press form and compact Featured form follow the supplied screenshots. Headline spans both Press columns; logo and Publication share the first Featured row. Forms stack on mobile; only the table scrolls horizontally. Dirty drafts are protected on links, browser Back/Forward and page unload. Saves lock repeated submission and navigation. An ambiguous create result requires checking the refreshed list before starting another submission. File failures retain the saved record ID and retry only the file.

## Verified schema and mappings

Test/UAT is `https://org97063a46.crm.dynamics.com`, environment `16838866-275a-e2e7-838f-57313f30a416`. Site `e7f400bd-1e04-4efa-b8b3-7a7a3b168662` is hosted at `https://oiac-engage-test.powerappsportals.com/`. Solution: **CRM Solution**, unique name `CRMSolution`, ID `dc98bc78-79ea-f011-8406-000d3a3b8459`.

| Form value | Press column | Featured column |
|---|---|---|
| Headline | `mss_headlinetitle` | `mss_headline` |
| Outlet | `mss_mediaoutlet` | `mss_publication` |
| Date | `mss_datepublishedaired` | `mss_publicationdate` |
| Summary | `mss_summary` | `mss_shortsummary` |
| Link | `mss_articlevideourl` | `mss_originalarticlelink` |

Press also maps campaign, interviewed person, reporter, section, coverage type/level, tone, topic, OIAC Mentioned, key quote, Related Contact and follow-up to the existing `mss_*` columns. The full mapping lives in `src/features/pressCoverage/pressCoverageService.ts`. Exact verified choices are in `pressCoverageTypes.ts`; formatted Dataverse labels take priority for listing.

All business columns are optional in Dataverse. Required screenshot fields are enforced by the form and endpoint. The primary name `mss_headlinetitle` allows **850 characters**; the other business text, URL and memo columns allow **100 characters**, including both summaries. The implementation respects those limits; increasing them would be a separate schema change.

Both date columns have **UserLocal behavior with DateOnly display format**. They are not true DateOnly storage. The endpoint calls the read-only `mss_CoverageLocalTime` Custom API adapter, which invokes native SDK `LocalTimeFromUtcTimeRequest` with the verified business timezone **129 / Jordan Standard Time (Amman)**, returns canonical `YYYY-MM-DD`, and verifies the inverse conversion at local noon before writes. It uses historical Dataverse rules rather than a fixed UTC offset or browser timezone. Revalidate the business timezone when promoting to another environment. The hosted Server SDK rejects the built-in function URI, including parameter aliases; the separate Sandbox adapter performs only the native conversion under the integration caller. It has no business-record reads or writes and changes no portal permissions. See [adapter contract and build](../backend/pressCoverage/README.md) and [registered IDs/hash](../scripts/press-coverage/time-action-registration.json).

User-approved additions have already been created, read back, added to `CRMSolution` and published in **Test/UAT only**:

- Optional Submitted By lookup `mss_submittedby`, navigation `mss_SubmittedBy`, Contact relationship `mss_presscoverage_SubmittedBy_contact`.
- One File column `mss_coveragefile`, filename companion `mss_coveragefile_name`, maximum **10,240 KB**. Metadata confirmed no suitable existing File/Image or Notes storage for coverage.

See `scripts/press-coverage/schema-manifest.json` for verified identifiers and `submitted-by-relationship.json` / `coverage-file-column.json` for the approved creation definitions. Do not blindly replay creation POSTs: these additions already exist in UAT. Use the solution to promote schema, and compare metadata before any changes in another environment.

## Ownership, API and permissions

The browser calls only `/_api/serverlogics/press-coverage` for coverage data and files. It reuses `powerPagesFetch` and its existing CSRF token behavior. Contact search uses the existing authorized Contacts API, selecting only `contactid,fullname`, escaping the search string and limiting results to 15.

ServerLogic derives Submitted By from trusted `Server.User`, ignores browser role claims, rejects unapproved fields, and stamps `mss_isfeatured` during creation. Neither creator nor variant can be reassigned through this endpoint. The Contact relationship for **Related Contact** remains a journalist/business association and is never used as ownership. Imported rows with no Submitted By remain administrator-editable until authorship is established from trusted evidence.

The authoritative write check is the Dataverse connector with portal table permissions. Reads also enforce portal permissions. File upload checks the record's write permission before block actions; download checks its read permission. Connector errors are sanitized. The endpoint accepts only its fixed operations and bounded pagination; it does not accept arbitrary Dataverse queries or client continuation tokens. No privileged token, connection string or secret is bundled in the SPA.

These artifacts were uploaded together with the compiled site to the approved Test/UAT website:

| Artifact | Required configuration |
|---|---|
| `server-logic/press-coverage/press-coverage.js` and `.serverlogic.yml` | GET, POST, PATCH; Authenticated Users role `0353acdd-7b95-4c07-8997-ae95dafd978d` |
| `Press-Coverage-Authenticated-Read.tablepermission.yml` | Global Read for Authenticated Users; no write/create/delete/append grants |
| `Press-Coverage-Creator-Manage.tablepermission.yml` | Contact scope through Submitted By; Read/Create/Write/Append/AppendTo for Volunteer, Staff, Applicant; no Delete |
| `Press-Coverage-Administrator-Manage.tablepermission.yml` | Global Read/Create/Write/Append/AppendTo for Administrators; no Delete |
| `ServerLogic-Enabled.sitesetting.yml` | `ServerLogic/Enabled = true` |
| `Webapi-mss_presscoverage-enabled.sitesetting.yml` | `Webapi/mss_presscoverage/enabled = false`, preventing direct browser CRUD bypass |

Existing Contact read/association permissions are reused unchanged. No coverage permission grants Anonymous Users access. Keep direct coverage Web API disabled; enabling it later would expose a route around creator stamping and field validation. ServerLogic is a Microsoft preview feature, so hosted runtime support and actual SDK identity/response shapes must be checked during UAT.

## Files and limits

The single File column stores the publication logo for Featured records or one optional attachment for Press records. Logos accept PNG/JPG/WebP up to **2 MB**. Press attachments accept PDF/PNG/JPG/WebP up to **10 MB**. Both client and server validate filenames, extension/MIME, size, canonical base64 and file signatures. SVG and executable formats are excluded. Existing file metadata satisfies the logo requirement when editing; replacement and download are supported. Record/file deletion is not exposed.

The endpoint invokes supported Dataverse file block actions, keeps continuation tokens on the server and uses aligned 3 MB blocks. The browser still sends the file as one base64 JSON request, so the portal's actual request/response limits, timeout, maximum-size files and file actions must be exercised in UAT before release. No Meeting Report flow is reused or altered.

## Verification

- Final full Vitest regression: **857 tests passed in 73 files** using two workers.
- Read-only coverage time adapter: **16 SDK tests passed**, including current and historical native conversion results; registered signed assembly hash read back. Existing Appointments SDK tests: **52 passed**.
- `npm run build`: TypeScript and Vite production build passed.
- `node scripts/verify-press-coverage.mjs`: real Chromium Back cancellation preserves a draft, accepted Back/Forward works, links and Back are blocked while saving, and navigation resumes after success.
- The same browser script checks selector/Press/Featured at desktop 1440, tablet 820 and mobile 390: **9 scoped axe checks with zero violations**, no document overflow. Screenshots are in ignored `artifacts/press-coverage-ui/`.
- Service/server/form tests include malformed responses, definite versus uncertain create errors, pagination recovery, creator field forgery, immutable type, simulated portal denials, business dates, related-contact separation, file validation and file-only retry.

The navigation/accessibility scripts use local fixtures. Separately, actual hosted Press and Featured submissions returned success, survived refresh and passed Dataverse field read-back. A Featured PNG was uploaded and downloaded with identical bytes. Selected Contact and Yes/No controls measured 44px high at the same top position in the deployed Press form. The authenticated session has Administrator and Volunteer roles, so these successes do not establish ordinary-user isolation.

## UAT deployment and remaining acceptance

The approved upload completed in 181.35 seconds. Fresh deployment read-back matches both reviewed ServerLogic sources and all 91 existing site settings, 20 table permissions and six web roles. The runtime uses the final build without a restart. The original PAC profile was restored. Real Appointment, Press and Featured form creates, refresh persistence, selected-contact association, business-date conversion, trusted creator/requester stamping and the Featured logo roundtrip all passed. All five uniquely named test rows and the temporary fixed-input diagnostic component were removed; existing business records were not changed.

The seven-page signed-in crawl passed for Home, Events, My Calendar, Contacts, Meeting Reports, Appointments and Press Coverage; all observed API reads succeeded and no console errors occurred. Direct browser table/action routes returned 404 as intended. Earlier anonymous checks redirected to Microsoft sign-in without returning records. See [runtime test report](alm/last-test-site.json).

Before Production promotion, use separate creator, unrelated ordinary-user, Administrator and pending-user sessions to verify record-level permissions, updates, pending-user read-only behavior and imported unattributed records. Maximum-size files, replacement, interrupted upload and file-only retry acceptance remain pending. These limits do not invalidate the verified real saves, but remain release acceptance work. Production has not been deployed to; revalidate its schema and timezone before any separately approved promotion.

## Source inventory

- `src/features/pressCoverage/`: types, service, validation, files, form, scoped CSS, navigation guard and six test files.
- `src/pages/PressCoverage.tsx` and `.test.tsx`: service-backed page and behavior tests.
- `src/App.tsx`, `components/PortalNav.tsx`, `components/RequirePortalRole.tsx` and related tests: targeted integration. `pages/EmptyStates.test.tsx` no longer injects sample coverage props.
- `.powerpages-site/server-logic/press-coverage/`, three coverage table permissions and two site settings: deployable backend/configuration.
- `backend/pressCoverage/`: separate read-only native date adapter, registration tooling and SDK tests.
- `scripts/press-coverage/`, `scripts/verify-press-coverage.mjs`, `scripts/verify-module-corrections.mjs`, this handoff, and `docs/superpowers/` design/plan: schema record, repeatable local verification and implementation decisions.

Local `.superpowers/` inspection helpers/raw metadata, `.playwright-mcp/` browser output and ignored build/screenshots are excluded from versioned deliverables.
