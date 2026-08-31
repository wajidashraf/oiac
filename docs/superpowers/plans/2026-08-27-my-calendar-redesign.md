# My Calendar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved interactive month calendar and upcoming-list design on the existing `/my-calendar` route using static records.

**Architecture:** A focused calendar-data module owns the record contract and pure date-grid helpers. `MyCalendar` owns only the selected-month state and renders the generated cells and filtered records. Calendar-specific CSS is fully rooted beneath `.oiac-calendar-page` so Power Pages and Bootstrap defaults cannot alter the component.

**Tech Stack:** React 19, TypeScript 5.7, React Router 7, Vitest, Testing Library, CSS Grid.

## Global Constraints

- Keep the existing `/my-calendar` route.
- Use static records only; do not add Dataverse access.
- Previous and next month controls must update the grid and upcoming list.
- Every record must open its own Microsoft Teams or Outlook URL in a new tab with safe relationship attributes.
- Keep the desktop calendar panel approximately 490 pixels tall.
- Root every new page selector beneath `.oiac-calendar-page`.
- Preserve unrelated uncommitted workspace changes.

---

### Task 1: Calendar record model and date helpers

**Files:**
- Create: `oiac-engage/src/data/calendarData.ts`
- Create: `oiac-engage/src/data/calendarData.test.ts`
- Modify: `oiac-engage/src/data/portalData.ts`

**Interfaces:**
- Produces: `CalendarItem`, `calendarItems`, `buildMonthCells(year, monthIndex)`, `itemsForMonth(items, year, monthIndex)`, and `monthLabel(year, monthIndex)`.
- Consumes: native `Date` in local-calendar mode; ISO `YYYY-MM-DD` record dates.

- [ ] **Step 1: Write failing helper tests**

```ts
import { describe, expect, test } from 'vitest'
import { buildMonthCells, itemsForMonth, type CalendarItem } from './calendarData'

describe('calendar date helpers', () => {
  test('builds a Sunday-first five-week September 2026 grid', () => {
    const cells = buildMonthCells(2026, 8)
    expect(cells).toHaveLength(35)
    expect(cells[0]).toBeNull()
    expect(cells[2]?.day).toBe(1)
    expect(cells[31]?.day).toBe(30)
  })

  test('filters and sorts records for the selected month', () => {
    const items = [
      { id: '2', date: '2026-09-18', title: 'Meeting', kind: 'meeting', status: 'Accepted', time: '2:00 PM ET', location: 'Microsoft Teams', joinUrl: 'https://teams.microsoft.com/l/meetup-join/example' },
      { id: '1', date: '2026-09-08', title: 'Event', kind: 'event', status: 'Registered', time: 'All Day', location: 'Washington, D.C.', joinUrl: 'https://outlook.office.com/calendar/item/example' },
    ] satisfies CalendarItem[]
    expect(itemsForMonth(items, 2026, 8).map((item) => item.id)).toEqual(['1', '2'])
  })
})
```

- [ ] **Step 2: Run the tests and confirm the missing-module failure**

Run: `npm test -- src/data/calendarData.test.ts`

Expected: FAIL because `calendarData.ts` does not exist.

- [ ] **Step 3: Implement the record contract and pure helpers**

```ts
export type CalendarItem = {
  id: string
  date: `${number}-${number}-${number}`
  title: string
  kind: 'meeting' | 'event'
  status: 'Accepted' | 'Registered'
  time: string
  location: string
  joinUrl: string
}

export type MonthCell = { day: number; isoDate: string } | null

export function buildMonthCells(year: number, monthIndex: number): MonthCell[] {
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells: MonthCell[] = Array.from({ length: firstWeekday }, () => null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    const month = String(monthIndex + 1).padStart(2, '0')
    cells.push({ day, isoDate: `${year}-${month}-${String(day).padStart(2, '0')}` })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function itemsForMonth(items: readonly CalendarItem[], year: number, monthIndex: number) {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`
  return items.filter((item) => item.date.startsWith(prefix)).sort((a, b) => a.date.localeCompare(b.date))
}
```

Add three reference records for September and October 2026, with distinct Teams/Outlook URLs. Remove the obsolete `AgendaItem` model and `agendaItems` export from `portalData.ts`, then update its generic collection test to stop importing them.

- [ ] **Step 4: Run data tests**

Run: `npm test -- src/data/calendarData.test.ts src/data/portalData.test.ts`

Expected: PASS.

---

### Task 2: Interactive calendar page

**Files:**
- Modify: `oiac-engage/src/pages/MyCalendar.tsx`
- Modify: `oiac-engage/src/pages/MyCalendar.test.tsx`
- Modify: `oiac-engage/src/pages/EmptyStates.test.tsx`

**Interfaces:**
- Consumes: `CalendarItem`, `calendarItems`, `buildMonthCells`, and `itemsForMonth` from Task 1.
- Produces: `MyCalendar({ items?, initialMonth? })`, an accessible interactive month calendar.

- [ ] **Step 1: Replace the legacy page test with failing behavior tests**

Test the September 2026 heading, the two September record links, link `target` and `rel`, the absence of the October-only record, previous/next accessible button names, navigation to October, and the empty state after navigating to a record-free month. Render with `initialMonth={new Date(2026, 8, 1)}` for deterministic output.

```tsx
const user = userEvent.setup()
render(<MyCalendar initialMonth={new Date(2026, 8, 1)} />)
expect(screen.getByRole('heading', { name: 'September 2026' })).toBeInTheDocument()
expect(screen.getByRole('link', { name: /Join Congressional Outreach Training Session/i })).toHaveAttribute('target', '_blank')
await user.click(screen.getByRole('button', { name: 'Show October 2026' }))
expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument()
```

Update `EmptyStates.test.tsx` to pass `items={[]}` and expect `No upcoming items this month`.

- [ ] **Step 2: Run the page tests and confirm failure against the legacy layout**

Run: `npm test -- src/pages/MyCalendar.test.tsx src/pages/EmptyStates.test.tsx`

Expected: FAIL because the new controls, links, and copy are absent.

- [ ] **Step 3: Implement the interactive page**

Use `useState` for a first-of-month `selectedMonth`, compute cells and selected records with `useMemo`, and change months with `new Date(year, monthIndex + offset, 1)`. Render:

- Back link to `/`.
- `h1` title and approved description.
- Meeting/event legend.
- Calendar scroll region and fixed-height panel.
- Three-column month bar with real previous/next buttons.
- Seven weekday headers and generated date cells.
- Item links grouped by ISO date.
- Upcoming heading and record list with date tile, title, time/location, and status.
- Empty status message when the selected month has no records.

Each item link must use:

```tsx
<a href={item.joinUrl} target="_blank" rel="noreferrer" aria-label={`Join ${item.title} in Microsoft Teams or Outlook (opens in a new tab)`}>
```

- [ ] **Step 4: Run the focused page tests**

Run: `npm test -- src/pages/MyCalendar.test.tsx src/pages/EmptyStates.test.tsx`

Expected: PASS.

---

### Task 3: Scoped visual implementation and regression coverage

**Files:**
- Modify: `oiac-engage/src/styles/theme.css`
- Create: `oiac-engage/scripts/verify-calendar-layout.mjs`

**Interfaces:**
- Consumes: `.oiac-calendar-page` class structure from Task 2.
- Produces: reference-matched desktop layout and horizontally scrollable small-screen layout.

- [ ] **Step 1: Add a failing browser layout check**

Start the Vite server, open `/my-calendar`, and assert the rendered calendar panel is approximately 490 pixels high, contains seven equal weekday columns, and has no page-level horizontal overflow at desktop and mobile widths. Also check computed button appearance and the calendar scroll region's mobile overflow behavior.

The script exits non-zero when a computed layout invariant fails and prints the measured values for diagnosis.

- [ ] **Step 2: Run the regression test and confirm failure**

Run: `node scripts/verify-calendar-layout.mjs`

Expected: FAIL because the new calendar DOM and styles are absent.

- [ ] **Step 3: Replace legacy calendar styles with namespaced rules**

Define explicit styles for the page header, legend, scroll region, 490-pixel panel, month bar, navigation buttons, weekday headings, variable-row grid, cells, item pills, upcoming container, upcoming links, date tiles, metadata, status badges, hover, focus, and empty state. Set `appearance: none`, `border`, `background`, `font`, `line-height`, and padding on controls and links to neutralize platform defaults.

At `max-width: 47.99rem`, set the calendar inner width to at least `48rem`, keep the outer region scrollable, and stack each upcoming row's status beneath its details. Remove the obsolete `.calendar-layout`, `.date-card`, and `.timeline-list` declarations.

- [ ] **Step 4: Run focused tests and the production build**

Run: `npm test -- src/data/calendarData.test.ts src/pages/MyCalendar.test.tsx src/pages/EmptyStates.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 5: Run full verification**

Run: `npm test`

Expected: all suites PASS.

Run the local Vite preview, capture `/my-calendar` at desktop and mobile widths, and confirm the desktop panel height, month navigation, no horizontal page overflow, readable seven-column mobile grid, visible focus states, and reference-matched upcoming rows.
