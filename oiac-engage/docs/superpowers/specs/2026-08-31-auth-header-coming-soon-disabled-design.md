# Authentication Header and Coming Soon Disabled States

## Goal

Make the native Power Pages authentication experience feel connected to the OIAC Engage landing page, and make every unfinished feature visibly inactive while keeping it discoverable.

## Scope

This change covers:

- Sign In, Register, Redeem Invitation, and Forgot Password native Power Pages pages.
- The existing Coming Soon navigation entries and Home page sections.
- Responsive, keyboard, and screen-reader behavior for the affected elements.

It does not change authenticated application navigation, implemented routes, authentication behavior, form fields, or existing feature logic.

## Native Authentication Header

The existing `OIAC-Auth-Header` web template will render a shared header on native authentication routes. The header will contain:

- An OIAC logo and “OIAC Engage” brand link on the left.
- A Sign In action on the right.
- A logo link targeting `/`, which returns users to the anonymous landing page.

On the Sign In page, the Sign In action will target the local sign-in form on the same page. On Register, Redeem Invitation, and Forgot Password pages, the action will navigate to `/SignIn?returnUrl=%2F`.

The header will use isolated, authentication-header-specific styles. The previously disabled full authentication form stylesheet will remain disabled, ensuring the form layout and native account tabs are not restyled by this feature. Desktop and mobile layouts will follow the anonymous landing header’s spacing, logo scale, colors, focus treatment, and compact responsive behavior.

## Coming Soon Visual State

All existing Coming Soon navigation entries and Home page sections will receive explicit modifier classes instead of being inferred through global selectors.

Affected navigation entries:

- Activity Log
- Appointments
- Press Coverage

Affected Home content:

- Activity shortcut
- Appointments shortcut
- Meeting Invites
- Teams Announcements
- Training Resources
- Teams & Resources
- Volunteer Submissions

Coming Soon surfaces will use a muted background, softer border and text colors, and reduced visual intensity. Titles and Coming Soon badges will remain readable at accessible contrast. Disabled navigation and action-like elements will use a noninteractive cursor and will not gain hover or active styles.

Existing `aria-disabled="true"` semantics will be retained and extended to section-level containers where appropriate. Coming Soon items will remain non-links or otherwise have navigation prevented. Implemented items—including Events, Resources, Meeting Reports, Contacts, and My Calendar—will retain their current appearance and behavior.

## Implementation Boundaries

- Native header markup stays in the Power Pages authentication web template because authentication pages render outside the React SPA.
- Header styling remains isolated from the disabled `auth.css` form rules.
- React components receive explicit Coming Soon modifier classes and accessible disabled attributes.
- Shared theme CSS owns the muted visual treatment so navigation and Home sections remain consistent.
- No JavaScript DOM injection will be used for the native header.

## Error and Fallback Behavior

- If a native authentication path is not one of the supported routes, the authentication header template renders no header.
- The logo always has a working `/` fallback.
- Non-Sign-In authentication pages always have a direct Sign In URL even when a same-page form target does not exist.
- Coming Soon content remains readable when CSS effects such as opacity or filters are unavailable.

## Verification

Automated tests will verify:

- Native auth header route conditions, logo destination, and Sign In destinations.
- The full authentication form stylesheet remains disabled.
- All designated navigation entries remain non-links with `aria-disabled="true"`.
- All designated Home sections and shortcuts receive the disabled Coming Soon modifier.
- Implemented navigation entries remain active links.
- CSS includes responsive header behavior and targeted Coming Soon visual states.

The full Vitest suite and production build must pass before deployment.
