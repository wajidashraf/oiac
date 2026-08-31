# My Calendar Redesign

## Goal

Replace the current agenda-only My Calendar page with the supplied month-calendar design. The page displays static meetings and registered events for now, supports real month navigation, lists the selected month's upcoming items, and opens each item's Microsoft Teams or Outlook URL in a new tab.

## Architecture

The existing `/my-calendar` route remains unchanged. `MyCalendar` owns the selected month and renders a page header, legend, generated month grid, and upcoming list. Date-grid generation is kept in small pure helpers so it can be tested independently and reused when static records are replaced with Dataverse records.

Calendar records expose an ID, ISO date, title, kind (`meeting` or `event`), status (`Accepted` or `Registered`), display time, location, and external join URL. `MyCalendar` continues to accept records through props, preserving a simple future integration boundary.

## Visual Design

The page follows the provided reference: a Back link, compact serif heading, explanatory text, two-item legend, bordered white calendar, centered month title, seven weekday columns, muted date labels, colored event pills, and a bordered upcoming list with date tiles and status badges.

On desktop, the calendar header and grid occupy approximately 490 pixels. The grid divides the remaining height evenly across the number of week rows in the selected month. On narrow screens the calendar keeps a usable minimum width inside a labeled horizontal-scroll region; upcoming rows adapt to the available width.

All page selectors are rooted beneath `.oiac-calendar-page`. Interactive controls explicitly define appearance, typography, spacing, borders, and colors with component-specific selectors so Power Pages and Bootstrap styles do not alter the design.

## Behavior

- Previous and next buttons move one calendar month at a time.
- The month heading, day grid, event placement, and upcoming list update together.
- Calendar event pills and upcoming rows open the record's Teams or Outlook URL in a new tab using `target="_blank"` and `rel="noreferrer"`.
- The upcoming list contains records in the selected month, sorted by date and then time.
- A selected month without records retains the full calendar and displays a clear empty-state message below it.

## Accessibility

Navigation buttons have month-specific accessible names. The calendar exposes grid semantics with column headers and date-cell labels. Item links include enough context to identify the item and destination. Keyboard focus is visible, and the horizontally scrolling calendar region is focusable and labeled on small screens.

## Testing and Verification

Automated tests cover initial month rendering, previous and next navigation, correct item placement, filtering and sorting of the upcoming list, safe external link attributes, the empty state, and the document title. Completion requires the targeted tests, full test suite, TypeScript production build, and a browser layout check when local preview tooling is available.

## Scope

This change uses static records only. Dataverse queries, authentication changes, calendar synchronization, record editing, and in-page meeting details are outside this implementation.
