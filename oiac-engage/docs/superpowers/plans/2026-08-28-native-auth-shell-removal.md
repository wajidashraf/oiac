# Native Authentication Shell Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove custom header and footer markup from all native Power Pages authentication pages without changing the React application shells or centered authentication-form layout.

**Architecture:** Keep the existing Power Pages website header/footer template record assignments, but make both assigned native auth template source files empty. Protect the behavior with the authentication-theme regression suite and live-markup Playwright layout check.

**Tech Stack:** Power Pages Liquid templates, CSS, Vitest, Playwright, Vite

## Global Constraints

- Apply the removal to Sign in, Register/Redeem invitation, Forgot password, and related native account-login routes.
- Do not change the authenticated or anonymous React application headers and footers.
- Preserve the 500px centered native authentication form and Bootstrap isolation rules.

---

### Task 1: Remove the native authentication shell

**Files:**
- Modify: `.powerpages-site/web-templates/oiac-auth-header/OIAC-Auth-Header.webtemplate.source.html`
- Modify: `.powerpages-site/web-templates/oiac-auth-footer/OIAC-Auth-Footer.webtemplate.source.html`
- Modify: `src/auth/powerPagesAuthTheme.test.ts`
- Verify: `scripts/verify-auth-layout.mjs`

**Interfaces:**
- Consumes: Power Pages website template assignments from `.powerpages-site/website.yml`
- Produces: Empty native header/footer template output while preserving the assigned template record IDs

- [ ] **Step 1: Write the failing regression test**

Replace the native-shell assertions with:

```ts
test('native authentication templates render no custom header or footer', () => {
  expect(header.trim()).toBe('')
  expect(footer.trim()).toBe('')
  expect(website).toContain('headerwebtemplateid: 1a8d7f5c-7e6b-4a4f-b9d5-2f3c6a1e8b70')
  expect(website).toContain('footerwebtemplateid: 5c3e9a12-4b7d-4f8a-a6c1-9e2d7b5f3048')
  expect(codeSiteHeader.trim()).toBe('<div/>')
  expect(codeSiteFooter.trim()).toBe('<div/>')
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run `npm test -- src/auth/powerPagesAuthTheme.test.ts --no-file-parallelism --maxWorkers=1`.

Expected: FAIL because both native templates still contain OIAC header/footer markup.

- [ ] **Step 3: Empty both native template source files**

Delete all Liquid and HTML content from both native template source files so each file is zero-length.

- [ ] **Step 4: Verify focused behavior and layout**

Run `npm test -- src/auth/powerPagesAuthTheme.test.ts --no-file-parallelism --maxWorkers=1` and `node scripts/verify-auth-layout.mjs`.

Expected: Five auth-theme tests pass; the browser check reports a 500px centered desktop layout and a 366px mobile layout.

- [ ] **Step 5: Verify the complete project**

Run `npm test -- --no-file-parallelism --maxWorkers=1` and `npm run build`.

Expected: All tests pass and the Vite production build exits successfully.

- [ ] **Step 6: Commit only the implementation files**

Stage the test, both template source files, and this plan. Commit them with message `Remove native auth header and footer`.
