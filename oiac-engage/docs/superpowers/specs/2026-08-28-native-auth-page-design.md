# Native Authentication Page Design

## Scope

Restyle Power Pages native authentication pages without changing the vendor Bootstrap file. The initial implementation covers Sign in, Redeem invitation, and related local-account pages such as Forgot password. The React application shell is outside this change.

## Layout

- Keep the native authentication header and footer visually empty.
- Constrain the outer authentication content to `42rem` (`max-w-2xl`) and center it in the viewport with responsive horizontal padding.
- Constrain the form and its fields to `500px` while allowing it to shrink to the available width on smaller screens.
- Preserve the reference layout: tab row, section heading and divider, right-aligned desktop labels, aligned controls, and stacked mobile fields.

## Navigation and Content

- Show only the native **Sign in** and **Redeem invitation** tabs.
- Do not enable or add open registration.
- Do not add demo-role buttons or demo credential behavior.
- Preserve the native Remember me, Sign in, and Forgot your password actions.

## Styling Architecture

Leave `bootstrap.min.css` unchanged. Add a dedicated authentication stylesheet as a Power Pages web file and load it after Bootstrap from the native authentication header template. The template must emit only the stylesheet reference and no visible header markup. Keep the footer template empty.

Scope authentication rules to the native account DOM (`.nav-account`, `.portal-form`, `.form-horizontal`, and `.forgot-password`) so they do not alter the React site or unrelated Power Pages pages. Use sufficiently specific rules, including targeted `!important` declarations where required, to override Bootstrap grid widths and offsets.

## Responsive and Accessibility Requirements

- At desktop widths, keep labels and controls aligned in a compact two-column form.
- At mobile widths, stack labels above controls and make actions full-width where needed.
- Retain native labels, validation, keyboard tab behavior, and visible focus states.
- Do not replace native authentication inputs or submit behavior with custom JavaScript.

## Verification

- Add regression coverage proving Bootstrap remains unchanged and the authentication stylesheet is loaded by the native shell.
- Verify the outer width is `42rem`, the form maximum is `500px`, and the Register and demo-role UI are absent.
- Run the authentication layout browser check, focused tests, full test suite, and production build before deployment.
- After deployment, verify the live Sign in and Redeem invitation pages; cache restart remains a separate action requiring approval.
