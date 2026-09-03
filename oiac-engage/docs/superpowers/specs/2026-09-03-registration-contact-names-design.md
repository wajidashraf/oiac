# Registration Contact Names Design

## Goal

Extend the existing native Power Pages local-registration experience so a new user supplies required First Name and Last Name values before Email, Username, Password, and Confirm Password. A completed registration must leave the new Dataverse Contact populated with `firstname`, `lastname`, and the primary email address already written by Power Pages.

## Existing Architecture

OIAC Engage uses the server-rendered Power Pages registration page at `/Account/Login/Register`. The current website header template supplies route-aware branding, while the disabled `auth.css` web file contains optional form styling. Account creation, password handling, email confirmation, and the authentication cookie remain owned by Power Pages.

The native Web Forms registration control accepts the existing Email, Username, Password, and Confirm Password controls. Additional browser inputs are not part of that server control, so displaying name inputs alone would not save them to the Contact.

The SPA already receives the authenticated Contact identifier through `window.Microsoft.Dynamic365.Portal.User.contactId`. It also has a CSRF-aware Web API client, a Contact Self permission with read/write access, and `firstname`/`lastname` in the Contact Web API field allowlist.

## Approved Approach

### Native Form Extension

Add a dedicated, deployable JavaScript web file and load it only from the existing authentication header template on the native registration route. The script will:

- Locate the native `#Register` form and its Email control.
- Insert First Name and Last Name rows immediately before the Email row.
- Preserve every existing native registration control and the native form action.
- Use `autocomplete="given-name"` and `autocomplete="family-name"`.
- Mark both inputs required and expose accessible inline validation messages.
- Validate on blur, clear the error while the user corrects the field, and validate both fields on submit.
- Display the exact messages `First Name is required.` and `Last Name is required.`.
- Focus the first invalid name field and prevent native submission until both trimmed values are non-empty.

### Pending Registration Profile

Immediately before a valid native registration submit, store a versioned pending payload in `sessionStorage`. It contains trimmed First Name, trimmed Last Name, the registration Email and Username identifiers when those native controls are present, and a creation timestamp. It contains no password, token, role, or Contact identifier.

The payload is scoped to the current browser tab and expires after 30 minutes. If the native registration page re-renders because Power Pages rejected another field, the script restores the name inputs from the pending payload so the user does not need to type them again.

### Authenticated Contact Finalization

Before the authenticated SPA renders its normal portal-role boundary, a registration-profile finalizer will inspect the pending payload:

1. Ignore and remove malformed or expired payloads.
2. Require an authenticated session with a valid `contactId`.
3. Require the authenticated username to match either the pending Email or Username case-insensitively before updating anything. This supports both native local-login modes without changing the site's authentication configuration.
4. PATCH only `firstname` and `lastname` on `/_api/contacts(<contactId>)` through the existing CSRF-aware client.
5. Clear the pending payload only after a successful update.
6. Refresh the in-memory session name values for the current page.

The finalizer renders a neutral "Completing your profile" state while saving. If saving fails, it renders an actionable error with a Retry button and does not render portal pages or the Under Review page. This makes profile persistence part of the user-visible registration completion boundary even though Power Pages creates the account first.

Once the Contact update succeeds, normal routing resumes. A new user without an approved portal role then sees the existing Under Review page; an approved user sees the appropriate portal routes.

## Security and Data Boundaries

- Do not replace or reproduce Power Pages password, email-confirmation, or account-creation logic.
- Never store passwords or anti-forgery tokens in browser storage.
- Never accept a Contact ID from the pending browser payload.
- Always use the authenticated session's normalized `contactId` as the PATCH target.
- Use the existing Self-scoped Contact write permission; do not add create, delete, or global write privileges.
- Do not change web-role assignment, role approval, external identity providers, or registration enablement settings.
- A stale or identity-mismatched payload must not update a Contact.

## File Responsibilities

- `.powerpages-site/web-files/registration-profile.js/*`: native registration form enhancement, validation, and pending-payload persistence.
- `.powerpages-site/web-templates/oiac-auth-header/OIAC-Auth-Header.webtemplate.source.html`: load the registration script only on `/Account/Login/Register`.
- `src/features/registrationProfile/registrationProfile.ts`: pending-payload parsing, expiry checks, identity checks, Contact update, and storage cleanup.
- `src/components/RegistrationProfileGate.tsx`: authenticated completion/loading/error/retry UI.
- `src/App.tsx`: place the registration-profile gate before the existing portal-role gate.
- Authentication and registration regression tests: verify native field behavior, validation, persistence, safe finalization, retry behavior, and unchanged native authentication settings.

## Error Handling

- Missing First Name: show `First Name is required.` beside the field.
- Missing Last Name: show `Last Name is required.` beside the field.
- Native registration rejection: remain on the native page and restore entered names.
- Missing or invalid authenticated Contact ID: keep the completion gate visible and offer Retry; never send an update request.
- Contact PATCH failure: retain the pending payload and offer Retry.
- Expired, malformed, or identity-mismatched payload: discard it without updating a Contact, then continue normal routing.

## Verification

Automated coverage will demonstrate:

- The native enhancement inserts First Name and Last Name before Email.
- Empty names prevent submission and display the exact required messages.
- Valid names are trimmed and stored without credentials.
- A native server-validation re-render restores the names.
- The finalizer updates only the authenticated Contact with `firstname` and `lastname`.
- Malformed, expired, mismatched, and invalid-Contact payloads cannot update Dataverse.
- Failed updates retain the payload and expose Retry; successful updates clear it and release routing.
- The existing approved-role gate still controls all portal pages after finalization.
- Focused tests, the full Vitest suite, and the production build pass.

Runtime verification must ultimately be performed on a deployed Power Pages site because the native registration page, authentication cookie, and Dataverse Contact creation do not exist on localhost.
