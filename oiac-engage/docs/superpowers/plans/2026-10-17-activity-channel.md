# Activity Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved authenticated community feed, nested conversations and secure moderation in the existing OIAC Engage SPA.

**Architecture:** A separate trusted Power Pages ServerLogic bridge invokes a dedicated Dataverse Custom API. The API owns identity, reads, bounded pagination, creation, moderation and native cascade deletion. React consumes validated DTOs through the existing CSRF utility and retains the current AppShell/theme.

**Tech Stack:** React 19, TypeScript, React Router 7, Vitest/Testing Library, Playwright/axe, C# .NET Framework Dataverse SDK, PAC code-site tooling. No new dependencies.

## Global Constraints

- Approved design: `docs/superpowers/specs/2026-10-17-activity-channel-design.md`; supplied screenshots are the visual reference.
- Test/UAT only: environment `16838866-275a-e2e7-838f-57313f30a416`, URL `https://org97063a46.crm.dynamics.com`, site `e7f400bd-1e04-4efa-b8b3-7a7a3b168662`, solution `CRMSolution`. No Production changes or restart.
- Preserve all unrelated dirty work; no commits, staging, resets, stashes, branch/worktree migration or broad cleanup. Keep scoped before snapshots and review evidence in this plan's ignored workspace.
- Preserve Events/Join Event, Appointments, My Calendar, Press Coverage, Contacts, Meeting Reports, authentication/profile processing and existing configuration.
- Use existing Activity tables/columns; only approved schema changes are comment memo 100ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢8000 and PostÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢Comment Delete RemoveLinkÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢Cascade. Keep self-parent RemoveLink and all other cascade settings unchanged.
- All authenticated eligible portal Contacts may participate regardless of functional approval. Anonymous access is denied. Preserve registration/profile gate and narrow existing route restrictions.
- Never trust browser authorship, role, pin fields, timestamps, arbitrary API/query URLs or selectable actor. Server validates exact site Administrator membership. Browser gets no Dataverse credentials.
- Bounded reads: 20 posts per stream page, transition at most 40; 100 comments per page over at most 40 posts; aggregate actual visible post count with explicit unavailable state on errors/limit.
- Text limit 8000 UTF-16 characters, whitespace-only rejected, paragraphs preserved. No submitted HTML; validated HTTP/HTTPS links only. Standard Dataverse createdon/modifiedon; display America/New_York.
- Immediate mutation locks plus actor-scoped deterministic request replay; retain drafts after failures and do not silently issue a new create identity on uncertain saves.
- Sequential implementation agents, fresh task-scoped reviewers, final broad review. Never delete test evidence because there are no task commits. Native PowerShell replaces unavailable Bash artifact scripts.

## Fixed interfaces

Custom API `mss_ActivityChannelCommand`, assembly `Oiac.Engage.ActivityChannel` version 1.0.0.0, class `Oiac.Engage.ActivityChannel.ActivityChannelCommandPlugin`. Inputs ActorContactId Guid, Command String, Payload JSON String; Result JSON String. Execute privilege `prvReadmss_ActivityPost`; service uses context.UserId.

Endpoint `/_api/serverlogics/activity-channel`: POST JSON `{command,payload}` for all operations, including reads, to keep one strict action contract. Trusted ActorContactId comes only from Server.User. Bridge unwraps documented InvokeCustomApi wrappers and returns the inner Result. Transport may wrap it as `{success:true,data:string}`; TS validates both.

Review refinement: counting runs in a separate Dataverse request/transaction. Internal Custom API command `count`, payload `{}`, returns `{ok:true,totalCount:number}` or sanitized unavailable. Raw API `feed` performs no aggregate and returns count placeholders (`totalCount:null,countUnavailable:true`). The bridge invokes feed first, then count separately and enriches the public feed DTO on success; a failed count leaves the usable feed and explicit unavailable count. Browser clients cannot directly select this internal count command. This preserves the approved public contract and avoids continuing SDK work after a count fault aborts its transaction. At the paging ceiling with MoreRecords, return explicit unavailable instead of an unexecutable cursor or false terminal success.

Author `{id:string|null,name:string,jobTitle:string|null}`.
Post `{id,content,author,createdOn,modifiedOn,isPinned,pinnedOn,pinnedById,rowVersion,canDelete,canModerate}`. Nullable only pinnedOn/pinnedById and author.id/jobTitle. Date fields use UTC ISO strings; rowVersion positive numeric string.
Comment `{id,postId,parentId:string|null,content,author,createdOn}`.
Success replies include `ok:true`. Failures `{ok:false,error:{code,message}}`, codes unauthenticated/forbidden/validation/not_found/conflict/unavailable; messages sanitized.

Commands and exact payload/response:
```ts
feed: { phase: 'pinned' | 'regular', page: number }
// -> {ok,posts:Post[],nextLink:string|null,totalCount:number|null,countUnavailable:boolean,currentUser:Author,canModerate:boolean}
comments: { postIds: string[], page: number }
// -> {ok,comments:Comment[],nextLink:string|null}
post: { requestId:string, content:string }
// -> {ok,post:Post}
comment: { requestId:string, postId:string, content:string }
reply: { requestId:string, postId:string, parentId:string, content:string }
// -> {ok,comment:Comment}
pin | unpin | remove: { id:string, expectedRowVersion:string }
// pin/unpin -> {ok,post:Post}; remove -> {ok,id:string}
```
Feed cursor is only `pinned:N` or `regular:N`; comments cursor only `comments:N`. Validate positive bounded page numbers (max 2500), never execute arbitrary nextLink URLs. If the pinned stream ends, append regular page 1 and return regular:2 if more; subsequent regular pages stay 20. Missing false flags belong to regular stream. Stable order pinnedOn DESC, createdOn DESC, ID ASC; regular createdOn DESC, ID ASC; comments createdOn ASC, ID ASC.

Actor-scoped deterministic created ID = first 16 SHA256 bytes of UTF8 `activity-channel:<command>:<actor-D>:<requestId-D>` (force RFC version/variant bits consistently). First retrieve by deterministic ID; replay succeeds only if author, text, post and parent match exactly. Reuse after deletion cannot restore deleted content without explicit create, an acceptable bounded idempotency scope. Do not swallow failed SDK writes and continue in an aborted transaction.

## Task 1: Dataverse action, registration, schema tooling and SDK tests

**Files:** Create `backend/activityChannel/ActivityChannelCommandPlugin.cs`, `ActivityChannelCommandTests.cs`, `RegisterActivityChannelCommand.cs`, `ApplyActivityChannelSchema.cs`, `build-test.ps1`, `README.md`; create `scripts/activity-channel/schema-manifest.json`.
**Consumes:** Verified mapping/design and existing `backend/appointments` SDK build/registration conventions. **Produces:** Fixed action and DTO contract above; guarded administrative Apply methods for the parent to call using the existing fixed-UAT helper. No remote mutations from this implementer.

- [x] Write behavioral SDK fakes/tests first, run red: eligible pending Contact allowed; anonymous/inactive/login-disabled denied; browser extra author/pin fields rejected; actual exact-site Admin membership; native conditional pin/unpin/remove; owner/admin deletion; no caller timestamps; 8000 limit and whitespace; same-post parent ancestry/cross-post/cycle rejection; deterministic replay/mismatch; feed streams/page transition/null flag, stable ordering; comment batch bound/order; aggregate count unavailable handling.
```csharp
AssertCode(Run(Guid.Empty,"post","{}"),"unauthenticated");
AssertCode(Run(UserB,"remove",Payload(PostA,"1")),"forbidden");
// Inspect executed DeleteRequest.ConcurrencyBehavior == IfRowVersionMatches.
// Inspect new reply has original mss_activitypost AND immediate mss_parentcomment.
```
- [x] Implement strict payload keys/types/limits. Active post checks on every write/read; author projection minimal fullname/jobtitle, null honest fallback. Bound ancestry traversal at 100 and reject missing/cyclic/cross-post chains. Use SDK QueryExpression joins and FetchXML count aggregate; no downloaded-body counting. No direct Contact listing endpoint.
- [x] Generate names server-side (`Activity <id>` / `Comment <id>`), stamp author, false pin; retrieve persisted records for standard timestamps. Pin metadata server UTC/actor; unpin clears it. Use concurrency SDK UpdateRequest/DeleteRequest, preserve createdon. Validate row active/version before mutation and return conflicts from native mismatch.
- [x] Implement signed Sandbox Database assembly build/test following existing appointments script; registration guard exact assembly/action/input/output privilege/solution, idempotent existing components. Keep registration out of runtime DLL.
- [x] Schema tool reads existing memo and relationship by actual logical names/metadata ID, accepts only expected before/already-applied states, preserves other cascade settings and customizability. Apply UpdateAttribute/UpdateRelationship, add affected entities to CRMSolution and publish only these entities; write sanitized before/after manifest. No records deleted.
- [x] Run SDK tests green; self-review; report exact files, commands/output, discovered platform assumptions and all concerns. No git commits.

## Task 2: Trusted bridge, portal metadata and validated TypeScript service

**Files:** Create `.powerpages-site/server-logic/activity-channel/activity-channel.js`, `activity-channel.serverlogic.yml`; two authenticated Read-only table permission YAMLs; two direct Web API disabled setting YAMLs; `src/features/activityChannel/activityTypes.ts`, `activityService.ts`, `activityService.test.ts`, `activityServerLogic.test.ts`.
**Consumes:** Task 1's fixed DTO/API contract. **Produces:** `getActivities(cursor?:string):Promise<ActivityFeedPage>`, `getCommentsForPosts(postIds:string[],cursor?:string):Promise<ActivityCommentPage>`, `createActivity(content,requestId)`, `createComment(postId,content,requestId)`, `createReply(postId,parentId,content,requestId)`, `pinActivity(post)`, `unpinActivity(post)`, `deleteActivity(post)`; mutations return DTO (delete void/id), typed `ActivityConflictError` and safe errors.

- [x] Write transport VM/service tests red, including real lowercase wrapper, stringified Result, malformed/false success, invalid IDs/versions/timestamps/cursors/counts/actionflags, actor spoof attempts, anonymous no invocation, fixed API invocation identity from lowercase trusted contactid.
```ts
expect(await getActivities()).toMatchObject({totalCount:3,countUnavailable:false})
await expect(getActivities('https://other.example')).rejects.toThrow()
// Forged `{command:'pin',payload:{id,author:other}}` must be rejected before API call.
```
- [x] Implement bridge strict command/keys and trusted identity, exact registered action InvokeCustomApi, sanitized error handling. Top-level supported handler, arrow callbacks; avoid restricted anonymous-function/prototype/endsWith patterns. Do not modify existing server endpoints.
- [x] Add only authenticated role `0353acdd-7b95-4c07-8997-ae95dafd978d` to endpoint and two Global Read permissions. All Create/Write/Delete/Append flags false. Add `Webapi/mss_activitypost/enabled=false` and comment equivalent; leave existing metadata intact. Generate fresh stable component GUIDs.
- [x] Implement TS validation/reuse shared powerPagesFetch; strict response DTO parsing, same-origin fixed endpoint, bounded input/cursors, friendly code-based messages, positive numeric versions and safe UTC instants. `crypto.randomUUID` is provided by UI per logical draft and retained through retries. Never issue automatic mutation retry.
- [x] Run targeted Vitest tests and production TypeScript build; self-review and report evidence. No remote writes/commits.

## Task 3: Activity Channel page, conversations, routes and visual verification

**Files:** Create `src/pages/ActivityChannel.tsx`, `.test.tsx`; feature components `ActivityComposer.tsx`, `ActivityCard.tsx`, `ActivityDiscussion.tsx`, `ActivityDeleteDialog.tsx`, `activityPresentation.tsx`, `.test.tsx`, `activity-channel.css`; `scripts/verify-activity-channel.mjs`. Modify `src/App.tsx`, `components/PortalNav.tsx`, `components/RequirePortalRole.tsx`, `pages/Home.tsx`, `pages/PendingApproval.tsx`, `data/portalRoles.ts` and their relevant tests. Create `docs/activity-channel.md`.
**Consumes:** Task 2's service/types. **Produces:** Complete authenticated page and prescribed navigation/access with browser verification script.

- [x] Write interaction tests red: empty/failed/successful composer, repeated click lock/retry same requestID, independent comment/reply drafts and parent targets, reply-to-reply, pagination and draft preservation, count failure/retry, admin controls vs author delete, confirmed deletion/cancel, XSS/safe linkification, orphan/cyclic threads bounded with missing-context load controls, pending auth route isolated and anonymous blocked.
```tsx
await user.click(screen.getByRole('button',{name:/Create Activity/}))
await user.type(screen.getByRole('textbox',{name:'Activity content'}),'Community update')
await user.click(screen.getByRole('button',{name:'Post Activity'}))
// Failure preserves text; retry uses identical requestId; success resets after server DTO.
```
- [x] Implement screenshot layout using existing theme/AppShell/backlink, narrower centered column, collapsed+expanded inline composer, actual author initials/jobtitle, count badge, pinned strip and upper-right moderation, shaded threads, vertical connector. No fabricated runtime fixtures/global redesign. CSS scoped. Keyboard/focus semantics, touch controls and mobile no overflow.
- [x] Render safe paragraph-preserving React text and validated HTTP/HTTPS links (`noopener noreferrer`, reject control/userinfo/unsafeprotocol). Format native createdOn in America/New_York with semantic time/full-date tooltip.
- [x] Build thread presentation from IDs iteratively/cycle-safe; preserve immediate-parent association, cap visual depth at 3, show missing context rather than converting unknown-parent reply into root. Batch initial comments for visible newly loaded posts, retain per-post pages/merge IDs, refresh only affected thread after write. Refresh feed beginning after moderation; dedupe append.
- [x] Add accessible Delete Activity dialog with exact permanent-delete warning, focus containment/restoration/Escape and disabled actions during delete. Independent operation locks synchronously via refs, success live notices, actionable errors/drafts retained. Handle refresh failures after successful write without implying write failed or reposting.
- [x] Replace first Activity dropdown entry only; canonical /activity/channel and legacy /activity/activity-log redirect, /activity unchanged. Exactly three ordered entries. Activate related Home/Volunteer link, pending approval entry; narrow gate exception uses AppShell and preserves all unrelated restrictions/profile gate.
- [x] Run targeted UI/routing tests and production build; implement browser script using controlled mocks only in test harness at 1440/820/390 + axe/screenshots. Document schema/security/commands/limits and run evidence. No live businessrecord mutations/commits.

## Task 4: Combined review, approved UAT configuration/deployment and hosted acceptance

**Files:** Parent-owned ignored SDK helper glue/staging/evidence; versioned `docs/alm/activity-channel-uat-deployment.json`, `docs/activity-channel.md` and approved schema manifest updates. No unrelated file edits.
**Consumes:** Reviewed Tasks 1ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“3. **Produces:** Deployed verified UAT feature, source/build/readback/hosted evidence and honest remaining-account limits.

- [x] Run final broad fresh review against scoped before snapshots/design; route fixes through one fix implementer and scoped rereview. Run complete Vitest, SDK suites and build once amended code settles.
- [x] Capture fresh UAT metadata/assembly/site backup; verify exact environment+tenant via PAC profile5, restore original4 in finally. Use download-code-site, never classic download. Snapshot all existing metadata (initial baseline 288; final baseline 294). Invoke approved guarded schema/registration via fixedUAT helper; read back memo8000/cascade/exactaction/DLLsha.
- [x] Stage fresh downloaded existing metadata, overlay only six new metadata files and verified dist/config. Verify preserved baseline files byte-for-byte except intentional regenerated build references; inspect additions/settings/permissions. Upload-code-site exact UAT root, no restart, restore PAC profile4. Read back deployed bytes/config and asset hashes.
- [x] Launch only owned testing Edge persistent profile; reuse browser-managed session normally. Do not extract cookies/tokens/profile. Test own uniquely named post/root/reply/nestedreply, adminpin/unpin, reload persistence/authorship/parent/native timestamps, conditional-conflict, unsafe forgedpayload rejection, directtableCRUDblocked. Confirm deletion cascades testconversation; clean only own test records. No business data mutation.
- [x] Request User A/B signed-in availability only when test setup needs it; no manufactured multi-user claims or actor impersonation. Record ordinary-user/anonymous/manual checks actually performed and outstanding limits precisely.
- [x] Run hosted regression navigation/GET checks of existing modules and 3viewports/accessibility. Save sanitized results/screenshots and update handoff; mark plan steps with actual outcomes. Final concise outcome, evidence totals, limitations and docs link.

## Plan self-review

Spec covers navigation, composer, persisted feed, count, paging, comments, nested replies, pin/unpin, own/admin deletion, identity/permissions, safe rendering, responsive design, regression and deployment. Actual mappings and platform limits are explicit. Contracts are shared above, no new dependency or unrelated integration. User approval is already recorded; execute continuously without another plan/deploy permission loop.

## Final execution evidence � 18 October 2026

Reviewed final validation recovery and stale test expectation; 949 Vitest tests, 97 SDK behavioral groups, build and browser scenarios passed. Approved UAT upload completed in 218.59 seconds; actual bundle/bridge hashes and metadata readback verified. Native API 30 checks and real UI 28 checks passed; 3 hosted widths had no overflow or scoped axe violations. Existing routes 9/9 and observed API responses 23/23 passed. Anonymous entry and exact API endpoint redirect to tenant sign-in. All 5 uniquely named test posts and 9 discussion records were read back absent after authorized deletion/cascade. Temporary diagnostic removed and runtime404. No restart/Production changes; PAC profile4 restored. Only current Administrator was available; ordinary User A/B and pending-user hosted checks explicitly skipped. See docs/activity-channel.md and docs/alm/activity-channel-uat-deployment.json.
