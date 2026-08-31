# Pending Profile Approval Page Design

## Goal

Give newly registered, signed-in users a clear and reassuring holding experience until an administrator assigns an approved portal role. Pending users must not see or navigate through the normal authenticated portal UI.

## Pending-Approval Rule

An authenticated user requires approval when their role list is empty or contains only implicit Power Pages roles:

- `Authenticated Users`
- `Anonymous Users`

Role comparison is case-insensitive and ignores surrounding whitespace. Any other assigned role counts as an approved portal role, including the existing Administrators, Staff, Volunteer, and Applicant roles and future custom roles.

Anonymous visitors remain on the public landing experience. Approved authenticated users continue through the existing authenticated shell and routes without behavior changes.

## Routing Architecture

Add a central approval gate in `App.tsx` after the anonymous-session branch and before the normal authenticated `AppShell`. This avoids repeating guards on every route and ensures future portal pages are protected automatically.

Pending users receive a dedicated shell and route set:

- `/pending-approval` renders the approval page.
- Every other path redirects to `/pending-approval` with `replace`, including direct links to reports, events, contacts, resources, and calendar pages.
- The normal portal header, navigation, data-backed pages, dashboard hooks, and footer links are not mounted for pending users.

## Page and Shell Design

Create a small `PendingApprovalShell` with:

- The standard OIAC logo and `OIAC Engage` wordmark linked to `/pending-approval`.
- A **Sign Out** button using `/Account/Login/LogOff?returnUrl=%2F`.
- No primary navigation, account-role label, or portal footer navigation.
- The existing site-container width, white header, border, typography, focus treatment, and responsive spacing.

Create a `PendingApproval` page with a centered card sized for comfortable reading on desktop and full-width mobile layouts. The card uses the existing white surface, muted green palette, restrained shadow, rounded border, and a decorative clock/status icon. A small `Approval pending` status label appears above the heading.

Approved copy:

> **Your profile is under review**
>
> Thank you for creating your OIAC Engage account. Our team is reviewing your profile. We’ll notify you as soon as your access is approved.
>
> After approval, sign in again to access the portal.

The page does not display account or role details and does not imply a guaranteed approval timeframe.

## Accessibility

- The page has one level-one heading.
- The status icon is decorative and hidden from assistive technology.
- The Sign Out action remains keyboard accessible with the existing focus style.
- The shell includes the standard skip link targeting the page main content.
- Route changes retain the existing heading-focus behavior where applicable.
- Text and status colors retain WCAG AA contrast against their surfaces.

## Security Boundary

This task implements a client-side UI approval gate only. It prevents pending users from mounting or navigating the normal SPA experience, but it does not change Dataverse table permissions. Existing permissions associated with the built-in Authenticated Users role remain unchanged and continue to be the server-side authorization boundary.

A future permission-hardening project may move data access from Authenticated Users to approved functional roles. That work is explicitly outside this task.

## Files and Responsibilities

- `src/auth/authorization.ts`: determine whether an authenticated session requires profile approval.
- `src/components/PendingApprovalShell.tsx`: render the restricted branded shell and Sign Out action.
- `src/pages/PendingApproval.tsx`: render the approval message and status presentation.
- `src/App.tsx`: apply the central approval gate and canonical redirect.
- `src/styles/theme.css`: add isolated responsive pending-page styles.
- Tests alongside authorization, App, page, shell, and design regression coverage.

## Testing

Tests will verify:

- Empty roles require approval.
- `Authenticated Users` alone requires approval regardless of case or whitespace.
- `Anonymous Users` plus `Authenticated Users` still requires approval.
- Any non-implicit role bypasses the pending gate.
- Pending users on `/` and direct portal URLs reach `/pending-approval` and see only the restricted shell.
- The page renders the approved copy and Sign Out URL.
- Normal anonymous and approved authenticated experiences remain unchanged.
- Pending-page CSS is isolated and responsive.
- The complete test suite and production build pass.

## Deployment

Implementation, deployment, and cache restart are separate actions. After local verification, deployment to a Power Pages environment requires explicit confirmation. A site-cache restart also requires separate approval because it may cause brief downtime.
