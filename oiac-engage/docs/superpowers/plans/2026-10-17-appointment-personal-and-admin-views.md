# Appointment personal and administrator views implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task 1, then review and verify delivery. Steps use checkbox syntax for tracking.

**Goal:** Right-align appointment status badges, retain recipient responses, preserve administrator visibility and confirm accepted appointments in both participants' app calendars.

**Architecture:** Keep one shared appointment record. Personal incoming, outgoing and calendar queries always filter by participant. Add a separate administrator-only `all` read command through the existing trusted proxy and bounded service. Add an administrator view switch without changing write commands, schema or existing Events/Meeting Invite sources.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, scoped CSS, Power Pages ServerLogic, Dataverse SDK C# plug-in, Playwright.

## Global constraints

- Existing feature branch contains deployed but uncommitted work. Preserve it all; no broad staging, commits, resets, stashes, new checkout or worktree migration. Keep per-task before snapshots for review.
- App My Calendar only; no Outlook, automatic Teams provisioning, duplicate event/invite creation, new columns, cancellation command or requester-confirmation transition.
- Keep 110px collapsed desktop/tablet cards, compact single Contact, existing theme, navigation locks, Eastern Time/DST and safe meeting links. Mobile/expanded forms may grow.
- Administrators can see all appointments in a separate view. Regular users see their own only. Administrator privilege never permits responding for another recipient. My Calendar stays personal for all users.
- Preserve Press Coverage, Events/Join Event, Contacts, Meeting Reports and existing site permissions/settings/roles.
- Deployment target remains the already approved Test/UAT site e7f400bd-1e04-4efa-b8b3-7a7a3b168662, environment16838866-275a-e2e7-838f-57313f30a416. No Production or restart. Restore PAC's original profile after every operation.

### Task 1: Implement the complete view contract and response presentation

**Files:** `src/pages/Appointments.tsx`, `.test.tsx`; `src/features/appointments/appointmentService.ts`, `.test.ts`; `appointmentServer.test.ts`; `appointments.css`; `.powerpages-site/server-logic/appointments/appointments.js`; `backend/appointments/AppointmentCommandPlugin.cs`, `AppointmentCommandTests.cs`; `src/pages/MyCalendar.tsx`, `.test.tsx`; `scripts/verify-module-corrections.mjs` and a focused browser script if needed.

**Interfaces:** extend list views to `incoming | outgoing | all` at `getAppointmentPage`. The proxy forwards `all` using the existing fixed action. C# `Run` accepts `all` only after exact site administrator role verification. Payload remains `{page:number}`, result remains `{ok:true,appointments,nextLink,awaitingCount}` with matching `view=all` continuation. No action parameter or response member changes.

- [x] Write behavioral failing tests before implementation. Administrator C sees a row in `all`, cannot see it in personal incoming/outgoing/calendar; unrelated ordinary C gets `forbidden` for `all`. A/B see the same Accepted appointment in calendar, C does not, including when C is administrator. Accept still requires B and Pending/version. Verify safe `all` continuation and reject a swapped list continuation.

```csharp
var s = new Fake { Admin = true };
Assert(Call(s,C,"all","{}").Contains("Budget"), "admin overview missing");
Assert(!Call(s,C,"incoming","{}").Contains("Budget"), "personal incoming polluted");
Code(Call(new Fake(),C,"all","{}"), "forbidden");
```

- [x] Run SDK tests and focused Vitest tests to record the expected failures. Use `backend/appointments/build-test.ps1`; use host escalation for npm due Windows ancestor-path restrictions. Keep logs in this plan's ignored SDD directory.
- [x] Implement C# personal query scoping and administrator-only `all`, retain exact site-role validation and unchanged write/concurrency rules. Update proxy command/continuation allowlists and service view types. No browser-provided administrator flag reaches authorization.

```csharp
if(command=="all") { if(!Administrator(service,actor)) Fail("forbidden"); }
else if(command=="incoming") q.Criteria.AddCondition(Recipient,ConditionOperator.Equal,actor);
else if(command=="outgoing") q.Criteria.AddCondition(Requester,ConditionOperator.Equal,actor);
else { /* calendar: Requester OR Recipient, plus Accepted and Eastern month */ }
```

- [x] Add administrator-only My Appointments / All Appointments switch with accessible button semantics (`aria-pressed`) and own paginated list. Do not request `all` for non-admin or before selecting it. Personal lists always filter current participant. Admin all cards identify requester and recipient. View changes obey existing dirty-draft confirmation and save lock; refresh both lists and all view after response/create. Identity/role changes clear privileged state and drafts.
- [x] Move every status into the right action area. Display Pending rather than Requested. Keep Accept and Request Reschedule for actual incoming Pending recipients, including an administrator's own incoming request from the all view. Never show recipient buttons to the requester or an unrelated administrator. Retain accepted online Join meeting and accessible Rescheduled disclosure.
- [x] Add tests exercising rendered own/all lists, administrator view access, missing/all error retries, view changes while dirty/saving and response refresh. Adjust the existing compact-card test to expect Pending in actions; use real browser measurement to verify geometry rather than jsdom CSS assertions.
- [x] Update acceptance panel and success feedback to explain both app calendars. Add a focused calendar refresh-on-focus/visible-return behavior that reloads only Appointments, aborts stale requests and preserves selected month and existing Event/Invite sources. Test an Accepted appointment arriving after focus, a cancelled/removed appointment disappearing, no duplicates, and no Event/Invite reload. Preserve existing error/partial-success rules.
- [x] Run affected UI/service/server/calendar tests and SDK tests green; self-review. Update the browser fixture assertions for right-hand badge bounds and 110px height at 1440/820; mobile remains accessible. Add administrator overview fixture checks with actual service/proxy request boundaries. Write report with exact files, red/green commands/results and concerns. Do not deploy or commit.

### Task 2: Review and integrated verification

- [x] Review the implementation against the confirmed spec and its before snapshots, including all-view authorization, personal calendar isolation, response permissions, continuation validation and focus refresh lifecycle. Resolve material findings before deploy.
- [x] Run full Vitest regression with two workers, production build, SDK tests and scoped browser scripts. Inspect desktop/card and administrator-view screenshots. Record actual counts and limits, not inferred success.

### Task 3: Deploy to the approved Test/UAT and verify

- [x] Capture current UAT metadata and original PAC profile. Verify exact environment/site before mutation. Register the reviewed rebuilt Appointments assembly with unchanged API/schema contract and read back binary/hash. Stage the verified build from fresh metadata; overlay only the reviewed Appointments proxy source. Preserve all existing settings, permissions, roles and Press Coverage source. Upload and restore original PAC profile.
- [x] Read back source/configuration and verify runtime uses the final assets. Use user-controlled sign-in for hosted checks; never read/export credentials/cookies or impersonate actors. Verify personal incoming/outgoing, admin `all`, calendar, badge/actions layout and existing module reads. If separate user sessions are unavailable, explicitly retain two-user acceptance as a limit instead of claiming it passed.
- [x] Update versioned ALM evidence, handoff and plan with actual results. Remove only exact test artifacts/records created by this run; no existing business record writes. No Production/restart. Report the UAT result and any genuine hosted verification limits.

Completed 17 October 2026. 868 tests/73files, build,55SDK,17axe+2browserboundary checks and scoped review PASS. UAT upload171.06s succeeded; signed assembly readback matches. All91settings/20permissions/6roles preserved and Press source unchanged. Hosted administrator personal/all views, right-side badges110px, seven pages and28observed API reads passed without console errors. No business records changed, no Production or restart. Separate real recipient acceptance/two-user calendars and a real race remain explicitly unverified; source/SDK/UI tests cover the contract. Evidence: `docs/alm/appointment-views-uat-deployment.json`.
