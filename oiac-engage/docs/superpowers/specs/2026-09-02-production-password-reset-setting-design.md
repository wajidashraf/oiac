# Production Password Reset Setting Design

## Goal

Explicitly enable the native Power Pages password-reset feature for OIAC Engage and deploy that configuration to the OIAC Production environment.

## Investigation Findings

- The Production site is `https://oiac.powerappsportals.com` and is public.
- Its native `/Account/Login/ForgotPassword` page renders an email field, submit button, form action, and anti-forgery token correctly.
- A controlled Production submission returned HTTP 200 and the native confirmation message, with no validation errors.
- The affected user has a local Power Pages username/password and uses the same address stored in the Contact's primary email field.
- The Production site metadata does not contain an explicit `Authentication/Registration/ResetPasswordEnabled` setting.

These findings rule out a broken button or form submission. The focused repository change will make the password-reset feature explicit instead of relying on the platform default.

## Configuration Change

Add one Power Pages site-setting artifact:

- Name: `Authentication/Registration/ResetPasswordEnabled`
- Value: `true`
- Type: Boolean
- Purpose: Enable the native local-account forgot-password and reset-password flow.

No other authentication settings will change. In particular, invitation registration remains disabled, open local registration remains enabled, and no custom React password-reset page or email-sending implementation will be introduced.

## Runtime Flow

1. The user selects the native **Forgot your password?** action.
2. Power Pages accepts the Contact's primary email address.
3. Power Pages invokes its native password-reset process and displays its generic confirmation response.
4. The configured Production mail pipeline sends the reset link.

The response must remain generic whether an account exists, preventing account enumeration.

## Verification

- Add a regression assertion that `Authentication/Registration/ResetPasswordEnabled` exists and equals `true`.
- Run the focused authentication-setting test.
- Run the complete Vitest suite.
- Run the production build.
- Confirm the active PAC profile is `OIAC-Prod` and the environment is `https://oiac.crm.dynamics.com/` immediately before upload.
- Deploy the verified code site to website ID `e7f400bd-1e04-4efa-b8b3-7a7a3b168662` in OIAC Production.
- After deployment, submit the native forgot-password form for an eligible local account and confirm receipt of the reset email.

## Operational Boundary

The site setting enables the Power Pages feature, but successful email delivery also depends on the native **Send Password Reset to Contact** process and an approved, enabled sender mailbox in Production. If the post-deployment form succeeds but no message arrives, the remaining repair is an environment email-process/mailbox configuration task rather than a website code change.

Deployment is authorized by the user for OIAC Production. A site-cache restart is not included and requires separate approval because it can briefly interrupt the live site.
