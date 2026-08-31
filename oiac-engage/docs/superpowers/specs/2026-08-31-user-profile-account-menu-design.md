# User Profile and Account Menu Design

## Goal

Give every approved signed-in portal user a consistent account menu and a custom SPA profile page where the user can view and update their own Contact information.

## Scope

This feature applies only to authenticated users who have passed the existing profile-approval gate. Anonymous visitors keep the public landing experience. Pending users keep the minimal pending-approval header and do not receive the profile route or account menu.

The profile page displays and edits these Dataverse Contact columns:

- First Name: `firstname`
- Last Name: `lastname`
- City: `address1_city`
- State: `address1_stateorprovince`

Email is not displayed or edited. The existing Contact directory may continue using `emailaddress1`; this feature does not remove that column from the Web API allowlist.

## Header Account Menu

Replace the static role badge and separate Sign out button in `PortalNav` with one account-menu button. The button retains the current avatar and functional role label and adds a down chevron. Activating it opens a small menu aligned to the account button with:

1. `Profile`, an internal React Router link to `/profile`.
2. `Sign out`, an anchor to `/Account/Login/LogOff?returnUrl=%2F`.

The button uses `aria-expanded` and `aria-controls`. The menu closes after route navigation, when the user clicks outside it, and when the user presses Escape. On narrow screens it remains inside the existing responsive navigation panel and uses full-width touch targets.

## Profile Page UI

Add a custom React page at `/profile` using the established OIAC page spacing, serif heading, bordered white form card, muted supporting copy, and existing button/field styles.

The page contains:

- Back navigation to the dashboard.
- Page heading `My Profile`.
- Supporting text explaining that these details are associated with the portal account.
- A two-column desktop form that stacks on mobile.
- First Name and Last Name as required text fields.
- City and State as optional text fields.
- A primary `Save changes` action.
- A success status after a completed update.

The form must expose labels, required states, error associations, keyboard focus, and status messages to assistive technologies. While saving, controls are disabled and the action reads `Saving…`.

## Data Flow

Create a focused profile service that uses the existing `powerPagesFetch` wrapper.

On page load:

1. Read the signed-in user’s `contactId` from the existing `PortalUser` passed through `App.tsx`.
2. Validate and normalize the GUID.
3. GET `/_api/contacts(<contactId>)?$select=contactid,firstname,lastname,address1_city,address1_stateorprovince`.
4. Map null Dataverse strings to empty form values.

On save:

1. Trim all four values.
2. Require non-empty First Name and Last Name.
3. PATCH `/_api/contacts(<contactId>)` with `firstname`, `lastname`, `address1_city`, and `address1_stateorprovince`.
4. Send empty optional City or State values as `null` so users can clear them.
5. Use `Content-Type: application/json` and `If-Match: *` through the shared request wrapper.
6. Keep the saved values in the form and announce `Profile updated.`.

The page uses an `AbortController` for the initial GET and aborts it on unmount. A missing or invalid Contact ID produces a session-specific message rather than sending an API request.

## Loading and Error Handling

- Loading: show `Loading your profile…` in a status region.
- Missing Contact ID: tell the user that the Power Pages session could not identify their Contact and ask them to sign in again.
- Load failure: show `Your profile could not be loaded.` with a `Try again` button.
- Validation failure: show a form alert and move focus to the first invalid name field.
- Save failure: keep all entered values and show `Your profile could not be updated. Try again.`.
- Success: clear earlier errors and announce `Profile updated.` without navigating away.

Raw Dataverse or HTML error responses must not be exposed in the UI.

## Power Pages Security and Configuration

Client-side routing is only a UX boundary. Dataverse security remains enforced by Power Pages table permissions.

- Change the existing Contact Self permission from read-only to `read: true` and `write: true` with Self scope.
- Keep `create: false` and `delete: false`.
- Keep the global/district Contact permissions read-only.
- Add `firstname` and `lastname` to `Webapi/contact/fields`.
- Retain `contactid`, `address1_city`, and `address1_stateorprovince` in the allowlist.
- Do not grant global Contact write access.
- Do not change web-role assignments.

This limits an authenticated user’s update capability to the Contact record represented by their own Power Pages identity.

## Component Boundaries

- `PortalNav.tsx`: account-menu interaction and links only.
- `UserProfile.tsx`: page state, validation, loading/error/success rendering, and form submission.
- `profileService.ts`: Contact GUID validation, Web API paths, payload mapping, and GET/PATCH operations.
- `profileTypes.ts`: Dataverse response and editable profile types.
- `App.tsx`: registers `/profile` for approved authenticated users and supplies their `PortalUser`.
- `theme.css`: isolated account-menu and profile-page selectors consistent with the existing design system.

## Testing

Automated tests will cover:

- Account menu opens from the role badge and contains Profile and Sign out.
- The former separate Sign out control is removed.
- Account menu closes on navigation, outside click, and Escape.
- `/profile` remains available to approved users and unavailable through the pending-user gate.
- Profile GET uses only the current Contact ID and requested columns.
- Profile PATCH contains only the four editable columns and converts blank optional fields to null.
- Missing/invalid Contact IDs do not make Web API calls.
- Loading, retry, validation, success, and save-error states.
- Contact Web API fields include both name columns.
- Contact Self permission has write enabled while broader Contact permissions remain read-only.
- The complete Vitest suite and production build pass.

## Deployment

Implementation and deployment are separate actions. After code, permissions, settings, tests, and build are complete, deployment requires explicit confirmation of the target Power Platform environment.
