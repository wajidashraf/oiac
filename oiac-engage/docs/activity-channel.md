# Activity Channel

The authenticated community channel lives at `/activity/channel`; `/activity/activity-log` redirects there. `/activity` continues to redirect to Events. Pending authenticated Contacts can use the channel in the full AppShell after registration-profile processing. Other pending-user restrictions remain in place. Anonymous sessions get the existing welcome experience.

The Activity dropdown contains Activity Channel, Events and Appointments, in that order. Home's Activity shortcut, the Volunteer destination and the pending-approval action lead to the channel.

## Data and security

The UI uses `activityService.ts` and its validated DTOs, posting `{command,payload}` through the existing CSRF utility to `/_api/serverlogics/activity-channel`. The trusted server bridge obtains ActorContactId from the portal session and invokes `mss_ActivityChannelCommand`. Browser code supplies no actor, author, permission flags or credentials. Administrator pin/unpin and author/administrator deletion are server-authorized; UI controls use the returned per-post `canModerate` / `canDelete` flags.

Public commands are `feed`, `comments`, `post`, `comment`, `reply`, `pin`, `unpin`, and `remove`. `count` is internal to the trusted bridge, run separately from feed retrieval so aggregate failure leaves a usable feed with explicit unavailable count. Only validated phase/page tokens are accepted, never arbitrary query URLs. Modification uses the returned rowVersion; conflicts are surfaced for refresh/retry.

Existing ActivityPost and ActivityComment tables are used. The approved schema changes are Comment memo maximum 8000 UTF-16 characters and Post→Comment Delete Cascade. Comment self-parent Delete remains RemoveLink. Native server cascade removes the whole post's conversation on delete.

## Behavior and bounds

- Feed pages contain 20 posts (at most 40 at the pinned-to-regular transition). Deduplicated retained and incoming posts are sorted by pinned status, pinnedOn descending, createdOn descending and ID ascending. Moderation rereads the beginning while retaining later loaded cards and their drafts, including older records moved into the regular stream.
- Initial comments are fetched together for newly visible posts, 100 comments over at most 40 post IDs. If that batch is truncated, a post's Load more comments starts its own page 1; subsequent loads use its own continuation, merging IDs. It never applies the batch cursor to a different query scope.
- Conversations keep immediate parent IDs. Deduplicated comments are sorted by createdOn ascending / ID ascending before iterative traversal, so roots and siblings remain chronological when older pages arrive after a new save. Traversal bounds cycles, marks missing context, and caps visual indentation at three levels. Available context loads use that post's paging controls.
- Each post/comment/reply composer has its own draft, synchronous submit lock and UUID request identity. A definitive first-attempt validation rejection preserves editable text; correcting it starts a new request identity. An uncertain save retains the exact read-only draft and UUID for retry, even if a later retry is rejected. Cancel collapses without losing the draft. Successful writes clear only their composer after the server DTO arrives. Thread refresh errors have a separate read retry and never invite reposting a confirmed save.
- Confirmed mutations always start a fresh relevant read, even while an older feed/thread read is active. Request generations prevent older responses or errors from publishing stale DTOs, counts, cursors or busy state. Initial batched comment reads participate in each post's generation and cannot overwrite a newer individual refresh.
- Whitespace-only input is rejected; textarea maximum is 8000 UTF-16 characters. Content is rendered as React text, paragraphs/newlines preserved. Only validated HTTP(S) links without userinfo, controls or backslashes become anchors, with `noopener noreferrer`. Native timestamps use Just now / Today / Yesterday based on America/New_York calendar days, followed by absolute dates for older entries; semantic ISO time values and full-date tooltips remain available.
- Delete Activity requires a modal permanent-deletion confirmation, contains keyboard focus, restores it on cancel, supports Escape, and disables actions while deleting.

## Local verification

Run `npm test -- src/pages/ActivityChannel.test.tsx src/features/activityChannel/activityPresentation.test.tsx src/App.test.tsx src/components/PortalNav.test.tsx src/pages/Home.test.tsx src/pages/PendingApproval.test.tsx`, `npm run build`, and `node scripts/verify-activity-channel.mjs` from this project.

The browser script launches a local Vite server on 127.0.0.1:5187 and intercepts API calls with controlled test-only identity/records. It captures collapsed, expanded and delete-confirmation states at 1440, 820 and 390 pixels, checks overflow, create/reply/cancel interactions, and runs scoped WCAG 2 A/AA and 2.1 AA axe checks. Artifacts go to `../.superpowers/sdd/2026-10-17-activity-channel/browser/`. Test fixtures are confined to the harness and tests. This evidence does not establish hosted two-user authorization; native UAT is tracked separately.

`node scripts/verify-activity-validation.mjs` separately exercises corrected validation drafts and uncertain-save retries in Chromium. The final local run on 18 October 2026 passed 949 Vitest tests across 78 files, the production build, both recovery scenarios, and 97 existing SDK behavioral groups (Activity 26, Appointments 55, Press Coverage 16). The existing roughly 510 kB main-chunk advisory remains.

## Dataverse mappings and deployment

| Purpose | Existing logical column |
| --- | --- |
| Post ID / internal name / content | `mss_activitypostid` / `mss_activityname` / `mss_content` |
| Post author / pin flag | `mss_author` / `mss_ispinned` |
| Pin date / administrator | `mss_pinnedon` / `mss_pinnedby` |
| Comment ID / internal name / content | `mss_activitycommentid` / `mss_commentname` / `mss_commenttext` |
| Comment author / original post / immediate parent | `mss_author` / `mss_activitypost` / `mss_parentcomment` |
| Actual creation / modification / concurrency | Standard `createdon` / `modifiedon` / native RowVersion |

The signed `Oiac.Engage.ActivityChannel` sandbox assembly implements `mss_ActivityChannelCommand` under the connector caller's security context. Administrative registration and schema tools live separately in `backend/activityChannel/`; they are not runtime browser code. The exact UAT schema readback is recorded in [activity-channel-schema-verification.json](alm/activity-channel-schema-verification.json).

The portal additions are the Activity server-logic script and YAML, two Global authenticated Read-only table permissions, and two `Webapi/<table>/enabled=false` settings. Create, Write, Delete and Append permissions remain false. The server action independently checks actor eligibility, exact-site Administrator membership, ownership, payloads, parent chains and row versions. Existing server endpoints and other modules remain separate.

On 18 October 2026 the reviewed build was uploaded to OIAC Test/UAT, website `e7f400bd-1e04-4efa-b8b3-7a7a3b168662` in environment `16838866-275a-e2e7-838f-57313f30a416`. The fresh 294-file baseline was preserved in staging except reviewed Activity file normalization; PAC then regenerated compiled bundles, landing references, attachment identifiers and its manifest. Readback found no unexpected changes. Hosted JavaScript, CSS and actual server-script File bytes match the reviewed build/source. The temporary Administrator diagnostic was removed and returns 404. The supported content-cache refresh was used after stale asset references appeared; no site restart or Production deployment was performed.

## Hosted acceptance, 18 October 2026

The signed-in Administrator passed 30 native API checks: trusted authorship, post save/replay without duplicates, an intact 8000-character comment, nested replies, cross-post and forged-field rejection, native pin concurrency (one winner and one conflict), unpin, actual post count, blocked direct-table access, and authorized deletion. Exact Dataverse-ID readback verified the test post and conversation records were absent after deletion.

The real hosted forms passed 28 checks: retained cancelled draft, server validation and editable correction with a new request identity, post/comment/reply/reply-to-reply saves, safe text and link rendering, pin-to-top, persisted conversation and pin after reload, unpin, cancelled deletion, and confirmed deletion. At 1440, 820 and 390 pixels there was no horizontal overflow and zero scoped WCAG 2 A/AA and 2.1 AA axe violations. Desktop and mobile screenshots were visually inspected. All uniquely marked test records, including the two interrupted harness attempts, were cleaned up; exact-ID readback confirmed native conversation cascade.

Only the current Administrator account was available. Real ordinary User A/User B and pending-user hosted sessions were not tested. Their authorization and route cases have local SDK/component coverage; that does not replace multi-user acceptance. Large-feed performance was not load-tested. The earlier connector failure cleared before acceptance without source, permission or registration changes; its precise platform cause was not established.

Nine existing-route checks passed with expected headings and no alerts or JavaScript errors: Dashboard, My Reports, My Calendar, Contacts, Events, Appointments, Press Coverage, the legacy Activity Log redirect, and the `/activity` Events redirect. All 23 observed API responses, covering 11 distinct paths, returned HTTP 200. These were navigation/read checks; no existing appointments, coverage, events or registrations were changed. The `Join Event` wording remains covered by the full local suite.

A clean anonymous browser context was redirected to Microsoft sign-in. A separate request to the exact portal Activity endpoint, with redirects disabled, returned HTTP 302 to the identity provider and no Activity records. The initial anonymous harness assumed a visible page during that redirect; the explicit redirect checks supersede that harness timeout.

The sanitized deployment record is [activity-channel-uat-deployment.json](alm/activity-channel-uat-deployment.json). The machine-readable runtime report is [last-test-site.json](alm/last-test-site.json): 81 automated checks passed, with two additional-account checks explicitly skipped. Detailed logs, source snapshots, scoped reviews, three hosted screenshots and test-record cleanup evidence are retained under `.superpowers/sdd/2026-10-17-activity-channel/` in the workspace. The source is left uncommitted alongside the preserved earlier work.
