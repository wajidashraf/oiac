# Coming Soon UI Design

## Goal

Keep planned Home and navigation features visible while making it unmistakable that they are unavailable and preventing users from navigating to unfinished experiences.

## Approved interaction

- Coming Soon items are fully non-interactive.
- They do not open a page, run unfinished logic, or show a popup.
- Each unavailable feature shows the same visible `Coming Soon` badge.
- Existing implemented features keep their current navigation and behavior.

## Home page behavior

The following Home sections display the shared badge:

- Meeting Invites
- Teams Announcements
- Training Resources
- Teams & Resources
- Volunteer Submissions

Training Resources and Teams & Resources retain their current sample content so users can see what is planned, but their item-level links become non-interactive text. Meeting Invites, Teams Announcements, and Volunteer Submissions retain their current read-only content.

The dashboard shortcuts that currently lead to Activity Log and Appointments become disabled, visibly badged items. Events and Resources remain normal links, as do Meeting Reports, Upcoming Events, and My Calendar.

## Navigation behavior

- The Activity menu remains expandable.
- Events remains a working link inside the Activity menu.
- Activity Log and Appointments render as disabled, non-link rows with the shared badge.
- Press Coverage renders as a disabled, non-link primary-navigation row with the shared badge.
- Existing application routes remain registered; this change only prevents the normal Home and navigation controls from sending users to incomplete pages.

## Component and styling approach

A small reusable `ComingSoonBadge` component provides one text label and CSS hook everywhere. Disabled Home shortcuts and navigation rows use semantic non-interactive elements with `aria-disabled="true"`; they are not buttons or anchors and do not enter the keyboard tab order.

The badge uses the existing theme tokens, compact pill shape, typography, and spacing. Disabled actions preserve the layout of the existing cards but use muted text and a default cursor. Responsive rules continue to give shortcut and navigation items full-width/touch-friendly layouts where the current design does so.

## Accessibility

- The visible `Coming Soon` text is exposed to assistive technology.
- Disabled items use `aria-disabled="true"` and have no `href` or click handler.
- Implemented links retain their accessible names and destinations.
- The UI does not use disabled buttons merely to display status.

## Verification

- Component tests verify all requested badges appear.
- Home tests verify incomplete shortcuts and content actions are no longer links.
- Navigation tests verify Activity Log, Appointments, and Press Coverage are disabled non-links while Events remains navigable.
- Existing tests verify already implemented Home and navigation behavior remains intact.
- Run focused tests, the full Vitest suite, and the production build.
