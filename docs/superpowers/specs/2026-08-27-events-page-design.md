# Events Page Design

## Goal

Replace the current Events page with the supplied event-directory design. The page presents a separate set of six organizational events, supports category filtering, and switches between list and month-calendar views. The Register and Add to Calendar controls are intentionally non-functional in this phase.

The Events records remain separate from My Calendar records. An event shown on this page does not automatically appear on My Calendar, and the page does not mutate either dataset.

## Architecture

Create a focused Events data module containing an `EventItem` contract and the six reference records. The model includes an ID, ISO date, title, category, location, page status, and registration state. Display labels such as the abbreviated date are derived from the ISO date rather than stored twice.

Extract the reusable month grid and month-navigation behavior from `MyCalendar` into a presentational calendar component. The component receives calendar-compatible records through props and owns only the selected-month state needed to render the grid. It does not import either page's dataset.

`MyCalendar` continues to supply its existing meetings and registered events and retains its legend, upcoming list, external links, and current behavior. `Events` supplies only the separate Events-page records. This shares calendar presentation without coupling the two data sources.

## Event Records

The page contains these records:

1. OIAC National Convention 2026 — Convention, October 15, 2026, Washington, D.C., Registration Open, registered.
2. Iranian American Rights Rally — Los Angeles — Rally, September 20, 2026, Los Angeles, CA, Upcoming, not registered.
3. Capitol Hill Advocacy Day — Advocacy Day, September 8, 2026, Washington, D.C., Upcoming, registered.
4. Volunteer Captain Briefing — Briefing, September 15, 2026, Microsoft Teams, Registration Open, not registered.
5. State Coalition Summit — Texas — Convention, August 28, 2026, Houston, TX, Completed, not registered.
6. Iranian American Heritage Month Kickoff — Rally, October 2, 2026, New York, NY, Upcoming, not registered.

## Page Structure and Visual Design

The page follows the supplied desktop and cropped references:

- A compact Back link returns to the home page.
- The serif `Events` heading is followed by “Rallies, conventions, advocacy days, and organizational briefings.”
- Category filters sit at the upper left: All, Convention, Rally, Advocacy Day, and Briefing.
- A segmented List/Calendar toggle sits at the upper right.
- List is the initial view.
- The list uses a two-column grid of bordered white cards on desktop and a single column on narrow screens.
- Each card places its category chip at the upper left and status chip at the upper right, followed by title, date/location metadata, and applicable actions.
- Convention, Rally, Advocacy Day, and Briefing chips use distinct muted colors consistent with the reference.
- Registered records display `✓ Registered`; other active records display `Register`.
- Completed records display no action row.
- Calendar and map-pin icons come from the existing `react-icons` dependency and are decorative beside readable text.

The page uses the application's existing container, header, footer, typography tokens, and muted green-gray palette. Spacing, borders, and font sizes are tuned to the reference rather than inherited from generic card styles.

## Interaction and State

`Events` owns two small pieces of state: the active category and active view.

- Selecting a category filters the visible records immediately.
- The active filter exposes pressed/selected state visually and semantically.
- Filtering applies to both list and calendar views.
- Switching views preserves the active filter.
- The Calendar view starts at September 2026 and supports the same previous/next month navigation as My Calendar.
- A month with no matching events still renders the complete month grid with no event pills.
- Register and Add to Calendar render as `button type="button"` controls with no click handlers or data changes in this phase.
- No Event-page interaction adds a record to My Calendar.

## Shared Calendar Boundary

The extracted calendar component accepts a normalized record shape containing ID, ISO date, title, and visual kind. Optional link behavior remains supplied by the consumer rather than assumed by the grid.

On My Calendar, item pills remain external links with their existing Teams or Outlook behavior. On Events, event pills are non-link labels because event detail navigation is outside scope. This preserves My Calendar while allowing both pages to share the month layout and navigation.

The My Calendar upcoming section remains page-specific and is not moved into the shared grid component.

## Power Pages Style Isolation

All Events-page selectors are rooted beneath `.oiac-events-page`. Shared-calendar selectors remain rooted beneath a dedicated calendar component class and are composed with page-root selectors where page-specific differences are necessary.

Controls explicitly set `appearance`, font, font size, line height, color, background, border, border radius, padding, alignment, and text decoration. Lists reset margin, padding, and list style. Card, chip, toggle, and icon rules do not depend on unscoped element selectors.

The Events stylesheet is loaded after the platform theme in the deployed bundle. Selector specificity must be sufficient to beat expected Power Pages and Bootstrap defaults without using `!important`. If a platform rule still wins in deployed computed styles, increase the component selector specificity locally rather than introducing global overrides.

A browser regression check will load the route with the project's Power Pages-compatible stylesheet stack and verify representative computed styles for the page heading, filter controls, view toggle, event cards, action buttons, and shared calendar. It will also check the two-column desktop layout, one-column mobile layout, and absence of page-level horizontal overflow.

## Accessibility and Responsive Behavior

The filter controls are real buttons with programmatic selected state. The view switch exposes a labeled control group and selected state for List and Calendar. All buttons retain visible keyboard focus.

Event cards use article semantics and level-three headings. Dates use `time` elements with machine-readable ISO values. Status and category remain readable text rather than color-only indicators.

On narrow screens, filters and view controls wrap without overlap, the two-column card grid becomes one column, action buttons wrap, and the shared calendar retains its established labeled horizontal-scroll behavior. Reduced viewport width must not create body-level horizontal scrolling.

## Empty States and Error Handling

Static in-memory data has no loading or request-error state in this phase. When a filter has no matching records, List view displays a concise `No events in this category` status message. Calendar view retains the month grid even when the selected month contains no matching records.

## Testing and Verification

Automated tests cover:

- The six supplied records and their categories, dates, statuses, and registration states.
- Default List view and All filter.
- Each category filter and the no-results state.
- List/Calendar switching and preservation of the active filter.
- Separate Events and My Calendar datasets.
- Inert Register and Add to Calendar controls.
- Shared calendar month navigation and Events-only rendering.
- Existing My Calendar links, legend, upcoming list, and month navigation after extraction.
- Document title and accessible control names/states.

Completion requires focused tests, the complete test suite, a TypeScript/Vite production build, the computed-style browser regression check, and desktop/mobile screenshots compared with the supplied reference.

## Out of Scope

This phase does not register a user, synchronize with Outlook, add Events records to My Calendar, persist filters or view choice, fetch Dataverse data, open event details, or modify authentication and navigation behavior.
