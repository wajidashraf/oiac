# Event Details Modal Design

## Goal

Let an authenticated user open complete Event details from an Event title on the Home dashboard, the Events page, or My Calendar without navigating away or changing any existing registration, editing, or meeting behavior.

## Interaction Model

Use one reusable `EventDetailsModal` component for all three entry points. Each consuming page owns the selected `EventItem`, the title button that opened it, and the close callback.

Only the Event title is interactive:

- On **Home**, the title in each Upcoming Events row opens the modal.
- On the **Events** page, the title in list cards and Calendar view opens the modal.
- On **My Calendar**, registered Event titles in the month grid and selected-month list open the modal.

Registration, Add to Calendar, Edit, month navigation, and accepted Meeting Invite interactions keep their current behavior. Accepted meeting titles do not open the Event modal.

## Modal Content

The modal receives an already-loaded `EventItem`; opening it must not issue another Web API request. It displays:

- Event title as the dialog heading.
- Event format.
- Event type.
- Start date and time.
- End date and time.
- Venue only when `venueName` contains a non-empty value.
- Description only when `description` contains a non-empty value.
- A **Join meeting** action only when `meetingUrl` is a valid HTTP or HTTPS URL.

Missing or invalid start/end timestamps display a clear `Not available` fallback. Unsafe or malformed meeting URLs are treated as absent. The Join meeting action opens in a new tab with `target="_blank"` and `rel="noopener noreferrer"`.

## Component and Data Flow

Create `src/features/events/EventDetailsModal.tsx` beside the existing Event types and form. The component accepts:

- `event: EventItem`
- `returnFocusTo: HTMLButtonElement | null`
- `onClose: () => void`

The component owns formatting and safe-link normalization so all entry points render the same content. Home and Events store `{ event, trigger }` in local state. My Calendar retains its loaded `EventItem` records and resolves registered calendar items back to their full Event record by normalized ID; Meeting Invite items never enter that lookup.

No Event schema, Web API query, registration rule, route, or Dataverse permission changes are required.

## Accessibility and Presentation

Follow the established modal behavior already used by Teams announcements:

- `role="dialog"`, `aria-modal="true"`, and a heading referenced by `aria-labelledby`.
- Focus moves to the Close button when opened.
- Focus remains trapped inside the dialog while open.
- Escape, the Close button, and a direct backdrop click close the modal.
- Page scrolling is locked while open and restored on close.
- Focus returns to the exact Event title button that opened the dialog.

Use the existing OIAC palette, typography, button classes, spacing rhythm, and modal proportions. Present format and type as compact metadata, dates as labeled semantic `<time>` values, and optional venue/description sections only when meaningful. The Event title buttons visually retain the current card, list-row, and calendar-item appearance with a clear hover and keyboard-focus state.

## Testing and Verification

- Component tests verify all required fields, optional field omission, safe Join meeting behavior, invalid-date fallback, Escape/backdrop/Close behavior, focus trapping, scroll locking, and focus restoration.
- Home tests verify an Upcoming Event title opens the correct modal.
- Events tests verify list and calendar title buttons open the modal while Register, Add to Calendar, and Edit remain separate controls.
- My Calendar tests verify a registered Event title opens the modal and an accepted Meeting Invite retains its existing join behavior without opening Event details.
- Run focused modal, Home, Events, My Calendar, and Month Calendar tests.
- Run the complete Vitest suite and the production build.

## Scope

This change adds Event-detail presentation and title-trigger interactions only. It does not add Event editing to the modal, change data loading, add deep links, alter accepted Meeting Invite details, deploy the site, or modify Dataverse configuration.
