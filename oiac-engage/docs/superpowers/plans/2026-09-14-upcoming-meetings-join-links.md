# Upcoming Meetings Join Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static Upcoming Meetings sample card with every future `mss_meetinginvites` record eligible for the signed-in Contact, ordered nearest-first and linked safely to its meeting platform.

**Architecture:** Extend the existing eligible meeting-invite query and domain model with `mss_meetinglink`; do not add a second Dataverse request. A pure selector derives future meetings without truncation, and `useHomeDashboardData` exposes that derived collection through the invite loading/error/retry lifecycle. `Home` renders the live card while keeping Important Channels and Recent Documents as individually disabled placeholders.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Dataverse Web API, Power Pages site settings, CSS.

## Global Constraints

- Read records from `mss_meetinginvites` and read the join URL from `mss_meetinglink`.
- Eligibility remains the existing union: Meeting For All, direct Contact, or matching District.
- Include records whose valid Meeting Date & Time is greater than or equal to the current instant, and exclude invalid or past dates.
- Sort all eligible future meetings by Meeting Date & Time ascending, using record ID as the deterministic tie-breaker; do not truncate the collection.
- Open only absolute `http:` and `https:` join URLs in a new tab; blank, malformed, and other-scheme URLs render as `Link unavailable`.
- The active link text is exactly `Join Link`, includes a meeting/video icon, and has an accessible name that identifies the meeting and new-tab behavior.
- Only Upcoming Meetings becomes active; Important Channels and Recent Documents remain disabled and marked `Coming Soon`.
- Reuse the current invite loading, error, empty, and retry lifecycle and do not deploy the site as part of this implementation.

---

## File Structure

- `src/features/meetingInvites/meetingInviteTypes.ts`: add the normalized meeting-link field to the domain record.
- `src/features/meetingInvites/meetingInviteService.ts`: request, validate, and map `mss_meetinglink` while preserving existing eligibility.
- `src/features/meetingInvites/meetingInviteService.test.ts`: prove query, mapping, URL safety, and eligibility behavior.
- `.powerpages-site/site-settings/Webapi-mss_meetinginvites-fields.sitesetting.yml`: allow the new Dataverse column through the Power Pages Web API.
- `src/features/meetingInvites/meetingInvitePowerPagesConfig.test.ts`: lock the allowlist requirement.
- `src/features/dashboard/upcomingMeetings.ts`: hold the pure future-filtering and stable-ordering selector.
- `src/features/dashboard/upcomingMeetings.test.ts`: cover boundary time, invalid dates, full collection, sort, and immutability.
- `src/features/dashboard/useHomeDashboardData.ts`: expose `upcomingMeetings` from the already loaded eligible invite collection.
- `src/features/dashboard/useHomeDashboardData.test.tsx`: prove derivation and accepted-participant synchronization.
- `src/data/dashboardData.ts`: remove obsolete sample Upcoming Meetings rows.
- `src/pages/Home.tsx`: render live meeting rows and isolate Coming Soon behavior to the other two cards.
- `src/pages/Home.test.tsx`: cover rows, links, missing links, states, and remaining placeholders.
- `src/styles/theme.css`: add scoped interactive and unavailable-link styling.

---

### Task 1: Extend the meeting-invite data contract

**Files:**
- Modify: `src/features/meetingInvites/meetingInviteTypes.ts`
- Modify: `src/features/meetingInvites/meetingInviteService.test.ts`
- Modify: `src/features/meetingInvites/meetingInviteService.ts`
- Modify: `src/features/meetingInvites/meetingInvitePowerPagesConfig.test.ts`
- Modify: `.powerpages-site/site-settings/Webapi-mss_meetinginvites-fields.sitesetting.yml`

**Interfaces:**
- Consumes: `getMeetingInvites(contactId: string, signal?: AbortSignal): Promise<readonly MeetingInvite[]>` and the existing eligibility filter.
- Produces: `MeetingInvite.meetingLink: string | null`, populated only with trimmed absolute HTTP(S) URLs.

- [ ] **Step 1: Write failing service and configuration tests**

Add `mss_meetinglink` to raw invite fixtures and assert that the decoded invite request contains it in `$select`. Assert a valid value such as `  https://teams.microsoft.com/l/meetup-join/briefing  ` maps to `https://teams.microsoft.com/l/meetup-join/briefing`. Add table-driven rows for `javascript:alert(1)`, `mailto:person@example.com`, `/relative/path`, malformed text, and whitespace, and assert each maps to `meetingLink: null`. Add `mss_meetinglink` to the required allowlist fields in `meetingInvitePowerPagesConfig.test.ts`.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```powershell
npm test -- src/features/meetingInvites/meetingInviteService.test.ts src/features/meetingInvites/meetingInvitePowerPagesConfig.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: failures report the absent `meetingLink` mapping, missing `$select` column, and missing Power Pages allowlist field.

- [ ] **Step 3: Implement the smallest data-layer change**

Add this required property:

```ts
readonly meetingLink: string | null
```

Add `mss_meetinglink` to `inviteSelect`, normalize it with a private helper equivalent to:

```ts
function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}
```

Map `meetingLink: safeHttpUrl(value.mss_meetinglink)` and append `mss_meetinglink` to the comma-separated site-setting value. Update every typed `MeetingInvite` fixture with an explicit `meetingLink` value.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run the Step 2 command. Expected: both files pass while existing Meeting For All, Contact, and District eligibility assertions remain green.

- [ ] **Step 5: Commit the data contract**

```powershell
git add src/features/meetingInvites/meetingInviteTypes.ts src/features/meetingInvites/meetingInviteService.ts src/features/meetingInvites/meetingInviteService.test.ts src/features/meetingInvites/meetingInvitePowerPagesConfig.test.ts .powerpages-site/site-settings/Webapi-mss_meetinginvites-fields.sitesetting.yml
git commit -m "feat: expose meeting invite join links"
```

### Task 2: Derive the complete ordered future-meeting collection

**Files:**
- Create: `src/features/dashboard/upcomingMeetings.ts`
- Create: `src/features/dashboard/upcomingMeetings.test.ts`
- Modify: `src/features/dashboard/useHomeDashboardData.ts`
- Modify: `src/features/dashboard/useHomeDashboardData.test.tsx`

**Interfaces:**
- Consumes: `readonly MeetingInvite[]` returned by the eligible invite service and a `Date` current-time boundary.
- Produces: `selectUpcomingMeetings(invites: readonly MeetingInvite[], now?: Date): readonly MeetingInvite[]` and `HomeDashboardData.upcomingMeetings`.

- [ ] **Step 1: Write failing selector tests**

Create fixtures with valid `meetingLink` fields and assert that, for `new Date('2026-09-14T12:00:00Z')`, a past row is excluded, a row exactly at the boundary is included, an invalid-date row is excluded, four future rows are all returned, ascending timestamps are enforced, equal timestamps use `id.localeCompare`, and the input array order is unchanged.

- [ ] **Step 2: Run the selector test and confirm RED**

Run:

```powershell
npm test -- src/features/dashboard/upcomingMeetings.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: failure because `selectUpcomingMeetings` does not exist.

- [ ] **Step 3: Implement the pure selector**

Implement a filter-plus-copy-sort function. Parse each start once per comparison helper; retain timestamps `>= now.getTime()`, reject non-finite timestamps, sort by timestamp, then by ID. Return `[]` for an invalid current time and never call `slice`.

- [ ] **Step 4: Run the selector test and confirm GREEN**

Run the Step 2 command. Expected: all selector cases pass.

- [ ] **Step 5: Write failing dashboard-hook tests**

Make invite fixtures date-stable using explicit past (`2000`) and future (`2099`) values. Mock `getMeetingInvites` with both and assert `meetingInvites` retains both while `upcomingMeetings` contains only future records in ascending order. In the existing acceptance test, also assert the corresponding `upcomingMeetings` participant becomes accepted.

- [ ] **Step 6: Run the hook test and confirm RED**

Run:

```powershell
npm test -- src/features/dashboard/useHomeDashboardData.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: failures report that `HomeDashboardData` has no `upcomingMeetings` property.

- [ ] **Step 7: Expose the derived collection from the hook**

Add `upcomingMeetings` to `HomeDashboardData`. Derive it from the current `meetingInvites` with `useMemo(() => selectUpcomingMeetings(meetingInvites), [meetingInvites])`, so a successful acceptance update changes both views without a second request. Return it alongside `meetingInvites`; existing invite status, error, and retry members remain the source for card states.

- [ ] **Step 8: Run selector and hook tests and confirm GREEN**

Run:

```powershell
npm test -- src/features/dashboard/upcomingMeetings.test.ts src/features/dashboard/useHomeDashboardData.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: both files pass.

- [ ] **Step 9: Commit the dashboard derivation**

```powershell
git add src/features/dashboard/upcomingMeetings.ts src/features/dashboard/upcomingMeetings.test.ts src/features/dashboard/useHomeDashboardData.ts src/features/dashboard/useHomeDashboardData.test.tsx
git commit -m "feat: derive eligible upcoming meetings"
```

### Task 3: Replace the static card with the live Upcoming Meetings UI

**Files:**
- Modify: `src/data/dashboardData.ts`
- Modify: `src/pages/Home.test.tsx`
- Modify: `src/pages/Home.tsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: `HomeDashboardData.upcomingMeetings`, `invitesStatus`, `retryInvites`, and each `MeetingInvite.meetingLink`.
- Produces: active Upcoming Meetings card with `Join Link`; disabled Important Channels and Recent Documents cards.

- [ ] **Step 1: Write failing page behavior tests**

Update `dashboardData()` and every invite fixture with `upcomingMeetings` and `meetingLink`. Assert all supplied upcoming rows render in their received order; a valid row exposes an anchor with accessible name `Join <title> in a new tab`, visible text `Join Link`, an SVG with `aria-hidden="true"`, the expected `href`, `target="_blank"`, and `rel="noreferrer"`; a null-link row shows `Link unavailable` and no anchor. Assert the old sample meeting names are absent.

Add one rerender-based test for `invitesStatus` values: loading shows `Loading upcoming meetings…`; error shows the invite error plus a button named `Try loading upcoming meetings again` that calls `retryInvites`; ready with an empty collection shows `No upcoming meetings.`

Update the Coming Soon test to assert the Teams & Resources section and Upcoming Meetings article are active, while Important Channels and Recent Documents each have `aria-disabled="true"`, the `dashboard-panel--coming-soon` class, and their own `Coming Soon` badge.

- [ ] **Step 2: Run the page test and confirm RED**

Run:

```powershell
npm test -- src/pages/Home.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: failures find the static sample card, missing links/states, and section-level disabled treatment.

- [ ] **Step 3: Implement the live card and scoped placeholders**

Remove the `upcoming-meetings` sample group from `teamResourceGroups`. In `Home`, remove section-level `aria-disabled` and Coming Soon styling, render an active `ContentCard` titled `Upcoming Meetings` before mapping the remaining groups, and use `LuCalendarDays` as its marker. Render the invite lifecycle states and every ready meeting as a list row with its title and `<time dateTime={meeting.startDateTime}>{formatInviteDate(meeting.startDateTime)}</time>`.

For a non-null URL, render:

```tsx
<a
  className="dashboard-team-list__action dashboard-team-list__action--link"
  href={meeting.meetingLink}
  target="_blank"
  rel="noreferrer"
  aria-label={`Join ${meeting.title} in a new tab`}
>
  <LuVideo aria-hidden="true" />
  <span>Join Link</span>
</a>
```

Otherwise render a noninteractive `.dashboard-team-list__action--unavailable` span containing `Link unavailable`. Give each remaining static `ContentCard` `ariaDisabled`, `dashboard-panel--coming-soon`, and its own `ComingSoonBadge`.

- [ ] **Step 4: Add theme-consistent interaction styling**

Scope new CSS to `.dashboard-team-list__action--link`, preserving the existing row typography and spacing. Use theme primary colors, no permanent underline, a visible underline/color change on hover, a visible `:focus-visible` outline with offset, and `cursor: pointer`. Style `.dashboard-team-list__action--unavailable` with muted text and no pointer behavior; size the link icon consistently with other dashboard inline icons.

- [ ] **Step 5: Run the page and dashboard regression tests**

Run:

```powershell
npm test -- src/pages/Home.test.tsx src/styles/designRegression.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: both files pass.

- [ ] **Step 6: Commit the live card**

```powershell
git add src/data/dashboardData.ts src/pages/Home.tsx src/pages/Home.test.tsx src/styles/theme.css
git commit -m "feat: show upcoming meeting join links"
```

### Task 4: Verify the integrated feature

**Files:**
- Test: all files changed in Tasks 1–3

**Interfaces:**
- Consumes: the completed data, selector, hook, and UI changes.
- Produces: fresh proof that the feature passes tests and production compilation.

- [ ] **Step 1: Run the complete relevant test set**

```powershell
npm test -- src/features/meetingInvites/meetingInviteService.test.ts src/features/meetingInvites/meetingInvitePowerPagesConfig.test.ts src/features/dashboard/upcomingMeetings.test.ts src/features/dashboard/useHomeDashboardData.test.tsx src/pages/Home.test.tsx src/styles/designRegression.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: every relevant test passes with zero failures.

- [ ] **Step 2: Run the entire test suite**

```powershell
npm test -- --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: every test file and test passes.

- [ ] **Step 3: Build the production bundle**

```powershell
npm run build
```

Expected: TypeScript and Vite complete successfully with exit code 0.

- [ ] **Step 4: Review the final diff and status**

```powershell
git diff HEAD~3 --check
git status --short
```

Expected: no whitespace errors; only the intended commits plus the pre-existing unrelated `Minimal Volunteer Portal Design.make/` untracked directory.

