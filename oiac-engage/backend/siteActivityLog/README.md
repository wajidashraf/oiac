# Site Activity Log

UAT implementation verified on 20 October 2026 (Saudi Arabia time). Uses the existing `mss_activitylog` table; no schema or environment audit setting was changed. The authenticated footer links to `/activity/history`.

The browser has a read-only Server Logic endpoint. It derives the Contact from `Server.User`; callers cannot supply an actor or append history. The native reader filters every list, count and detail query by the exact website. Ordinary users see their own Performed By records; only membership in the exact site's Administrators role permits all-user scope. Direct table Web API is disabled.

## Capture and integrity

- Native synchronous observers authenticate existing Activity Channel/Appointment commands and attach a strictly bound SharedVariables receipt. They make no SDK calls or Target changes. Async observers consume their own receipt, retain the original operation time and append a deterministic event key. Different-record cascades, arbitrary actor parameters and rewritten async API ancestors cannot authorize an event.
- Dataverse switches the native post Delete child pipeline to the verified UAT SYSTEM principal. The narrowly scoped exception additionally requires the real synchronous remove API, the same organization/initiator/correlation and an explicit matching payload record ID and row version. This was verified through the actual portal delete icon and confirmation.
- Separate async portal observers cover supported record changes in Meeting Reports, Events, Registrations, Contacts/Profile and Press Coverage. They require the SDK's authoritative portal Contact flag, the verified portal application user, root depth and bounded matching context. The observed terminal transport envelope retains that same SDK Contact identity; it cannot substitute a target Contact or creator for the actor.
- Coverage upload history is emitted only on a verified final state clear from the existing file API. It binds the actor, record, transfer session and actual stored file/name. Begin/chunk/read and intermediate updates produce no upload events. Platform-added typed modification fields and null-to-empty text normalization are allowed; mixed business fields are rejected. Private transfer state, file tokens and binary contents are never copied into history.
- Async delivery errors request a System Job retry; they do not roll back an already confirmed business save. The active alternate key and deterministic ID prevent duplicate entries on replay. Monitor failed history jobs and retry delivery rather than resubmitting the business operation.
- Two filtered Update/Delete guards enforce append-only history, including existing-row Upsert. Only verified platform Contact unlink/merge maintenance may change Performed By, leaving immutable actor and record snapshots intact. Actual UAT Delete/RemoveLink and Merge proofs passed.

## Deployment boundary

This implementation is deliberately bound to the approved UAT organization `3f613eb3-72ea-f011-aa23-6045bd003f09` and website `e7f400bd-1e04-4efa-b8b3-7a7a3b168662`. The portal application user is `605697c5-69a5-f111-b8dd-002248042536`. These bindings must be reverified before a separately authorized deployment to another environment.

`build-test.ps1` compiles and tests the signed runtime plus administrative helpers; it does not register or activate anything. `build-admin-host.ps1` builds the exact-UAT SDK host. Registration first creates disabled observers with full runtime/component/image validation and an ownership journal; activation is a separate operation. `RegisterSiteActivityLogPortalPlan` is the current portal registration path (`configure-portal-v2` / `activate-portal-v2`). Legacy registration utilities are retained for provenance, not the current rollout procedure.

Final UAT runtime SHA256: `dca4b16c2c54190648f5879a5ad12c3d616e3cb81ef69e65da16bce74655d013`. All 34 permanent steps are active: 16 native source/capture steps, 15 portal observers, one coverage upload source observer and two history guards. All seven temporary diagnostic steps and all owned source fixtures were removed. Their confirmed append-only history remains. Intentional diagnostic System Jobs are retained separately from ordinary delivery jobs.

## Verification and limits

Evidence is under `.superpowers/sdd/2026-10-19-history-and-channel-implementation/` at the workspace root. Final runtime and reader checks are `final-runtime-verification.json` and `final-reader-verification.json`. Browser evidence covers the real Administrator in Edge Work 8, live feed/comment/reply pagination, history continuation from 25 to 27 rows, real portal deletion, portal coverage editing, and the linked file control. The existing file API stored a harmless 622-byte PDF and returned the exact original download bytes. Exactly one final Uploaded event was recorded. Ordinary-user own/all/detail policy was verified through the native API, not a second browser login.

Local checks cover native command projections, legacy module projections, retries/deduplication, actor/receipt forgery, cascades, configuration, guards and registration preflight. Other modules were not each mutated in the hosted browser during this rollout; their business pages and services were preserved.

Meeting Report attachment history is explicitly deferred. Its upload/delete flow and storage remain unchanged. Reads, downloads, navigation, authentication/password material, technical upload chunks and past inferred events are excluded. The release adds no missing cancellation/deletion workflows. Effective Dataverse native auditing remains disabled at environment level; this is operational history, not tamper-proof storage. A Contact deleted before queued capture finishes can still cause a retrying delivery failure; already persisted snapshots survive later Contact/source changes. No retention purge or historical backfill was performed.
