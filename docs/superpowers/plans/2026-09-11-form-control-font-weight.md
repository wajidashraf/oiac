# Form Control Font Weight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make values displayed by every application input, textarea, and select use normal font weight without changing labels or action typography.

**Architecture:** Add one baseline typography declaration to the shared theme so every current and future form control receives the same value weight. Protect the behavior with the existing raw-CSS regression test rather than changing individual React forms.

**Tech Stack:** CSS, TypeScript, Vitest, Vite

## Global Constraints

- Entered and selected values in `input`, `textarea`, and `select` controls must use `font-weight: 400`.
- Field labels, headings, buttons, radio-card labels, lookup results, and other interface text must retain their existing weights.
- Form state, validation, submission, accessibility attributes, and backend payloads must remain unchanged.
- Do not add dependencies or edit React component behavior.

---

### Task 1: Normalize Form Control Value Weight

**Files:**
- Modify: `oiac-engage/src/styles/designRegression.test.ts`
- Modify: `oiac-engage/src/styles/theme.css:53-55`

**Interfaces:**
- Consumes: the shared `theme.css` file imported as raw text by `designRegression.test.ts`
- Produces: a baseline CSS contract in which `input`, `textarea`, and `select` declare `font-weight: 400`

- [ ] **Step 1: Write the failing regression test**

Append this focused assertion to `oiac-engage/src/styles/designRegression.test.ts`:

```ts
test('renders form control values with normal font weight across the app', () => {
  const formControlTypography = css.match(/input,\s*textarea,\s*select\s*\{([^}]*)\}/s)?.[1]

  expect(formControlTypography).toBeDefined()
  expect(formControlTypography).toMatch(/font-weight:\s*400/)
})
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run from `oiac-engage`:

```powershell
npm test -- src/styles/designRegression.test.ts
```

Expected: FAIL in `renders form control values with normal font weight across the app` because no shared `input, textarea, select` block declares `font-weight: 400`.

- [ ] **Step 3: Add the minimal shared CSS rule**

Immediately after the existing inherited-font declaration in `oiac-engage/src/styles/theme.css`, add:

```css
input, textarea, select { font-weight: 400; }
```

Keep `button` out of this selector so action typography is unchanged.

- [ ] **Step 4: Run the focused test and verify it passes**

Run from `oiac-engage`:

```powershell
npm test -- src/styles/designRegression.test.ts
```

Expected: all tests in `designRegression.test.ts` PASS with no errors.

- [ ] **Step 5: Run full verification**

Run from `oiac-engage`:

```powershell
npm test
npm run build
```

Expected: the complete Vitest suite passes and the TypeScript/Vite production build exits successfully.

- [ ] **Step 6: Review and commit the implementation**

Confirm the diff changes only the regression test, shared stylesheet, and this plan. Then run from the repository root:

```powershell
git diff --check
git add -- docs/superpowers/plans/2026-09-11-form-control-font-weight.md oiac-engage/src/styles/designRegression.test.ts oiac-engage/src/styles/theme.css
git commit -m "fix: normalize form control text weight"
```
