# Activity Log — selected table definition and proposed integration

Date: 19 October 2026. Status: the user subsequently requested implementation, footer-only navigation and Activity Channel pagination. Local implementation is tracked in [the current execution plan](../plans/2026-10-19-history-and-channel-implementation.md); this design alone does not authorize schema/environment changes or deployment. The user added Deleted themselves and its value 866530017 was verified read-only.

The user created the table themselves. Read-only UAT metadata checks on 19 October 2026 confirmed logical name **`mss_activitylog`**, EntitySetName **`mss_activitylogs`**, and primary ID **`mss_activitylogid`**. Both Choice label lists exactly match the user's selected definition. The definition below remains the desired schema, with verified differences listed next. No table, column, audit setting, or record was changed by this review. See [metadata evidence](../../alm/activity-log-existing-table-review.json).

## Verified existing table and reconciliation

| Setting | Existing UAT metadata | Desired definition / planning consequence |
| --- | --- | --- |
| Ownership | UserOwned (user/team) | **User confirmed keeping this existing table.** Accept user/team ownership, enforce history access through Performed By + Site ID, and do not recreate or replace the table. |
| Name | String, 850, optional | Desired 200 and required. Do not shrink existing data without checking lengths; the writer can enforce a 200-character label. Required metadata/server validation needs reconciliation. |
| Performed By | Contact lookup, optional, auditing off | Desired required and audited. Server-derived actor and schema/audit reconciliation are necessary for future entries. |
| Actor Name | String, 100 | Desired 200; increasing capacity is a proposed safe expansion, not an applied change. |
| Actor ID Snapshot / Record ID / Site ID | String, 100 each | Desired 36; validate canonical GUID values in the writer. Extra column capacity alone does not require a risky shrink. |
| Record Title | String, 100 | Desired 850; expand before storing long source titles. |
| Summary / Correlation ID | String, 1,000 / 100 | Match the requested capacities. |
| Details JSON | String, 4,000 | Desired Memo/multiline text, 16,000. The saved String type cannot simply be widened to 16,000 or changed in place to Memo. Propose a separately approved new Memo column if 16,000 is retained; preserve the old column/data. |
| Event Key | String, 100, required; unique key Active | Uniqueness is ready. Generate exactly 64-character keys; do not rebuild/shrink the active key just to reduce the metadata maximum. |
| Occurred On | DateAndTime, UserLocal, required | Matches. |
| Table/custom-column auditing | Table true; supported custom fields true except Performed By | Performed By needs auditing enabled; virtual/system helper columns are not the custom-data audit target. |
| Environment auditing | `isauditenabled = false` | Effective native auditing is not active, despite the table flags. Any environment-wide enablement is a separate reviewed change. |
| Actor Contact delete behavior | RemoveLink | Current optional lookup supports preserving history after unlinking. If changed to required, decide actor deletion policy before switching to Restrict Delete. |

Published Action values are 866530000–866530017, including the user-added Deleted value 866530017; Module values are 866530000–866530007 in the exact user-listed order. The original metadata evidence predates Deleted; its later readback and implementation verification are saved with the execution evidence. Use actual metadata values rather than sample row titles.

The five supplied rows contain null Performed By lookups and placeholder actor/site/record IDs such as `actor_001`, `site_001`, and `rec_001`. Some describe login/logout/views, outside the confirmed capture scope. Preserve them as existing sample/legacy data; do not delete, rewrite, infer Contacts from names, or represent them as verified portal-user history. Own-history queries require the real Contact and exact website ID. Administrator history for this site must not leak unrelated placeholder-site rows.

The user confirmed keeping the existing user/team-owned table. Reconcile only necessary columns/security through a separately reviewed delta; no replacement table is planned. The Details JSON decision remains: a new 16,000-character Memo column (proposed `mss_detailsjsonlong`, subject to availability) preserves the existing String column/data, or explicitly accept a bounded 4,000-character details contract. Do not silently truncate JSON or perform destructive schema repair. Ownership acceptance does not by itself approve column changes or environment-wide auditing enablement.

## Purpose and confirmed scope

**Latest scope restriction:** Activity Log is linked **only in the existing authenticated footer**. No header/Activity-dropdown/profile-menu link, dashboard shortcut, or profile-verification prompt/button is part of this feature. Keep existing business pages, profile verification, access rules, and workflows unchanged. The only requested cleanup outside Activity Log is removal of the two unsolicited `View My Calendar` and `Open Activity Channel` shortcuts from the profile-under-review card. Do not change verification/authentication logic or its Sign Out behavior as part of that cleanup.

Add a read-only Activity Log page showing a history of actions performed on OIAC Engage. A user sees actions that they performed. A user with the actual **Administrators** web role can additionally see all users' history on this website. Staff and Volunteer roles alone do not grant access to other users' history.

The user confirmed **record changes and uploads**. Capture completed creates, edits, deletes, event joins/rejoins, appointment acceptance/reschedule/cancellation where implemented, Activity Channel posts/comments/replies/pin/unpin/delete, profile/contact edits, and successful attachment upload/replacement/removal. Do not add record views, downloads, navigation, sign-ins/sign-outs, or failed form validation to this release. An action is logged only if the site supports that operation; this feature does not add cancellation, deletion, or other missing business workflows.

History begins when a module's verified logging integration is enabled. Existing records are not proof of past actions; do not invent historical updates or deletions. Any future import of genuine existing audit events needs separate provenance and deduplication checks.

## Proposed approach and alternatives

**Recommended:** a dedicated Dataverse history table, trusted server capture at the business operation, and a read-only Power Pages endpoint. Reuse the site's existing Server Logic/native-command pattern. Prefer durable asynchronous history processing after a confirmed business commit, so a later history-insert failure does not turn an already successful save into a failed save. The native asynchronous execution context is the proposed delivery mechanism, not a browser fire-and-forget call. Its actor context, committed payload, retry behavior, and delete snapshots must be proven in UAT before a module is marked covered.

**Alternative: native Dataverse audit alone.** Useful for platform change evidence but does not by itself implement this portal's Contact-based, own-history page. Portal Contact attribution and permission filtering still require a design. No environment-wide auditing change is included in this proposal.

**Alternative: browser-side log inserts after saves.** Not recommended: browser code can be skipped, interrupted, or forged, and would not reliably identify every committed action.

This is an operational site history, not a claim of legally immutable or tamper-proof storage. Portal administrators cannot edit/delete history through the portal; privileged Dataverse maintenance remains a separate administrative capability.

## Existing integration findings

| Area | Current write path | Planning consequence |
| --- | --- | --- |
| Appointments | `server-logic/appointments` → `mss_AppointmentCommand` | Trusted Contact is already derived from `Server.User`; capture the actual requester/recipient action and committed outcome. |
| Activity Channel | `server-logic/activity-channel` → `mss_ActivityChannelCommand` | Existing trusted author/moderator checks; deletion must retain a safe pre-delete snapshot. |
| Press Coverage | Server Logic SDK CRUD; file actions use `mss_CoverageFileCommand` | Creator is not always the editing actor. Log a file only on verified commit, never each begin/chunk/read. |
| Meeting Reports | Direct Power Pages Web API | Reported By is not sufficient proof of the actor of a later edit. A trusted actor handoff is required. |
| Report attachments | Separate upload/delete flow | Preserve existing storage and record associations; log confirmed individual file outcomes with authenticated actor provenance. |
| Events and registrations | Direct Power Pages Web API | Do not accept a browser Contact ID or timestamp as audit identity; repeated Join Event recovery is not a second join. |
| Contact/profile edits | Direct Power Pages Web API | A Contact being edited can differ from the acting administrator. Never use the target Contact as the actor. |

Do not assume a shared portal integration user's Dataverse `createdby`, record owner, Submitted By, Reported By, or Requester equals the actor of every operation. The initial UAT proof must address these different paths. A table and a page alone cannot provide complete, trustworthy site-wide history.

## Dataverse table proposal

Use the user's existing ordinary **Activity Log** table, **`mss_activitylog`** / **`mss_activitylogs`**, with its accepted **user/team ownership**. The user explicitly chose reuse over an organization-owned replacement. Portal own/all visibility must be controlled by the Performed By Contact relationship and trusted site/actor scope, rather than treating Dataverse owner as the portal actor. Do not create a duplicate, use a Dataverse Activity table, or reuse `mss_activitypost`/`mss_activitycomment`. All following field definitions describe the desired column contract; the preceding verified-difference table prevents assuming they are already deployed.

| Column | Proposed type | Purpose |
| --- | --- | --- |
| `mss_activitylogid` | Primary GUID, system generated | Identifies a history entry. |
| `mss_name` | Primary text, 200, required | Short generated label, such as `Appointment accepted`. |
| `mss_performedby` | Lookup → Contact, required | Actual signed-in user who performed the action; also validated by the server for every portal event. |
| `mss_actorname` | Text, 200 | Display-name snapshot at the time of the action. |
| `mss_actoridsnapshot` | Text, 36 | Internal original Contact GUID, retained if the Contact relationship is later removed. |
| `mss_siteid` | Text, 36, required | Fixed originating website ID; required scope on every history query. |
| `mss_action` | Local Choice | Server-assigned semantic action from the action catalog below. |
| `mss_module` | Local Choice | Meeting Reports, Events, Registrations, Appointments, Press Coverage, Activity Channel, Contacts, or Profile. |
| `mss_recordtype` | Text, 100 | Allowlisted target logical table name. |
| `mss_recordid` | Text, 36 | Target GUID, retained even when the target row is deleted. |
| `mss_recordtitle` | Text, 850 | Safe title snapshot, independent of later record renaming/deletion. |
| `mss_occurredon` | Date and Time, User Local, required | Server UTC time of the confirmed operation, distinct from later log delivery time. |
| `mss_summary` | Text, 1,000 | Bounded readable description of what happened. |
| `mss_detailsjson` | Multiline plain text, 16,000 | Versioned, allowlisted details/changed fields; not an arbitrary copy of the record. |
| `mss_eventkey` | Text, 64, required; alternate key | Server-generated stable event identity for duplicate suppression on delivery retries. |
| `mss_correlationid` | Text, 100 | Internal correlation for the originating operation and delivery diagnostics. |
| `createdon` | System Date and Time | When the log row was stored; may be later than Occurred On. |
| `createdby` | System User lookup | Technical writer/integration identity; do not use as the portal User column. |

Lengths and required fields above reflect the user's chosen definition; reconcile them against the verified existing metadata before implementation. In particular, do not write 16,000 characters to the existing 4,000-character `mss_detailsjson` String or 850 characters to the existing 100-character title. Keep the table's direct portal Web API disabled and expose only the explicit read DTO through Server Logic. Do not enable Notes/attachments or add file/image columns. Verify/add meaningful descriptions to the table and every custom column, describing server ownership of actor/time/event identity and safe snapshot contents.

Use a normal Contact relationship with **no cascade delete of history**. Because the chosen Performed By lookup is required, recommend **Restrict Delete** for the actor Contact relationship and deactivate actor Contacts instead of deleting them while their logs remain. The earlier Remove Link recommendation would leave a required lookup empty and is superseded. If physical deletion of actor Contacts must be supported, explicitly review changing that lookup requirement and using Remove Link while retaining snapshots; do not silently weaken it. Unrelated source records are referenced by table name + GUID + title snapshots and can be deleted or renamed without removing the history. Actor-name and record-title snapshots are not refreshed after later renames.

### Auditing, append-only enforcement, and querying

Enable auditing on the Activity Log table and every supported custom column. Read the environment audit setting as a prerequisite: table/column flags alone do not activate effective audit capture when environment auditing is off. Report that condition before proposing any environment-wide setting change; do not silently alter auditing for unrelated tables. Verify audit behavior separately from the custom history rows and the custom table's retention policy.

Append-only is an application/security requirement, not a standard custom-table ownership flag. Give the trusted writer Create/Read privileges only as needed and no normal Write/Delete privileges. Portal roles have Read only. Add a native Update/Delete guard for normal runtime paths, including alternate-key upsert updates, so this is not merely hidden UI. Approved retention/privacy maintenance requires a separate tightly scoped process; a browser `isAdmin`/maintenance flag cannot bypass the guard. Privileged platform administrators can change security or registrations, so this does not imply tamper-proof storage.

Create the unique Event Key alternate key and wait for its index status to become **Active**. Query by fixed Site ID plus actor (for mine), UTC date range, and optional Record Type/ID, with bounded `$select` and page size. Add useful views for My Activity, All Activity, recent site activity, and a record's history, ordered by Occurred On then primary ID. Use actual query telemetry to validate platform indexing and performance. Do not invent direct SQL indexes or turn Performed By/Site ID/Occurred On into a unique alternate key merely to optimize sorting; different valid events can share those values.

No extra columns are required on existing business tables by this proposal. If the identity feasibility work proves that a private operation-context column or a separate durable queue is necessary for a legacy path, present that exact addition for review before applying it. Do not silently fall back to a browser-supplied actor or an unreliable best-effort log.

## Action catalog and event identity

The user's selected Action Choice labels are exactly: **Created, Updated, Submitted, Registered, Approved, Rejected, Accepted, Cancelled, Closed, Reopened, Rescheduled, Published, Uploaded, Joined, Left, Profile Updated, Password Changed**. Resolve the actual integer values from the table metadata rather than the prior proposal or another Choice column.

**Recommended addition needing confirmation: Deleted.** It is absent from this selected catalog, while record/file deletion is part of the original history scope. Do not silently insert another Choice, classify a deletion as Updated, or claim complete deletion coverage until this is resolved. Use the existing chosen labels plus bounded `Details JSON.operation` values for finer distinctions such as pin/unpin, comment/reply, replacement, and registration reactivation; these do not require extra Action choices.

The presence of Approved, Rejected, Closed, Reopened, Left, or Password Changed in a reusable Choice does not add those workflows to the app. Log them only when an authoritative implemented operation confirms the corresponding change. In particular, Password Changed stays outside initial capture unless a trusted identity-system completion hook is separately verified; never infer success from a reset-link click or record credentials. Rejected is a confirmed business transition, not a generic HTTP/form failure.

Examples:

- Appointment request → Created; recipient confirmation → Accepted; alternative-time proposal → Rescheduled with `operation: "RescheduleRequested"` and `confirmed: false`. The summary must state it is an unconfirmed proposal; the label does not change its calendar/status behavior.
- Featured logo initial commit → Uploaded with `operation: "FileUploaded"`; verified replacement on the same coverage record → Uploaded with `operation: "FileReplaced"`.
- Report submission followed by two successfully uploaded files → one Submitted event and two Uploaded events, correlated to the report. A failed file does not receive a successful upload event. Do not also invent a second Created event for the same submitted report.
- Activity post publication → Published; comment/reply creation → Created with `operation: "CommentCreated"`/`"ReplyCreated"`; pin/unpin → Updated with `operation: "PinActivity"`/`"UnpinActivity"`.
- Profile edits → Profile Updated; editing another Contact through the administrator contact form → Updated, with the actual administrator as Performed By.
- Retry of the same committed file/event delivery → no duplicate history row. A real later replacement is a new event.
- An existing already-registered response from Join Event recovery is not another join. Actual cancelled-registration reactivation is Joined with `operation: "RegistrationReactivated"`.
- A true no-op edit or internal file-state update is not an Updated event. Exclude `mss_coverageuploadstate`, portal permission-check empty updates, and technical row-version churn.
- If Deleted is added, deleting an Activity post can remove multiple comments through cascade. Show the user's one Deleted action with a safe removed-child count, rather than inventing separate user delete actions for every child. Deletion capture remains a schema decision until that Choice is agreed.

The deduplication key represents a committed domain event, including site, actor, operation identity, target, and event type. A server-generated SHA-256 representation fits `mss_eventkey`. Generate or persist the operation/event identity at the authoritative mutation boundary and reuse it for redelivery. A client request ID alone is neither identity proof nor sufficient global deduplication. Do not deduplicate by record title or time windows, which could collapse distinct valid edits.

## What Details contains

Store a safe operation description, target ID/title, event time, and an allowlisted field-change summary. For example, appointment status `Pending → Accepted`, or file name/type/size and whether it replaced a previous file. A versioned JSON schema is enforced on the server, with maximum field counts and lengths.

Do not store passwords, cookies, CSRF tokens, file continuation tokens, SAS URLs, file contents, meeting access links, arbitrary request bodies, or unrestricted profile/report/comment content. Personal/contact values are masked or represented by field names by default. The deleted-record history retains its safe snapshot, not the whole deleted record.

Show snapshots as plain text. Construct record links from an internal module/route allowlist; never follow a saved arbitrary URL. An Activity Log entry does not grant access to the current target record. Recheck the target page/API's normal permissions, and show `Record unavailable` for deleted or no-longer-accessible targets while retaining the permitted historical summary.

## Read security and page behavior

Use a new route **`/activity/history`**, titled **Activity Log**. Its sole navigation entry is one **Activity Log** link inside `AppShell.tsx`'s existing authenticated Footer navigation. Add it when the page exists, not as a link to an unimplemented route. Do not modify PortalNav, the account/profile menu, the Activity dropdown, the anonymous footer, or the pending-profile shell/card to expose it. Preserve the existing `/activity/activity-log` redirect to Activity Channel; it is an existing compatibility route, not a blank page to repurpose.

| Viewer | Allowed history |
| --- | --- |
| Signed-in Volunteer, Staff, Applicant, or other non-admin Contact | Only events whose Performed By equals that Contact, for this website. |
| Administrators | Own history by default; can select All Users and filter by user. |
| Anonymous visitor | No history access. |

Use the current authenticated-user eligibility/approval rules; reading one's own history does not grant other page or directory privileges. Resolve administrator access using the current actual role membership for this site, independently of the profile button's display label or a role snapshot saved in a log.

Configure Contact-scoped **Read only** table permission on `mss_performedby` for authenticated users, and **Global Read only** for the exact site's Administrators role. No portal role gets Create, Write, Delete, Append, or Append To on the history table. Use a least-privilege server identity for inserts. Native read queries independently require the current actor and fixed site; server-side filtering precedes sorting/paging/counts. The native command must not expose organization-wide results based on a browser `isAdmin` flag or arbitrary Contact filter. Every detail-by-ID request repeats the same checks. Direct table Web API remains disabled.

Proposed list: **Date & Time | User | Module | Action | Record | Summary | Details**. Ordinary users can see their own name; administrators get the User filter only in All Users mode. Sort newest first with log ID as a stable tie-breaker; load 25 rows per page. Offer date range, module, action, and bounded record-title/summary search. Include loading, empty, unavailable, and retry states. A details drawer shows only the allowed snapshot and available record link. Reuse the existing page shell, typography, colors, controls, and mobile layout. No add/edit/delete log controls or export in the first release.

Store UTC; display explicitly labeled Eastern Time consistently with the appointment workflow, with an ISO UTC timestamp available in details. Date-range filtering must use the same timezone rules on the server.

## Capture reliability and rollout boundary

Separate logging from browser code. The trusted server establishes the actor, semantic action, safe snapshot, UTC event time, target, and event identity. Business outcome is authoritative; a lost HTTP response is not proof that the record failed to save.

Preferred flow:

```text
Authenticated operation → existing validated mutation → confirmed commit
                                                   ↓
                           durable server event/context → background history insert
                                                   ↓
                                  own/admin authorized read → Activity Log
```

The feasibility task must prove native asynchronous capture retains the trusted actor and bounded deletion/upload outcome after a successful command, supports retry with the same event key, and does not append events for rolled-back/rejected operations. Do not infer undocumented portal Contact context from an ordinary entity plug-in. If the native approach cannot meet these tests for a path, revise that path's capture design before enabling it; a durable outbox is an alternative with an additional table and transactional coupling that requires explicit review.

The latest scope does not authorize redesigning or migrating legacy CRUD/flow writers. Inspect their actor provenance and prefer separate, non-invasive Activity Log capture adapters where the platform supports them. If a path cannot provide trustworthy history without changing an existing business service/command/flow, document that exact necessary delta and obtain a scope decision before touching it. Do not rewrite report uploads, profile saves, event joins, or other workflows as an implicit logging task. Native Dataverse operations must not be assumed to inherit portal table permissions automatically; an unrestricted generic CRUD command is not an acceptable shortcut. Mark any unverified capture path incomplete rather than broadening the scope or fabricating actor data.

The guaranteed-history versus save-availability tradeoff must remain explicit: a synchronous same-transaction history write can roll back the business save if logging fails; a background approach can show history later and needs monitored durable retries. Never promise both unconditional save availability and guaranteed immediate history. This proposal prefers background delivery and a small eventual delay; do not introduce synchronous save failures as an undocumented shortcut.

A module is not marked complete while its actor capture or delivery is only best effort. Background failures go to administrator diagnostics and retry; a successful mutation is not resubmitted to repair its history. Do not create extra history events for logging's own writes, capture jobs, or Activity Log reads.

## Retention and release acceptance

Propose **365 days online**, subject to the owner's retention decision. Until a policy is approved, configure **no automatic purge**. Do not assume Dataverse native-audit retention automatically purges this custom table. Retention, archive, export, and privacy erasure are separate controlled work, not hidden jobs in this feature.

Acceptance requires ordinary User A, ordinary User B, and an Administrator: A/B cannot access each other's rows, details, counts, filters, or continuation pages; Staff alone is not an administrator; administrator sees all users; changing roles immediately affects authorization. Forged actor, timestamps, action, event keys, and target IDs cannot create history. Validate supported mutations across every module, safe deletion snapshots, successful-upload-only logging, failed/rolled-back suppression, retry deduplication, background failure recovery, and target record access after permission changes. Confirm old report/file storage and all existing business behavior remain intact.

Implement and validate in the approved Test/UAT environment first. Preserve the current uncommitted workspace, deferred Activity UI edits, and the locally changed account-button label. Do not bundle unrelated pending changes or deploy to Production during this feature's UAT work.

## References

- [Power Pages server objects and signed-in user context](https://learn.microsoft.com/en-us/power-pages/configure/server-objects)
- [Power Pages table permissions and Contact access](https://learn.microsoft.com/en-us/power-pages/security/table-permissions)
- [Dataverse event framework](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/event-framework)
- [Dataverse database transaction behavior](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/scalable-customization-design/database-transactions)
- [Dataverse auditing and retention](https://learn.microsoft.com/en-us/power-platform/admin/manage-dataverse-auditing)
- [Configure auditing at environment, table, and column levels](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/auditing/configure)
- [Alternate-key index creation and status](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/define-alternate-keys-entity)
- [Dataverse relationships and Restrict Delete](https://learn.microsoft.com/en-us/powerapps/maker/common-data-service/relationships-overview)

Implementation plan: `../plans/2026-10-19-site-activity-log-plan.md`.
