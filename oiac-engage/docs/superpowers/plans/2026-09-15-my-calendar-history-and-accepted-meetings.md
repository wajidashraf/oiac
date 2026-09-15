# My Calendar History and Accepted Meetings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every past and future registered Event and every past and future accepted Meeting Invite for the signed-in Contact on My Calendar.

**Architecture:** Keep Event Registration as the Event ownership boundary and reuse the existing Meeting Invite eligibility service. Add bounded Event-detail batching, pure calendar-item mapping for accepted meetings, timestamp-based ordering, and combine both asynchronous branches in `MyCalendar` without changing the existing visual structure.

**Tech Stack:** React 19, TypeScript 5.7, React Router 7, Vitest, Testing Library, Power Pages Web API.

## Global Constraints

- Include only Event Registrations whose status is Registered (`1`).
- Include past and future Events while retaining the existing Published, Registration Open, and Registration Closed Event-status allowlist.
- Include only Meeting Invites whose selected participant status is Accepted (`1`), including both past and future meetings.
- Preserve the existing Contact, District, and Meeting For All invite-eligibility rules.
- Preserve HTTP/HTTPS link validation, external-link attributes, accessibility semantics, responsive layout, and abort/retry behavior.
- Do not change Dataverse schema, Power Pages table permissions, deployment state, calendar synchronization, or record-editing behavior.
- Preserve unrelated workspace changes.

---

### Task 1: Load complete registered-Event history in bounded batches

**Files:**
- Modify: `src/features/events/eventService.test.ts:116-156`
- Modify: `src/features/events/eventService.ts:126-162`

**Interfaces:**
- Consumes: `getCalendarEvents(eventIds: readonly string[], signal?: AbortSignal)` and existing Event status values.
- Produces: the same `getCalendarEvents` signature, returning all allowed past and future matching Events with at most 50 Event IDs per request.

- [ ] **Step 1: Change the existing query test so past Events are eligible**

Rename the test to `loads past and future registered Event details without a current-time cutoff`. Keep the duplicate-ID assertion and change the expected filter to contain only the status allowlist and Event IDs:

```ts
expect(url.searchParams.get('$filter')).toBe(
  '(mss_eventstatus eq 866530001 or mss_eventstatus eq 866530002'
  + ' or mss_eventstatus eq 866530003 or mss_eventstatus eq 866530004)'
  + ` and (mss_eventsid eq ${calendarEventId})`,
)
expect(url.searchParams.get('$filter')).not.toContain('mss_startdatetime ge')
```

- [ ] **Step 2: Add a failing batching and deterministic-order test**

Add a test that supplies 101 valid unique GUIDs, returns a later Event from the first request and an earlier Event from the final request, and asserts 3 requests, a maximum of 50 ID clauses per request, and chronological result ordering:

```ts
test('batches more than 100 registered Event IDs and merges them chronologically', async () => {
  const ids = Array.from({ length: 101 }, (_, index) => (
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
  ))
  powerPagesFetchMock.mockImplementation(async (path) => {
    const filter = new URL(path, 'https://powerpages.local').searchParams.get('$filter') ?? ''
    const matchingIds = ids.filter((id) => filter.includes(id))
    return {
      value: matchingIds.map((id) => ({
        ...eventApiRecord,
        mss_eventsid: id,
        mss_startdatetime: id === ids[100]
          ? '2025-01-01T09:00:00Z'
          : '2027-01-01T09:00:00Z',
      })),
    }
  })

  const result = await getCalendarEvents(ids)

  expect(powerPagesFetchMock).toHaveBeenCalledTimes(3)
  expect(powerPagesFetchMock.mock.calls.every(([path]) => (
    ((new URL(path, 'https://powerpages.local').searchParams.get('$filter') ?? '')
      .match(/mss_eventsid eq/g)?.length ?? 0) <= 50
  ))).toBe(true)
  expect(result).toHaveLength(101)
  expect(result[0].id).toBe(ids[100])
})
```

- [ ] **Step 3: Run the Event service tests and verify RED**

Run:

```powershell
npm test -- src/features/events/eventService.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: the history assertion fails because the query still contains `mss_startdatetime ge`; the batching test fails because 101 IDs are rejected.

- [ ] **Step 4: Implement bounded queries without a time cutoff**

In `eventService.ts`, add `CALENDAR_EVENT_BATCH_SIZE = 50`, extract one batch request, and merge all batches:

```ts
const CALENDAR_EVENT_BATCH_SIZE = 50

async function getCalendarEventBatch(
  eventIds: readonly string[],
  signal?: AbortSignal,
): Promise<readonly EventItem[]> {
  const statusFilter = '(mss_eventstatus eq 866530001 or mss_eventstatus eq 866530002'
    + ' or mss_eventstatus eq 866530003 or mss_eventstatus eq 866530004)'
  const idFilter = `(${eventIds.map((id) => `mss_eventsid eq ${id}`).join(' or ')})`
  const params = new URLSearchParams({
    $select: EVENT_SELECT.join(','),
    $filter: `${statusFilter} and ${idFilter}`,
    $orderby: 'mss_startdatetime asc',
  })
  const response = await powerPagesFetch<unknown>(`/_api/mss_eventses?${params.toString()}`, {
    signal,
    headers: { Prefer: EVENT_PREFER },
  })
  if (!isRecord(response) || !Array.isArray(response.value)) {
    throw new Error('Registered events could not be loaded.')
  }
  return response.value.map(mapEventRecord)
}
```

Normalize and deduplicate IDs as today, split with `slice(index, index + CALENDAR_EVENT_BATCH_SIZE)`, load batches with `Promise.all`, flatten, and sort by parsed `startDateTime`, then ID. Wrap malformed records and request failures with `Registered events could not be loaded.` as the current contract requires.

- [ ] **Step 5: Run the Event service tests and verify GREEN**

Run the Step 3 command. Expected: every Event service test passes with no warnings.

- [ ] **Step 6: Commit Task 1**

```powershell
git add -- src/features/events/eventService.ts src/features/events/eventService.test.ts
git commit -m "feat: load complete registered event history"
```

---

### Task 2: Map accepted meetings and sort calendar items by timestamp

**Files:**
- Modify: `src/data/calendarData.test.ts:1-118`
- Modify: `src/data/calendarData.ts:1-86`

**Interfaces:**
- Consumes: `EventItem`, `MeetingInvite`, and `MEETING_INVITATION_STATUS.accepted`.
- Produces: `CalendarItem.startDateTime`, `acceptedMeetingInviteToCalendarItem(invite)`, and timestamp-ordered `itemsForMonth`.

- [ ] **Step 1: Add failing accepted-meeting mapping tests**

Import `MEETING_INVITATION_STATUS`, `MeetingInvite`, and `acceptedMeetingInviteToCalendarItem`. Create an accepted Meeting Invite and assert the full mapping:

```ts
const acceptedMeeting: MeetingInvite = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  title: 'District Briefing',
  startDateTime: '2025-08-12T18:00:00Z',
  endDateTime: '2025-08-12T19:00:00Z',
  meetingLink: 'https://teams.microsoft.com/l/meetup-join/district-briefing',
  participant: {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    contactId: '11111111-1111-4111-8111-111111111111',
    meetingInviteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    status: MEETING_INVITATION_STATUS.accepted,
    acceptedOn: '2025-08-01T12:00:00Z',
    name: 'District Briefing - Sara Rahimi',
  },
}

expect(acceptedMeetingInviteToCalendarItem(acceptedMeeting)).toMatchObject({
  id: acceptedMeeting.id,
  title: acceptedMeeting.title,
  kind: 'meeting',
  status: 'Accepted',
  startDateTime: acceptedMeeting.startDateTime,
  location: 'Online meeting',
  joinUrl: acceptedMeeting.meetingLink,
})
```

Add assertions that pending, rejected, missing-participant, and invalid-start invites return `null`. Add a no-link accepted invite assertion for `Meeting location unavailable` and `joinUrl: null`.

- [ ] **Step 2: Add a failing chronological-order test**

Add `startDateTime` to existing `CalendarItem` fixtures, then prove formatted labels do not control order:

```ts
const sameDayItems: readonly CalendarItem[] = [
  { ...records[0], id: 'late', date: '2026-09-18', startDateTime: '2026-09-18T21:00:00Z', time: '9:00 PM' },
  { ...records[0], id: 'early', date: '2026-09-18', startDateTime: '2026-09-18T10:00:00Z', time: '10:00 AM' },
]
expect(itemsForMonth(sameDayItems, 2026, 8).map(({ id }) => id)).toEqual(['early', 'late'])
```

- [ ] **Step 3: Run calendar-data tests and verify RED**

Run:

```powershell
npm test -- src/data/calendarData.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: TypeScript/test failures because the mapper and required timestamp field do not exist, and the existing string-time ordering is wrong.

- [ ] **Step 4: Implement the meeting mapper and timestamp ordering**

Extend `CalendarItem`:

```ts
startDateTime: string
```

Set it from `event.startDateTime` in `eventToCalendarItem`. Add:

```ts
export function acceptedMeetingInviteToCalendarItem(invite: MeetingInvite): CalendarItem | null {
  if (invite.participant?.status !== MEETING_INVITATION_STATUS.accepted) return null
  const date = eventCalendarDate(invite.startDateTime)
  if (!date) return null
  const joinUrl = safeHttpUrl(invite.meetingLink)
  return {
    id: invite.id,
    date,
    title: invite.title,
    kind: 'meeting',
    status: 'Accepted',
    startDateTime: invite.startDateTime,
    time: eventTimeLabel(invite.startDateTime, invite.endDateTime),
    location: joinUrl ? 'Online meeting' : 'Meeting location unavailable',
    joinUrl,
  }
}
```

Change `itemsForMonth` to compare `Date.parse(startDateTime)` and use `id.localeCompare` as the tie-breaker. Keep the function non-mutating.

- [ ] **Step 5: Run calendar-data and MonthCalendar tests and verify GREEN**

Run:

```powershell
npm test -- src/data/calendarData.test.ts src/components/MonthCalendar.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: both test files pass with no warnings.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- src/data/calendarData.ts src/data/calendarData.test.ts
git commit -m "feat: map accepted meetings into calendar"
```

---

### Task 3: Combine registered Events and accepted Meeting Invites in My Calendar

**Files:**
- Modify: `src/pages/MyCalendar.test.tsx:1-159`
- Modify: `src/pages/MyCalendar.tsx:1-229`

**Interfaces:**
- Consumes: `getEventRegistrations`, `getCalendarEvents`, `getMeetingInvites`, and `acceptedMeetingInviteToCalendarItem`.
- Produces: `MyCalendar` rendering both eligible record types with the existing grid/list UI and shared retry state.

- [ ] **Step 1: Expand the page-test fixture and dependency boundary**

Add `loadMeetingInvites` to `renderCalendar`, defaulting to an empty collection:

```ts
const loadMeetingInvites = vi.fn().mockResolvedValue({
  contactFullName: 'Sara Rahimi',
  invites: [],
})
```

Pass it to `MyCalendar`. Add `startDateTime` to any injected `CalendarItem` fixtures required by the new contract.

- [ ] **Step 2: Add a failing combined-history test**

Create one past and one future registered Event, plus one past and one future accepted Meeting Invite. Render the calendar in the past Event month, verify both loaders receive the signed-in Contact and the same abort signal type, navigate through the relevant months, and assert all four titles appear in their correct month grids and monthly lists.

Use Meeting Invite participant objects with `MEETING_INVITATION_STATUS.accepted`; use valid HTTP/HTTPS links for one Event and one meeting so existing accessible link behavior is also exercised.

- [ ] **Step 3: Add a failing meeting-status exclusion test**

Return accepted, pending, rejected, and participant-less invites from `loadMeetingInvites`. Assert only the accepted title appears and the other three titles are absent after loading.

- [ ] **Step 4: Update the empty-state expectation**

Change the empty-state heading assertion to `No registered events or accepted meetings yet`. Retain the Events browse link assertion.

- [ ] **Step 5: Run the My Calendar tests and verify RED**

Run:

```powershell
npm test -- src/pages/MyCalendar.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: the new prop/mapping behavior is absent, meeting titles do not render, and the empty-state copy does not match.

- [ ] **Step 6: Implement concurrent meeting and Event loading**

Add this prop:

```ts
readonly loadMeetingInvites?: (
  contactId: string,
  signal?: AbortSignal,
) => Promise<MeetingInviteCollection>
```

Default it to `getMeetingInvites`. At load time, start the invite request before awaiting registrations:

```ts
const meetingInvitesPromise = loadMeetingInvites(contactId, controller.signal)
const registeredEventsPromise = loadRegistrations(contactId, controller.signal).then(async (registrations) => {
  const registeredIds = Array.from(new Set(
    registrations
      .filter(({ status }) => status === EVENT_REGISTRATION_STATUS.registered)
      .map(({ eventId }) => eventId),
  ))
  return registeredIds.length > 0
    ? loadRegisteredEvents(registeredIds, controller.signal)
    : []
})

const [events, meetingCollection] = await Promise.all([
  registeredEventsPromise,
  meetingInvitesPromise,
])
```

Map Events with `eventToCalendarItem`, map invites with `acceptedMeetingInviteToCalendarItem`, discard `null`, combine with `acceptedItems`, and set the live-item count. Include `loadMeetingInvites` in the effect dependency list. Preserve the single error/retry state and abort controller.

- [ ] **Step 7: Update empty-state copy**

Use:

```tsx
<h2>No registered events or accepted meetings yet</h2>
<p>Register for an event or accept a meeting invitation to add it here.</p>
```

Keep the `Browse events` link.

- [ ] **Step 8: Run focused integration tests and verify GREEN**

Run:

```powershell
npm test -- src/pages/MyCalendar.test.tsx src/data/calendarData.test.ts src/components/MonthCalendar.test.tsx src/features/events/eventService.test.ts src/features/eventRegistrations/eventRegistrationService.test.ts src/features/meetingInvites/meetingInviteService.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: every focused test passes with no warnings.

- [ ] **Step 9: Commit Task 3**

```powershell
git add -- src/pages/MyCalendar.tsx src/pages/MyCalendar.test.tsx
git commit -m "feat: show accepted meetings on calendar"
```

---

### Task 4: Full regression verification

**Files:**
- Verify only; no planned source changes.

**Interfaces:**
- Consumes: the completed calendar, service, mapper, and tests from Tasks 1-3.
- Produces: fresh evidence that the repository test suite and production build remain healthy.

- [ ] **Step 1: Run the complete test suite**

```powershell
npm test -- --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: all test files and tests pass with zero failures.

- [ ] **Step 2: Run the production build**

```powershell
npm run build
```

Expected: TypeScript completes and Vite emits the production bundle successfully.

- [ ] **Step 3: Inspect the final diff and workspace state**

```powershell
git diff --check HEAD~3..HEAD
git status --short
```

Expected: no whitespace errors; only the pre-existing untracked `Minimal Volunteer Portal Design.make/` remains outside `oiac-engage`.
