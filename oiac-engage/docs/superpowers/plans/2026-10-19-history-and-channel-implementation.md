# Activity Log and Activity Channel implementation

User authorization: 19 October 2026, implement the previously planned Activity Log, footer link, icon delete and Activity Channel pagination. This supersedes planning-only status for these features. Preserve every unrelated local edit and all business behavior. No commits or broad staging. Use a scoped deployment from the last verified source when ready.

## Accepted design

- Activity Log uses the existing `mss_activitylog` table, own history by authenticated actor; exact-site Administrators may see all. Footer entry only at `/activity/history`; preserve legacy `/activity/activity-log` redirect. No verification/auth/profile changes.
- History is append-only, server actor/time/site, bounded safe snapshots, unique 64-character Event Key. No browser-supplied actor, direct table API or arbitrary append endpoint. Do not log reads, sign-ins, validation failures, no-op technical upload chunks or invented past events.
- Reuse current schema capacities for an initial bounded contract (Details JSON 4,000, title/actor name 100) without silently truncating JSON. Prefer short generated record labels, with safe relevant fields in bounded details. No environment-wide audit change. Native auditing disabled remains a documented limitation.
- Separate trusted capture observers/adapters from business services. Prove actor attribution and delivery before claiming module coverage. If legacy APIs require changing their write boundary, present the exact delta; do not substitute the target Contact/creator for the actor.
- User added Deleted; its actual value 866530017 was verified. No replacement table or destructive schema repair.
- Activity Channel uses icon-only accessible delete and Pin/Unpin. Show all pinned posts separately from newest ten regular posts. Show more appends ten regular posts without duplicate IDs. Comment display: five top-level comments per post, Show more reveals next five; one child per parent, View comment expands further replies without dropping nested context.
- Match existing theme. Keep draft persistence, mutation concurrency checks, confirmed-save behavior and authorization.

## Tasks

- [x] Task 1: Channel pagination, backend ten-record regular page, pinned-stream draining, comment/reply visibility, meaningful regression checks.
- [x] Task 2: New read-only Activity Log frontend, footer-only route, strict service DTO, own/all filters, accessible details and pagination.
- [x] Task 3: Native log writer/reader/immutability and trusted asynchronous capture for proven paths; security tests and administrative registration helpers.
- [x] Task 4: Prove legacy actor provenance, integrate only required trusted capture boundaries, report unresolved prerequisites explicitly.
- [x] Task 5: Review, focused regressions/build, exact scoped UAT package and verified rollout when authorized; never include unrelated pending changes.

## UAT result

Verified 20 October 2026 local time. Footer/page and Channel changes are deployed; all 34 permanent history steps are active. Actual portal deletion and coverage editing, native coverage file persistence/download/history, live Channel pagination and history continuation passed. Module/action filtering and ordinary-user own/all/detail isolation passed through the native API. Only the Administrator browser account was available; a separate ordinary-user browser session was not tested. Meeting Report attachment history remains explicitly deferred. No Production change, restart, existing business-service change, schema alteration or historical backfill was performed. Detailed evidence and operational limits are in `backend/siteActivityLog/README.md` and `.superpowers/sdd/2026-10-19-history-and-channel-implementation/final-report.md`.
