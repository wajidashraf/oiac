# Native Authentication Shell Removal

## Scope

Remove the custom OIAC header and footer markup from every native Power Pages authentication page, including Sign in, Register/Redeem invitation, Forgot password, and related account-login routes.

The authenticated and anonymous React application shells are outside this change and must retain their existing headers and footers.

## Design

Keep the website's existing native header and footer template assignments, but make the `OIAC Auth Header` and `OIAC Auth Footer` template source files render no markup. This removes the elements from the document rather than hiding them with CSS and avoids changing global website metadata.

The existing authentication-page CSS remains responsible for constraining the native form to 500px and overriding Power Pages Bootstrap layout rules. Header/footer CSS may remain temporarily because it has no effect when the corresponding markup is absent; removing unrelated CSS is not part of this change.

## Verification

- Update the authentication-theme regression test to require both native auth templates to be empty.
- Retain assertions that the website still references the intended template records and that the code-site header/footer templates remain empty.
- Run the native-auth layout browser regression to confirm the centered form remains unchanged.
- Run the full test suite and production build before deployment.

## Deployment

Upload the verified code site to the previously confirmed OIAC-DEV environment. Cache restart remains a separate action requiring explicit approval because it can cause brief downtime.
