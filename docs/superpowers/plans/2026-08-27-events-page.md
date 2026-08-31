# Events Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved responsive Events directory with separate data, category filtering, List/Calendar views, inert event actions, and a calendar grid shared safely with My Calendar.

**Architecture:** A focused Events data module owns the six standalone event records. A reusable `MonthCalendar` component owns selected-month navigation and receives normalized records plus an item-rendering callback; Events and My Calendar retain separate datasets and page-specific surrounding UI. Events styles are namespaced beneath `.oiac-events-page`, while shared calendar styles are rooted beneath `.oiac-month-calendar` to resist Power Pages and Bootstrap defaults.

**Tech Stack:** React 19, TypeScript 5.7, React Router 7, React Icons 5, Vitest, Testing Library, CSS Grid, Playwright.

## Global Constraints

- Keep Events records separate from My Calendar records.
- Do not make Register or Add to Calendar functional in this phase.
- Preserve the existing `/activity/events` and `/my-calendar` routes.
- Preserve My Calendar's current legend, upcoming list, links, and navigation behavior.
- Load no new runtime dependency.
- Root every Events selector beneath `.oiac-events-page` and explicitly reset interactive control appearance.
- Do not use `!important`; raise local component specificity if Power Pages styles win.
- Preserve all unrelated uncommitted workspace changes.
- Do not commit implementation files that already contained user changes before this task.

---

### Task 1: Standalone Events data model

**Files:**
- Create: `oiac-engage/src/data/eventsData.ts`
- Create: `oiac-engage/src/data/eventsData.test.ts`
- Modify: `oiac-engage/src/data/portalData.ts`
- Modify: `oiac-engage/src/data/portalData.test.ts`

**Interfaces:**
- Produces: `EventCategory`, `EventPageStatus`, `EventItem`, `eventItems`, `eventDateLabel(isoDate)`.
- Consumes: native local-calendar `Date` parsing from ISO `YYYY-MM-DD` strings.

- [ ] **Step 1: Write failing data tests**

```ts
import { describe, expect, test } from 'vitest'
import { eventDateLabel, eventItems } from './eventsData'

describe('Events data', () => {
  test('contains the six standalone reference events', () => {
    expect(eventItems).toHaveLength(6)
    expect(eventItems.map((item) => item.title)).toContain('OIAC National Convention 2026')
    expect(eventItems.map((item) => item.category)).toEqual([
      'Convention', 'Rally', 'Advocacy Day', 'Briefing', 'Convention', 'Rally',
    ])
  })

  test('formats an ISO date without timezone drift', () => {
    expect(eventDateLabel('2026-09-08')).toBe('Sep 8')
  })
})
```

- [ ] **Step 2: Run the tests and confirm the missing-module failure**

Run: `npm test -- src/data/eventsData.test.ts`

Expected: FAIL because `eventsData.ts` does not exist.

- [ ] **Step 3: Implement the model and six records**

```ts
export type EventCategory = 'Convention' | 'Rally' | 'Advocacy Day' | 'Briefing'
export type EventPageStatus = 'Registration Open' | 'Upcoming' | 'Completed'

export type EventItem = {
  id: string
  title: string
  date: `${number}-${number}-${number}`
  location: string
  category: EventCategory
  status: EventPageStatus
  registered: boolean
}

export function eventDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
    .format(new Date(year, month - 1, day))
}
```

Create the six approved records in screenshot order. Remove the obsolete `EventRecord` and `events` collection from `portalData.ts`, and update its generic collection test accordingly.

- [ ] **Step 4: Run focused data tests**

Run: `npm test -- src/data/eventsData.test.ts src/data/portalData.test.ts`

Expected: PASS.

---

### Task 2: Reusable month calendar extraction

**Files:**
- Create: `oiac-engage/src/components/MonthCalendar.tsx`
- Create: `oiac-engage/src/components/MonthCalendar.test.tsx`
- Modify: `oiac-engage/src/pages/MyCalendar.tsx`
- Modify: `oiac-engage/src/pages/MyCalendar.test.tsx`
- Modify: `oiac-engage/src/styles/theme.css`

**Interfaces:**
- Consumes: `buildMonthCells`, `monthLabel`, and records shaped as `MonthCalendarItem`.
- Produces: `MonthCalendar({ items, initialMonth, ariaLabelPrefix, renderItem })`.

```ts
export type MonthCalendarItem = {
  id: string
  date: `${number}-${number}-${number}`
  title: string
  kind: string
}

type MonthCalendarProps<T extends MonthCalendarItem> = {
  items: readonly T[]
  initialMonth: Date
  ariaLabelPrefix: string
  renderItem: (item: T) => ReactNode
  onMonthChange?: (month: Date) => void
}
```

- [ ] **Step 1: Write failing component tests**

Test the September 2026 heading, date placement, prior/next month accessible names, October navigation, and custom record rendering. The test must render `MonthCalendar` with a small local dataset and a `<span>{item.title}</span>` render callback.

- [ ] **Step 2: Run the tests and confirm failure**

Run: `npm test -- src/components/MonthCalendar.test.tsx`

Expected: FAIL because `MonthCalendar.tsx` does not exist.

- [ ] **Step 3: Extract the grid and navigation**

Move selected-month state, month labels, generated cells, grouping-by-date, weekday headers, date-cell accessible labels, and navigation buttons from `MyCalendar` into `MonthCalendar`. Keep consumers responsible for rendering each item.

Use `useMemo` for cells and grouped visible records, and preserve the current Sunday-first grid semantics.

- [ ] **Step 4: Refactor My Calendar to consume the shared component**

Pass `calendarItems`, the existing deterministic September 2026 initial month, and a render callback that returns the existing safe external link:

```tsx
<a
  className={`oiac-calendar__item oiac-calendar__item--${item.kind}`}
  href={item.joinUrl}
  target="_blank"
  rel="noreferrer"
  aria-label={joinLabel(item)}
  title={item.title}
>
  {item.title}
</a>
```

Expose the selected month from `MonthCalendar` through `onMonthChange` so My Calendar's page-specific Upcoming list stays synchronized.

- [ ] **Step 5: Run shared and My Calendar tests**

Run: `npm test -- src/components/MonthCalendar.test.tsx src/pages/MyCalendar.test.tsx src/data/calendarData.test.ts`

Expected: PASS with My Calendar behavior unchanged.

---

### Task 3: Events list, filters, and Calendar view

**Files:**
- Modify: `oiac-engage/src/pages/Events.tsx`
- Modify: `oiac-engage/src/pages/Events.test.tsx`
- Modify: `oiac-engage/src/pages/EmptyStates.test.tsx`

**Interfaces:**
- Consumes: `EventItem`, `eventItems`, `eventDateLabel`, and `MonthCalendar`.
- Produces: `Events({ items? })` with internal filter/view state.

- [ ] **Step 1: Replace legacy tests with failing behavior tests**

Test:

```tsx
expect(screen.getByRole('heading', { name: 'Events', level: 1 })).toBeInTheDocument()
expect(screen.getAllByRole('article')).toHaveLength(6)
expect(screen.getByRole('button', { name: 'All', pressed: true })).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: 'Rally' }))
expect(screen.getAllByRole('article')).toHaveLength(2)
expect(screen.queryByText('Capitol Hill Advocacy Day')).not.toBeInTheDocument()
await user.click(screen.getByRole('button', { name: 'Calendar' }))
expect(screen.getByRole('grid', { name: 'Events September 2026 calendar' })).toBeInTheDocument()
```

Also assert that action-button clicks do not change card labels, record counts, view, filter, or My Calendar data exports.

- [ ] **Step 2: Run Events tests and confirm legacy-layout failure**

Run: `npm test -- src/pages/Events.test.tsx src/pages/EmptyStates.test.tsx`

Expected: FAIL because filters, view controls, approved records, and shared calendar are absent.

- [ ] **Step 3: Implement the approved page structure**

Use `useState<EventCategory | 'All'>('All')` and `useState<'list' | 'calendar'>('list')`. Filter with `useMemo`. Render the Back link, heading, approved description, filter group, segmented view group, list cards, and Calendar view.

Use `LuChevronLeft`, `LuList`, `LuCalendarDays`, and `LuMapPin`. Render dates with `time dateTime={item.date}`. Use `aria-pressed` for filter and view buttons.

Render Registered, Register, and Add to Calendar controls according to the approved record state, with no `onClick` handlers. Completed records render no action row.

- [ ] **Step 4: Render Events through the shared calendar**

Normalize each filtered event to the `MonthCalendarItem` structural contract and render non-interactive event pills:

```tsx
<span className={`oiac-calendar__item oiac-calendar__item--event oiac-events-calendar__item`}>
  {item.title}
</span>
```

Start at September 2026 and keep filter state unchanged when the user switches views or months.

- [ ] **Step 5: Run focused page tests**

Run: `npm test -- src/data/eventsData.test.ts src/components/MonthCalendar.test.tsx src/pages/Events.test.tsx src/pages/MyCalendar.test.tsx src/pages/EmptyStates.test.tsx`

Expected: PASS.

---

### Task 4: Power Pages-resistant visual implementation and verification

**Files:**
- Modify: `oiac-engage/src/styles/theme.css`
- Create: `oiac-engage/scripts/verify-events-layout.mjs`
- Modify: `oiac-engage/src/styles/designRegression.test.ts`

**Interfaces:**
- Consumes: `.oiac-events-page` and `.oiac-month-calendar` DOM structure.
- Produces: reference-matched desktop/mobile layout and computed-style invariants.

- [ ] **Step 1: Add failing style-contract assertions**

Extend `designRegression.test.ts` to require `.oiac-events-page` scoping for card, filter, toggle, and action selectors, explicit `appearance: none` on interactive controls, and no `!important` in the Events section.

- [ ] **Step 2: Add a failing Playwright layout check**

The script opens `/activity/events` at 1600×900 and 390×844. It asserts:

- two card columns on desktop and one on mobile;
- active filter and List toggle computed backgrounds;
- explicit action-button border, background, font size, and line height;
- card border radius and background;
- no body-level horizontal overflow;
- Calendar toggle reveals the shared grid;
- the mobile grid scrolls inside its labeled region instead of widening the page.

- [ ] **Step 3: Implement namespaced styles**

Add an `.oiac-events-page` section that defines the page spacing, back link, compact serif heading, description, toolbar, filter chips, segmented toggle, card grid, cards, category/status chips, metadata, action row, buttons, empty state, and responsive breakpoints.

Every button rule explicitly sets `appearance`, font, line height, text decoration, color, background, border, radius, and padding. Every list resets margin, padding, and list style. Shared calendar structural rules move under `.oiac-month-calendar`; My Calendar-specific colors remain composed beneath `.oiac-calendar-page`.

- [ ] **Step 4: Run style and browser checks**

Run: `npm test -- src/styles/designRegression.test.ts`

Run with the Vite server available: `node scripts/verify-events-layout.mjs`

Expected: both commands PASS and print measured desktop/mobile layout values.

- [ ] **Step 5: Run complete verification**

Run: `npm test`

Run: `npm run build`

Expected: all Vitest suites pass and TypeScript/Vite production build exits 0.

- [ ] **Step 6: Capture and inspect final screenshots**

Capture `/activity/events` at desktop and mobile widths in List and Calendar views. Compare heading placement, toolbar alignment, card dimensions, chip treatment, two-to-one-column transition, internal calendar scrolling, and footer spacing with the supplied references. Correct only evidence-backed mismatches and rerun the affected checks.
