# Legacy User Dashboard and Calendar Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent orphaned legacy Dataverse child rows from breaking dashboard schedules and My Calendar, distinguish API failures from successful-response processing failures, and make My Calendar available to every authenticated user without widening other route access.

**Architecture:** Keep Power Pages HTTP handling strict at the response boundary, but make collection-row mapping tolerant so one unusable legacy row cannot reject valid siblings. Dashboard widgets retain independent effects; My Calendar uses independent settled branches and renders partial success. The functional-role gate receives one explicit authenticated route exception for My Calendar.

**Tech Stack:** React 19, TypeScript 5.7, React Router 7, Vitest, Testing Library, Power Pages Web API.

## Global Constraints

- Preserve the existing Dataverse schema, table permissions, Web Roles, status values, and production data.
- Never display orphaned Event Registrations, Meeting Invite Participants, Meeting Invites, or unsafe links.
- Preserve meeting eligibility: meeting-for-all OR normalized Contact relationship OR normalized District relationship.
- Treat null, missing, or empty relationship expansions as empty collections.
- Normalize every GUID before storage or comparison.
- Do not log names, email addresses, response payloads, flow URLs, tokens, or other sensitive values.
- Preserve unrelated workspace changes, including the existing `flow.json` deletion and untracked design folder.
- Use test-first red-green cycles for every production behavior change.

---

### Task 1: Classify API failures and successful-response processing failures

**Files:**
- Modify: `src/shared/powerPagesApi.ts`
- Modify: `src/shared/powerPagesApi.test.ts`

**Interfaces:**
- Produces: `PowerPagesDataError`, `PowerPagesLoadFailureKind`, and `classifyPowerPagesLoadFailure(error)`.
- Preserves: `powerPagesFetch<T>(path, options)` and `PowerPagesApiError` public behavior.

- [ ] **Step 1: Write failing response-processing tests**

Add tests that return HTTP 200 with invalid JSON and assert a typed processing error, plus classification tests for non-2xx/network versus processing failures:

```ts
test('classifies HTTP success with invalid JSON as a processing failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{invalid', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })))

  const error = await powerPagesFetch('/_api/contacts').catch((value) => value)

  expect(error).toBeInstanceOf(PowerPagesDataError)
  expect(classifyPowerPagesLoadFailure(error)).toBe('processing')
})

test('classifies request and network failures as API failures', () => {
  expect(classifyPowerPagesLoadFailure(new PowerPagesApiError('request failed', 500))).toBe('api')
  expect(classifyPowerPagesLoadFailure(new TypeError('Failed to fetch'))).toBe('api')
})
```

- [ ] **Step 2: Run the shared API tests and verify RED**

Run:

```powershell
npm test -- src/shared/powerPagesApi.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: imports/assertions fail because the typed data error and classifier do not exist and invalid JSON is currently exposed as an untyped parsing exception.

- [ ] **Step 3: Implement the typed processing boundary**

Add:

```ts
export type PowerPagesLoadFailureKind = 'api' | 'processing'

export class PowerPagesDataError extends Error {
  constructor(message = 'The Power Pages response could not be processed.') {
    super(message)
    this.name = 'PowerPagesDataError'
  }
}

export function classifyPowerPagesLoadFailure(error: unknown): PowerPagesLoadFailureKind {
  return error instanceof PowerPagesDataError ? 'processing' : 'api'
}
```

In `powerPagesFetch`, preserve 204 handling and wrap only `response.json()` decoding failures as `PowerPagesDataError`. Do not include response bodies in the error or logs.

- [ ] **Step 4: Run the shared API tests and verify GREEN**

Run the Step 2 command. Expected: every shared API test passes.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- src/shared/powerPagesApi.ts src/shared/powerPagesApi.test.ts
git commit -m "feat: classify Power Pages processing failures"
```

---

### Task 2: Skip orphaned Event Registration rows without hiding valid registrations

**Files:**
- Modify: `src/features/eventRegistrations/eventRegistrationService.ts`
- Modify: `src/features/eventRegistrations/eventRegistrationService.test.ts`

**Interfaces:**
- Consumes: strict caller GUID validation and `PowerPagesDataError` from Task 1.
- Produces: the unchanged `getEventRegistrations` and `registerForEvent` signatures with tolerant collection-row mapping.

- [ ] **Step 1: Add the supplied older-user regression fixture**

Add a test with a valid Registered sibling and the confirmed orphaned row:

```ts
test('skips a legacy Registered row whose Event lookup is null', async () => {
  const valid = registrationRow(EVENT_REGISTRATION_STATUS.registered)
  fetchMock.mockResolvedValue({
    value: [{
      mss_eventregistrationid: '5a60fe67-4bb0-f111-aaac-7ced8d3c2947',
      _mss_contact_value: 'eba640d9-93a8-f111-b8de-000d3a5c63c8',
      _mss_event_value: null,
      mss_registrationdate: '2026-09-14T14:48:53Z',
      mss_registrationnumber: 'REG-1006',
      mss_registrationstatus: EVENT_REGISTRATION_STATUS.registered,
    }, valid],
  })

  await expect(getEventRegistrations(contactId)).resolves.toEqual([
    expect.objectContaining({ id: registrationId, eventId }),
  ])
  expect(console.warn).toHaveBeenCalledWith('[EventRegistrations] skipped unusable rows', {
    skippedCount: 1,
  })
})
```

Also assert `{ value: [] }` returns `[]` and a non-array envelope rejects with `PowerPagesDataError`.

- [ ] **Step 2: Run Event Registration tests and verify RED**

Run:

```powershell
npm test -- src/features/eventRegistrations/eventRegistrationService.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: the orphan test rejects the entire collection and the invalid-envelope test receives a generic error.

- [ ] **Step 3: Implement tolerant row mapping**

Split strict input validation from nullable response parsing:

```ts
function normalizeGuidOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/^\{+|\}+$/g, '').toLowerCase()
  return GUID_PATTERN.test(normalized) ? normalized : null
}

function mapRegistration(value: unknown): EventRegistration | null {
  if (!isRecord(value)) return null
  const id = normalizeGuidOrNull(value.mss_eventregistrationid)
  const contactId = normalizeGuidOrNull(value._mss_contact_value)
  const eventId = normalizeGuidOrNull(value._mss_event_value)
  const status = value.mss_registrationstatus
  if (!id || !contactId || !eventId || !isRegistrationStatus(status)) return null
  return {
    id,
    contactId,
    eventId,
    status,
    registrationDate: typeof value.mss_registrationdate === 'string'
      ? value.mss_registrationdate
      : null,
    registrationNumber: typeof value.mss_registrationnumber === 'string'
      ? value.mss_registrationnumber
      : null,
  }
}
```

For a valid `value` array, map once, retain non-null rows, and emit one sanitized warning only when `skippedCount > 0`. For an invalid envelope, throw `PowerPagesDataError('Event registration data could not be processed.')`. Keep `normalizeGuid` strict for caller-supplied Contact/Event IDs.

- [ ] **Step 4: Run Event Registration tests and verify GREEN**

Run the Step 2 command. Expected: all tests pass, including mutation/recovery behavior.

- [ ] **Step 5: Commit Task 2**

```powershell
git add -- src/features/eventRegistrations/eventRegistrationService.ts src/features/eventRegistrations/eventRegistrationService.test.ts
git commit -m "fix: tolerate orphaned event registrations"
```

---

### Task 3: Make Meeting Invite mapping resilient to legacy participants and empty relationships

**Files:**
- Modify: `src/features/meetingInvites/meetingInviteService.ts`
- Modify: `src/features/meetingInvites/meetingInviteService.test.ts`

**Interfaces:**
- Consumes: `PowerPagesDataError` from Task 1 and current Meeting Invite types/statuses.
- Produces: unchanged `getMeetingInvites` and `acceptMeetingInvite` signatures with normalized, tolerant reads.

- [ ] **Step 1: Add failing legacy participant and eligibility tests**

Add the supplied orphaned participant beside a valid participant and assert only the valid row is usable:

```ts
const orphanedParticipant = {
  mss_meetinginviteparticipantid: '62b6e1de-4ab0-f111-aaac-7ced8d3c2947',
  _mss_contact_value: 'eba640d9-93a8-f111-b8de-000d3a5c63c8',
  _mss_meetinginvite_value: null,
  mss_invitationstatus: MEETING_INVITATION_STATUS.accepted,
  mss_acceptedon: '2026-09-14T14:45:07Z',
  mss_name: 'test - Nabeel1 Ahmad',
}
```

Cover these cases separately:

- the orphan participant is skipped and eligible invites still resolve;
- absent/null Contact and District expansions behave as `[]`;
- uppercase/braced Contact and District GUIDs match normalized profile GUIDs;
- a missing District still permits meeting-for-all and direct-Contact invites but not District-only invites;
- empty invite/participant arrays return a ready empty collection;
- an invalid envelope throws `PowerPagesDataError`;
- a null full name uses `Portal user` without blocking reads.

- [ ] **Step 2: Run Meeting Invite tests and verify RED**

Run:

```powershell
npm test -- src/features/meetingInvites/meetingInviteService.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: null parent lookups and absent expansions reject; invalid envelopes use the wrong error type.

- [ ] **Step 3: Implement tolerant normalized mapping**

Use a nullable response GUID parser and keep strict caller validation. Change participant mapping to `MeetingInviteParticipant | null`, and change relationship mapping to return an empty list for non-arrays:

```ts
function relatedIds(value: unknown, key: 'contactid' | 'mss_districtid'): readonly string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const id = normalizeGuidOrNull(item[key])
    return id ? [id] : []
  })
}
```

Parse participants and invites with one pass each, retain usable rows, and issue sanitized aggregate warnings:

```ts
console.warn('[MeetingInvites] skipped unusable participant rows', { skippedCount })
console.warn('[MeetingInvites] skipped unusable invite rows', { skippedCount })
```

Require the profile envelope and matching normalized Contact ID. Treat invalid/missing District as `null`. Set `contactFullName` to a trimmed non-empty `fullname` or `Portal user`. Throw `PowerPagesDataError` only for invalid collection/profile envelopes, not individual legacy rows.

- [ ] **Step 4: Run Meeting Invite tests and verify GREEN**

Run the Step 2 command. Expected: all query, mapping, and acceptance tests pass.

- [ ] **Step 5: Commit Task 3**

```powershell
git add -- src/features/meetingInvites/meetingInviteService.ts src/features/meetingInvites/meetingInviteService.test.ts
git commit -m "fix: tolerate legacy meeting invite rows"
```

---

### Task 4: Expose scoped dashboard failure kinds without coupling widgets

**Files:**
- Modify: `src/features/dashboard/useHomeDashboardData.ts`
- Modify: `src/features/dashboard/useHomeDashboardData.test.tsx`
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Home.test.tsx`

**Interfaces:**
- Consumes: `classifyPowerPagesLoadFailure` and `PowerPagesLoadFailureKind` from Task 1.
- Produces: `registrationsFailureKind` and `invitesFailureKind` in `HomeDashboardData`.

- [ ] **Step 1: Add failing hook isolation and classification tests**

Test that:

- registration failure does not change `invitesStatus`, `reportsStatus`, or `announcementsStatus`;
- invite failure does not change the registration/report/announcement states;
- a `PowerPagesDataError` produces `processing`;
- a `PowerPagesApiError` or network error produces `api`;
- successful `[]` responses remain `ready` with no failure kind.

Example assertion:

```ts
vi.mocked(getMeetingInvites).mockRejectedValue(new PowerPagesDataError())
const { result } = renderHook(() => useHomeDashboardData(contactId))
await waitFor(() => expect(result.current.invitesStatus).toBe('error'))
expect(result.current.invitesFailureKind).toBe('processing')
expect(result.current.registrationsStatus).toBe('ready')
```

- [ ] **Step 2: Add failing Home copy tests**

Assert processing failures render account-data copy while API failures retain connection/retry copy. Keep the empty-state assertions distinct from errors.

- [ ] **Step 3: Run dashboard tests and verify RED**

Run:

```powershell
npm test -- src/features/dashboard/useHomeDashboardData.test.tsx src/pages/Home.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: failure-kind fields and processing-specific copy are absent.

- [ ] **Step 4: Implement independent failure-kind state**

Add nullable failure-kind state for registrations and invites. Reset it when loading/retrying, classify caught errors, and do not change any unrelated status in those catch branches. In `Home.tsx`, render safe section-specific copy:

```ts
const registeredEventsError = registrationsFailureKind === 'processing'
  ? 'Some saved event registration data could not be processed.'
  : 'Your registered events could not be loaded.'

const meetingInvitesError = invitesFailureKind === 'processing'
  ? 'Some meeting invitation data for this account could not be processed.'
  : 'Meeting invites could not be loaded.'
```

Upcoming Meetings continues using `invitesStatus`; its processing copy must also state that returned meeting data could not be processed. Preserve independent retry buttons and effects rather than introducing a page-wide `Promise.all`.

- [ ] **Step 5: Run dashboard tests and verify GREEN**

Run the Step 3 command. Expected: all dashboard hook and page tests pass.

- [ ] **Step 6: Commit Task 4**

```powershell
git add -- src/features/dashboard/useHomeDashboardData.ts src/features/dashboard/useHomeDashboardData.test.tsx src/pages/Home.tsx src/pages/Home.test.tsx
git commit -m "fix: distinguish dashboard data failures"
```

---

### Task 5: Render partial My Calendar results when one data branch fails

**Files:**
- Modify: `src/pages/MyCalendar.tsx`
- Modify: `src/pages/MyCalendar.test.tsx`

**Interfaces:**
- Consumes: resilient registration/invite services and failure classification.
- Produces: independent Event/Meeting branch states with unchanged loader prop signatures.

- [ ] **Step 1: Add failing partial-success tests**

Add separate tests proving:

- registered Events render when `loadMeetingInvites` rejects;
- accepted meetings render when `loadRegistrations` rejects;
- both failures show the full Calendar error state;
- a processing rejection produces processing-specific warning copy;
- both successful empty branches show the combined empty state;
- retry invokes both branches again;
- unmount aborts the shared signal.

For partial success, assert the successful title appears in the grid/list and the failed branch's scoped `role="alert"` appears without the full `Your calendar could not be loaded` heading.

- [ ] **Step 2: Run My Calendar tests and verify RED**

Run:

```powershell
npm test -- src/pages/MyCalendar.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: existing `Promise.all` sends the page to its full error state and hides the successful branch.

- [ ] **Step 3: Implement independent settled branches**

Start both branch promises immediately and await `Promise.allSettled`:

```ts
const [eventsResult, meetingsResult] = await Promise.allSettled([
  registeredEventsPromise,
  loadMeetingInvites(contactId, controller.signal),
])
```

Map fulfilled values, classify each rejection, and store branch status/failure kind. Combine fulfilled live items with `acceptedItems`. Render:

- loading until both initial branches settle;
- full error only when both reject;
- Calendar grid/list plus a scoped warning when one rejects;
- empty state only when both fulfill and produce no live/static items.

Retry increments the existing request key and restarts both branches. Preserve the single abort controller and ignore settled results after abort.

- [ ] **Step 4: Run My Calendar tests and verify GREEN**

Run the Step 2 command. Expected: all full-success, partial-success, empty, retry, and abort tests pass.

- [ ] **Step 5: Commit Task 5**

```powershell
git add -- src/pages/MyCalendar.tsx src/pages/MyCalendar.test.tsx
git commit -m "fix: preserve partial calendar results"
```

---

### Task 6: Make My Calendar available to every authenticated user only

**Files:**
- Modify: `src/components/RequirePortalRole.tsx`
- Modify: `src/pages/PendingApproval.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/PortalNav.test.tsx`

**Interfaces:**
- Consumes: authenticated session and existing functional-role checks.
- Produces: an explicit `calendarElement: ReactNode` exception in `RequirePortalRole`.

- [ ] **Step 1: Add failing authenticated-only route tests**

Change the denied-session route matrix so `/my-calendar` is no longer expected to redirect. Assert:

```ts
renderApp('/my-calendar', deniedSession)
expect(screen.getByRole('heading', { name: 'My Calendar', level: 1 })).toBeInTheDocument()
expect(screen.getByTestId('current-path')).toHaveTextContent('/my-calendar')
```

Assert `/contact`, `/report`, and `/activity/events` remain redirected. Add a Pending Approval assertion for a visible `My Calendar` link.

- [ ] **Step 2: Add failing admin and multi-role visibility tests**

Render `/my-calendar` with:

- `['Authenticated Users', 'Administrators']`;
- `['Authenticated Users', 'Volunteer', 'Administrators', 'Staff']` in non-priority order.

Assert the route renders and Primary Navigation contains the My Calendar link. Add a `PortalNav` test that My Calendar remains present regardless of the displayed primary role.

- [ ] **Step 3: Run routing/navigation tests and verify RED**

Run:

```powershell
npm test -- src/App.test.tsx src/components/PortalNav.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: authenticated-only Calendar access redirects to Pending Approval and that page has no Calendar link.

- [ ] **Step 4: Implement the narrow route exception**

Add `calendarElement: ReactNode` to `RequirePortalRoleProps`. Preserve full portal rendering when `hasPortalAccess(session)` is true. For an authenticated session without a functional role, render:

```tsx
<PendingApprovalShell>
  <Routes>
    <Route path="/my-calendar" element={calendarElement} />
    <Route path="/pending-approval" element={<PendingApproval />} />
    <Route path="*" element={<Navigate to="/pending-approval" replace />} />
  </Routes>
</PendingApprovalShell>
```

Pass `<MyCalendar contactId={completedSession.user.contactId} />` from `App.tsx`. Add a React Router `Link` to `/my-calendar` in `PendingApproval.tsx`. Do not alter `PORTAL_ACCESS_ROLES`, `hasPortalAccess`, or any other route.

- [ ] **Step 5: Run routing/navigation tests and verify GREEN**

Run the Step 3 command. Expected: authenticated-only Calendar access passes, all other denied routes remain blocked, and admin/multi-role navigation passes.

- [ ] **Step 6: Commit Task 6**

```powershell
git add -- src/components/RequirePortalRole.tsx src/pages/PendingApproval.tsx src/App.tsx src/App.test.tsx src/components/PortalNav.test.tsx
git commit -m "fix: allow authenticated My Calendar access"
```

---

### Task 7: Integrated regression verification

**Files:**
- Verify only; no planned production changes.

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: fresh evidence for legacy/new users, roles, missing District, empty data, valid HTTP 200 responses, full tests, and build.

- [ ] **Step 1: Run focused regression tests**

```powershell
npm test -- src/shared/powerPagesApi.test.ts src/features/eventRegistrations/eventRegistrationService.test.ts src/features/meetingInvites/meetingInviteService.test.ts src/features/dashboard/useHomeDashboardData.test.tsx src/pages/Home.test.tsx src/pages/MyCalendar.test.tsx src/App.test.tsx src/components/PortalNav.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: every focused file passes with no unhandled errors or warnings except explicitly asserted sanitized skip diagnostics.

- [ ] **Step 2: Run the complete test suite**

```powershell
npm test -- --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: all repository tests pass with zero failures.

- [ ] **Step 3: Run the production build**

```powershell
npm run build
```

Expected: TypeScript and Vite finish successfully.

- [ ] **Step 4: Inspect final history and workspace state**

```powershell
git diff --check f6356ff..HEAD
git status --short
git log --oneline f6356ff..HEAD
```

Expected: no whitespace errors; only the user's pre-existing `flow.json` deletion and untracked `Minimal Volunteer Portal Design.make/` remain outside the feature commits.
