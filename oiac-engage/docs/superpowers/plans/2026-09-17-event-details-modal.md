# Event Details Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one accessible Event Details modal that opens from Event titles on Home, Events list/calendar views, and My Calendar.

**Architecture:** A focused `EventDetailsModal` consumes an already-loaded `EventItem`, owns safe URL/date presentation, and implements the app's established dialog accessibility behavior. Each page owns `{ event, trigger }` selection state; My Calendar additionally retains its loaded Event records so presentation-only calendar items can resolve back to full details without another request.

**Tech Stack:** React 19, TypeScript, React Testing Library, Vitest, react-icons, existing OIAC CSS tokens.

## Global Constraints

- Only an Event title opens the modal; surrounding cards, dates, statuses, and existing action controls do not.
- Do not issue a new Web API request when the modal opens.
- Show title, format, type, start, and end; show venue and description only when non-empty.
- Show **Join meeting** only for a valid HTTP/HTTPS `meetingUrl`, opening with `target="_blank"` and `rel="noopener noreferrer"`.
- Preserve registration, Add to Calendar, Edit, month navigation, and accepted Meeting Invite behavior.
- Preserve the current OIAC visual language and accessible focus/scroll behavior.
- Do not modify Dataverse schema, permissions, routes, or deployment configuration.

---

### Task 1: Build the shared Event Details modal

**Files:**
- Create: `src/features/events/EventDetailsModal.tsx`
- Create: `src/features/events/EventDetailsModal.test.tsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: `EventItem` from `src/features/events/eventTypes.ts`.
- Produces: `EventDetailsModal({ event, returnFocusTo, onClose })`.

- [ ] **Step 1: Write failing component tests**

Add a complete Event fixture and assert the real dialog renders its title, format, type, labeled start/end times, conditional venue/description, and safe Join meeting link. Add focused cases for omitted optional content, malformed URLs, invalid dates, Escape/backdrop/Close behavior, focus trapping, body scroll locking, and trigger-focus restoration.

```tsx
render(<EventDetailsModal event={event} returnFocusTo={trigger} onClose={onClose} />)
expect(screen.getByRole('dialog', { name: event.title })).toBeInTheDocument()
expect(screen.getByText('Virtual')).toBeInTheDocument()
expect(screen.getByText('Webinar')).toBeInTheDocument()
expect(screen.getByRole('link', { name: 'Join meeting' })).toHaveAttribute('href', event.meetingUrl)
```

- [ ] **Step 2: Run the modal test and verify RED**

Run: `npm test -- src/features/events/EventDetailsModal.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose`

Expected: FAIL because `EventDetailsModal` does not exist.

- [ ] **Step 3: Implement the modal and focused styling**

Implement a dialog with this public contract:

```tsx
export type EventDetailsModalProps = {
  readonly event: EventItem
  readonly returnFocusTo: HTMLButtonElement | null
  readonly onClose: () => void
}
```

Normalize `meetingUrl` through `new URL()` and accept only `http:`/`https:`. Trim venue and description before deciding whether to render them. Format valid timestamps with `Intl.DateTimeFormat`; render `Not available` for missing/invalid values. Use `role="dialog"`, `aria-modal`, close-button initial focus, Escape/backdrop closing, Tab focus wrapping, body scroll lock, and trigger focus restoration. Add `.event-details-modal*` and reusable Event-title-button styles using existing tokens.

- [ ] **Step 4: Run the modal test and verify GREEN**

Run the Step 2 command.

Expected: all Event Details modal tests pass without console errors.

- [ ] **Step 5: Commit the shared component**

```bash
git add src/features/events/EventDetailsModal.tsx src/features/events/EventDetailsModal.test.tsx src/styles/theme.css
git commit -m "feat: add event details modal"
```

### Task 2: Open Event details from Home Upcoming Events

**Files:**
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Home.test.tsx`

**Interfaces:**
- Consumes: `EventDetailsModal` and each existing `upcomingEvents: readonly EventItem[]` record.
- Produces: Event-title buttons in the Home Upcoming Events list.

- [ ] **Step 1: Write the failing Home interaction test**

Click `Registered Capitol Briefing` by its button role and assert its dialog appears with the fixture's metadata and Join meeting action. Assert the containing list item is not itself a button or link.

```tsx
await user.click(screen.getByRole('button', { name: 'Registered Capitol Briefing' }))
expect(screen.getByRole('dialog', { name: 'Registered Capitol Briefing' })).toBeInTheDocument()
expect(screen.getByRole('link', { name: 'Join meeting' })).toHaveAttribute('href', 'https://example.com/meeting')
```

- [ ] **Step 2: Run Home tests and verify RED**

Run: `npm test -- src/pages/Home.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose`

Expected: FAIL because Upcoming Event titles are non-interactive text.

- [ ] **Step 3: Implement Home selection state**

Import `EventDetailsModal` and `EventItem`, store `{ event, trigger } | null`, replace only the title `<span>` with a styled button, and render the modal beside the existing announcement modal. Close by clearing selection so the modal restores focus to the originating title button.

- [ ] **Step 4: Run Home tests and verify GREEN**

Run the Step 2 command.

Expected: all Home tests pass.

- [ ] **Step 5: Commit Home integration**

```bash
git add src/pages/Home.tsx src/pages/Home.test.tsx
git commit -m "feat: show event details from home"
```

### Task 3: Open Event details from Events list and calendar views

**Files:**
- Modify: `src/pages/Events.tsx`
- Modify: `src/pages/Events.test.tsx`

**Interfaces:**
- Consumes: `EventDetailsModal` and loaded `EventItem` records.
- Produces: title buttons in Event cards and the Events month calendar.

- [ ] **Step 1: Write failing Events interaction tests**

Add one test for list view and one for calendar view. In list view, click the title button and assert the correct dialog while Register, Add to Calendar, and admin Edit remain separate controls. In calendar view, switch views, click the title button in the grid, and assert the same dialog.

```tsx
await user.click(within(card).getByRole('button', { name: 'Volunteer Orientation Webinar' }))
expect(screen.getByRole('dialog', { name: 'Volunteer Orientation Webinar' })).toBeInTheDocument()
expect(within(card).getByRole('button', { name: 'Register' })).toBeInTheDocument()
```

- [ ] **Step 2: Run Events tests and verify RED**

Run: `npm test -- src/pages/Events.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose`

Expected: FAIL because list and calendar titles do not open a dialog.

- [ ] **Step 3: Implement Events selection state**

Add `{ event, trigger } | null` state and an `openEventDetails(event, trigger)` handler. Extend `EventCard` with an `onViewDetails` callback and replace only its title text with a button. Replace the static calendar renderer with a renderer that closes over `openEventDetails`. Render `EventDetailsModal` once at page level.

- [ ] **Step 4: Run Events tests and verify GREEN**

Run the Step 2 command.

Expected: all Events tests pass.

- [ ] **Step 5: Commit Events integration**

```bash
git add src/pages/Events.tsx src/pages/Events.test.tsx
git commit -m "feat: show event details from events page"
```

### Task 4: Open registered Event details from My Calendar

**Files:**
- Modify: `src/pages/MyCalendar.tsx`
- Modify: `src/pages/MyCalendar.test.tsx`

**Interfaces:**
- Consumes: loaded registered `EventItem[]`, `CalendarItem[]`, and `EventDetailsModal`.
- Produces: Event-only title buttons in the month grid and selected-month list; accepted Meeting Invite links remain unchanged.

- [ ] **Step 1: Write failing My Calendar interaction tests**

Update the registered-Event test to expect title buttons rather than direct Join links. Click the grid Event title and assert its details dialog and Join meeting action. Add an accepted Meeting Invite assertion proving its existing join link remains a link and does not open an Event dialog.

```tsx
await user.click(within(grid).getByRole('button', { name: registeredEvent.title }))
expect(screen.getByRole('dialog', { name: registeredEvent.title })).toBeInTheDocument()
expect(screen.getByRole('link', { name: 'Join meeting' })).toHaveAttribute('href', registeredEvent.meetingUrl)
```

- [ ] **Step 2: Run My Calendar tests and verify RED**

Run: `npm test -- src/pages/MyCalendar.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose`

Expected: FAIL because registered Event titles currently navigate directly to meeting URLs.

- [ ] **Step 3: Retain Event records and implement Event-only title controls**

Store the successfully loaded registered `EventItem[]` alongside mapped `CalendarItem[]`. Build an Event-by-ID map. For `kind === 'event'` with a matching Event record, render a title button in both calendar locations and open `EventDetailsModal`; never wrap the entire monthly row. Continue rendering accepted Meeting Invite items with their current safe join links or non-link fallback.

- [ ] **Step 4: Run My Calendar tests and verify GREEN**

Run the Step 2 command.

Expected: all My Calendar tests pass.

- [ ] **Step 5: Commit My Calendar integration**

```bash
git add src/pages/MyCalendar.tsx src/pages/MyCalendar.test.tsx
git commit -m "feat: show event details from calendar"
```

### Task 5: Verify the complete feature

**Files:**
- Verify only; change code only in response to a reproduced failing test.

**Interfaces:**
- Consumes: all completed feature tasks.
- Produces: a releasable, reviewed Event Details interaction.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- src/features/events/EventDetailsModal.test.tsx src/pages/Home.test.tsx src/pages/Events.test.tsx src/pages/MyCalendar.test.tsx src/components/MonthCalendar.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

- [ ] **Step 2: Run the complete test suite**

Run: `npm test -- --no-file-parallelism --maxWorkers=1 --reporter=verbose`

- [ ] **Step 3: Run the production build**

Run: `npm run build`

- [ ] **Step 4: Check the final diff and workspace ownership**

Run: `git diff --check`, `git status --short`, and inspect commits since `d362ee8`. Confirm `flow.json` and `Minimal Volunteer Portal Design.make/` were not staged or modified by this work.

- [ ] **Step 5: Request code review and address only verified findings**

Review the feature against the design spec, accessibility contract, interaction scope, and tests. Any fix must begin with a failing regression test.
