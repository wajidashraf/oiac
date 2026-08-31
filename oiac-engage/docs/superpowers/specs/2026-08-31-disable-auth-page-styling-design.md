# Temporarily Disable Authentication Page Styling

## Goal

Temporarily disable OIAC's custom styling on the Power Pages Sign in, Register, and Redeem invitation pages without changing authentication behavior or deleting the stylesheet.

## Design

Comment out the `/auth.css?v=3` stylesheet link in the `OIAC-Auth-Header` web template. The browser will then use the native Power Pages theme for all server-rendered authentication tabs. Keep `auth.css` and its web-file metadata unchanged so the customization can be restored by uncommenting one line.

No login, registration, invitation, CAPTCHA, identity-provider, navigation, or authorization settings will change.

## Verification

Update the authentication-theme test to require a commented stylesheet reference and confirm that no active `/auth.css` link remains. Run the focused authentication tests and the production build.
