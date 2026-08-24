# OIAC Engage React SPA Design

## Summary

OIAC Engage is a Power Pages single-page application for authenticated external members. The first delivery is a structured React UI starter: it establishes routing, navigation, reusable page structure, and realistic static page content while intentionally deferring authentication, Dataverse integration, and the organization theme.

The project will be created in `oiac-engage/` beneath the current workspace.

## Goals

- Create a Power Pages-compatible React SPA foundation using Vite.
- Provide all requested pages and nested Activity navigation.
- Make each page useful as a static UI starting point rather than an empty placeholder.
- Keep the component and styling boundaries ready for the existing theme, authentication, and Dataverse services to be added later.
- Provide an accessible and responsive baseline.

## Non-goals

- Connecting to Dataverse or any other live data source.
- Configuring sign-in, identity providers, route guards, web roles, or table permissions.
- Applying the final OIAC visual theme or brand assets.
- Implementing backend contact-form delivery, appointment booking, calendar synchronization, or report generation.
- Deploying the site without a separate user approval after local review.

## Architecture

The app will use React, Vite, and React Router. A shared `AppShell` will own the header, responsive navigation, main landmark, and footer. Route components will be kept separate from shared UI components so page internals can later be connected to Dataverse without changing navigation or layout.

Future authentication and data access will be introduced behind provider and service boundaries. During this UI-first phase, all routes remain directly accessible, and page content is supplied by local static data.

## Routes and pages

| Page | Route | Initial UI |
|---|---|---|
| Home | `/` | Member welcome, portal shortcuts, and a concise activity overview |
| My Reports | `/my-reports` | Static report summary cards and a report-list structure |
| My Calendar | `/my-calendar` | Static calendar-oriented agenda and upcoming-items structure |
| Contact | `/contact` | Accessible contact form with client-side validation and local-only submission feedback |
| Activity Log | `/activity/activity-log` | Filter-ready chronological activity-list structure |
| Events | `/activity/events` | Upcoming and past event card/list structure |
| Appointments | `/activity/appointments` | Appointment summary and list structure prepared for later booking actions |
| Press Coverage | `/press-coverage` | Coverage cards/list with publication, date, headline, and summary fields |

`/activity` will redirect to `/activity/activity-log`. Activity will appear as a collapsible parent item in navigation, with Activity Log, Events, and Appointments as its children. An unmatched URL will render a not-found page with a clear route back to Home.

## Shared components

- `AppShell`: consistent layout and semantic landmarks.
- `Header` and responsive navigation: top-level links plus the nested Activity group.
- `PageHeader`: consistent page title and optional introductory text.
- Reusable card, list, status, and empty-state primitives for static content.
- `ContactForm`: controlled fields, accessible labels, validation messages, and local success feedback.
- `Footer`: concise portal identification and secondary links.

Components will expose small, stable props and will not import page-specific data directly.

## Visual foundation

The initial styling will be intentionally minimal and theme-ready. A small set of CSS custom properties will cover color, spacing, typography, radius, shadow, and focus treatment. Components will consume these tokens so the established OIAC theme can replace their values later without structural rewrites.

The baseline will include responsive layouts, visible keyboard focus, sufficient contrast, reduced-motion support, and restrained transitions. It will not attempt to invent OIAC branding.

## Data and interaction flow

Static page data will live in focused local modules or within the relevant page when it is page-specific. Pages pass records to reusable presentational components. No network requests will be made.

The Contact form will validate required fields in the browser. A valid submission will display local confirmation without sending or retaining the message. This behavior will be clearly represented in the UI and can later be replaced by Power Pages Web API, Server Logic, or a cloud flow.

## Error handling

- Unknown routes render the not-found page.
- Contact validation errors appear beside their corresponding fields and are announced accessibly.
- Reusable list sections support an explicit empty state so they remain stable when static data is replaced by live data.
- Future service errors are outside this phase, but page boundaries will allow loading, empty, and error states to be added without changing routing.

## Verification

- Build the production bundle successfully.
- Verify every route and navigation link.
- Verify the Activity parent can be expanded and operated with a keyboard.
- Verify responsive navigation at narrow and wide viewport widths.
- Test Contact form required-field validation and local success feedback.
- Run automated accessibility checks across every route and resolve all critical and serious findings.
- Confirm each page sets an appropriate document title.

## Delivery boundary

The completed result is a local, reviewable React Power Pages SPA starter in `oiac-engage/`. Deployment will be offered only after the user reviews the running site. Theme application, authentication, Dataverse integration, and production workflows are follow-up phases.
