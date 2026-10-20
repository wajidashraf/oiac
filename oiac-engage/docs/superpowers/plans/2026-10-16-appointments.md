# Appointments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development for isolated implementation tasks and review. Keep remote UAT operations with the primary agent. Preserve the current feature branch and pre-existing uncommitted changes; do not create/stash/switch worktrees or stage broadly.

**Goal:** Implement secure two-party Appointments and add accepted appointments to My Calendar, preserving existing data sources and live behavior.

**Architecture:** Reuse the SPA, CSRF API, ContactLookup and calendar components. A dedicated Appointments ServerLogic endpoint invokes a solution-contained Dataverse Custom API/plugin that validates trusted actor identity, participant privacy, recipient-only state transitions and optimistic concurrency. One immutable Requester Contact lookup and a larger Meeting Link limit are the approved schema changes.

**Tech Stack:** React 19, TypeScript, React Router 7, Vite/Vitest, existing Playwright/axe, Power Pages ServerLogic, Dataverse SDK/.NET plugin. No new frontend dependencies.

## Global Constraints

- Approved spec: `docs/superpowers/specs/2026-10-16-appointments-design.md`.
- Existing branch `feature/press-coverage` contains user changes and the implemented Press Coverage feature. Preserve them. Pre-existing `flow.json` deletion and design folder remain untouched.
- No Production writes or deployment. UAT schema/backend additions are approved. Site deployment will be reviewed when concrete implementation is ready; restart approval remains separate and pending.
- Entity set `mss_appointments`; recipient navigation `mss_Contact`; new requester proposed `mss_Requester` must be verified after creation.
- Status: Pending 866530000, Accepted 866530001, Rejected 866530002, Rescheduled 866530003, Cancelled 866530004.
- Format: Microsoft Teams 1, Phone Call 2, In Person 3. Require HTTPS URL only for Teams acceptance. No invented meeting URL; retain Join Event labels elsewhere.
- Title max850; agenda/reason max100; Meeting Link approved increase100→2000.
- Dataverse dates UserLocal DateAndTime, stored as UTC instants. Appointments use America/New_York / server Windows Eastern Standard Time. Reject DST gaps; folds require explicit offset choice. No separate date/time columns.
- Agenda remains optional per explicit user prompt despite ApplicationRequired form metadata. Format is required.
- Pending→Accepted or Pending→Rescheduled only; recipient only. Rescheduled proposals stay unconfirmed, preserve preferred datetime, and are excluded from calendar. No unapproved requester-confirmation transition.
- Requester/recipient immutable. No ordinary global read/write, anonymous access, browser-supplied requester, arbitrary field updates or direct portal table CRUD.
- Current authenticated user comes from Server.User. A Dataverse Custom API actor parameter is supplied by that trusted endpoint, never accepted from browser input. The API is not exposed through generic portal actions.
- Local SDK/date helper tooling and raw metadata stay in ignored `.superpowers/`.
- Run npm test/build with escalated host context on this Windows environment, because Vite/esbuild cannot resolve ancestor paths in the restricted sandbox.

## Shared frontend and endpoint contract

Task 1 owns these exports in `src/features/appointments/appointmentTypes.ts`:

```ts
import type { ContactOption } from '../meetingReports/meetingReportTypes'
export const APPOINTMENT_STATUS = { pending: 866530000, accepted: 866530001, rejected: 866530002, rescheduled: 866530003, cancelled: 866530004 } as const
export const APPOINTMENT_FORMAT = { teams: 1, phone: 2, inPerson: 3 } as const
export type AppointmentPerson = { readonly id: string; readonly name: string }
export type AppointmentRecord = {
 readonly id: string; readonly title: string; readonly status: number; readonly statusLabel: string
 readonly meetingFormat: number; readonly meetingFormatLabel: string
 readonly preferredDateTime: string; readonly suggestedDateTime: string | null
 readonly agenda: string; readonly meetingLink: string | null; readonly reschedulingReason: string
 readonly requester: AppointmentPerson | null; readonly recipient: AppointmentPerson | null
 readonly rowVersion: string
}
export type AppointmentRequestDraft = {
 readonly title: string; readonly contact: ContactOption | null; readonly meetingFormat: number | null
 readonly preferredDate: string; readonly preferredTime: string; readonly preferredOffsetMinutes: number | null; readonly agenda: string
}
export type AppointmentRescheduleDraft = {
 readonly reason: string; readonly suggestedDate: string; readonly suggestedTime: string; readonly suggestedOffsetMinutes: number | null
}
export type AppointmentPage = { readonly appointments: readonly AppointmentRecord[]; readonly nextLink: string | null; readonly awaitingCount: number }
```

Endpoint: `/_api/serverlogics/appointments`. Standard transport `success/data` envelope wraps JSON `{ok:true,...}` or `{ok:false,error:{code,message}}`. Error codes: validation, unauthenticated, forbidden, conflict, unavailable. Never expose raw Dataverse errors or identity/account data.

- `GET ?view=incoming&page=1` or `view=outgoing`: `{ok:true,appointments:AppointmentRecord[],nextLink:null|string,awaitingCount:number}`. Bound page15; safe same-origin continuation includes only known view/page and optional calendar month.
- `GET ?view=calendar&month=2026-10&page=1`: only Accepted participant-authorized appointments in that Eastern calendar month. Administrators can read broader according to the configured role. Same page envelope.
- `GET ?view=contacts&q=term`: `{ok:true,contacts:[{id,name}]}`; limit15; eligible active portal identities, exclude self, return only ID/name.
- `POST {operation:'create',payload:{title,recipientId,meetingFormat,preferredDate,preferredTime,preferredOffsetMinutes,agenda}}` → `{ok:true,id}`.
- `POST {operation:'accept',id,expectedRowVersion,payload:{meetingLink}}` → `{ok:true,id}`.
- `POST {operation:'reschedule',id,expectedRowVersion,payload:{reason,suggestedDate,suggestedTime,suggestedOffsetMinutes}}` → `{ok:true,id}`.

The ServerLogic-to-CustomAPI command is `mss_AppointmentCommand` (unbound action), parameters `ActorContactId` Guid, `Command` String, `Payload` String; response `Result` String containing the normalized envelope above. ServerLogic constructs actor, command and JSON payload, adds `id=Server.Context.ActivityId` for create, and strips/rejects unknown browser keys. Plugin commands: incoming, outgoing, calendar, contacts, create, accept, reschedule. Read commands also independently enforce participant visibility; administrator access is derived from actual UAT site web-role membership, never a browser boolean. Each write requires a trusted actor and allowlisted operation-specific payload; generic CRUD is not exposed.

## Task 1: Types, service and Eastern date/time helpers

**Files:** create `src/features/appointments/appointmentTypes.ts`, `appointmentService.ts`, `appointmentDates.ts` and their tests. Own only this feature service/date/type surface.

**Interfaces:** `getAppointmentPage(view:'incoming'|'outgoing',nextLink?:string|null,signal?:AbortSignal):Promise<AppointmentPage>`; `getCalendarAppointments(month:string,signal?:AbortSignal):Promise<readonly AppointmentRecord[]>`; `searchAppointmentContacts(search:string,signal?:AbortSignal):Promise<readonly ContactOption[]>`; `createAppointment(draft:AppointmentRequestDraft):Promise<{id:string}>`; `acceptAppointment(record:AppointmentRecord,meetingLink:string):Promise<{id:string}>`; `rescheduleAppointment(record:AppointmentRecord,draft:AppointmentRescheduleDraft):Promise<{id:string}>`; `AppointmentSaveUncertainError` and `AppointmentConflictError`.

Date exports: `getEasternTimeOptions(date:string,time:string):readonly {dateTime:string;offsetMinutes:number;label:string}[]`; `formatAppointmentDateTime(utc:string):string`; `appointmentCalendarDate(utc:string):string|null`; `appointmentTimeLabel(utc:string):string`; `emptyAppointmentRequest():AppointmentRequestDraft`; `emptyAppointmentReschedule():AppointmentRescheduleDraft`. Use Intl America/New_York, bounded candidate offset discovery, strict calendar round-trip; do not hardcode DST offsets. No options for invalid/gap; two options for a fold. UTC input validation rejects malformed dates and noninstants.

- [x] Write and run red tests for winter/summer conversions, spring gap and fall fold:
  ```ts
  expect(getEasternTimeOptions('2026-03-08','02:30')).toEqual([])
  expect(getEasternTimeOptions('2026-11-01','01:30')).toHaveLength(2)
  expect(getEasternTimeOptions('2026-07-10','09:30')[0].dateTime).toBe('2026-07-10T13:30:00.000Z')
  ```
- [x] Implement types and dates; verify the red cases pass along with strict invalid-date cases.
- [x] Write and run red service tests for actual transport shape, payload allowlists/no requester, exact ID/version validation, safe continuation, cancellation, bounded contacts, UTC response shape, conflict handling and ambiguous-create lock.
  ```ts
  fetchMock.mockResolvedValue({success:true,data:JSON.stringify({ok:false,error:{code:'unavailable',message:'Try later'}})})
  await expect(createAppointment(validDraft)).rejects.toBeInstanceOf(AppointmentSaveUncertainError)
  ```
- [x] Implement using unchanged `powerPagesFetch`; only known pre-write errors allow another create. Validate required/length/format/HTTPS values before requesting. For fold require selected offset; for unique time fill the verified unique offset. Accept/reschedule send immutable record ID/current rowVersion, no unrelated fields.
- [x] Run focused tests and self-review. Report changed files, commands/results and any contract issue; do not stage or commit unrelated work.

## Task 2: Dataverse atomic action and Appointments ServerLogic

**Files:** create `backend/appointments/AppointmentCommandPlugin.cs`, compilation/test scripts, a small fake SDK test harness using the installed official SDK, registration manifest/docs; create `.powerpages-site/server-logic/appointments/appointments.js` and metadata/tests under `src/features/appointments/appointmentServer.test.ts`. Root owns actual remote registration and site YAML generation.

**Interfaces:** normalized frontend/HTTP contract above; CustomAPI `mss_AppointmentCommand(ActorContactId,Command,Payload)` → `Result` JSON. Handler `Oiac.Engage.Appointments.AppointmentCommandPlugin : IPlugin`. Use official `Microsoft.Xrm.Sdk` and `Microsoft.Crm.Sdk.Messages`, no external library dependency; JSON via platform `DataContractJsonSerializer` or another installed system API with supported plugin runtime. Do not write registration credentials into source.

- [x] Write executable red tests against the command handler with fake IOrganizationService. Include actor A/B/C privacy, requester cannot accept, forged fields, self-recipient/disabled eligibility, Pending-only transitions, unchanged preferred date after reschedule, nonpending conflicts and expected rowVersion mismatch. Add one race test that changes the row after retrieve and requires `UpdateRequest.ConcurrencyBehavior=IfRowVersionMatches` to fail without mutation.
- [x] Implement plugin command handling. Use context.UserId service, no system elevation. Resolve administrator membership from the exact approved site role (Administrators ID `6ec72c3e-4f1b-420f-9565-d20047b12c1f`) through verified Contact↔powerpagecomponent role association; inspect metadata instead of guessing intersect attributes. Filter list/count/calendar queries by participants; no ordinary global data. Query Contact eligibility using active/logon-enabled local username or external identity but return only id/name; exclude self and validate again on create. Never expose password/securitystamp/external identity values.
- [x] Convert local date/time through TimeZoneInfo Eastern Standard Time; reject malformed/gap/fold-without-matching-offset; enforce 1753+ UTC bounds. Create trusted Requester and recipient references; Pending status; bounded validated fields. Use row-version checked UpdateRequest for responses and preserve immutable participants/title/preferred date. Teams needs HTTPS<=2000, Phone/In Person need no URL. Reject unexpected states and unknown properties.
- [x] List pages15 with stable preferred date/id order and exact incoming Pending count; calendar month interpreted Eastern with UTC bounds. Retrieve linked participant names safely. Keep legacy requester null and show safe unknowns; never infer ownership from System User. Use actual formatted choice labels with verified fallback values.
- [x] Build plugin with strong-name signing and supported .NET target using installed PAC SDK assemblies; retain signing material only in ignored tooling. Produce reviewed registration manifest identifying API, assembly/type and input/output types. Registration metadata exact names recorded by root before publication.
- [x] Write and run red tests for ServerLogic proxy: anonymous/trusted identity, allowed methods/query/body keys, no client actor/admin acceptance, fixed action name/command, safe response wrapper, sanitized failures and source top-level function restrictions. Implement only get/post entries with nested helpers; no browser globals, dependencies, HTTP credentials or arbitrary API paths. Root can refine deterministic endpoint role YAML after code review.
- [x] Run handler and proxy tests, self-review, report build/test output and remaining limits. No remote mutation from this task.

## Task 3: Appointments page and accessible forms

**Files:** replace `src/pages/Appointments.tsx`, `Appointments.test.tsx`; create `src/features/appointments/AppointmentRequestForm.tsx`, `AppointmentResponseForm.tsx`, scoped `appointments.css` and optional feature-only draft guard. Task1 owns imported types/service/dates; do not edit them without coordination.

**Interfaces:** page props `{contactId?:string;isAdmin?:boolean;canCreate?:boolean}`. Service/date/type exports exactly as defined above. UI authorization supplementary; source record requester/recipient IDs determine actions, while server is authoritative.

- [x] Write and run red page tests for two ordered sections, exact pending count, selector/form layout and list persistence, create refresh, recipient-only accept/reschedule, actual format behavior, no requester impersonation, reset/cancel/focus, one expanded response, duplicate locks and failures preserving input.
  ```ts
  expect(screen.getByRole('heading',{name:'Meeting requests sent to you'})).toBeInTheDocument()
  expect(screen.getByText('2 awaiting response')).toBeInTheDocument()
  ```
- [x] Implement screenshot layout with inline Request Appointment panel; required title/contact/format/date/time; optional Agenda; use ContactLookup custom loader and scoped styles. Preserve current global CSS.
- [x] Implement inline Accept and Request Reschedule forms on incoming Pending cards only; require valid HTTPS link for Teams, no link field for Phone/In Person. Use date helper for unique/fold offsets and show Eastern Time. Reschedule requires reason/date/time, preserves original preferred time and shows proposal/reason in both lists. Display actual status labels.
- [x] Implement independent loading/empty/error/retry/pagination states, stale-load cancellation, dirty guards for cancel/type/card/navigation, save locks, safe external links, uncertain-create lock/check list and conflict refresh notice. Only one active form; preserve data on failures. Read-only/list failures must not reveal another user's data.
- [x] Test keyboard labels, focus and scoped styles; verify component tests and self-review. No App/Nav/Calendar edits from this task.

## Task 4: Approved UAT schema, metadata and action registration (root)

**Files:** create `scripts/appointments/` schema/registration definitions and sanitized metadata manifest, plus Appointments-only table permissions/site settings generated with the plugin's deterministic tools. Root alone performs remote mutations.

- [x] Precheck requester absence, exact original mss_meetinglink length and Contact-role association metadata; save before state. User has approved only one requester lookup, URL enlargement and solution-contained action/plugin.
- [x] Create optional Requester Contact lookup with noncascading relationship; increase Meeting Link MaxLength to2000 via supported metadata update; read back logical/nav/relation/limits. Add attributes/relation to CRMSolution and publish only the affected Appointment schema.
- [x] Generate authenticated endpoint assignment and participant Contact-scope read permissions through verified Requester/Recipient relations; Admin global Read; no anonymous/global ordinary grants or portal Delete. Keep direct `Webapi/mss_appointment/enabled=false`. Preserve existing Contact settings and all other table permissions.
- [x] Review Task2 handler and registration; inspect existing assembly/API names to avoid collisions, register signed assembly/plugin type, Custom API and 3 parameters/Result; include solution components. Set an appropriate existing Execute privilege; never publish a generic unrestricted mutation endpoint.
- [x] Read back source/hash/API metadata/solution membership and execute controlled nonmutating action tests. Do not test business writes as privileged actor while presenting them as portal authorization proof. Actual user-role security needs hosted portal sessions after deployment.

## Task 5: Routing, Home shortcut and independent Calendar integration (root)

**Files:** modify `src/App.tsx`, `components/PortalNav.tsx`, `components/RequirePortalRole.tsx`, `pages/Home.tsx`, `pages/MyCalendar.tsx`, `data/calendarData.ts` only if needed, and their related tests / EmptyStates assertions.

- [x] Write red routing/navigation tests: enabled Appointments route under Activity, correct authenticated props, anonymous denial, narrow pending participant exception and unchanged other protected routes/Coming Soon features. Add Home shortcut assertion while preserving Event Join Event behavior.
- [x] Enable only the implemented Appointments entry/shortcut, wire contact/admin props, and preserve Press Coverage routing.
- [x] Add injectable `loadAppointments(month,signal)` to MyCalendar with a separate effect/status/retry state; namespace mapped IDs `appointment:<guid>`. Preserve existing registration and Meeting Invite promises/logic. Calendar mapper accepts only statusAccepted records, valid UTC/ET date and safe Teams link.
- [x] Write red tests for accepted A/B visibility (server-service scope verified separately), no proposed/nonaccepted items, ET day/month around midnight/DST, deduplication, appointment-source failure preserving existing sources and existing-source failure preserving appointments. Pass an empty appointment loader in unrelated unit fixtures to avoid uncontrolled network requests.
- [x] Implement mapper and third source, verify targeted integration tests and the original Event/calendar/Meeting Invite tests. Keep existing display policy unchanged for existing event/invite items.

## Task 6: Review, browser verification and handoff

**Files:** add `scripts/verify-appointments.mjs`, update `docs/appointments.md`, schema manifest, this plan and approved spec progress.

- [x] Task-level spec/quality review: inspect code and tests; fix material findings. Broad final review checks trust boundaries, atomic update behavior, error handling and preservation of existing functionality.
- [x] Run standalone real-browser fixtures at widths1440/820/390: both lists, request/accept/reschedule panels, DST fold UI, dirty/cancel/history/save navigation, mobile overflow and scoped axe checks. Clearly label fixtures as local UI checks.
- [x] Run the complete regression suite and production build once integrated changes are stable:
  ```powershell
  npm test -- --reporter=dot --silent
  npm run build
  node scripts/verify-appointments.mjs
  ```
- [x] Record counts, exact schema/choices/action metadata, files, API ownership/permission design, UTC/ET policy, MyCalendar behavior, rescheduling boundary and hosted limits. Preserve raw/private inspection output outside deliverables.
- [x] Present concrete UAT deployment artifacts and remaining signed-in A/B/C/admin checks. Do not claim hosted persistence/authorization or Production readiness without evidence. Deploy site code only when covered by explicit deployment authorization; do not infer a cache restart approval.

## Recovery ledger

Before Appointments: Press Coverage integrated, 693 tests /67 files and production build passed; UAT upload succeeded. The user subsequently authorized deployment to the exact Test/UAT site and signed in to a visible, isolated Edge test session. No site restart is authorized.

Progress: implementation/review/build complete; 850 frontend/proxy tests, 52 SDK tests and 12 responsive/axe checks pass, including browser DST gap/fold checks. Approved UAT schema/action changes and site upload completed and read back. A fresh UAT backup preserved all 280 existing metadata files before six Appointments additions; subsequent hosted compatibility fixes also adjust the Press Coverage handler. Signed-in Appointments reads/form open-cancel and the existing-module regression crawl pass. Participant A/B/C persistence and race acceptance remain pending. Production untouched. Detailed current results are in docs/alm/appointments-uat-deployment.json.
