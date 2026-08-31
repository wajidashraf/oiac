# Open Registration Without CAPTCHA Design

## Goal

Restore the native Power Pages sign-up form so anonymous visitors can create local portal accounts, while keeping CAPTCHA disabled.

## Configuration

- Keep `Authentication/Registration/Enabled` set to `true`.
- Keep `Authentication/Registration/LocalLoginEnabled` set to `true`.
- Change `Authentication/Registration/OpenRegistrationEnabled` from `false` to `true`.
- Add `Authentication/Registration/CaptchaEnabled` with the explicit value `false`.
- Keep `Authentication/Registration/InvitationEnabled` set to `true`, so invitation redemption remains available alongside open registration.
- Keep `Authentication/Registration/EmailConfirmationEnabled` set to `true`.
- Keep external and Microsoft Entra ID login disabled.
- Keep profile redirect disabled so authenticated users return to the SPA instead of the legacy profile page.

## User experience

Power Pages continues to own the native registration page and account-creation workflow. Enabling open registration makes the native Register option and form available; no React registration form, custom account API, or authentication JavaScript is introduced. Existing native authentication styling applies to the registration page.

An anonymous visitor can register without an invitation code. Invitation holders can continue using Redeem invitation. The registration page does not display or validate a CAPTCHA challenge.

## Security boundary

Open registration intentionally permits any anonymous visitor with a valid primary email address to create a Power Pages account and corresponding Dataverse Contact. CAPTCHA remains off per the approved requirement. Existing email confirmation, password policy, page permissions, web roles, and table permissions remain responsible for downstream access control and are not broadened by this change.

## Verification

- Add a configuration regression test requiring registration, local login, invitation registration, and open registration to be enabled.
- Add a configuration regression test requiring CAPTCHA to be explicitly disabled.
- Preserve tests that external identity providers remain disabled and profile redirect remains disabled.
- Run the focused authentication-setting tests, the full Vitest suite, and the production build.
- Deployment and Power Pages cache restart require separate approval after local verification.
