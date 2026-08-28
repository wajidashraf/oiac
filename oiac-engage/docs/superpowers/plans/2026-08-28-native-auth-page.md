# Native Authentication Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved OIAC design to native Power Pages authentication screens with a 42rem outer shell and a 500px form.

**Architecture:** Create a dedicated `/auth.css` Power Pages web file and load it from the native authentication header template after Bootstrap. Keep the template visually empty, preserve native authentication markup and behavior, and protect the layout with focused regression tests and a browser fixture matching the supplied Power Pages DOM.

**Tech Stack:** Power Pages web files and web templates, CSS, Liquid/HTML, Vitest, Playwright, PAC CLI metadata.

## Global Constraints

- Do not modify `.powerpages-site/web-files/bootstrap.min.css/bootstrap.min.css`.
- Outer authentication content maximum width is exactly `42rem`.
- Native form maximum width is exactly `31.25rem` (500px).
- Show only Sign in and Redeem invitation; do not enable open registration.
- Do not add demo-role buttons or demo credential behavior.
- Keep the authentication footer empty and render no visible authentication header.

---

### Task 1: Native authentication stylesheet contract

**Files:**
- Create: `.powerpages-site/web-files/auth.css/auth.css`
- Create: `.powerpages-site/web-files/auth.css/auth.css.webfile.yml`
- Modify: `.powerpages-site/web-templates/oiac-auth-header/OIAC-Auth-Header.webtemplate.source.html`
- Modify: `src/auth/powerPagesAuthTheme.test.ts`

**Interfaces:**
- Consumes: Native Power Pages selectors `.nav-account`, `.portal-form`, `.form-horizontal`, `.forgot-password`, `.wrapper-body`, and Bootstrap grid classes.
- Produces: Same-origin stylesheet `/auth.css` loaded by the native header template after platform styles.

- [ ] **Step 1: Write failing stylesheet integration tests**

Import `auth.css`, its web-file YAML, and `bootstrap.min.css` as raw fixtures. Assert that the header contains `<link rel="stylesheet" href="/auth.css?v=1">`, contains no visible header element, the footer stays empty, Bootstrap does not contain the OIAC auth marker, the outer width is `42rem`, the form width is `31.25rem`, and no Register/demo-role copy is introduced.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- src/auth/powerPagesAuthTheme.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose`

Expected: FAIL because `auth.css` and its metadata do not exist and the auth header is empty.

- [ ] **Step 3: Create the web file and stylesheet link**

Create Power Pages web-file metadata using new stable GUIDs, `partialurl: auth.css`, `mimetype: text/css`, `displayorder: 3`, and the existing Home parent page and Published state IDs. Make the auth header template contain only:

```html
<link rel="stylesheet" href="/auth.css?v=1">
```

- [ ] **Step 4: Implement the scoped reference design**

Define `--auth-shell-width: 42rem` and `--auth-form-width: 31.25rem`. Center `#content-container.container.wrapper-body`, override descendant Bootstrap rows and columns, keep tabs across the outer shell, constrain `.portal-form` and `.form-horizontal` to 500px, align desktop labels in a 7rem/flexible grid with a 1rem gap, style native fields and buttons, and stack controls below 720px. Do not generate additional navigation or demo-role content.

- [ ] **Step 5: Run the focused test and verify pass**

Run: `npm test -- src/auth/powerPagesAuthTheme.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose`

Expected: PASS.

### Task 2: Browser regression and full verification

**Files:**
- Modify: `scripts/verify-auth-layout.mjs`

**Interfaces:**
- Consumes: `.powerpages-site/web-files/auth.css/auth.css` and a fixture matching the supplied native Sign-in DOM.
- Produces: Executable regression proof for desktop and mobile widths.

- [ ] **Step 1: Update the browser fixture and expectations**

Load `auth.css`, include the two native tabs and complete `.portal-form` rows, and add later Bootstrap conflict rules. At 1440px assert the shell is 672px wide, the form is 500px wide, both are centered, and the active tab uses the blue reference border. At 390px assert the shell and form shrink to 366px and labels stack.

- [ ] **Step 2: Run the browser regression**

Run: `node scripts/verify-auth-layout.mjs`

Expected: Both 1440px and 390px checks pass.

- [ ] **Step 3: Run the full test suite**

Run: `npm test -- --no-file-parallelism --maxWorkers=1`

Expected: All tests pass.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite complete successfully.

- [ ] **Step 5: Review the implementation diff**

Run: `git diff -- .powerpages-site/web-files/auth.css .powerpages-site/web-templates/oiac-auth-header src/auth/powerPagesAuthTheme.test.ts scripts/verify-auth-layout.mjs`

Expected: Only the approved authentication stylesheet, link, metadata, and regression coverage are present; Bootstrap is unchanged.
