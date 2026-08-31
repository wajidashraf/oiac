# Authentication Header Cache and Height Fix Design

## Problem

The native Power Pages authentication header is registered as the website-wide header template. Its Liquid markup is intended to render only on Sign In, Register, Redeem Invitation, and Forgot Password routes. However, `Header/OutputCache/Enabled` is currently `True`, so a header rendered for an authentication request can be reused for the React landing page. The React anonymous shell then renders its own header, producing two visible headers.

The native authentication header also uses a `6.5rem` desktop minimum height and `5.5rem` mobile minimum height. The React anonymous header uses `5rem` on desktop and `4.75rem` on mobile, so the native version appears too tall.

## Approved Design

Disable Power Pages output caching for the global header template by changing `Header/OutputCache/Enabled` to `False`. This allows the existing route-dependent Liquid condition to be evaluated for every request. The native header will remain present only when the request path is `/signin`, `/register`, or under `/account/login`.

Align the native header with the existing React anonymous header:

- `5rem` desktop minimum height.
- `4.75rem` mobile minimum height.
- The same `81.5rem` maximum content width and responsive gutter calculation.
- The same white surface, border color, compact logo treatment, sans-serif wordmark, and primary action color.
- Preserve the logo link to `/`, authentication-aware Sign In targets, and visible keyboard focus styles.

The disabled `/auth.css` form stylesheet remains commented and is not re-enabled.

## Scope

Files to change:

- `.powerpages-site/site-settings/Header-OutputCache-Enabled.sitesetting.yml`
- `.powerpages-site/web-templates/oiac-auth-header/OIAC-Auth-Header.webtemplate.source.html`
- `src/auth/powerPagesAuthTheme.test.ts`

No React routing, authentication logic, footer behavior, table permissions, or implemented feature navigation will change.

## Testing

Update the native authentication theme regression test to require:

- Header output caching is disabled.
- Route-scoped Liquid remains present.
- Desktop and mobile header heights match the React anonymous header.
- The native header uses the matching container width and visual tokens.
- The full native authentication form stylesheet remains disabled.

Run the focused authentication theme test, the complete test suite, and the production build before deployment.

## Deployment Note

Disabling header output caching is an intentional site-setting change. It trades a small amount of header-render caching for correct per-route output. After deployment, the Power Pages site cache should be restarted so the previously cached header fragment is removed immediately.
