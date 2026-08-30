# Native Registration Layout Design

## Goal

Make the native Power Pages Register page use the same centered 500px layout as the existing Sign-in page without replacing or changing native registration behavior.

## Root Cause

The shared authentication stylesheet styles direct `.portal-form > .row` elements and removes Bootstrap columns only from `.page-content > .row`. The Register page introduces two additional structures that those selectors do not cover:

- `#SecureRegister > .row > .col-lg-6`, which leaves the form constrained to a Bootstrap half-width column.
- `#ShowEmail` and `#ShowUserName`, which wrap their field rows so Email and Username do not receive the shared form-grid rules.

## Layout Contract

- Keep the existing outer authentication shell at `42rem` and the form at a maximum width of `31.25rem` (500px).
- Make `#SecureRegister` and its first Bootstrap row occupy the full authentication shell.
- Remove the effective width, padding, margin, float, and flex constraints from the first registration column.
- Hide only the empty second registration column so it cannot reserve space.
- Apply the same `7rem / flexible-control` desktop grid to every registration field row, including rows nested inside `#ShowEmail` and `#ShowUserName`.
- Keep the submit action aligned with the input column on desktop.
- At widths up to 720px, stack labels above controls and make the Register button full-width, matching Sign in.

## Visual and Interaction Behavior

- Preserve the native Sign in, Register, and Redeem invitation tabs.
- Preserve the native heading, Email, Username, Password, Confirm password, validation messages, and Register button.
- Reuse the existing authentication colors, typography, borders, focus rings, and button treatment. Do not introduce a separate card or new visual language.
- Keep native labels and keyboard behavior intact; no JavaScript DOM manipulation is permitted.

## Out of Scope

- Registration enablement settings.
- CAPTCHA settings; CAPTCHA remains disabled as currently configured.
- Changes to account creation, validation, email confirmation, invitation redemption, or sign-in behavior.
- Changes to React application pages or the vendor Bootstrap stylesheet.

## Verification

- Add a regression test using the supplied Register DOM structure that proves the stylesheet explicitly covers the full-width registration wrapper and nested field rows.
- Preserve all existing authentication-theme assertions.
- Run the focused authentication-theme tests, the complete test suite, and the production build.
- Deployment and live-site cache restart remain separate actions requiring user approval.
