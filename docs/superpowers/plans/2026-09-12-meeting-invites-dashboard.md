# Meeting Invites Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's mocked Meeting Invites card with live, eligible Dataverse invitations and secure Accept mutations for the logged-in Contact.

**Architecture:** Add a focused Meeting Invite service that normalizes Power Pages Web API data, filters invitation audiences, joins contact-owned participant records, and performs idempotent create/update acceptance. Extend the existing dashboard hook with an isolated invitation state machine, then render the result through the current dashboard card with a five-row keyboard-scrollable viewport. Add minimal authenticated Web API settings and table permissions for the two new tables.

**Tech Stack:** React 19, TypeScript 5.7, Power Pages Web API, Dataverse OData, Vitest, Testing Library, existing OIAC CSS tokens.

## Global Constraints

- Accepted is numeric status `1`, Pending is `2`, and Rejected is `3`.
- Accepted is read-only; Pending, Rejected, and missing participant states expose **Accept**.
- Eligible invitations are `mss_meetingforall = true`, linked to the current Contact, or linked to the current Contact's District.
- Missing participants are created with status `1`, the current ISO acceptance time, Contact/Meeting Invite lookup binds, and `mss_name = "<Meeting title> - <Contact full name>"`.
- Existing Pending or Rejected participants are patched to status `1` with the current ISO acceptance time.
- Show at most five row heights before vertical scrolling; visually hide the scrollbar without disabling keyboard scrolling.
- Invitation failures remain isolated from reports and event registrations.
- Do not add rejection, unaccept, invite administration, meeting-link navigation, a new route, or unrelated dashboard redesign.
- Use the existing `powerPagesFetch` and `powerPagesRequest` helpers; do not add another CSRF or fetch wrapper.
- Do not deploy without a separate explicit deployment decision.

---

### Task 1: Add Meeting Invite Read Models and Eligibility Service

**Files:**
- Create: `oiac-engage/src/features/meetingInvites/meetingInviteTypes.ts`
- Create: `oiac-engage/src/features/meetingInvites/meetingInviteService.ts`
- Create: `oiac-engage/src/features/meetingInvites/meetingInviteService.test.ts`

**Interfaces:**
- Consumes: `powerPagesFetch`, GUID strings from the Power Pages session, supplied entity sets/relationship names.
- Produces: `MEETING_INVITATION_STATUS`, `MeetingInviteParticipant`, `MeetingInvite`, `MeetingInviteCollection`, and `getMeetingInvites(contactId, signal?)`.

- [ ] **Step 1: Write failing read-contract tests**

Create `meetingInviteService.test.ts`. Mock only `fetch`, allowing the real shared Power Pages client and service mapping to run. Use fixed IDs and complete Dataverse response envelopes.

Cover these observable behaviors:

```ts
test('loads only invitations for everyone, the current Contact, or the current District', async () => {
  // GET 1 returns the Contact fullname and District lookup.
  // GET 2 returns four complete invite records: all-users, direct, district, unrelated.
  // GET 3 returns the current Contact's participant records.
  const result = await getMeetingInvites(contactId)

  expect(result.contactFullName).toBe('Sara Rahimi')
  expect(result.invites.map((invite) => invite.id)).toEqual([
    allUsersInviteId,
    directInviteId,
    districtInviteId,
  ])
})
```

Assert the literal query contracts:

```ts
expect(contactUrl.pathname).toBe(`/_api/contacts(${contactId})`)
expect(contactUrl.searchParams.get('$select')).toBe('contactid,fullname,_mss_district_value')

expect(invitesUrl.pathname).toBe('/_api/mss_meetinginviteses')
expect(invitesUrl.searchParams.get('$select')).toBe(
  'mss_meetinginvitesid,mss_meetingenddate,mss_meetingforall,mss_meetingstartdate,mss_meetingtitle',
)
expect(invitesUrl.searchParams.get('$expand')).toBe(
  'mss_MeetingInvites_Contact_Contact($select=contactid),mss_MeetingInvites_mss_District_mss_District($select=mss_districtid)',
)

expect(participantsUrl.pathname).toBe('/_api/mss_meetinginviteparticipants')
expect(participantsUrl.searchParams.get('$filter')).toBe(`_mss_contact_value eq ${contactId}`)
```

Add separate tests for:

- no District still returning all-users/direct invitations;
- Accepted participant precedence over newer Pending/Rejected duplicates;
- start-date ascending order, invalid dates last, then ID tie-breaker;
- rejecting invalid Contact IDs and malformed Contact/invite/participant responses with `Meeting invitations could not be loaded.`.

Before each test, name the mutation it catches: wrong audience branch, wrong entity set/field, stale participant precedence, unstable ordering, or unsafe malformed mapping.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- src/features/meetingInvites/meetingInviteService.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because `meetingInviteTypes.ts`, `meetingInviteService.ts`, and `getMeetingInvites` do not exist.

- [ ] **Step 3: Add normalized public types**

Create `meetingInviteTypes.ts` with these exact public contracts:

```ts
export const MEETING_INVITATION_STATUS = {
  accepted: 1,
  pending: 2,
  rejected: 3,
} as const

export type MeetingInvitationStatus =
  typeof MEETING_INVITATION_STATUS[keyof typeof MEETING_INVITATION_STATUS]

export type MeetingInviteParticipant = {
  readonly id: string
  readonly contactId: string
  readonly meetingInviteId: string
  readonly status: MeetingInvitationStatus
  readonly acceptedOn: string | null
  readonly name: string | null
}

export type MeetingInvite = {
  readonly id: string
  readonly title: string
  readonly startDateTime: string | null
  readonly endDateTime: string | null
  readonly participant: MeetingInviteParticipant | null
}

export type MeetingInviteCollection = {
  readonly contactFullName: string
  readonly invites: readonly MeetingInvite[]
}
```

- [ ] **Step 4: Implement `getMeetingInvites`**

In `meetingInviteService.ts`:

- Validate brace-wrapped or plain GUIDs and normalize to lowercase.
- Define raw record types for the three response shapes.
- Build all query strings with `URLSearchParams` and the exact selections from Step 1.
- Start the Contact, invite collection, and contact-filtered participant requests together because all three require only the already-known Contact ID.
- Require the Contact response ID/full name and valid collection envelopes.
- Map only status values `1`, `2`, and `3`.
- Select one participant per invitation with priority Accepted, Pending, Rejected; compare valid `acceptedOn` timestamps within equal status and use ID last.
- Filter raw invites with this literal predicate:

```ts
const eligible = record.mss_meetingforall === true
  || contactIds.includes(contactId)
  || (districtId !== null && districtIds.includes(districtId))
```

- Sort valid eligible invitations by valid start timestamp ascending, invalid/missing start last, then normalized invite ID.
- Return only normalized public fields; do not return expanded Contact/District collections.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: all read-contract tests pass.

- [ ] **Step 6: Commit Task 1**

```powershell
git add -- oiac-engage/src/features/meetingInvites/meetingInviteTypes.ts oiac-engage/src/features/meetingInvites/meetingInviteService.ts oiac-engage/src/features/meetingInvites/meetingInviteService.test.ts
git commit -m "feat: load eligible meeting invites"
```

---

### Task 2: Add Idempotent Accept Mutations

**Files:**
- Modify: `oiac-engage/src/features/meetingInvites/meetingInviteService.ts`
- Modify: `oiac-engage/src/features/meetingInvites/meetingInviteService.test.ts`

**Interfaces:**
- Consumes: a current Contact ID/full name, `MeetingInvite`, and injectable acceptance time.
- Produces: `acceptMeetingInvite(input, acceptedAt?) => Promise<MeetingInviteParticipant>`.

- [ ] **Step 1: Write failing PATCH tests**

Add this input contract to the test imports:

```ts
type AcceptMeetingInviteInput = {
  readonly contactId: string
  readonly contactFullName: string
  readonly invite: MeetingInvite
}
```

For Pending and Rejected participants, call:

```ts
await acceptMeetingInvite(input, new Date('2026-09-12T14:30:00.000Z'))
```

Assert the real fetch boundary receives:

```ts
expect(fetch).toHaveBeenCalledWith(
  `/_api/mss_meetinginviteparticipants(${participantId})`,
  expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({
      mss_invitationstatus: 1,
      mss_acceptedon: '2026-09-12T14:30:00.000Z',
    }),
  }),
)
```

Assert the returned participant is Accepted while retaining its ID, Contact ID, Meeting Invite ID, and name.

- [ ] **Step 2: Write failing POST and recovery tests**

For a missing participant, assert this exact body:

```ts
{
  mss_name: 'District Briefing - Sara Rahimi',
  mss_invitationstatus: 1,
  mss_acceptedon: '2026-09-12T14:30:00.000Z',
  'mss_Contact@odata.bind': `/contacts(${contactId})`,
  'mss_MeetingInvite@odata.bind': `/mss_meetinginviteses(${inviteId})`,
}
```

Assert POST uses `/_api/mss_meetinginviteparticipants`, normalizes the `entityid` response header, and returns an Accepted participant.

Add a recovery test where POST throws or returns no entity ID and the narrow follow-up query returns an Accepted participant. Assert recovery filters by both lookup values:

```text
_mss_contact_value eq <contactId> and _mss_meetinginvite_value eq <inviteId>
```

Also test:

- an already-Accepted input performs no mutation and returns it unchanged;
- an invalid acceptance Date fails before fetch;
- empty full name/title fails before POST;
- a failed POST with no recovered Accepted participant rejects with safe application copy.

- [ ] **Step 3: Run the mutation tests and verify RED**

Run the Task 1 focused command. Expected: FAIL because `acceptMeetingInvite` does not exist.

- [ ] **Step 4: Implement the mutation**

Add to `meetingInviteService.ts`:

```ts
export type AcceptMeetingInviteInput = {
  readonly contactId: string
  readonly contactFullName: string
  readonly invite: MeetingInvite
}

export async function acceptMeetingInvite(
  input: AcceptMeetingInviteInput,
  acceptedAt: Date = new Date(),
): Promise<MeetingInviteParticipant>
```

Use `powerPagesRequest` for PATCH/POST so the existing verification-token path is retained. Return immediately for Accepted. PATCH Pending/Rejected. POST a missing participant with the exact lookup binds from Step 2.

Add a private `recoverAcceptedParticipant(contactId, inviteId)` that runs only after an uncertain POST result. It uses the standard participant selection/mapping logic and accepts only status `1`.

- [ ] **Step 5: Run the service suite and verify GREEN**

Run the Task 1 focused command. Expected: read and mutation tests all pass.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- oiac-engage/src/features/meetingInvites/meetingInviteService.ts oiac-engage/src/features/meetingInvites/meetingInviteService.test.ts
git commit -m "feat: accept meeting invitations"
```

---

### Task 3: Integrate Invitation State into the Dashboard Hook

**Files:**
- Modify: `oiac-engage/src/features/dashboard/useHomeDashboardData.ts`
- Modify: `oiac-engage/src/features/dashboard/useHomeDashboardData.test.tsx`

**Interfaces:**
- Consumes: `getMeetingInvites`, `acceptMeetingInvite`, and `MeetingInvite`.
- Produces additional `HomeDashboardData` fields: `meetingInvites`, `invitesStatus`, `acceptingInviteIds`, `inviteError`, `acceptInvite`, and `retryInvites`.

- [ ] **Step 1: Write failing dashboard-hook load tests**

Mock the external service boundary and add complete `MeetingInviteCollection` fixtures. Extend the existing primary hook test to assert:

```ts
expect(result.current.invitesStatus).toBe('ready')
expect(result.current.meetingInvites.map((invite) => invite.id)).toEqual([firstInviteId, secondInviteId])
expect(getMeetingInvites).toHaveBeenCalledWith(contactId, expect.any(AbortSignal))
```

Add tests proving:

- an invitation read failure sets only `invitesStatus = 'error'` while reports and registrations stay ready;
- `retryInvites()` reloads invitations without reloading reports or event registrations;
- missing Contact ID produces the invitation error state without calling the service;
- unmount aborts the invitation request signal.

- [ ] **Step 2: Run the hook test and verify RED**

```powershell
npm test -- src/features/dashboard/useHomeDashboardData.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because invitation fields and requests are absent.

- [ ] **Step 3: Add the isolated invitation load effect**

Extend `HomeDashboardData` with:

```ts
readonly meetingInvites: readonly MeetingInvite[]
readonly invitesStatus: DashboardLoadStatus
readonly acceptingInviteIds: ReadonlySet<string>
readonly inviteError: string | null
readonly acceptInvite: (inviteId: string) => Promise<void>
readonly retryInvites: () => void
```

Use a separate `inviteRetryKey` and effect from the report/event effect. On each load, reset invite data/status, create an AbortController, call `getMeetingInvites(contactId, signal)`, and store both `contactFullName` and invitations. Do not change report/event states from this effect.

- [ ] **Step 4: Write failing acceptance-state tests**

Add tests proving:

- Pending, Rejected, and missing-participant invitations call `acceptMeetingInvite` with the loaded full name and selected invite;
- two immediate `acceptInvite(id)` calls produce one service mutation;
- only that ID appears in `acceptingInviteIds` while pending;
- success replaces that invite's participant with the returned Accepted participant;
- failure sets `<title> could not be accepted. Try again.`, leaves the prior participant state unchanged, and clears the lock in `finally`;
- an Accepted invitation never calls the mutation service.

- [ ] **Step 5: Run acceptance tests and verify RED**

Run the Task 3 Step 2 command. Expected: load tests pass after Step 3; acceptance tests fail because the action is absent.

- [ ] **Step 6: Implement acceptance state**

Use a ref-backed `Set<string>` for synchronous duplicate-call protection and immutable Set state for rendering. Keep a `meetingInvitesRef` synchronized whenever invitation state is loaded or updated so the stable callback can find the latest invite by ID; return for missing or Accepted. Clear the previous invite error, await the service, update only the matching invitation in both the state and ref, catch to safe copy, and remove the ID from lock ref/state in `finally`.

Memoize `retryInvites` and `acceptInvite` with `useCallback`; use functional state updates so callbacks do not depend on the current invitation array.

- [ ] **Step 7: Run the hook suite and verify GREEN**

Run the Task 3 Step 2 command. Expected: all dashboard-hook tests pass.

- [ ] **Step 8: Commit Task 3**

```powershell
git add -- oiac-engage/src/features/dashboard/useHomeDashboardData.ts oiac-engage/src/features/dashboard/useHomeDashboardData.test.tsx
git commit -m "feat: manage meeting invites on dashboard"
```

---

### Task 4: Replace the Coming Soon Panel with the Live Five-Row UI

**Files:**
- Modify: `oiac-engage/src/pages/Home.tsx`
- Modify: `oiac-engage/src/pages/Home.test.tsx`
- Modify: `oiac-engage/src/data/dashboardData.ts`
- Modify: `oiac-engage/src/styles/theme.css`

**Interfaces:**
- Consumes: the six invitation fields/actions added to `HomeDashboardData`.
- Produces: live Meeting Invites rows, Accepted/Accept states, and an accessible five-row scroll viewport.

- [ ] **Step 1: Write failing live-panel tests**

Remove the mock-data expectation for Meeting Invites and add complete hook fixtures for Accepted, Pending, Rejected, and missing participant states.

Assert:

```ts
const panel = screen.getByRole('heading', { name: 'Meeting Invites' }).closest('article')!
expect(panel).not.toHaveAttribute('aria-disabled')
expect(within(panel).queryByText('Coming Soon')).not.toBeInTheDocument()
expect(within(panel).getByText('Accepted')).toHaveClass('status-badge--positive')
expect(within(panel).queryByRole('button', { name: /Accept accepted invite/ })).not.toBeInTheDocument()
expect(within(panel).getByRole('button', { name: 'Accept pending invite' })).toBeEnabled()
expect(within(panel).getByRole('button', { name: 'Accept rejected invite' })).toBeEnabled()
expect(within(panel).getByRole('button', { name: 'Accept new invite' })).toBeEnabled()
```

Click a button and assert the real component calls `acceptInvite` for its invite ID. With an accepting ID fixture, assert the matching button reads `Accepting <title>` and is disabled while another row remains enabled.

Add loading, empty, retryable collection-error, and acceptance-error tests using existing dashboard copy patterns.

- [ ] **Step 2: Write failing schedule and scroll tests**

Use a literal date fixture and assert `Sep 10, 2026 · 10:00 AM ET`.

Render six invitations and assert the list wrapper has:

```ts
expect(within(panel).getByRole('region', { name: 'Meeting Invites list' })).toHaveAttribute('tabindex', '0')
expect(within(panel).getAllByRole('listitem')).toHaveLength(6)
```

Load `theme.css?raw` and assert the rendered region matches concrete rules that set vertical scrolling, five-row maximum block size, and hidden scrollbar behavior. The production break each assertion catches is an unscrollable sixth row or a visible scrollbar.

- [ ] **Step 3: Run Home tests and verify RED**

```powershell
npm test -- src/pages/Home.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because Home still renders mocked, disabled invitations.

- [ ] **Step 4: Implement the live panel**

In `Home.tsx`:

- Remove the `meetingInvites` data import and the local Pending/Accepted tone helper.
- Destructure invitation state/actions from `useHomeDashboardData`.
- Remove `dashboard-panel--coming-soon`, `ariaDisabled`, and the Coming Soon meta from the Meeting Invites `ContentCard`.
- Render loading, empty, retry, and accept-error branches explicitly.
- Wrap the live `<ul>` in:

```tsx
<div className="dashboard-invite-scroll" role="region" aria-label="Meeting Invites list" tabIndex={0}>
```

- Render `StatusBadge tone="positive"` only for Accepted; otherwise render a compact button with accessible name `Accept ${invite.title}` or `Accepting ${invite.title}`.
- Add `formatInviteSchedule` using `Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })` and append ` ET`. Return `Schedule not available` for missing/invalid dates.

In `dashboardData.ts`, delete only the obsolete `MeetingInvite` type and `meetingInvites` constant.

- [ ] **Step 5: Add restrained responsive styles**

Retain current dashboard tokens. Move the invitation list border/background to `.dashboard-invite-scroll` and add:

```css
.dashboard-invite-scroll {
  max-block-size: calc(5 * var(--dashboard-row-height));
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  scrollbar-width: none;
}

.dashboard-invite-scroll::-webkit-scrollbar { display: none; }
.dashboard-invite-scroll:focus-visible { outline-offset: 2px; }
.dashboard-invite-list { border: 0; border-radius: 0; }
```

Style `.dashboard-invite-list button` with existing primary/quiet colors, at least `2.75rem` target height, and a visible disabled state. Allow row wrapping in the existing small-screen media query without changing the rest of the dashboard.

The intentional signature is the in-place state change from Accept to Accepted; add no extra decoration or motion.

- [ ] **Step 6: Run Home and design-regression tests and verify GREEN**

```powershell
npm test -- src/pages/Home.test.tsx src/styles/designRegression.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: all Home and style regressions pass.

- [ ] **Step 7: Commit Task 4**

```powershell
git add -- oiac-engage/src/pages/Home.tsx oiac-engage/src/pages/Home.test.tsx oiac-engage/src/data/dashboardData.ts oiac-engage/src/styles/theme.css
git commit -m "feat: show actionable meeting invites"
```

---

### Task 5: Add Minimal Power Pages Web API Settings and Permissions

**Files:**
- Create: `oiac-engage/src/features/meetingInvites/meetingInvitePowerPagesConfig.test.ts`
- Create through deterministic scripts: `oiac-engage/.powerpages-site/site-settings/Webapi-mss_meetinginvites-enabled.sitesetting.yml`
- Create through deterministic scripts: `oiac-engage/.powerpages-site/site-settings/Webapi-mss_meetinginvites-fields.sitesetting.yml`
- Create through deterministic scripts: `oiac-engage/.powerpages-site/site-settings/Webapi-mss_meetinginvites-disableodatafilter.sitesetting.yml`
- Create through deterministic scripts: `oiac-engage/.powerpages-site/site-settings/Webapi-mss_meetinginviteparticipant-enabled.sitesetting.yml`
- Create through deterministic scripts: `oiac-engage/.powerpages-site/site-settings/Webapi-mss_meetinginviteparticipant-fields.sitesetting.yml`
- Create through deterministic scripts: `oiac-engage/.powerpages-site/site-settings/Webapi-mss_meetinginviteparticipant-disableodatafilter.sitesetting.yml`
- Create through deterministic scripts: `oiac-engage/.powerpages-site/table-permissions/Authenticated-Meeting-Invites-Read-AppendTo.tablepermission.yml`
- Create through deterministic scripts: `oiac-engage/.powerpages-site/table-permissions/Authenticated-Owned-Meeting-Invite-Participants-Manage.tablepermission.yml`

**Interfaces:**
- Consumes: Authenticated Users web role ID `0353acdd-7b95-4c07-8997-ae95dafd978d`, expected Contact relationship `mss_meetinginviteparticipant_Contact_contact`, and the exact fields used by Tasks 1–2.
- Produces: deployed-site metadata enabling authenticated invite reads and contact-owned participant reads/creates/updates.

- [ ] **Step 1: Write a failing configuration inventory test**

Use eager raw globs so missing files produce assertion failures rather than unresolved-import compilation errors:

```ts
const settings = import.meta.glob(
  '../../../.powerpages-site/site-settings/*.sitesetting.yml',
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>
const permissions = import.meta.glob(
  '../../../.powerpages-site/table-permissions/*.tablepermission.yml',
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>
```

Find entries by their `name:`/`entityname:` values and assert:

- both tables are enabled;
- both `disableodatafilter` values are false;
- Meeting Invite fields equal:

```text
mss_meetinginvitesid,mss_meetingenddate,mss_meetingforall,mss_meetingstartdate,mss_meetingtitle,mss_MeetingInvites_Contact_Contact,mss_MeetingInvites_mss_District_mss_District
```

- participant fields equal:

```text
mss_meetinginviteparticipantid,mss_acceptedon,mss_contact,mss_Contact,_mss_contact_value,mss_invitationstatus,mss_meetinginvite,mss_MeetingInvite,_mss_meetinginvite_value,mss_name
```

- Meeting Invites permission is authenticated-only, Global scope, read/append-to true, and create/write/delete false;
- participant permission is authenticated-only, Contact scope through `mss_meetinginviteparticipant_Contact_contact`, read/create/write/append/append-to true, and delete false.

- [ ] **Step 2: Run the config test and verify RED**

```powershell
npm test -- src/features/meetingInvites/meetingInvitePowerPagesConfig.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: assertions fail because the settings and permissions are absent.

- [ ] **Step 3: Validate metadata names before writes**

Cross-check the exact supplied entity sets and relationship/navigation names against any available Dataverse/site metadata. The user-provided OData contract establishes:

```text
mss_meetinginviteses
mss_meetinginviteparticipants
mss_MeetingInvites_Contact_Contact
mss_MeetingInvites_mss_District_mss_District
_mss_contact_value
_mss_meetinginvite_value
```

Confirm or correct the expected write navigation properties `mss_Contact`, `mss_MeetingInvite` and Contact permission relationship `mss_meetinginviteparticipant_Contact_contact`. If live metadata is unavailable and these three names cannot be confirmed, stop before YAML/source writes and ask for their exact schema names.

- [ ] **Step 4: Generate settings through the Power Pages plugin scripts**

From the repository root, run these commands one at a time:

```powershell
node "C:\Users\Administrator\.codex\plugins\cache\power-platform-skills\power-pages\2.6.2\scripts\create-site-setting.js" --projectRoot "C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage" --name "Webapi/mss_meetinginvites/enabled" --value "true" --description "Enable Web API access for Meeting Invites" --type "boolean"
node "C:\Users\Administrator\.codex\plugins\cache\power-platform-skills\power-pages\2.6.2\scripts\create-site-setting.js" --projectRoot "C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage" --name "Webapi/mss_meetinginvites/fields" --value "mss_meetinginvitesid,mss_meetingenddate,mss_meetingforall,mss_meetingstartdate,mss_meetingtitle,mss_MeetingInvites_Contact_Contact,mss_MeetingInvites_mss_District_mss_District" --description "Allow only Meeting Invite fields required by the dashboard"
node "C:\Users\Administrator\.codex\plugins\cache\power-platform-skills\power-pages\2.6.2\scripts\create-site-setting.js" --projectRoot "C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage" --name "Webapi/mss_meetinginvites/disableodatafilter" --value "false" --description "Keep table permission filtering enabled for Meeting Invites" --type "boolean"
node "C:\Users\Administrator\.codex\plugins\cache\power-platform-skills\power-pages\2.6.2\scripts\create-site-setting.js" --projectRoot "C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage" --name "Webapi/mss_meetinginviteparticipant/enabled" --value "true" --description "Enable Web API access for Meeting Invite Participants" --type "boolean"
node "C:\Users\Administrator\.codex\plugins\cache\power-platform-skills\power-pages\2.6.2\scripts\create-site-setting.js" --projectRoot "C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage" --name "Webapi/mss_meetinginviteparticipant/fields" --value "mss_meetinginviteparticipantid,mss_acceptedon,mss_contact,mss_Contact,_mss_contact_value,mss_invitationstatus,mss_meetinginvite,mss_MeetingInvite,_mss_meetinginvite_value,mss_name" --description "Allow only Meeting Invite Participant fields required by the dashboard"
node "C:\Users\Administrator\.codex\plugins\cache\power-platform-skills\power-pages\2.6.2\scripts\create-site-setting.js" --projectRoot "C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage" --name "Webapi/mss_meetinginviteparticipant/disableodatafilter" --value "false" --description "Keep table permission filtering enabled for Meeting Invite Participants" --type "boolean"
```

- [ ] **Step 5: Generate permissions through the deterministic script**

```powershell
node "C:\Users\Administrator\.codex\plugins\cache\power-platform-skills\power-pages\2.6.2\scripts\create-table-permission.js" --projectRoot "C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage" --permissionName "Authenticated Meeting Invites Read AppendTo" --tableName "mss_meetinginvites" --webRoleIds "0353acdd-7b95-4c07-8997-ae95dafd978d" --scope "Global" --read --appendto
node "C:\Users\Administrator\.codex\plugins\cache\power-platform-skills\power-pages\2.6.2\scripts\create-table-permission.js" --projectRoot "C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage" --permissionName "Authenticated Owned Meeting Invite Participants Manage" --tableName "mss_meetinginviteparticipant" --webRoleIds "0353acdd-7b95-4c07-8997-ae95dafd978d" --scope "Contact" --contactRelationshipName "mss_meetinginviteparticipant_Contact_contact" --read --create --write --append --appendto
```

Do not add delete permission. Do not enable inner errors.

- [ ] **Step 6: Run config and existing Power Pages tests and verify GREEN**

```powershell
npm test -- src/features/meetingInvites/meetingInvitePowerPagesConfig.test.ts src/features/meetingReports/meetingReportPowerPagesConfig.test.ts src/features/eventRegistrations/eventRegistrationPowerPagesConfig.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: all configuration tests pass.

- [ ] **Step 7: Commit Task 5**

Stage the exact generated files plus the config test and commit:

```powershell
git add -- oiac-engage/src/features/meetingInvites/meetingInvitePowerPagesConfig.test.ts oiac-engage/.powerpages-site/site-settings/Webapi-mss_meetinginvites-enabled.sitesetting.yml oiac-engage/.powerpages-site/site-settings/Webapi-mss_meetinginvites-fields.sitesetting.yml oiac-engage/.powerpages-site/site-settings/Webapi-mss_meetinginvites-disableodatafilter.sitesetting.yml oiac-engage/.powerpages-site/site-settings/Webapi-mss_meetinginviteparticipant-enabled.sitesetting.yml oiac-engage/.powerpages-site/site-settings/Webapi-mss_meetinginviteparticipant-fields.sitesetting.yml oiac-engage/.powerpages-site/site-settings/Webapi-mss_meetinginviteparticipant-disableodatafilter.sitesetting.yml oiac-engage/.powerpages-site/table-permissions/Authenticated-Meeting-Invites-Read-AppendTo.tablepermission.yml oiac-engage/.powerpages-site/table-permissions/Authenticated-Owned-Meeting-Invite-Participants-Manage.tablepermission.yml
git commit -m "feat: configure meeting invite web api"
```

---

### Task 6: Final Verification and Deployment Handoff

**Files:**
- Verify only; modify files only if a failing test exposes a covered defect.

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: evidence-backed completion status and an explicit deploy/defer choice.

- [ ] **Step 1: Run all focused invitation tests**

```powershell
npm test -- src/features/meetingInvites/meetingInviteService.test.ts src/features/meetingInvites/meetingInvitePowerPagesConfig.test.ts src/features/dashboard/useHomeDashboardData.test.tsx src/pages/Home.test.tsx src/styles/designRegression.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

- [ ] **Step 2: Run the complete test suite**

```powershell
npm test -- --no-file-parallelism --maxWorkers=1
```

- [ ] **Step 3: Run the production build**

```powershell
npm run build
```

- [ ] **Step 4: Audit source and configuration**

Run `git diff --check`, inspect the complete implementation diff, and verify:

- the old `meetingInvites` mock import/data are removed;
- only status `1` renders Accepted;
- statuses `2`, `3`, and missing participant render Accept;
- accepted rows cannot invoke a mutation;
- each accept lock clears in `finally`;
- POST/PATCH use only the current Contact and selected invitation;
- invitation list loading/errors do not affect report/event state;
- six or more rows remain reachable through the five-row scroll region;
- no delete permission exists;
- unrelated `Minimal Volunteer Portal Design.make/` remains untouched.

- [ ] **Step 5: Record Integrate Web API skill usage**

Read `C:\Users\Administrator\.codex\plugins\cache\power-platform-skills\power-pages\2.6.2\references\skill-tracking-reference.md` and run its command with `--skillName "IntegrateWebApi"`.

- [ ] **Step 6: Present deployment choice**

Report the services, components, permissions, settings, focused/full test totals, build result, commits, and the documented Global-read privacy trade-off. Then ask whether to deploy using the `power-pages:deploy-site` workflow or leave the committed changes for later deployment. Do not deploy before that answer.
