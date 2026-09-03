# Portal Role Route Guard Design

## Goal

Ensure that every authenticated portal page is available only to users assigned at least one approved OIAC functional web role. Signed-in users who have no approved role must see the existing pending-approval experience instead of the requested portal page.

## Approved Portal Roles

The only roles that grant access to the authenticated portal are:

- `Administrators`
- `Staff`
- `Volunteer`
- `Applicant`

Role comparison is case-insensitive and ignores surrounding whitespace. A user with more than one role is approved when at least one normalized role matches the allowlist.

The following do not grant portal access:

- An empty or missing role list.
- The implicit `Authenticated Users` or `Anonymous Users` roles.
- Any unrecognized or future custom role until it is deliberately added to the allowlist.

This is a fail-closed policy: authentication alone never grants access to portal pages.

## Routing Architecture

Create one shared `RequirePortalRole` route boundary around the complete authenticated route tree. The boundary evaluates the current authenticated session before rendering `AppShell`, an authenticated page, or any page-owned data-loading behavior.

All current authenticated routes, redirects, and the authenticated not-found route remain inside this boundary. New authenticated routes must also be added beneath it, which protects them automatically without duplicating authorization logic in individual page components.

The routing outcomes are:

1. An anonymous visitor receives the existing public landing experience.
2. An authenticated user with an approved role receives the requested portal route.
3. An authenticated user without an approved role receives the existing `PendingApprovalShell` and `/pending-approval` page.
4. When a denied user requests any other path directly or through client navigation, the router replaces that location with `/pending-approval`.
5. An approved user who requests `/pending-approval` is handled by the normal authenticated route tree rather than seeing the pending page.

The role decision is made at the route boundary on client-side route changes using the Power Pages session exposed to the application. The check prevents protected React pages from mounting before authorization succeeds. It does not promise live detection of an administrator changing a user's Dataverse role while an already-open browser document continues using an older Power Pages user context; the refreshed role context is obtained on the next full page load or sign-in.

## Authorization Responsibilities

`src/auth/authorization.ts` owns the approved-role allowlist and exposes a single portal-access predicate. The predicate accepts the existing `AuthSession`, returns false for anonymous sessions, and returns true only when an authenticated session contains an approved functional role.

The pending-profile predicate uses the inverse of this approved-role decision for authenticated users. It must not treat an arbitrary non-implicit role as approval. Existing general helpers such as `hasRole` remain available for feature-specific checks, including the Administrators capability currently passed to the Events page.

`src/App.tsx` owns experience selection and routing:

- Public experience for anonymous users.
- Pending-approval experience for authenticated users denied by the allowlist.
- Authenticated application shell and portal routes for approved users.

Individual pages do not repeat the shared portal-entry check.

## User Experience

The existing pending-approval page, copy, layout, and Sign Out action remain unchanged. Denied users must not see the authenticated navigation, account menu, footer navigation, page content, or transient loading states from protected pages.

Redirects use history replacement so the browser Back action does not repeatedly return the user to a denied portal URL.

## Security Boundary

The React role boundary controls client-side rendering and navigation. It is not the authoritative data-security boundary. Power Pages web roles and Dataverse table permissions must continue to enforce read and write access for every API request.

No web-role assignment, table permission, authentication provider, registration setting, or deployed environment is changed by this implementation.

## Testing

Automated coverage will verify:

- Each of `Administrators`, `Staff`, `Volunteer`, and `Applicant` grants portal entry.
- Matching is case-insensitive and whitespace-tolerant.
- A mixed role list grants access when at least one approved role is present.
- Empty, missing, implicit-only, and unknown-role lists are denied.
- Every current authenticated route redirects a denied signed-in user to `/pending-approval`.
- Direct URLs and client-side navigation cannot mount protected content for denied users.
- Protected pages do not start page-owned data requests before the role boundary passes.
- Anonymous and approved-user behavior remains unchanged.
- The complete test suite and production build pass.

## Scope

Implementation is limited to the shared authorization predicate, authenticated route boundary, and their regression tests. It does not redesign the pending page, add per-role page permissions, change Dataverse authorization, deploy the site, or restart the Power Pages cache.
