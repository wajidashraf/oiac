# Production Password Reset Setting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Explicitly enable the native Power Pages password-reset feature and deploy the verified OIAC Engage code site to OIAC Production.

**Architecture:** Keep the native server-rendered forgot-password flow. Add one declarative Power Pages site setting and one configuration regression test; do not introduce a React password-reset page or custom email sender. Build the complete current workspace, verify the exact Production PAC identity and website ID, then upload the code site without restarting the site cache.

**Tech Stack:** Power Pages code site metadata, YAML site settings, React 19, TypeScript 5.7, Vitest 2, Vite 6, Microsoft Power Platform CLI.

## Global Constraints

- Create only `Authentication/Registration/ResetPasswordEnabled` with value `true` for this repair.
- Keep `Authentication/Registration/InvitationEnabled` set to `false`.
- Do not add `Authentication/Registration/ResetPasswordRequiresConfirmedEmail`.
- Do not add a custom React forgot-password or reset-password implementation.
- Deploy only to OIAC Production at `https://oiac.crm.dynamics.com/`.
- Target OIAC Engage website ID `e7f400bd-1e04-4efa-b8b3-7a7a3b168662`.
- Do not restart the Production site cache without separate user approval.
- Preserve all pre-existing workspace changes and exclude the unrelated `Minimal Volunteer Portal Design.make` directory from staging.

---

### Task 1: Add the Explicit Password-Reset Setting Test-First

**Files:**
- Create: `.powerpages-site/site-settings/Authentication-Registration-ResetPasswordEnabled.sitesetting.yml`
- Modify: `src/auth/powerPagesAuthSettings.test.ts`

**Interfaces:**
- Consumes: The existing `settingValue(yaml: string): string | undefined` test helper and raw-YAML Vite imports.
- Produces: A deployable `Authentication/Registration/ResetPasswordEnabled` site-setting record whose parsed value is exactly `true`.

- [ ] **Step 1: Write the failing regression test**

Add this import to `src/auth/powerPagesAuthSettings.test.ts`:

```typescript
import resetPasswordEnabled from '../../.powerpages-site/site-settings/Authentication-Registration-ResetPasswordEnabled.sitesetting.yml?raw'
```

Add this test inside the existing `Power Pages authentication settings` suite:

```typescript
test('explicitly enables native password reset', () => {
  expect(settingValue(resetPasswordEnabled)).toBe('true')
})
```

- [ ] **Step 2: Run the focused test and confirm the missing artifact fails**

Run:

```powershell
npm test -- src/auth/powerPagesAuthSettings.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because `Authentication-Registration-ResetPasswordEnabled.sitesetting.yml` does not exist.

- [ ] **Step 3: Add the minimal Power Pages site-setting artifact**

Create `.powerpages-site/site-settings/Authentication-Registration-ResetPasswordEnabled.sitesetting.yml` with exactly:

```yaml
description: Enable the native local-account forgot-password and password-reset flow
id: fd1c0977-1a9f-4b4e-ba3d-18d8d9fa7f6a
name: Authentication/Registration/ResetPasswordEnabled
value: true
```

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```powershell
npm test -- src/auth/powerPagesAuthSettings.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: PASS, including `explicitly enables native password reset`.

- [ ] **Step 5: Review the scoped diff**

Run:

```powershell
git diff -- .powerpages-site/site-settings/Authentication-Registration-ResetPasswordEnabled.sitesetting.yml src/auth/powerPagesAuthSettings.test.ts
git diff --check
```

Expected: The new setting and its regression assertion are present; no whitespace errors are reported. Existing unrelated working changes remain intact.

---

### Task 2: Verify the Complete Current Site Before Deployment

**Files:**
- Verify: all tracked and untracked deployment inputs under `oiac-engage`

**Interfaces:**
- Consumes: The setting artifact from Task 1 and the current verified workspace changes.
- Produces: Passing focused/full tests and a successful `dist` production build suitable for Power Pages upload.

- [ ] **Step 1: Run the complete test suite**

Run:

```powershell
npm test -- --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: All Vitest files and tests pass.

- [ ] **Step 2: Build the production site**

Run:

```powershell
npm run build
```

Expected: TypeScript completes without errors, Vite completes successfully, and `dist/index.html` plus hashed JavaScript/CSS assets exist.

- [ ] **Step 3: Confirm deployment scope**

Run:

```powershell
git status --short
git diff --check
```

Expected: The new reset-password setting and test are visible alongside the user's pre-existing CSS, calendar, and auth-test changes. The unrelated sibling design directory is not staged or passed to PAC.

---

### Task 3: Deploy the Verified Code Site to OIAC Production

**Files:**
- Deploy from: `C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage`
- Runtime target: OIAC Production website `e7f400bd-1e04-4efa-b8b3-7a7a3b168662`

**Interfaces:**
- Consumes: The verified project and compiled `dist` output from Task 2.
- Produces: Updated OIAC Engage Production metadata with native password reset explicitly enabled.

- [ ] **Step 1: Verify the active PAC identity immediately before upload**

Run:

```powershell
pac auth who
pac pages list
```

Expected values:

```text
Profile: OIAC-Prod
User: developer@OIAC.org
Environment: OIAC production
Environment URL: https://oiac.crm.dynamics.com/
Environment ID: ca557a8d-626a-ed50-b1e7-ca05693b4405
Website: OIAC Engage
Website ID: e7f400bd-1e04-4efa-b8b3-7a7a3b168662
```

Stop without uploading if any value differs.

- [ ] **Step 2: Upload the code site to the explicit Production environment**

Run from the project root:

```powershell
pac pages upload-code-site --environment 'https://oiac.crm.dynamics.com/' --path . --webSiteId 'e7f400bd-1e04-4efa-b8b3-7a7a3b168662'
```

Expected: PAC reports `Power Pages website upload succeeded`.

- [ ] **Step 3: Do not restart the site cache**

No restart command is run. Authentication settings can take several minutes to propagate naturally; a cache restart remains a separate, explicitly approved Production action.

- [ ] **Step 4: Verify the live Production forgot-password page**

Request:

```text
https://oiac.powerappsportals.com/Account/Login/ForgotPassword
```

Expected: HTTP 200 with the email field, submit button, POST action `/Account/Login/ForgotPassword`, and anti-forgery token.

- [ ] **Step 5: Complete the delivery check with an eligible user**

The user submits the affected local account's primary email address on the live page and confirms that the reset email arrives. If Power Pages again displays its success message but no email arrives, inspect the Production **Send Password Reset to Contact** process and its approved/test-enabled sender mailbox; that remaining issue is outside the website artifact.

---

### Task 4: Commit the Focused Implementation

**Files:**
- Commit: `.powerpages-site/site-settings/Authentication-Registration-ResetPasswordEnabled.sitesetting.yml`
- Commit: the password-reset import/assertion from `src/auth/powerPagesAuthSettings.test.ts`
- Exclude: unrelated sibling directory and unrelated working-tree changes

**Interfaces:**
- Consumes: The verified setting and regression test.
- Produces: A focused implementation commit documenting the deployed configuration.

- [ ] **Step 1: Stage only the password-reset implementation**

Stage the new YAML file and only the password-reset import/test hunk from the existing dirty test file. Do not stage the existing invitation-setting assertion change or any CSS/calendar change.

- [ ] **Step 2: Review the staged diff**

Run:

```powershell
git diff --cached --check
git diff --cached
```

Expected: Only the new reset-password setting and its regression assertion are staged.

- [ ] **Step 3: Commit**

Run:

```powershell
git commit -m "fix: explicitly enable password reset"
```

Expected: A focused commit is created without consuming the user's unrelated working changes.
