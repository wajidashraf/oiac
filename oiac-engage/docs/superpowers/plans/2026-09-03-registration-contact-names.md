# Registration Contact Names Implementation Plan

> **For Codex:** Use the executing-plans workflow to implement each task in order, with test-driven development and verification before completion.

**Goal:** Extend native Power Pages registration with required First Name and Last Name fields, then persist those values to the newly authenticated Dataverse Contact before any portal page or Under Review page renders.

**Architecture:** A route-scoped plain JavaScript web file augments the native Power Pages registration form without changing its postback. It stores a short-lived, password-free pending profile in same-tab session storage. An authenticated React gate validates that payload against the signed-in identity, updates only the session Contact through the existing CSRF-aware Web API client, and releases routing only after success.

**Tech Stack:** Power Pages Liquid/web files, browser JavaScript, React 19, TypeScript, Vitest, Testing Library.

---

### Task 1: Enhance the native registration form

**Files:**
- Create: `.powerpages-site/web-files/registration-profile.js/registration-profile.js`
- Create: `.powerpages-site/web-files/registration-profile.js/registration-profile.js.webfile.yml`
- Modify: `.powerpages-site/web-templates/oiac-auth-header/OIAC-Auth-Header.webtemplate.source.html`
- Create: `src/auth/nativeRegistrationProfile.test.ts`
- Modify: `src/auth/powerPagesAuthTheme.test.ts`

1. Write a browser-level test that executes the deployable script against a representative native `#Register` form.
2. Assert First Name and Last Name are inserted, in that order, immediately before Email with `given-name` and `family-name` autocomplete values.
3. Assert empty trimmed names prevent submit, show the exact required messages, expose invalid state, and focus First Name.
4. Assert a valid submit is left to Power Pages and stores only version, trimmed names, email, username, and timestamp.
5. Assert a recreated registration form restores unexpired names from the pending payload and ignores malformed or expired data.
6. Run the focused tests and confirm they fail before implementation.
7. Implement an idempotent IIFE which initializes on DOM readiness, locates the native controls, builds accessible Bootstrap-compatible rows, validates on blur/input/submit, and uses `sessionStorage` key `oiac.registrationProfile.pending.v1`.
8. Add web-file metadata and load the script with `defer` only when the exact normalized path is `/account/login/register`.
9. Run the focused tests and confirm they pass.

### Task 2: Finalize the authenticated Contact safely

**Files:**
- Create: `src/features/registrationProfile/registrationProfile.ts`
- Create: `src/features/registrationProfile/registrationProfile.test.ts`

1. Write failing tests for pending-payload parsing and finalization.
2. Cover valid, malformed, expired, identity-mismatched, invalid-Contact, successful PATCH, and failed PATCH cases.
3. Assert the request path is the normalized authenticated Contact identifier and the body contains exactly `firstname` and `lastname`.
4. Assert malformed, expired, and mismatched payloads are removed without a request; invalid Contact and request failures retain the payload for retry.
5. Run the focused tests and confirm they fail before implementation.
6. Implement a typed parser with a 30-minute TTL and case-insensitive matching against either stored email or username.
7. Reuse `normalizeProfileContactId` and `powerPagesFetch`; never read a Contact ID from storage.
8. On success, remove the pending payload and return a session whose in-memory names are updated.
9. Run the focused tests and confirm they pass.

### Task 3: Block routing until finalization completes

**Files:**
- Create: `src/components/RegistrationProfileGate.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles/theme.css`

1. Add an App integration test with an authenticated no-role session and valid pending payload.
2. Hold the Contact request unresolved and assert a “Completing your profile” state renders while neither portal content nor Under Review content is visible.
3. Resolve the request and assert normal role enforcement resumes with the updated session.
4. Add a failure/retry test which asserts portal content remains blocked, the payload remains, and Retry invokes finalization again.
5. Run the focused tests and confirm they fail before implementation.
6. Implement `RegistrationProfileGate` with loading, ready, and error states; expose Retry and Sign Out in the error state.
7. Wrap `RequirePortalRole` in this gate and pass the effective updated session into all downstream role and page props.
8. Add restrained styles consistent with the existing pending shell.
9. Run the focused tests and confirm they pass.

### Task 4: Regression verification

**Files:**
- Verify: all modified files

1. Run the registration, authentication-theme, App, role, and profile focused tests.
2. Run the full Vitest suite.
3. Run the production TypeScript/Vite build.
4. Inspect `git diff --check`, `git diff --stat`, and the final diff for unrelated changes or accidental credential storage.
5. Record that live native registration and Dataverse persistence still require verification after deployment to a Power Pages environment.
