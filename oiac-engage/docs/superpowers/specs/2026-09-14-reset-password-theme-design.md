# Reset Password Theme Design

## Goal

Apply the OIAC Engage visual theme only to the native Power Pages **Reset password** page. Sign in, Register, Redeem invitation, Forgot password, and all other native authentication pages must retain their current presentation.

## Existing Context

Power Pages owns the reset form, hidden user and reset-code values, anti-forgery token, validation, and POST request to `/Account/Login/ResetPassword`. The repository already contains an optional `auth.css` web file, but its shared link was intentionally disabled so it would not style every authentication page. The route-aware OIAC authentication header remains active for `/account/login` routes.

## Styling Architecture

Keep the shared authentication stylesheet disabled by default. In the `OIAC-Auth-Header` web template, detect the normalized reset-password route and emit a versioned `/auth.css` link only for `/account/login/resetpassword`.

Extend `auth.css` with selectors scoped to the reset form itself, using its action URL and stable field/button identifiers. Existing selectors for other authentication screens may remain in the dormant stylesheet, but they will not execute because the stylesheet will not be loaded on those routes.

Do not modify Bootstrap, the native form action, input names, hidden fields, validation attributes, or authentication settings.

## Visual Design

The reset page will use the existing OIAC Engage design language:

- Light gray `#f9fafa` page background and white form surface.
- OIAC green `#596e6a` primary action with the existing darker hover state.
- Dark `#1a1f1e` text, muted green-gray supporting text, and `#dde3e2` borders.
- Inter-compatible body and control typography, with a restrained Source Serif-compatible reset heading to match portal headings.
- A centered, compact card with a maximum width near 31rem, comfortable padding, subtle border, small radius, and restrained shadow.
- Vertically stacked password fields with full-width controls, visible labels, and accessible green focus treatment.
- A full-width primary **Reset password** action aligned with the fields.
- Validation errors shown in the portal's red alert treatment.

The layout will shrink to the available viewport width and reduce card padding on mobile. No decorative animation is needed for this security-sensitive task.

## Empty Button Label

The supplied native markup renders `#submit-reset-password` without text. On the reset route only, a small progressive-enhancement script will set its text to `Reset password` when the button is empty and provide the same accessible label. If Power Pages later supplies localized button text, the script will preserve it.

The script will not intercept submission, read password values, or modify the form payload.

## Accessibility and Security

- Preserve native labels, password input types, keyboard order, server validation, and anti-forgery behavior.
- Provide a visible focus indicator with sufficient contrast.
- Ensure the submit button has an accessible name.
- Keep error text readable and associated with the existing validation summary.
- Never log, inspect, copy, or persist the user ID, reset code, anti-forgery token, or password values.

## Verification

- Add regression assertions for reset-route detection and conditional stylesheet loading.
- Assert that other authentication routes do not receive an active stylesheet link.
- Add reset-form CSS assertions for the scoped card, fields, focus state, error treatment, responsive layout, and submit action.
- Add a browser fixture matching the supplied native reset form and verify desktop and mobile geometry plus the button label enhancement.
- Run focused authentication tests, the reset browser-layout check, the complete test suite, and the production build.

## Deployment Boundary

This change prepares deployable Power Pages source files. Deployment, publishing, or a live-site cache restart is outside scope unless separately requested.
