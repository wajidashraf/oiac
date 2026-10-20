# Activity Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task after the design is reviewed. Steps use checkbox (`- [ ]`) syntax for tracking. This document is a planning deliverable, not permission to implement or deploy.

Execution update: the user subsequently requested implementation and Channel pagination. The [current scoped execution plan](2026-10-19-history-and-channel-implementation.md) and its ledger track progress. The user added Deleted themselves; its value866530017 was verified. Meeting Report attachment history is explicitly deferred and its flow/service must remain unchanged. The original proposal below is retained as design history; it does not override these later scope decisions.

**Goal:** Provide a trustworthy, read-only record-change/upload history, scoped to the acting user with a separate administrator overview.

**Architecture:** Reuse the user's verified **Activity Log** table, `mss_activitylog` / `mss_activitylogs`. Its user/team ownership is explicitly accepted; there is no table-recreation task. Add trusted actor-aware capture from each authoritative write path, durable asynchronous delivery after confirmed mutation, and a fixed read endpoint. First prove the capture/delivery mechanism in UAT; integrate and verify each module before calling the feature site-wide. Reuse the site's Server Logic/native Dataverse command model and existing React shell.

**Tech Stack:** React 19, TypeScript, existing React Router/theme/CSRF helper, Power Pages Server Logic, Dataverse custom table/relationships/permissions, and C# SDK native commands/asynchronous plug-ins where the UAT proof supports them.

## Global constraints

- Design: [2026-10-19-site-activity-log-design.md](../specs/2026-10-19-site-activity-log-design.md). Scope explicitly confirmed: **record changes and uploads**; no views, downloads, or sign-in events.
- This planning task changes documentation only. No table creation, server registration, code change, or deployment until the proposal is reviewed.
- **Latest scope:** Activity Log's only navigation entry is the authenticated footer. No Activity dropdown/header/account/profile links, new verification buttons, dashboard shortcuts, or unrelated UI changes. Preserve existing access gates and business workflows. The explicitly requested corrective exception is removing the two unsolicited shortcuts from the profile-under-review card; no authentication/verification behavior changes.
- New feature code belongs to Activity Log. Minimal shared integration is the new route and one footer link, added only once the page exists. Existing business-service/native-command/flow modifications are not implicitly authorized: inspect them and present any indispensable logging delta before touching them. Defer unproven capture paths rather than rewriting live workflows.
- Existing-table read-only review: [activity-log-existing-table-review.json](../../alm/activity-log-existing-table-review.json). Actual Choice maps, field types/lengths, required/audit flags, active key, UserLocal datetime, and Contact RemoveLink behavior were retrieved from UAT. The user confirmed keeping user/team ownership; do not create a replacement table or confuse Dataverse owner with the acting Contact.
- Column reconciliation still needs review: Details JSON is String 4,000 (not Memo 16,000), Record Title 100 (not 850), Actor Name 100 (not 200), Name 850/optional, Performed By optional/not audited. Environment auditing is off despite table auditing being on. Keep all existing sample rows unchanged and do not infer actors from their placeholder IDs or names.
- The user's selected definition supersedes the first proposed table name and Action labels. Reuse an already created matching table; read its actual logical names, primary ID, EntitySetName, and Choice values before code generation. Do not create a second table to match an earlier proposal.
- Required fields: Name (200), Performed By (Contact), Site ID (36), Occurred On (User Local), and Event Key (64, unique alternate key). Preserve all other user-selected column types/lengths and the eight Module choices in the design.
- Enable auditing on the table and supported custom columns, add descriptions, and keep Notes/files/images/attachments disabled. Effective native auditing also depends on the environment setting; no unrelated environment audit change is implicit.
- The selected Action catalog has 17 labels and lacks Deleted. Resolve that additional Choice before shipping deletion coverage; do not add it silently or classify deletion as an edit. Password Changed is not automatically enabled merely because its Choice exists.
- Default site: OIAC Test/UAT, environment `16838866-275a-e2e7-838f-57313f30a416`, website `e7f400bd-1e04-4efa-b8b3-7a7a3b168662`, URL `https://oiac-engage-test.powerappsportals.com/`. Verify tenant/environment/site before any future mutation; Production is excluded.
- Performed By means **the actor**, not the target Contact, source creator, requester, owner, or shared integration account.
- Only actual Administrators membership for this site permits All Users. Staff/Volunteer/Applicant are own-history only. The account-button label is not an authorization source.
- No direct browser insert/update/delete access to logs; no arbitrary log-append API. Queries authorize before filtering/paging/counting/detail retrieval.
- One event per completed semantic action; suppress retry duplicates, technical updates, empty permission-check updates, no-op edits, and capture of the history system itself.
- Preserve existing business rules, permissions, storage, response/recovery contracts, and page layouts. Do not add missing cancellation/deletion workflows to generate log examples.
- Preserve uncommitted/pre-existing changes. In particular, do not bundle deferred Activity UI edits or the local account-button label change into this feature without separate scope inclusion. Do not stage/commit unrelated files.
- A durable asynchronous capture proof is a delivery prerequisite. If it fails, revise and review that architecture rather than shipping best-effort coverage as complete or silently introducing synchronous business-save failures.
- Proposed retention is 365 days; **no automated purge** without an explicit retention decision.

## Task 1: Prove trusted actor capture and durable delivery

**Files:** Create `backend/siteActivityLog/README.md`, `backend/siteActivityLog/SiteActivityCaptureProbe.cs`, `backend/siteActivityLog/SiteActivityCaptureTests.cs`, and a sanitized `docs/alm/site-activity-log-capture-proof.json` during implementation. Inspect current native registrations and existing module permission/configuration tests before modifying their contracts.

**Consumes:** Current `Server.User` identity extraction, exact-site role checks in Appointments/Activity Channel, native command execution contexts, report attachment flow definition, and current direct Web API writers.

**Produces:** A verified per-module capture adapter map and the exact durable delivery mechanism. Existing source APIs remain in use until their replacement/adapter is proven equivalent.

- [ ] Inventory actual create/update/delete/semantic/file operations and permission rules in the source files listed in Task 4. Read the deployed report flow definition; a client-supplied flow body is not proof of the acting Contact.
- [ ] Use two ordinary users and an administrator in UAT. Probe a native command, Server Logic SDK update, direct Web API edit, cascade deletion, and report-file upload. Record which supported contexts carry a trustworthy Contact and committed event payload. Never assume an undocumented `SharedVariables`/plug-in Contact key exists.
- [ ] Prove native asynchronous post-operation delivery retains the actor, event identity, occurred time, bounded before-delete snapshot, and successful outcome after business commit. Prefer explicit trusted native-command event context over inference from business fields. Where an existing Custom API needs an explicit event output or asynchronous step configuration, document the precise signature/registration delta before applying it.
- [ ] Force one history delivery failure, recover it through the durable server mechanism, and verify the same event identity is reused. Verify a rejected/rolled-back mutation creates no successful event. Confirm capture failure does not misreport a committed business save as unsaved.
- [ ] If a legacy path lacks trusted actor context, plan its module-specific authenticated server handoff and row-authorization checks. Do not use Reported By/target Contact as a shortcut. If a durable queue or context column is necessary, return the exact additional schema proposal for review; the current one-table design does not silently authorize it.
- [ ] Stop rollout for any unproven path. Publish the coverage map and verified queue/context behavior; begin schema/delivery implementation only with an agreed, feasible capture mechanism.

**Proof assertions:**

```text
admin edits User A's record → actor is admin, not User A
User B retries a committed operation → same event identity, one delivered event
permission-denied write → zero committed-history events
post delete → safe title survives, no fabricated child-delete actors
delivery outage → original business commit retained, durable retry observable
```

## Task 2: Reconcile the existing schema, event contract, and internal writer

**Files:** Create `backend/siteActivityLog/ApplySiteActivityLogSchema.cs`, `SiteActivityLogEvent.cs`, `SiteActivityLogWriter.cs`, `SiteActivityLogWriterTests.cs`, `ActivityLogImmutabilityPlugin.cs`, `ActivityLogImmutabilityTests.cs`, `build-test.ps1`, and `docs/site-activity-log.md`.

**Consumes:** Task 1's proven trusted event context, the existing metadata evidence, and the reviewed schema delta. **Produces:** a validated existing table/alternate key and an internal writer callable only by trusted capture adapters.

Internal event contract, with all values established/verified by the server:

```csharp
public sealed class SiteActivityLogEvent
{
    public Guid SiteId { get; set; }
    public Guid ActorContactId { get; set; }
    public string ActorName { get; set; }
    public string Action { get; set; }
    public string Module { get; set; }
    public string RecordType { get; set; }
    public Guid RecordId { get; set; }
    public string RecordTitle { get; set; }
    public DateTime OccurredOnUtc { get; set; }
    public string Summary { get; set; }
    public string DetailsJson { get; set; }
    public string EventKey { get; set; }
    public string CorrelationId { get; set; }
}
```

- [x] Initial read-only UAT inspection confirms existing `mss_activitylog`, `mss_activitylogs`, `mss_activitylogid`, 17 matching Action choices, eight matching Module choices, active Event Key, UserLocal Occurred On, and the metadata differences recorded in the review. The user accepted keeping the existing user/team-owned table.
- [ ] Refresh metadata/publisher/solution membership before implementing; reuse the verified existing table. Do not recreate it. Describe and review exact column/relationship/audit changes before applying them.
- [ ] Resolve Details JSON capacity before coding the writer/reader: either approve a new Memo column capped at 16,000, leaving `mss_detailsjson` String/data intact, or accept 4,000 and bind both writer validation and UI contract to that capacity. A String cannot simply be changed to Memo or enlarged beyond 4,000. Do not silently truncate or delete/recreate the old column.
- [ ] Propose expanding Record Title to 850 and Actor Name to 200, setting required metadata for Name/Performed By, and auditing Performed By. Existing larger capacities for GUID/hash/name fields do not require shrinking; preserve existing data and enforce canonical lengths in the writer. These are identified corrections, not applied changes.
- [ ] Apply meaningful table/column descriptions and the user's required levels. Validate required fields in the native writer as well as metadata. Do not enable Notes/attachments or file/image columns.
- [ ] Enable auditing for the new table and supported custom columns and verify published flags. Read the environment audit setting; if off, present that dependency before any environment-wide change. Do not claim effective auditing from metadata flags alone.
- [ ] Ensure no source-record or Contact deletion cascades to history. Because Performed By is required, the revised recommended actor relationship uses Restrict Delete; verify the actor-deactivation strategy and its implications for physical Contact deletion before applying it. Remove Link with retained snapshots requires explicit review of the lookup requirement. Source-record title/ID snapshots remain independent of business-record deletion/renaming.
- [x] Read-back confirms alternate key `mss_Eventkey` on `mss_eventkey` is Active. Reuse it; do not add a duplicate or rebuild it merely to shrink text capacity.
- [ ] Recheck key state before enabling the writer. Use the proven stable operation/event identity and 64-character hash; do not treat browser IDs or minute-level timestamp buckets as unique audit identities.
- [ ] Write SDK tests proving valid append, duplicate delivery collapse, distinct real edits retained, fixed site, missing actor rejection, unknown action/table rejection, bounded JSON/title/summary, token/URL/content redaction, and preserved event time despite delayed insertion.
- [ ] Implement internal append under the approved least-privilege writer identity. Retrieve Actor name from Dataverse/trusted snapshot capture, not a browser display string. Distinguish event time from automatic `createdon`; leave `createdby` as the technical writer.
- [ ] Implement and test append-only enforcement: no normal writer/portal Update/Delete privileges; native Update/Delete guard rejects updates and alternate-key upsert overwrites. A browser maintenance/admin flag cannot bypass it. Separate future approved retention/privacy maintenance from ordinary runtime writes.
- [ ] On duplicate alternate-key delivery, verify the existing entry represents the same event rather than overwriting it. Account for native transaction fault behavior: do not continue issuing SDK operations in an aborted transaction to implement a catch-and-upsert shortcut. Durable delivery must recover through a fresh execution or a proven atomic deduplication strategy.
- [ ] Run `powershell -File backend/siteActivityLog/build-test.ps1`; verify SDK behavioral tests and signed assembly registration artifact before any UAT registration.

## Task 3: Implement protected list/detail reads

**Files:** Create `backend/siteActivityLog/SiteActivityLogReadPlugin.cs`, `SiteActivityLogReadTests.cs`, `RegisterSiteActivityLogRead.cs`, `.powerpages-site/server-logic/site-activity-log/site-activity-log.js`, its `.serverlogic.yml`, and history-only table-permission/site-setting metadata. Native action proposed name: `mss_SiteActivityLogRead`.

**Consumes:** table schema and event rows. **Produces:** `GET /_api/serverlogics/site-activity-log` with list/detail views and explicit bounded DTOs.

```typescript
type HistoryScope = 'mine' | 'all'
type HistoryRow = {
  id: string; occurredOn: string; userName: string;
  module: string; action: string; recordTitle: string; summary: string;
}
type HistoryPage = { items: HistoryRow[]; nextLink: string | null }
type HistoryDetail = HistoryRow & {
  recordType: string; recordId: string; recordedOn: string;
  changes: { field: string; before?: string; after?: string }[];
}
```

- [ ] Implement `view=list` (scope, from/to dates, module, action, search, admin-only user filter, continuation) and `view=detail&id=GUID`. Reject other views, arbitrary FetchXML/query text, write methods, actor parameters, and browser administrator flags. If user-filter options are required, provide a separate admin-only list derived from recorded actors, not an unrestricted Contact directory.
- [ ] Bridge identity comes from current `Server.User`. Native reads independently revalidate eligibility, exact-site Administrators membership, site, and actor scope. Follow the current `context.UserId` execution pattern, not SYSTEM.
- [ ] For mine, always add `mss_performedby == actor`; all requires current exact-site admin membership. Apply these conditions before search, date filters, counts, pagination, and detail lookup. Do not trust the account-role label.
- [ ] Return 25 rows ordered by the actual Occurred On logical column descending and actual primary ID descending (expected `mss_occurredon`, `mss_activitylogid`) with a bounded server-issued continuation. The client accepts only same-origin continuation URLs for this endpoint and the original filter scope. Do not expose raw native paging/context tokens or arbitrary executable URLs.
- [ ] Validate queries using Performed By, fixed Site ID, Occurred On range, Record Type, and Record ID. Add useful reporting views and bounded projections; use Dataverse-supported performance diagnostics/index optimization if required. Do not create misleading unique keys for non-unique sort/filter combinations or attempt direct SQL index creation.
- [ ] Configure Contact Read for authenticated users and Global Read for Administrators only. No portal writes. Keep direct table Web API disabled and verify 404 on direct access.
- [ ] SDK/bridge tests: A cannot enumerate B; direct ID and continuation/filter substitution cannot bypass; Staff + Volunteer is not admin; removed admin role loses All Users; administrator can filter a recorded actor; deleted target does not remove the permitted log; missing actor/site entries never leak to mine; no secrets/private payload in returned DTOs.

## Task 4: Verify and integrate non-invasive Activity Log capture adapters

**Existing files to inspect, not blanket permission to modify:**

| Module | Existing files | Required capture behavior |
| --- | --- | --- |
| Appointments | `backend/appointments/AppointmentCommandPlugin.cs`, `RegisterAppointmentCommand.cs`, `.powerpages-site/server-logic/appointments/appointments.js` | Created, Accepted, Rescheduled; proposals explicitly remain unconfirmed in Summary/Details. Only supported cancellation. Actual responding Contact is actor. |
| Activity Channel | `backend/activityChannel/ActivityChannelCommandPlugin.cs`, `RegisterActivityChannelCommand.cs`, its Server Logic bridge | Published posts; Created comments/replies with operation detail; Updated pin/unpin with operation detail. Deleted only after the missing Choice is resolved; safe cascade summary. Ignore recovery/no-op pin. |
| Press Coverage | `.powerpages-site/server-logic/press-coverage/press-coverage.js`, `backend/coverageFiles/CoverageFileCommandPlugin.cs`, `RegisterCoverageFileCommand.cs` | Created/Updated and committed Uploaded; distinguish new/replaced files in Summary/Details. Suppress empty write checks and all upload-state/chunk/read operations. |
| Reports | `src/features/meetingReports/meetingReportService.ts`, module-specific server adapter established by Task 1 | Submitted/Updated after authorized commit, without a duplicate Created event; preserve uncertain-create recovery and field/relationship rules. |
| Report files | `src/features/meetingReports/meetingReportAttachmentService.ts`, deployed upload/delete flow definition | Preserve storage/payload/associations; actor from authenticated server handoff, Uploaded per successfully committed file, Deleted only after Choice resolution. No success event for failed files. |
| Events | `src/features/events/eventService.ts`, module-specific server adapter | Actual committed Create/Update with unchanged role checks. |
| Event joins | `src/features/eventRegistrations/eventRegistrationService.ts`, module-specific server adapter | Joined; reactivation distinguished by operation detail. No event for already-registered reads or retry recovery. Keep **Join Event** wording. |
| Contacts/Profile | `src/features/contacts/contactService.ts`, `src/features/profile/profileService.ts`, module-specific server adapter | Updated for Contact edits, Profile Updated for own-profile edits. Actual editor rather than target Contact, safe changed-field names, sensitive values excluded. |

New capture adapter files belong under `backend/siteActivityLog/adapters/` after Task 1 identifies a supported mechanism. Keep them limited to history capture. Do not add replacement business write endpoints or alter existing native APIs/flows under this scope. If trusted actor capture needs an existing-service change, show the exact delta for scope review first; do not implement a generic CRUD endpoint.

For **each row of this inventory**, complete the following cycle before enabling that module's capture:

- [ ] Inspect the current payload, authorization, table permissions, idempotency, save/retry behavior, and response contract. Prove actor A editing another user's record is not attributed to that record's owner. Keep existing module source unchanged unless an exact logging-only delta is separately accepted.
- [ ] Add a semantic event only for the confirmed business outcome, with a snapshot captured before destructive operations and a stable event key. Never append in a React click handler or infer success from HTTP status alone when a native envelope can report failure.
- [ ] Connect the proven durable server delivery. Retry history delivery, not the original business mutation. Exclude internal jobs/state fields and history-table writes.
- [ ] Verify direct mutation paths cannot bypass capture or spoof an actor. If a transport change is necessary, record the integration as pending and request a decision on the exact delta; migrating existing write paths is not authorized by the current Activity Log-only scope. Do not disable existing reads or loosen privileges.
- [ ] Run the module's existing tests plus meaningful capture tests: success, denied/rolled back, uncertain response, retry duplicate, real second mutation, deletion snapshot, and where applicable partial-file success.
- [ ] Exercise a real marked UAT record for that module and native read-back. Do not mark coverage complete until its actor, action, snapshot, time, and delivery recovery pass.

## Task 5: Build the read-only page in the existing theme

**Files:** Create `src/pages/ActivityLog.tsx`, `src/pages/ActivityLog.test.tsx`, `src/features/siteActivityLog/siteActivityLogTypes.ts`, `siteActivityLogService.ts`, `siteActivityLogService.test.ts`, `HistoryFilters.tsx`, `HistoryDetails.tsx`, and `site-activity-log.css`. Minimal shared edits: `src/App.tsx` for the new route and `src/components/AppShell.tsx` for one link inside the existing authenticated Footer navigation only. Do not modify PortalNav, account/profile controls, AnonymousShell, RegistrationProfileGate, or PendingApprovalShell for this feature.

**Consumes:** Task 3's explicit DTOs. **Produces:** `/activity/history` and one **Activity Log** footer link after the page exists; preserves the existing `/activity/activity-log` compatibility redirect and all existing access gates.

```typescript
type HistoryFilters = {
  scope: 'mine' | 'all'; from?: string; to?: string;
  module?: string; action?: string; search?: string; userId?: string;
}
declare function getHistoryPage(
  filters: HistoryFilters, nextLink?: string, signal?: AbortSignal,
): Promise<HistoryPage>
declare function getHistoryDetail(id: string, signal?: AbortSignal): Promise<HistoryDetail>
```

- [ ] Reuse `powerPagesFetch` for CSRF-aware Server Logic reads. Validate GUIDs, timestamps, known module/action codes, bounded arrays/text, and same-endpoint continuation. Cancel stale requests when filters/detail selection change.
- [ ] Show Date & Time, User, Module, Action, Record, Summary, Details. Default to mine; only admins see All Users/user-filter controls. A forged route query still cannot elevate server access.
- [ ] Add bounded search and date/module/action filters, 25-row pagination, loading/empty/error retry, and a keyboard-accessible details drawer. Scope changes reset paging; failed reads do not silently retain rows from a previous scope/user.
- [ ] Format UTC as labeled Eastern Time and use matching server date-boundary conversion. Render all titles/details as text, with no arbitrary HTML. Build target routes from a fixed allowlist and retain existing target-page authorization; unavailable targets do not erase their safe historical entry.
- [ ] No log edit/delete/create controls. Do not redesign existing pages, the header/account toggle, Activity Channel cards, or file controls.
- [ ] Verify Activity Log appears in Footer navigation only and nowhere in the header, Activity dropdown, account/profile menu, pending verification card, or dashboard. Do not add a footer link to an unimplemented route.
- [ ] Test own/admin UI and unauthorized detail errors, stable paging/filter changes, empty/error states, escaping, date boundaries, keyboard operation, and mobile table/detail layout.

Run: `npm.cmd test -- src/pages/ActivityLog.test.tsx src/features/siteActivityLog --maxWorkers=2 --minWorkers=1`, then `npm.cmd run build`.

## Task 6: UAT acceptance, deployment, and handoff

**Files:** Create `scripts/verify-site-activity-log.mjs`, `docs/alm/site-activity-log-uat-verification.json`; update `docs/site-activity-log.md` with actual verified coverage, deployed hashes, and limitations.

- [ ] Before packaging, compare with a fresh UAT download and an isolated source baseline. Include only this feature's reviewed schema/commands/capture adapters/page/link; preserve deferred local changes. Follow exact environment/site guards and restore the original PAC profile.
- [ ] Validate actual table/column/Choice metadata, required fields, descriptions, ownership, published audit flags, environment audit prerequisite, relationship, Active alternate key, append-only guard, least-privilege writer/read permissions, reporting queries, and native registration in UAT. Deploy only the reviewed package; do not enable environment-wide auditing, retention jobs, Production promotion, or site restart as an implicit dependency.
- [ ] Use User A, User B, and Administrator sessions. Verify own/all lists, filters, direct detail access, continuation tampering, Staff-only denial, role revocation, pending-user restrictions, no anonymous access, and direct-table API disabled. If separate ordinary accounts are unavailable, record the result as **incomplete multi-user acceptance**, not a successful privacy test.
- [ ] Generate only uniquely marked test mutations across every enabled module. Check create/edit/delete/semantic/upload outcomes, safe snapshots, UTC/Eastern date boundaries, delivery delay/recovery, and one history row per semantic event despite retries.
- [ ] Run the relevant existing business regression suites and build. Hosted checks must include report submission/upload/delete, event join recovery, appointment request/accept/reschedule/calendar projection, Press Coverage max-size upload/retry/replacement, and Activity Channel mutation/moderation behavior where those integrations change.
- [ ] Clean up exact-ID/marker business fixtures through controlled maintenance. Normal deletion should leave its expected history; use a separate explicitly guarded test-history cleanup, not a portal delete feature or broad log purge. Verify no unrelated records were touched.
- [ ] Save a module-by-module acceptance matrix. Record any unsupported/disabled capture path plainly. Keep history deployment time/coverage start visible in documentation; do not claim backfilled pre-launch actions.
- [ ] Hand off the final schema, actual UI screenshots, authorization proof, delivery monitoring procedure, and retention proposal. Obtain the owner's retention decision before enabling any purge.

## Review checklist before execution

- [x] User's record-change/upload scope recorded; views/downloads/sign-ins excluded.
- [x] Schema distinguishes actor Contact from technical Dataverse Created By.
- [x] User-selected table name, 17 Action labels, required fields, lengths, audit/append-only requirements, descriptions, and query optimization incorporated; missing Deleted identified as a schema decision before deletion coverage.
- [x] Existing UAT table and exact Choice mappings read back; user/team ownership accepted for reuse; actual capacity/required/auditing differences documented without changing schema or data.
- [x] Admin sees all; Staff/Volunteer see own; authorization happens on every server query.
- [x] Deleted target snapshots and no cascading history deletion designed.
- [x] Legacy identity gap and asynchronous delivery feasibility are explicit, testable prerequisites.
- [x] Successful commit, uncertain response, duplicate delivery, partial-file, and background failure cases included.
- [x] Existing compatibility route, working upload mechanisms, and unrelated pending edits preserved.
- [x] Latest footer-only navigation and Activity Log-only change boundary incorporated; verification-card shortcut removal is a separate explicit user-requested correction, not permission to modify verification logic.
- [x] Source/task contracts agree; no schema or runtime changes executed by this planning task.

Next step is review of this proposal, especially the capture proof and integration scope. No implementation has begun.
