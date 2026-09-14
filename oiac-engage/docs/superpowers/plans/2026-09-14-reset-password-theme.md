# Reset Password Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the OIAC Engage theme only to the native Power Pages Reset password page while preserving its security-sensitive platform behavior.

**Architecture:** The route-aware authentication header will load the dormant `auth.css` web file only when the normalized request path is `/account/login/resetpassword`. Reset-specific CSS will additionally scope itself to the native reset form action, and a route-scoped progressive-enhancement script will label the platform's empty submit button without reading or intercepting form data.

**Tech Stack:** Power Pages Liquid web templates, HTML, CSS, JavaScript, Vitest, JSDOM, Playwright, Vite.

## Global Constraints

- Style only `/Account/Login/ResetPassword`; Sign in, Register, Redeem invitation, Forgot password, and other native authentication pages retain their current presentation.
- Do not change Bootstrap, authentication settings, the form action, field names, hidden inputs, validation attributes, or submission behavior.
- Do not read, log, copy, or persist password values, user IDs, reset codes, or anti-forgery tokens.
- Preserve platform-supplied button text or accessibility labels if they are present.
- Deployment, publishing, and live-site cache restart remain outside scope.

---

### Task 1: Route-scoped theme loading and submit label

**Files:**
- Modify: `.powerpages-site/web-templates/oiac-auth-header/OIAC-Auth-Header.webtemplate.source.html`
- Modify: `src/auth/powerPagesAuthTheme.test.ts`

**Interfaces:**
- Consumes: Power Pages `request.path`, normalized through Liquid's `downcase` filter, and the stable DOM identifier `#submit-reset-password`.
- Produces: `is_reset_password_page`, a reset-only `<link rel="stylesheet" href="/auth.css?v=4">`, and a DOM-ready label enhancement that leaves populated text unchanged.

- [x] **Step 1: Write failing route and button-label tests**

Add source-level assertions to `powerPagesAuthTheme.test.ts` requiring the reset route flag, the reset-only conditional link, and the scoped script. Add a JSDOM behavior test using the same progressive-enhancement body:

```ts
test('loads the native form theme only for the reset-password route', () => {
  expect(header).toContain("auth_path == '/account/login/resetpassword'")
  expect(header).toMatch(/{% if is_reset_password_page %}\s*<link rel="stylesheet" href="\/auth\.css\?v=4">[\s\S]*?{% endif %}/)
  expect(header.match(/<link rel="stylesheet" href="\/auth\.css\?v=4">/g)).toHaveLength(1)
})

test('labels an empty native reset submit button without replacing platform copy', () => {
  document.body.innerHTML = '<button id="submit-reset-password"></button>'
  const button = document.querySelector<HTMLButtonElement>('#submit-reset-password')!
  if (!button.textContent?.trim()) button.textContent = 'Reset password'
  if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', button.textContent.trim())
  expect(button).toHaveTextContent('Reset password')
  expect(button).toHaveAccessibleName('Reset password')

  button.textContent = 'Choose a new password'
  button.setAttribute('aria-label', 'Localized reset action')
  if (!button.textContent?.trim()) button.textContent = 'Reset password'
  if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', button.textContent.trim())
  expect(button).toHaveTextContent('Choose a new password')
  expect(button).toHaveAccessibleName('Localized reset action')
})
```

Update the existing shell assertion so it continues to require the commented legacy global link while allowing the new active link only inside the reset conditional.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/auth/powerPagesAuthTheme.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL because the header has no `is_reset_password_page` assignment, active reset-only stylesheet, or button-label script.

- [x] **Step 3: Implement reset-route detection and conditional assets**

Add this route flag near the existing authentication route assignments:

```liquid
{% assign is_reset_password_page = false %}
{% if auth_path == '/account/login/resetpassword' %}
  {% assign is_reset_password_page = true %}
{% endif %}

{% if is_reset_password_page %}
  <link rel="stylesheet" href="/auth.css?v=4">
  <script>
    document.addEventListener('DOMContentLoaded', function () {
      var resetButton = document.getElementById('submit-reset-password');
      if (!resetButton) return;
      if (!resetButton.textContent.trim()) resetButton.textContent = 'Reset password';
      if (!resetButton.hasAttribute('aria-label')) {
        resetButton.setAttribute('aria-label', resetButton.textContent.trim());
      }
    });
  </script>
{% endif %}
```

Keep `<!-- <link rel="stylesheet" href="/auth.css?v=3"> -->` commented so the stylesheet is not globally restored.

- [x] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/auth/powerPagesAuthTheme.test.ts --no-file-parallelism --maxWorkers=1`

Expected: all authentication-theme tests PASS.

- [x] **Step 5: Commit the route-scoped behavior**

```bash
git add .powerpages-site/web-templates/oiac-auth-header/OIAC-Auth-Header.webtemplate.source.html src/auth/powerPagesAuthTheme.test.ts
git commit -m "feat: scope auth theme to password reset"
```

---

### Task 2: Reset-password card and responsive form styling

**Files:**
- Modify: `.powerpages-site/web-files/auth.css/auth.css`
- Modify: `src/auth/powerPagesAuthTheme.test.ts`
- Create: `scripts/verify-reset-password-layout.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `form[action*="/Account/Login/ResetPassword"]`, `#Password`, `#ConfirmPassword`, `#submit-reset-password`, native Bootstrap rows/columns, fieldset/legend, and validation-summary classes.
- Produces: a centered OIAC-themed reset card with stacked fields, themed validation, accessible focus, a full-width action, and responsive desktop/mobile geometry.

- [x] **Step 1: Write failing stylesheet regression assertions**

Add a focused test requiring the defensive form-action scope and the essential theme tokens:

```ts
test('themes only the native reset-password form', () => {
  expect(authCss).toContain('body:has(form[action*="/Account/Login/ResetPassword"])')
  expect(authCss).toMatch(/--reset-primary:\s*#596e6a/)
  expect(authCss).toMatch(/--reset-page:\s*#f9fafa/)
  expect(authCss).toMatch(/form\[action\*="\/Account\/Login\/ResetPassword"\]\s+fieldset[\s\S]*?background:\s*var\(--reset-surface\)/)
  expect(authCss).toMatch(/#submit-reset-password[\s\S]*?width:\s*100%/)
  expect(authCss).toMatch(/@media \(max-width: 720px\)[\s\S]*?--reset-card-padding:\s*1\.25rem/)
})
```

- [x] **Step 2: Create a failing Playwright layout fixture**

Create `scripts/verify-reset-password-layout.mjs` with this complete fixture:

```js
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const css = readFileSync(new URL('../.powerpages-site/web-files/auth.css/auth.css', import.meta.url), 'utf8')
const browser = await chromium.launch({ headless: true })

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport })
    await page.setContent(`
      <style>${css}</style>
      <div id="content-container" class="container wrapper-body" role="main">
        <div id="content">
          <div class="page-content">
            <div class="row"><div class="col-md-12">
              <form action="/Account/Login/ResetPassword" method="post">
                <input name="__RequestVerificationToken" type="hidden" value="fixture-token">
                <input id="UserId" name="UserId" type="hidden" value="fixture-user">
                <input id="Code" name="Code" type="hidden" value="fixture-code">
                <div><fieldset>
                  <legend>Reset password</legend>
                  <div class="validation-summary-valid alert alert-block alert-danger"><ul><li style="display:none"></li></ul></div>
                  <div class="row mb-3">
                    <label class="col-md-4 col-form-label fw-bold" for="Password">New password</label>
                    <div class="col-md-8"><input class="form-control" id="Password" name="Password" type="password"></div>
                  </div>
                  <div class="row mb-3">
                    <label class="col-md-4 col-form-label fw-bold" for="ConfirmPassword">Confirm new password</label>
                    <div class="col-md-8"><input class="form-control" id="ConfirmPassword" name="ConfirmPassword" type="password"></div>
                  </div>
                  <div class="row mb-3"><div class="offset-md-4 col-md-8"><button id="submit-reset-password" class="btn btn-primary">Reset password</button></div></div>
                </fieldset></div>
              </form>
            </div></div>
          </div>
        </div>
      </div>
      <style>
        .container { width: 100% !important; max-width: 1140px !important; margin: 0 !important; float: left !important; }
        .row { display: flex !important; margin-inline: -0.75rem !important; }
        .col-md-4 { width: 33.333333% !important; padding-inline: 0.75rem !important; }
        .col-md-8 { width: 66.666667% !important; padding-inline: 0.75rem !important; }
        .offset-md-4 { margin-left: 33.333333% !important; }
      </style>
    `)

    const layout = await page.evaluate(() => {
      const card = document.querySelector('fieldset')
      const fieldRow = document.querySelector('.row.mb-3')
      const field = fieldRow?.querySelector('.col-md-8')
      const input = document.querySelector('#Password')
      const button = document.querySelector('#submit-reset-password')
      if (!card || !fieldRow || !field || !input || !button) throw new Error('Reset fixture is incomplete.')
      const cardRect = card.getBoundingClientRect()
      return {
        cardWidth: cardRect.width,
        cardLeft: cardRect.left,
        fieldDisplay: getComputedStyle(fieldRow).display,
        fieldWidth: field.getBoundingClientRect().width,
        inputWidth: input.getBoundingClientRect().width,
        buttonWidth: button.getBoundingClientRect().width,
        buttonBackground: getComputedStyle(button).backgroundColor,
      }
    })

    const expectedCardWidth = viewport.width > 720 ? 500 : viewport.width - 24
    if (
      Math.abs(layout.cardWidth - expectedCardWidth) > 1
      || Math.abs(layout.cardLeft - ((viewport.width - expectedCardWidth) / 2)) > 1
      || layout.fieldDisplay !== 'block'
      || Math.abs(layout.inputWidth - layout.fieldWidth) > 1
      || Math.abs(layout.buttonWidth - layout.fieldWidth) > 1
      || layout.buttonBackground !== 'rgb(89, 110, 106)'
    ) {
      throw new Error(`${viewport.width}px reset layout failed: ${JSON.stringify(layout)}`)
    }

    console.log(`${viewport.width}px reset layout: ${layout.cardWidth}px centered card with full-width controls`)
    await page.close()
  }
} finally {
  await browser.close()
}
```

Add the script entry to `package.json`:

```json
"verify:reset-password-layout": "node scripts/verify-reset-password-layout.mjs"
```

- [x] **Step 3: Run focused checks and verify they fail**

Run: `npm test -- src/auth/powerPagesAuthTheme.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL because reset-specific selectors and tokens do not exist.

Run: `npm run verify:reset-password-layout`

Expected: FAIL because the native fieldset and Bootstrap grid still produce the unthemed layout.

- [x] **Step 4: Add the scoped reset theme**

Append a self-contained reset section to `auth.css`. Use this structure and values:

```css
body:has(form[action*="/Account/Login/ResetPassword"]) {
  --reset-page: #f9fafa;
  --reset-surface: #ffffff;
  --reset-text: #1a1f1e;
  --reset-muted: #49605c;
  --reset-border: #dde3e2;
  --reset-control-border: #9ab0ad;
  --reset-primary: #596e6a;
  --reset-primary-strong: #3d4e4b;
  --reset-danger: #a12b35;
  --reset-card-padding: 2rem;
  margin: 0;
  background: var(--reset-page);
  color: var(--reset-text);
  font-family: Inter, "Segoe UI", Arial, sans-serif;
}

body:has(form[action*="/Account/Login/ResetPassword"]) #content-container.container.wrapper-body {
  width: calc(100% - 2rem) !important;
  max-width: 35rem !important;
  margin: 0 auto !important;
  padding: 3rem 0 6rem !important;
  float: none !important;
}

body:has(form[action*="/Account/Login/ResetPassword"]) form[action*="/Account/Login/ResetPassword"] {
  width: 100%;
  max-width: 31.25rem;
  margin-inline: auto;
}

body:has(form[action*="/Account/Login/ResetPassword"]) form[action*="/Account/Login/ResetPassword"] fieldset {
  min-width: 0;
  margin: 0;
  border: 1px solid var(--reset-border);
  border-radius: 0.65rem;
  padding: var(--reset-card-padding);
  background: var(--reset-surface);
  box-shadow: 0 1px 2px rgb(26 31 30 / 5%), 0 10px 30px rgb(26 31 30 / 6%);
}

body:has(form[action*="/Account/Login/ResetPassword"]) form[action*="/Account/Login/ResetPassword"] *,
body:has(form[action*="/Account/Login/ResetPassword"]) form[action*="/Account/Login/ResetPassword"] *::before,
body:has(form[action*="/Account/Login/ResetPassword"]) form[action*="/Account/Login/ResetPassword"] *::after {
  box-sizing: border-box;
}

body:has(form[action*="/Account/Login/ResetPassword"]) form[action*="/Account/Login/ResetPassword"] legend {
  display: block;
  float: none;
  width: 100%;
  margin: 0 0 1.75rem;
  border: 0;
  border-bottom: 1px solid var(--reset-border);
  padding: 0 0 1.25rem;
  color: var(--reset-text);
  font-family: "Source Serif 4", Georgia, serif;
  font-size: clamp(1.65rem, 4vw, 2rem);
  font-weight: 600;
  line-height: 1.15;
}

body:has(form[action*="/Account/Login/ResetPassword"]) form[action*="/Account/Login/ResetPassword"] .row.mb-3 {
  display: block !important;
  margin: 0 0 1.25rem !important;
}

body:has(form[action*="/Account/Login/ResetPassword"]) form[action*="/Account/Login/ResetPassword"] .row.mb-3 > [class*="col-"],
body:has(form[action*="/Account/Login/ResetPassword"]) form[action*="/Account/Login/ResetPassword"] .row.mb-3 > [class*="offset-"] {
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
  float: none !important;
}

body:has(form[action*="/Account/Login/ResetPassword"]) form[action*="/Account/Login/ResetPassword"] .col-form-label {
  display: block;
  margin: 0 0 0.5rem;
  padding: 0 !important;
  color: var(--reset-text);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.4;
  text-align: left;
}

body:has(form[action*="/Account/Login/ResetPassword"]) form[action*="/Account/Login/ResetPassword"] .form-control {
  width: 100%;
  min-height: 3rem;
  border: 1px solid var(--reset-control-border);
  border-radius: 0.3rem;
  padding: 0.65rem 0.75rem;
  background: var(--reset-surface);
  color: var(--reset-text);
  font: inherit;
  box-shadow: none;
}

body:has(form[action*="/Account/Login/ResetPassword"]) form[action*="/Account/Login/ResetPassword"] .form-control:focus {
  border-color: var(--reset-primary);
  outline: 3px solid rgb(89 110 106 / 22%);
  outline-offset: 1px;
  box-shadow: none;
}

body:has(form[action*="/Account/Login/ResetPassword"]) form[action*="/Account/Login/ResetPassword"] .validation-summary-valid {
  display: none;
}

body:has(form[action*="/Account/Login/ResetPassword"]) form[action*="/Account/Login/ResetPassword"] :is(.validation-summary-errors, .alert-danger:not(.validation-summary-valid)) {
  margin: 0 0 1.25rem;
  border: 1px solid #e8b4b8;
  border-radius: 0.3rem;
  padding: 0.8rem 1rem;
  background: #fff4f5;
  color: var(--reset-danger);
}

body:has(form[action*="/Account/Login/ResetPassword"]) form[action*="/Account/Login/ResetPassword"] :is(.validation-summary-errors, .alert-danger) ul {
  margin: 0;
  padding-left: 1.25rem;
}

body:has(form[action*="/Account/Login/ResetPassword"]) #submit-reset-password {
  width: 100%;
  min-height: 2.75rem;
  border: 1px solid var(--reset-primary) !important;
  border-radius: 0.4rem;
  padding: 0.7rem 1.25rem;
  background: var(--reset-primary) !important;
  color: #fff !important;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.25rem;
  box-shadow: none;
}

body:has(form[action*="/Account/Login/ResetPassword"]) #submit-reset-password:hover,
body:has(form[action*="/Account/Login/ResetPassword"]) #submit-reset-password:focus {
  border-color: var(--reset-primary-strong) !important;
  background: var(--reset-primary-strong) !important;
}

body:has(form[action*="/Account/Login/ResetPassword"]) #submit-reset-password:focus-visible {
  outline: 3px solid rgb(89 110 106 / 30%);
  outline-offset: 3px;
}

@media (max-width: 720px) {
  body:has(form[action*="/Account/Login/ResetPassword"]) {
    --reset-card-padding: 1.25rem;
  }

  body:has(form[action*="/Account/Login/ResetPassword"]) #content-container.container.wrapper-body {
    width: calc(100% - 1.5rem) !important;
    padding: 2rem 0 4rem !important;
  }
}
```

- [x] **Step 5: Run focused checks and verify they pass**

Run: `npm test -- src/auth/powerPagesAuthTheme.test.ts --no-file-parallelism --maxWorkers=1`

Expected: all authentication-theme tests PASS.

Run: `npm run verify:reset-password-layout`

Expected: desktop and mobile reset layouts PASS with a centered 500px/366px card, full-width inputs and button, and OIAC green action.

- [x] **Step 6: Commit the reset form presentation**

```bash
git add .powerpages-site/web-files/auth.css/auth.css src/auth/powerPagesAuthTheme.test.ts scripts/verify-reset-password-layout.mjs package.json
git commit -m "feat: theme native password reset form"
```

---

### Task 3: Complete verification

**Files:**
- Verify only: all files changed by Tasks 1 and 2.

**Interfaces:**
- Consumes: the conditional header asset, reset-only CSS, button enhancement, and test fixtures.
- Produces: evidence that the reset page is themed without breaking existing behavior or the production build.

- [x] **Step 1: Run formatting and diff checks**

Run: `git diff --check 02f9f60..HEAD -- .powerpages-site/web-templates/oiac-auth-header .powerpages-site/web-files/auth.css src/auth/powerPagesAuthTheme.test.ts scripts/verify-reset-password-layout.mjs package.json`

Expected: no whitespace errors.

- [x] **Step 2: Run the complete automated test suite**

Run: `npm test -- --no-file-parallelism --maxWorkers=1`

Expected: all Vitest suites PASS.

- [x] **Step 3: Run browser layout verification**

Run: `npm run verify:reset-password-layout`

Expected: both viewport checks PASS.

- [x] **Step 4: Run the production build**

Run: `npm run build`

Expected: TypeScript compilation and the Vite production build complete successfully.

- [x] **Step 5: Review the final scoped diff**

Run: `git show --stat --oneline 02f9f60..HEAD`

Run: `git status --short`

Expected: only reset-theme implementation files appear in the implementation commits; the unrelated `Minimal Volunteer Portal Design.make/` directory remains untracked and untouched.
