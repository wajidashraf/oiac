# OIAC Engage Authenticated Home Dashboard Design

## Purpose

Redesign the authenticated OIAC Engage homepage to match `oiac-engage/homepageContent.png`. The page is a volunteer dashboard that brings meeting reports, activity totals, upcoming events, invitations, Teams resources, and recent submissions into one responsive view.

This change applies only to authenticated users. The anonymous landing page and native Power Pages authentication experience remain unchanged.

## Scope

### Included

- Replace the existing authenticated homepage content with the supplied volunteer dashboard layout.
- Retain the current authenticated header, navigation, footer, and sign-out behavior.
- Add a dashboard identity banner with Volunteer context and shortcut links.
- Add four summary metrics.
- Add the Meeting Reports table and its actions.
- Add Upcoming Events, Meeting Invites, Teams Announcements, and Training Resources.
- Add the Teams & Resources section.
- Add the Volunteer Submissions table.
- Add an authenticated `/report` route reserved for the separately designed Report page.
- Route both `+ Submit Report` and every report-row `Edit` action to `/report`.
- Provide typed local preview data for all dashboard sections.
- Make the entire dashboard responsive and accessible.

### Deferred

- The final Report page design and form behavior.
- Report creation, update, or selection state.
- Passing a report ID to the Report page.
- Dataverse or Power Pages Web API integration.
- Teams API integration or live document links.
- Changes to the anonymous homepage or native authentication pages.

## User Experience

### Authenticated dashboard

The authenticated homepage follows the supplied reference from top to bottom:

1. A light dashboard banner identifies the current workspace as `Volunteer` and exposes Activity, Events, Appointments, and Resources shortcuts.
2. Four equal summary cards show Activities Submitted, Meetings Requested, Events Registered, and Hours Volunteered.
3. Meeting Reports displays a section heading, a primary `+ Submit Report` action, and a compact table containing meeting, representative, date, outcome, and Edit actions.
4. A three-column information area contains Upcoming Events, Meeting Invites, and a stacked Teams Announcements/Training Resources column.
5. Teams & Resources contains Upcoming Meetings, Important Channels, and Recent Documents cards.
6. Volunteer Submissions closes the dashboard with a table of type, subject, date, and status.

The existing authenticated application shell remains around this content. The anonymous application branch never renders this dashboard.

### Report navigation

- `+ Submit Report` links to `/report`.
- Every `Edit` link in Meeting Reports also links to `/report`.
- No report identifier, query string, edit state, or prefilled data is passed.
- `/report` initially renders a small authenticated placeholder explaining that its design will be added separately.
- Anonymous access to `/report` follows the existing application boundary and redirects to `/SignIn?returnUrl=%2Freport`.

## Responsive Behavior

- At desktop widths, the layout closely follows the supplied image: four metrics, a full-width reports table, a three-column activity area, and a three-column Teams/resources area.
- At intermediate widths, multi-column sections reduce to two columns where practical.
- At mobile widths, cards stack in reading order, metric cards use a compact grid or single column, and section actions remain easy to reach.
- Data tables stay semantic and use an overflow wrapper rather than squeezing columns until labels become unreadable.
- Shortcut pills wrap without clipping.
- Touch targets remain at least 44 CSS pixels high where they are interactive.

## Visual Direction

The implementation reuses the established OIAC Engage visual system:

- muted green-gray primary controls and text;
- white cards with fine cool-gray borders;
- Source Serif 4 for restrained dashboard/display headings;
- Inter for navigation, data, controls, and body copy;
- compact spacing and low-shadow surfaces matching the supplied operational-dashboard design.

The dashboard banner is the signature element: the small volunteer symbol, uppercase `Dashboard` label, serif `Volunteer` title, and pill shortcuts establish role context without reintroducing the previous role-directory cards.

## Component and Data Boundaries

- `Home` owns page composition and document title.
- Focused components may be introduced for metrics, dashboard panels, and responsive tables when doing so keeps markup readable.
- Dashboard preview records live in a typed data module rather than inline JSX.
- Navigation uses React Router `Link` components for internal routes.
- No component initiates network requests or mutates server data in this phase.

Suggested data types cover:

- dashboard metrics;
- meeting reports;
- upcoming events;
- meeting invitations;
- announcements;
- training resources;
- Teams meetings, channels, and documents;
- volunteer submissions.

## Accessibility

- Use ordered heading levels and named sections.
- Use real tables for the two tabular datasets, including column headers.
- Give icon-only or symbolic content accessible text or mark decorative glyphs as hidden.
- Preserve visible keyboard focus for every link.
- Communicate invitation and submission status with text, not color alone.
- Maintain WCAG AA foreground contrast.
- Ensure horizontally scrollable tables remain keyboard reachable and do not cause page-level horizontal overflow.

## Testing and Verification

Implementation follows test-driven development.

Automated tests will verify:

- authenticated Home renders the Volunteer dashboard and all principal sections;
- the four metrics and representative preview records are present;
- `+ Submit Report` links to `/report`;
- every Meeting Reports `Edit` link points to `/report`;
- `/report` renders for authenticated users;
- anonymous `/report` redirects to `/SignIn?returnUrl=%2Freport`;
- existing authenticated navigation and anonymous behavior remain intact.

Final verification will include:

- the complete Vitest suite;
- the production TypeScript/Vite build;
- the browser accessibility audit;
- desktop, tablet, and mobile screenshots of the authenticated dashboard;
- visual comparison with `homepageContent.png`;
- `git diff --check` and repository-status review.

## Acceptance Criteria

- Authenticated `/` closely matches the supplied dashboard design and content hierarchy.
- Anonymous `/` is unchanged.
- The previous Welcome/quick-links/role-directory homepage is no longer rendered for authenticated users.
- Submit Report and every Edit action navigate to the same `/report` route.
- The Report route does not attempt to distinguish create and edit modes.
- All dashboard sections remain usable on desktop, tablet, and mobile.
- No live backend integration or deployment is performed as part of this design.
