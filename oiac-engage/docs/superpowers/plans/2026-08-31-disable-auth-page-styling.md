# Temporarily Disable Authentication Page Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop loading OIAC's custom authentication stylesheet on Sign in, Register, and Redeem invitation pages while preserving an easy one-line restoration path.

**Architecture:** Keep the `auth.css` web file and metadata intact. Change only the shared `OIAC-Auth-Header` template so its stylesheet element is inside an HTML comment; all three native Power Pages authentication tabs will therefore fall back to the portal theme.

**Tech Stack:** Power Pages web templates, HTML, Vitest, Vite.

## Global Constraints

- Do not change authentication settings or behavior.
- Do not delete or modify `auth.css` or its web-file metadata.
- The active header output must contain no executable `/auth.css` stylesheet link.

---

### Task 1: Disable the shared authentication stylesheet

**Files:**
- Modify: `src/auth/powerPagesAuthTheme.test.ts`
- Modify: `.powerpages-site/web-templates/oiac-auth-header/OIAC-Auth-Header.webtemplate.source.html`

**Interfaces:**
- Consumes: Power Pages renders the shared auth header on Sign in, Register, and Redeem invitation pages.
- Produces: An HTML-commented `/auth.css?v=3` reference that browsers do not execute.

- [ ] **Step 1: Write the failing test**

Change the header assertion to require `<!-- <link rel="stylesheet" href="/auth.css?v=3"> -->` and reject a standalone active `<link>` element.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/auth/powerPagesAuthTheme.test.ts --no-file-parallelism --maxWorkers=1`

Expected: failure because the current template still contains an active stylesheet link.

- [ ] **Step 3: Implement the minimal template change**

Replace the template line with:

```html
<!-- <link rel="stylesheet" href="/auth.css?v=3"> -->
```

- [ ] **Step 4: Run focused verification**

Run: `npm test -- src/auth/powerPagesAuthTheme.test.ts src/auth/powerPagesAuthSettings.test.ts --no-file-parallelism --maxWorkers=1`

Expected: all authentication theme and settings tests pass.

- [ ] **Step 5: Run production verification**

Run: `npm run build`

Expected: TypeScript and Vite production build complete successfully.
