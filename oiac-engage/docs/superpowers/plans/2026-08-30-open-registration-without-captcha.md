# Open Registration Without CAPTCHA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the native Power Pages local-account registration form while explicitly keeping CAPTCHA disabled.

**Architecture:** Preserve the existing native authentication flow and change only its declarative site settings. Extend the existing raw-YAML configuration test so incorrect open-registration or CAPTCHA values fail before deployment.

**Tech Stack:** Power Pages site-setting YAML, TypeScript 5.7, Vitest.

## Global Constraints

- Keep `Authentication/Registration/Enabled`, `LocalLoginEnabled`, `InvitationEnabled`, and `EmailConfirmationEnabled` set to `true`.
- Set `Authentication/Registration/OpenRegistrationEnabled` to `true`.
- Set `Authentication/Registration/CaptchaEnabled` explicitly to `false`.
- Keep external and Microsoft Entra ID login disabled.
- Keep profile redirect disabled.
- Do not add a React registration form or custom account API.
- Do not deploy or restart the site cache without separate approval.

---

### Task 1: Registration configuration and regression coverage

**Files:**
- Modify: `src/auth/powerPagesAuthSettings.test.ts`
- Modify: `.powerpages-site/site-settings/Authentication-Registration-OpenRegistrationEnabled.sitesetting.yml`
- Create: `.powerpages-site/site-settings/Authentication-Registration-CaptchaEnabled.sitesetting.yml`

**Interfaces:**
- Consumes: Power Pages native registration settings.
- Produces: open native local registration with CAPTCHA disabled.

- [ ] **Step 1: Write the failing configuration test.** Import the CAPTCHA YAML, rename the invitation-only test to describe open and invitation registration, require `OpenRegistrationEnabled` to equal `true`, and add:

```ts
test('keeps registration CAPTCHA disabled', () => {
  expect(settingValue(captchaEnabled)).toBe('false')
})
```

- [ ] **Step 2: Run the focused test and verify the red phase.**

Run: `npm test -- src/auth/powerPagesAuthSettings.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose`

Expected: failure because open registration is `false` and the CAPTCHA setting does not exist.

- [ ] **Step 3: Implement the minimal settings.** Change the existing open-registration YAML to:

```yaml
id: 8cc43a4e-6269-4cff-9cc1-703062de715c
name: Authentication/Registration/OpenRegistrationEnabled
value: true
```

Create the CAPTCHA setting with a new stable UUID:

```yaml
description: Disable CAPTCHA on the native user registration page
id: <generated UUID>
name: Authentication/Registration/CaptchaEnabled
value: false
```

- [ ] **Step 4: Run the focused test and verify the green phase.**

Run: `npm test -- src/auth/powerPagesAuthSettings.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose`

Expected: all authentication-setting tests pass.

### Task 2: Verification and handoff

**Files:**
- Review the three Task 1 files and the approved design specification.

**Interfaces:**
- Produces: verification evidence and deployment-ready Power Pages metadata.

- [ ] **Step 1: Run the full test suite.**

Run: `npm test -- --no-file-parallelism --maxWorkers=1`

Expected: all test files pass.

- [ ] **Step 2: Run the production build.**

Run: `npm run build`

Expected: TypeScript and Vite complete with exit code 0.

- [ ] **Step 3: Run scoped whitespace and value checks.**

Run: `git diff --check -- src/auth/powerPagesAuthSettings.test.ts .powerpages-site/site-settings/Authentication-Registration-OpenRegistrationEnabled.sitesetting.yml`

Inspect the new CAPTCHA YAML and confirm no unrelated authentication settings changed.

- [ ] **Step 4: Record SetupAuth skill usage and ask before deployment.**
