# Native Registration Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the native Power Pages Register page use the same centered 500px form layout as Sign in.

**Architecture:** Extend the existing scoped authentication stylesheet rather than changing Power Pages markup or adding JavaScript. Add registration-specific selectors for the `#SecureRegister` Bootstrap wrapper and nested registration rows, protected by the existing raw-CSS regression suite.

**Tech Stack:** Power Pages Web Files, CSS, Vitest, TypeScript raw-file fixtures

## Global Constraints

- Keep the outer authentication shell at `42rem` and the form maximum width at `31.25rem` (500px).
- Preserve native registration fields, validation, tabs, submission, email confirmation, and invitation behavior.
- Keep `Authentication/Registration/CaptchaEnabled` unchanged and disabled.
- Do not modify React pages, vendor Bootstrap, or authentication site settings.
- Use CSS only; do not manipulate the native DOM with JavaScript.

---

### Task 1: Match the native Register layout to Sign in

**Files:**
- Modify: `src/auth/powerPagesAuthTheme.test.ts`
- Modify: `.powerpages-site/web-files/auth.css/auth.css`
- Modify: `.powerpages-site/web-templates/oiac-auth-header/OIAC-Auth-Header.webtemplate.source.html`

**Interfaces:**
- Consumes: Native Power Pages `#SecureRegister`, `.portal-form`, `.row.mb-3`, Bootstrap column classes, and the existing `--auth-form-width` token.
- Produces: Full-width registration wrapper rules and the same desktop/mobile form grid already used by Sign in.

- [x] **Step 1: Write the failing registration-layout regression test**

Add this test to `src/auth/powerPagesAuthTheme.test.ts`:

```ts
test('native Register page uses the same full-width 500px form grid as Sign in', () => {
  expect(authCss).toMatch(/#SecureRegister\s*>\s*\.row[\s\S]*?width:\s*100%\s*!important/)
  expect(authCss).toMatch(/#SecureRegister\s*>\s*\.row\s*>\s*\[class\*="col-"\]:has\(\.portal-form\)[\s\S]*?flex:\s*0 0 100%\s*!important/)
  expect(authCss).toMatch(/#SecureRegister\s+\.portal-form\s+\.row\.mb-3[\s\S]*?grid-template-columns:\s*7rem minmax\(0, 1fr\)\s*!important/)
  expect(authCss).toMatch(/@media \(max-width: 720px\)[\s\S]*?#SecureRegister\s+\.portal-form\s+\.row\.mb-3[\s\S]*?grid-template-columns:\s*1fr\s*!important/)
})
```

- [x] **Step 2: Run the focused test and verify the expected failure**

Run:

```powershell
npm test -- src/auth/powerPagesAuthTheme.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: the new test fails because `auth.css` does not contain `#SecureRegister` layout selectors.

- [x] **Step 3: Add the minimal registration-specific CSS**

Add scoped rules to `.powerpages-site/web-files/auth.css/auth.css`:

```css
body:has(.nav-account) #SecureRegister,
body:has(.nav-account) #SecureRegister > .row {
  display: block !important;
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
}

body:has(.nav-account) #SecureRegister > .row > [class*="col-"]:has(.portal-form) {
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
  flex: 0 0 100% !important;
  float: none !important;
}

body:has(.nav-account) #SecureRegister > .row > [class*="col-"]:not(:has(*)) {
  display: none !important;
}
```

Extend each existing desktop registration row, Bootstrap child-column, offset-column, and label rule with `body:has(.nav-account) #SecureRegister .portal-form .row.mb-3` equivalents. Extend the matching mobile grid, offset, and label rules with the same registration selector so `grid-template-columns` changes to `1fr` at 720px.

- [x] **Step 4: Run focused authentication tests**

Change the expected authentication stylesheet URL to `/auth.css?v=2`, verify the theme test fails against the old header, and then update the native authentication header link to `/auth.css?v=2`. This cache-version increment ensures the deployed Register page requests the updated CSS.

Run:

```powershell
npm test -- src/auth/powerPagesAuthTheme.test.ts src/auth/powerPagesAuthSettings.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: all authentication theme and settings tests pass.

- [x] **Step 5: Run full verification**

Run:

```powershell
npm test -- --no-file-parallelism --maxWorkers=1 --reporter=dot
npm run build
```

Expected: all tests pass and the Vite production build completes successfully.

- [x] **Step 6: Review the scoped diff**

Run:

```powershell
git diff --check -- src/auth/powerPagesAuthTheme.test.ts .powerpages-site/web-files/auth.css/auth.css
git diff -- src/auth/powerPagesAuthTheme.test.ts .powerpages-site/web-files/auth.css/auth.css
```

Expected: only the approved native registration layout and its regression coverage changed; no site setting, React, or Bootstrap file changed.
