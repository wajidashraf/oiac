# Press Coverage module: integration design and schema decision

Date: 16 October 2026

Status: design, minimal schema additions and the exact Test/UAT deployment approved by the user. The Submitted By lookup and File column have been created, verified, added to CRMSolution and published in Test/UAT. Local implementation passed 693 tests / 67 files, the production build, and 9 scoped responsive/accessibility checks. Portal code/permissions were uploaded successfully and verified in Dataverse; runtime cache refresh and authenticated UAT security/persistence checks remain pending. See [delivery notes](../../press-coverage.md).

## Goal and scope

Implement the supplied Press Coverage screenshots inside the existing OIAC Engage React/TypeScript SPA. Both ordinary and featured coverage use the existing `mss_presscoverage` table. Preserve current authentication, navigation behavior outside this module, Meeting Reports, Events, Calendar, Contacts, Profiles, attachment flows, and global styles.

The user's supplied implementation prompt and four screenshots define the visual design and field requirements. This document records the verified integration points and the changes needed to make that design work securely.

## Verified environment and schema

Read-only PAC checks on 16 October 2026 established:

| Environment | Result |
|---|---|
| Test/UAT: `https://org97063a46.crm.dynamics.com/`, environment `16838866-275a-e2e7-838f-57313f30a416` | Table exists. The supplied record `f195a977-8e2f-4005-8d06-16b1c6166b19` exists. |
| Production: `https://oiac.crm.dynamics.com/` | Dataverse reports `mss_presscoverage` was not found. |
| Development: `https://org9b0fb7b2.crm.dynamics.com/` | Dataverse reports `mss_presscoverage` was not found. |

The user confirmed Test/UAT with a Power Apps solution link: solution `dc98bc78-79ea-f011-8406-000d3a3b8459`, table metadata ID `7c0d3472-218b-4514-b40a-896c9985c85d`.

The official PAC model builder retrieved the complete table's generated attribute definitions and choice enums from Test/UAT:

- Logical name: `mss_presscoverage`.
- Entity set: `mss_presscoverages`.
- Record ID: `mss_presscoverageid`.
- All business columns in the supplied prompt exist.
- The only business Contact lookup in those definitions is `mss_relatedcontact`.
- There is no portal-creator Contact lookup.
- There is no File or Image attribute.
- A second metadata export including `contact` and `annotation` confirmed the Related Contact relationship `mss_presscoverage_RelatedContact_contact`; no coverage-to-Notes relationship appeared in that export.
- `createdby`, `createdonbehalfby`, and owner references identify System Users/Teams, not the authenticated portal Contact.

Choice mappings verified against that metadata:

| Column | Values in order beginning at `866530000` |
|---|---|
| `mss_coveragetype` | TV, Radio, Print, Online, Podcast |
| `mss_coveragelevel` | National, International, Local |
| `mss_tone` | Positive, Neutral, Mixed, Negative |
| `mss_keytopic` | Iran, Executions, Human Rights, NCRI, Rally |

Generated enum identifiers normalize spaces; retain Dataverse's formatted labels or exact localized metadata labels for display.

Detailed checks are now complete: both dates use UserLocal behavior with DateOnly display format; business columns are optional; primary-name maximum length is 850 and other business text/memos/URLs are 100. Related Contact navigation is `mss_RelatedContact`. HasNotes is false, with no suitable File/Image storage before the approved additions. Submitted By navigation is `mss_SubmittedBy`, through `mss_presscoverage_SubmittedBy_contact`. Exact verified additions are recorded in `scripts/press-coverage/schema-manifest.json`.

## Existing app integration at initial review

- `src/pages/PressCoverage.tsx` is a browser-local prototype backed by sample records.
- `src/App.tsx` comments out the Press Coverage route.
- `src/components/PortalNav.tsx` displays a disabled Coming Soon entry.
- `src/auth/powerPagesSession.ts` exposes the signed-in Contact ID and web roles.
- `src/auth/authorization.ts` identifies the administrator role as `Administrators`.
- `src/shared/powerPagesApi.ts` already handles same-origin requests, CSRF tokens, JSON, response headers, errors, and cancellation. Reuse it unchanged.
- `src/features/meetingReports/ContactLookup.tsx` accepts a custom search loader; its hook already debounces and cancels searches.
- Authenticated Contact directory read/association permissions and the `contactid,fullname` fields are already configured. Coverage searches only need these two fields.
- Existing Meeting Report uploads require a Meeting Report ID and a Meeting Report attachment relationship. Do not repurpose that flow or pass coverage IDs to it.

Authenticated users awaiting approval currently have a narrow Calendar exception. Add a similarly narrow Press Coverage read exception if implementing the requirement that *all authenticated users* can view coverage. Do not broaden `hasPortalAccess` or unlock other application routes. Creation remains tied to approved create permissions.

## UI and state

Use the existing header/footer, CSS variables, buttons, fields, messages, and coverage-specific styles. New CSS stays under coverage classes. Reusing ContactLookup must include coverage-scoped lookup styling without changing other consumers.

Page states: list, type selection, create press, create featured, loading edit, edit press, edit featured, saving, and saved-record/file-retry when applicable.

- Back link, heading, supplied subtitle, and right-aligned `+ Add Coverage` button.
- Keep the listing visible under the two selection cards or active inline form.
- Table columns: Headline, Date, Media Outlet, Coverage Type, Tone, Coverage Level, Featured, Actions.
- Highlight featured rows subtly and show a star Featured badge. Missing values use an em dash.
- Match both supplied form layouts, labels, field grouping, required markers, and button text.
- Stack fields/cards on mobile; retain the established accessible horizontal table scrolling.
- Show loading, empty, error/retry, validation, and success states.
- Confirm discarding a dirty form. Preserve failed inputs. Lock duplicate submissions and form switching while saving.
- Edit retrieves the latest record; its variant is immutable in the UI and payload.

## Classification and field mapping

Use `mss_isfeatured` only for classification. Featured Coverage is not a new option in `mss_coveragetype`.

| Purpose | Press | Featured |
|---|---|---|
| Headline | `mss_headlinetitle` | `mss_headline` |
| Outlet | `mss_mediaoutlet` | `mss_publication` |
| Date | `mss_datepublishedaired` | `mss_publicationdate` |
| Summary | `mss_summary` | `mss_shortsummary` |
| Link | `mss_articlevideourl` | `mss_originalarticlelink` |
| Type | Formatted choice label | Literal `Featured Coverage` |

Listing legacy fallback reads the alternate headline/outlet/date if the variant's preferred value is missing. Editing must preserve unrelated fields; submit only changed fields belonging to that variant. If the primary-name column is required for featured creation, satisfy its verified requirement without overwriting a different existing value on edit.

Date input and display behavior must follow verified date metadata. Preserve date-only values without converting through the browser's timezone. Reject invalid dates and non-HTTP(S) links. React renders supplied text as text, not HTML.

## Required security decision

The current schema cannot establish original portal creators. `mss_relatedcontact` is a journalist/business relationship and must never be used for ownership. Existing imported rows cannot be attributed to a portal Contact from their System User creator IDs.

Recommended smallest complete approach:

1. Add one **Submitted By** Contact lookup on the same table (proposed logical name `mss_submittedby`, subject to confirmed publisher/schema naming).
2. Populate it on a trusted server path from the authenticated portal session; never accept a browser-selected creator.
3. Make it immutable through portal operations. Do not expose it through an ordinary unrestricted writable field allowlist.
4. Grant all authenticated users global read only. Scope ordinary-user record writes to the Submitted By relationship. Administrators can update all coverage records. No delete permission is required.
5. Validate ownership and permitted fields on the server as well as in the UI. A dedicated coverage server endpoint is preferred if direct Web API creation cannot safely stamp and protect the creator relationship.
6. Keep existing unattributed records editable by administrators only until their authorship can be established from trusted evidence. Do not backfill speculative creators.
7. Reject direct unauthorized PATCH, creator reassignment, record-type conversion, and anonymous access. Test these through the live portal permission layer before release.

An interim alternative is administrator-only editing of existing coverage with read access for other authenticated users. That does not meet the requested creator-editing requirement and must be described as a reduced scope if chosen. A UI-only creator check or global ordinary-user write permission is not an acceptable alternative.

Microsoft documents signed-in-user access through `Server.User` and requires server-side authorization and table permissions for Server Logic. Runtime support and identity properties must be verified on this site's version before selecting the final endpoint implementation:

- https://learn.microsoft.com/power-pages/configure/server-objects
- https://learn.microsoft.com/power-pages/security/security-best-practices

## Required file-storage decision

There is no existing File/Image column, and the relationship export did not expose a coverage-to-Notes relationship. There is currently no verified reusable coverage storage path.

Preferred order:

1. Reuse an existing supported coverage attachment/Notes relationship if metadata and table permissions establish it; keep coverage handling separate from the Meeting Report flow.
2. Otherwise add **one File column** to `mss_presscoverage` (proposed `mss_coveragefile`) for the single file shown in each form: publication logo on featured records; optional attachment on press records. This avoids a new table or two separate file columns.

Validate file type, size, and filename on both client and supported server upload path. For logos, allow a small explicit raster-image set; exclude executable or active content. Final limits must fit the verified storage configuration. Existing logo metadata satisfies the edit form's required-logo condition without requiring reupload.

Create the record once, retain its returned ID, then upload its file. If upload fails, retain the saved record ID and retry the file only. Never create a second record when retrying a logo/attachment upload. Do not report full Featured Coverage success until its required logo is persisted. Replacing or downloading a file must enforce the same record authorization.

No new column, relationship, table, flow change, or remote permission change is authorized by this proposal alone.

## Planned source boundaries

New module files under `src/features/pressCoverage/`:

- Types and verified metadata constants/configuration.
- Coverage service: pagination, record retrieval, creation, variant-scoped updates, narrow Contact search.
- Form component(s) and validation.
- File service only after storage is verified/approved.
- Focused service, form, authorization, date, and integration configuration tests.

Targeted existing-file changes:

- Replace `src/pages/PressCoverage.tsx` prototype and its four local-data tests.
- Enable only the Press Coverage entry/route in PortalNav and App; add the narrow read exception in RequirePortalRole if required.
- Adjust related navigation/routing tests without weakening other protected-route assertions.
- Add scoped CSS or a module stylesheet; preserve existing global declarations.
- Add coverage-specific Power Pages settings/permissions only after metadata and the security plan are approved.
- Add a coverage-only runtime verification script using representative roles and real page assertions.

The user's existing Join Event edits, test corrections, deleted `flow.json`, and untracked design directory stay outside this feature's unrelated edits.

## Verification and release criteria

Baseline: all 552 tests in 61 files passed after updating Join Event expectations; production build succeeded before this feature work.

- Unit/service tests: actual option mappings, correct variant field preference/fallback, date behavior, safe URLs, escaped/limited Contact search, same-origin pagination, aborted/stale loads, update versus create, changed-fields-only PATCH, and ambiguous-create handling.
- UI tests: selection and both forms, required fields, dirty cancel/type changes, latest-record edit hydration, create/update refresh, failure preservation, duplicate-submit lock, and file-only retry after record creation.
- Routing tests: anonymous denial; all-authenticated coverage read; appropriate create/admin/creator actions; unchanged pending-approval boundaries on other pages.
- Configuration/server tests: no anonymous table grants, no global ordinary-user write, server-derived immutable creator, admin versus creator write enforcement, safe file access.
- Browser checks at mobile, tablet, desktop; keyboard/focus; accessible labels and status/errors; actual Press Coverage page assertions in accessibility checks.
- Run the complete existing regression suite and production build after integration.
- Test direct requests in Test/UAT using creator, other ordinary user, administrator, and anonymous contexts. Frontend tests alone do not prove server authorization.
- Production release additionally requires moving the existing table/schema/configuration through an approved solution deployment; the production table is currently absent.

## Progress

- [x] Read supplied prompt and screenshots.
- [x] Review source, routing, identity, reusable services, Contact lookup, styles, attachments, tests.
- [x] Locate supplied data in Test/UAT and verify entity set, business attributes, and choice mappings.
- [x] Identify and document creator-identity and file-storage gaps.
- [x] User approved the minimal security/storage additions; applied and verified in Test/UAT only.
- [x] Verify remaining detailed metadata and supported SDK/file-action contracts.
- [x] Implement isolated module and coverage-specific configuration.
- [x] Complete local regression/build and real-browser rendering/navigation checks.
- [x] Review deployment readiness separately from implementation; record limits in delivery notes.
- [x] Deploy portal code/configuration to Test/UAT after target approval; verify stored source, permissions and settings.
- [ ] Verify hosted runtime, persistence, file limits and creator/other-user/admin/anonymous authorization using real portal sessions.
