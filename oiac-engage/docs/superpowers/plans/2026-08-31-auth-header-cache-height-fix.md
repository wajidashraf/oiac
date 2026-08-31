# Authentication Header Cache and Height Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the native authentication header from appearing on the React landing page and make its dimensions match the normal anonymous header.

**Architecture:** Keep the existing global Power Pages header web template and route-scoped Liquid, but disable header output caching so the route condition evaluates for every request. Update only the isolated `.auth-site-*` CSS to mirror the React anonymous header dimensions and visual tokens.

**Tech Stack:** Power Pages site settings and Liquid web templates, CSS, TypeScript, Vitest.

## Global Constraints

- Native header renders only on `/signin`, `/register`, and `/account/login` routes.
- Header output caching must be disabled because its markup depends on `request.path`.
- Desktop minimum height is `5rem`; mobile minimum height is `4.75rem`.
- Native content width uses the React shell's `81.5rem` maximum and responsive gutter.
- Logo link, Sign In targets, keyboard focus treatment, and the disabled `/auth.css` link remain unchanged.
- No React routing, authentication behavior, footer, permissions, or feature navigation changes.

---

### Task 1: Route-Correct, Size-Matched Authentication Header

**Files:**
- Modify: `src/auth/powerPagesAuthTheme.test.ts`
- Modify: `.powerpages-site/site-settings/Header-OutputCache-Enabled.sitesetting.yml`
- Modify: `.powerpages-site/web-templates/oiac-auth-header/OIAC-Auth-Header.webtemplate.source.html`

**Interfaces:**
- Consumes: Power Pages `request.path`; existing `/logo.png`; existing website header template registration.
- Produces: per-request route-scoped header markup with anonymous-shell dimensions.

- [ ] **Step 1: Add failing cache and dimension assertions**

Import the header cache site setting as raw text:

```ts
import headerCacheSetting from '../../.powerpages-site/site-settings/Header-OutputCache-Enabled.sitesetting.yml?raw'
```

Extend the first authentication-shell test with:

```ts
expect(headerCacheSetting).toContain('name: Header/OutputCache/Enabled')
expect(headerCacheSetting).toContain('value: False')
expect(header).toMatch(/\.auth-site-header__inner\s*\{[^}]*width:\s*min\(81\.5rem, calc\(100% - \(2 \* clamp\(1rem, 2\.5vw, 2rem\)\)\)\)[^}]*min-height:\s*5rem/s)
expect(header).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.auth-site-header__inner\s*\{[^}]*min-height:\s*4\.75rem/s)
expect(header).toContain('background: #596e6a')
expect(header).not.toContain('min-height: 6.5rem')
expect(header).not.toContain('min-height: 5.5rem')
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
npm test -- src/auth/powerPagesAuthTheme.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because header caching is `True` and the native header still uses `6.5rem`/`5.5rem` dimensions.

- [ ] **Step 3: Disable route-dependent header output caching**

Change the site setting to:

```yaml
description: Set whether the header web template is output cached.
id: f78f764f-ac9f-459c-8cb1-5cdfb3884b21
name: Header/OutputCache/Enabled
value: False
```

- [ ] **Step 4: Match the React anonymous header in isolated native CSS**

In the auth header web template, change `.auth-site-header__inner` to:

```css
.auth-site-header__inner {
  display: flex;
  width: min(81.5rem, calc(100% - (2 * clamp(1rem, 2.5vw, 2rem))));
  min-height: 5rem;
  margin: 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}
```

Use `Inter, "Segoe UI", Arial, sans-serif`, a `1.05rem`/`700` wordmark, and `#596e6a` for the Sign In button background and border. Keep the logo width at `6.75rem`. In the `720px` media query, set the inner minimum height to `4.75rem` and keep the compact `6rem` logo.

- [ ] **Step 5: Run the focused test and verify pass**

Run the Step 2 command. Expected: all authentication theme tests PASS.

- [ ] **Step 6: Commit the focused fix**

```powershell
git add .powerpages-site/site-settings/Header-OutputCache-Enabled.sitesetting.yml .powerpages-site/web-templates/oiac-auth-header/OIAC-Auth-Header.webtemplate.source.html src/auth/powerPagesAuthTheme.test.ts
git commit -m "fix: scope and size native auth header"
```

### Task 2: Full Verification

**Files:**
- Verify only; no expected source changes.

**Interfaces:**
- Consumes: completed route and sizing fix.
- Produces: verified code ready for a separately authorized development deployment and cache restart.

- [ ] **Step 1: Run the complete test suite**

```powershell
npm test -- --no-file-parallelism --maxWorkers=1 --reporter=dot --silent
```

Expected: 42 test files and at least 260 tests PASS.

- [ ] **Step 2: Run the production build**

```powershell
npm run build
```

Expected: TypeScript and Vite complete with exit code 0.

- [ ] **Step 3: Review repository state**

Confirm the source changes are limited to the cache setting, auth header template, and regression test. Preserve the unrelated `Minimal Volunteer Portal Design.make` folder. Do not deploy or restart the site unless the user separately authorizes those shared-state actions.
