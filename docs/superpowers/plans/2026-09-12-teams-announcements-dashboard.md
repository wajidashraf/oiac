# Live Teams Announcements Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static Teams Announcements dashboard card with currently active Dataverse announcements and an accessible backdrop modal for full details.

**Architecture:** A focused service will query and validate active announcement records through the existing Power Pages Web API client. `useHomeDashboardData` will own an independent announcement load lifecycle, while Home owns only the selected row and modal presentation state. Power Pages metadata will expose the minimum fields through an authenticated, global, read-only permission.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, React Icons, Power Pages Web API, Dataverse, Power Pages YAML metadata.

## Global Constraints

- Read from `/_api/mss_teamsannouncementses`; do not introduce jQuery or `webapi.safeAjax`.
- An announcement is eligible only when valid `mss_startdate <= current date/time <= mss_enddate`; missing or invalid boundary dates are excluded.
- Rows show only title, formatted start date, and a conditional link icon.
- The link icon is non-interactive and appears only for a valid HTTP/HTTPS `mss_announcementlink`.
- Clicking a row opens a modal with title, start date, full multiline content, Close, and a conditional `Open announcement` link.
- The end date is used for filtering and is never displayed.
- The list shows at most five normal row heights and remains vertically scrollable with hidden scrollbar chrome.
- Announcement loading and retry state must remain independent of reports, registrations, and meeting invites.
- Do not grant create, write, delete, append, or append-to privileges for Teams Announcements.
- Do not deploy or clear a site cache without a separate explicit environment choice.
- Preserve the unrelated untracked `Minimal Volunteer Portal Design.make/` directory.

---

## File Structure

- Create `oiac-engage/src/features/teamAnnouncements/teamAnnouncementTypes.ts`: public normalized announcement type and query options.
- Create `oiac-engage/src/features/teamAnnouncements/teamAnnouncementService.ts`: Web API query, validation, active-window filtering, link normalization, and sorting.
- Create `oiac-engage/src/features/teamAnnouncements/teamAnnouncementService.test.ts`: service contract and boundary tests.
- Create `oiac-engage/src/features/teamAnnouncements/TeamAnnouncementModal.tsx`: accessible backdrop dialog, focus management, and conditional external link.
- Create `oiac-engage/src/features/teamAnnouncements/TeamAnnouncementModal.test.tsx`: modal interaction and accessibility tests.
- Modify `oiac-engage/src/features/dashboard/useHomeDashboardData.ts`: independent announcements state and retry effect.
- Modify `oiac-engage/src/features/dashboard/useHomeDashboardData.test.tsx`: loading, cancellation, isolation, failure, and retry tests.
- Modify `oiac-engage/src/pages/Home.tsx`: live announcement rows, selection state, conditional icon, and modal.
- Modify `oiac-engage/src/pages/Home.test.tsx`: operational card, row, scroll, modal-opening, and state tests.
- Modify `oiac-engage/src/data/dashboardData.ts`: remove the obsolete static announcement type and array.
- Modify `oiac-engage/src/styles/theme.css`: five-row viewport, row buttons, link indicator, and responsive modal styling.
- Create `oiac-engage/src/features/teamAnnouncements/teamAnnouncementPowerPagesConfig.test.ts`: settings and permission contract.
- Create four generated integration metadata artifacts only if live metadata confirms the supplied names: three site settings and one table permission. Update the existing skill-tracking setting during final verification.

---

### Task 1: Active Teams Announcements Service

**Files:**
- Create: `oiac-engage/src/features/teamAnnouncements/teamAnnouncementTypes.ts`
- Create: `oiac-engage/src/features/teamAnnouncements/teamAnnouncementService.ts`
- Test: `oiac-engage/src/features/teamAnnouncements/teamAnnouncementService.test.ts`

**Interfaces:**
- Consumes: `powerPagesFetch<T>(path, options)` from `src/shared/powerPagesApi.ts`.
- Produces: `TeamAnnouncement`, `TeamAnnouncementQuery`, and `getActiveTeamAnnouncements(options?): Promise<readonly TeamAnnouncement[]>`.

- [ ] **Step 1: Write the failing service tests**

Mock `powerPagesFetch` and define a fixed instant of `2026-09-12T14:30:00.000Z`. Assert that the request decodes to the following field list, active-window filter, and sort:

```ts
const decodedUrl = decodeURIComponent(mock.calls[0][0]).replace(/\+/g, ' ')
expect(decodedUrl).toContain('$select=mss_teamsannouncementsid,mss_announcementlink,mss_content,mss_enddate,mss_startdate,mss_title')
expect(decodedUrl).toContain(
  '$filter=mss_startdate le 2026-09-12T14:30:00.000Z and mss_enddate ge 2026-09-12T14:30:00.000Z',
)
expect(decodedUrl).toContain('$orderby=mss_startdate desc,mss_teamsannouncementsid asc')
```

Return fixtures containing an active range, an inclusive start boundary, an inclusive end boundary, a future range, an expired range, missing boundaries, invalid dates, a valid HTTPS link, a valid HTTP link, a blank link, and a `javascript:` link. Assert that post-validation keeps only active records, sorts newest first with ID ties, preserves content, and normalizes only HTTP/HTTPS URLs. Also assert malformed envelopes and invalid `now` values reject with safe messages.

- [ ] **Step 2: Run the service test and verify RED**

Run:

```powershell
npm test -- src/features/teamAnnouncements/teamAnnouncementService.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because the types and service do not exist.

- [ ] **Step 3: Add the public types**

Create:

```ts
export type TeamAnnouncement = {
  readonly id: string
  readonly title: string
  readonly content: string
  readonly startDateTime: string
  readonly endDateTime: string
  readonly link: string | null
}

export type TeamAnnouncementQuery = {
  readonly now?: Date
  readonly signal?: AbortSignal
}
```

- [ ] **Step 4: Implement the minimal validated service**

Build the request with `URLSearchParams`:

```ts
const select = [
  'mss_teamsannouncementsid',
  'mss_announcementlink',
  'mss_content',
  'mss_enddate',
  'mss_startdate',
  'mss_title',
].join(',')

const instant = now.toISOString()
const params = new URLSearchParams({
  $select: select,
  $filter: `mss_startdate le ${instant} and mss_enddate ge ${instant}`,
  $orderby: 'mss_startdate desc,mss_teamsannouncementsid asc',
})
```

Validate a collection envelope before mapping. Normalize GUID braces and case. Require non-empty titles, string content, valid start and end dates, and `start <= now <= end`. Normalize links with:

```ts
function normalizeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}
```

Sort the mapped result by parsed start time descending and normalized ID ascending. Forward `options.signal` to `powerPagesFetch`.

- [ ] **Step 5: Run the service test and verify GREEN**

Run the Task 1 test command. Expected: all service tests PASS.

- [ ] **Step 6: Commit the service slice**

```powershell
git add oiac-engage/src/features/teamAnnouncements/teamAnnouncementTypes.ts oiac-engage/src/features/teamAnnouncements/teamAnnouncementService.ts oiac-engage/src/features/teamAnnouncements/teamAnnouncementService.test.ts
git commit -m "feat: load active teams announcements"
```

---

### Task 2: Independent Dashboard Announcement State

**Files:**
- Modify: `oiac-engage/src/features/dashboard/useHomeDashboardData.ts`
- Modify: `oiac-engage/src/features/dashboard/useHomeDashboardData.test.tsx`

**Interfaces:**
- Consumes: `getActiveTeamAnnouncements({ signal })` and `TeamAnnouncement` from Task 1.
- Produces these additions to `HomeDashboardData`:

```ts
readonly teamAnnouncements: readonly TeamAnnouncement[]
readonly announcementsStatus: DashboardLoadStatus
readonly retryAnnouncements: () => void
```

- [ ] **Step 1: Write failing hook tests**

Mock `getActiveTeamAnnouncements`. Extend the default fixture so existing hook tests remain ready. Add tests that assert:

```ts
expect(result.current.announcementsStatus).toBe('ready')
expect(result.current.teamAnnouncements).toEqual([announcement])
expect(getActiveTeamAnnouncements).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) })
```

Capture the passed signal and assert it is aborted after unmount. Reject only the announcement request and assert reports, registrations, and invites still become ready. Call `retryAnnouncements`, wait for a second announcement request, and assert report, registration, and invite call counts do not change.

- [ ] **Step 2: Run the hook test and verify RED**

```powershell
npm test -- src/features/dashboard/useHomeDashboardData.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because the hook exposes no announcement fields.

- [ ] **Step 3: Implement a separate announcement effect**

Add state and a dedicated primitive retry key:

```ts
const [teamAnnouncements, setTeamAnnouncements] = useState<readonly TeamAnnouncement[]>([])
const [announcementsStatus, setAnnouncementsStatus] = useState<DashboardLoadStatus>('loading')
const [announcementRetryKey, setAnnouncementRetryKey] = useState(0)
const retryAnnouncements = useCallback(
  () => setAnnouncementRetryKey((value) => value + 1),
  [],
)
```

Use an effect depending only on `announcementRetryKey`. Create its own `AbortController`, set loading and clear the old collection, call `getActiveTeamAnnouncements({ signal })`, ignore completion after abort, then set ready or error. Return all three new values from the hook.

- [ ] **Step 4: Run the hook test and verify GREEN**

Run the Task 2 test command. Expected: all dashboard-hook tests PASS.

- [ ] **Step 5: Commit the dashboard-state slice**

```powershell
git add oiac-engage/src/features/dashboard/useHomeDashboardData.ts oiac-engage/src/features/dashboard/useHomeDashboardData.test.tsx
git commit -m "feat: manage teams announcements dashboard state"
```

---

### Task 3: Accessible Announcement Details Modal

**Files:**
- Create: `oiac-engage/src/features/teamAnnouncements/TeamAnnouncementModal.tsx`
- Test: `oiac-engage/src/features/teamAnnouncements/TeamAnnouncementModal.test.tsx`

**Interfaces:**
- Consumes: `TeamAnnouncement` from Task 1.
- Produces:

```ts
export type TeamAnnouncementModalProps = {
  readonly announcement: TeamAnnouncement
  readonly formattedStartDate: string
  readonly returnFocusTo: HTMLButtonElement | null
  readonly onClose: () => void
}
```

- [ ] **Step 1: Write failing modal tests**

Render a linked announcement and assert a named `dialog` contains title, start date, and complete multiline content. Assert `Open announcement` has the normalized `href`, `target="_blank"`, and `rel="noopener noreferrer"`. Render a linkless announcement and assert no link exists.

Add interaction tests that assert the Close button receives initial focus, Tab and Shift+Tab wrap between the modal's focusable controls, Escape calls `onClose`, clicking the backdrop calls `onClose`, clicking the dialog does not, `document.body.style.overflow` becomes `hidden` while mounted, and unmount restores both body overflow and focus to `returnFocusTo`.

- [ ] **Step 2: Run the modal test and verify RED**

```powershell
npm test -- src/features/teamAnnouncements/TeamAnnouncementModal.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because the modal does not exist.

- [ ] **Step 3: Implement dialog structure and focus lifecycle**

Render a fixed backdrop and dialog:

```tsx
<div className="team-announcement-modal" onMouseDown={handleBackdropMouseDown}>
  <section
    ref={dialogRef}
    className="team-announcement-modal__dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    onMouseDown={(event) => event.stopPropagation()}
  >
    {/* title, start date, content, optional external link, Close */}
  </section>
</div>
```

On mount, store the current body overflow, set it to `hidden`, focus the Close button, and register one `keydown` handler. Escape closes. For Tab, query enabled anchors and buttons inside `dialogRef`, then wrap first/last focus in both directions. Cleanup restores overflow, removes the handler, and focuses `returnFocusTo`.

Preserve multiline content with a dedicated element whose CSS uses `white-space: pre-wrap`. Render the external link only when `announcement.link` is non-null.

- [ ] **Step 4: Run the modal test and verify GREEN**

Run the Task 3 test command. Expected: all modal tests PASS.

- [ ] **Step 5: Commit the modal slice**

```powershell
git add oiac-engage/src/features/teamAnnouncements/TeamAnnouncementModal.tsx oiac-engage/src/features/teamAnnouncements/TeamAnnouncementModal.test.tsx
git commit -m "feat: add teams announcement detail modal"
```

---

### Task 4: Live Teams Announcements Card

**Files:**
- Modify: `oiac-engage/src/pages/Home.tsx`
- Modify: `oiac-engage/src/pages/Home.test.tsx`
- Modify: `oiac-engage/src/data/dashboardData.ts`
- Modify: `oiac-engage/src/styles/theme.css`

**Interfaces:**
- Consumes: Task 2 dashboard announcement fields and Task 3 `TeamAnnouncementModal`.
- Produces: the operational Teams Announcements card and modal-opening interaction.

- [ ] **Step 1: Write failing Home tests**

Extend `dashboardData()` with `teamAnnouncements`, `announcementsStatus`, and `retryAnnouncements`. Add ready fixtures with one valid link and one null link. Assert the Teams Announcements card no longer has `Coming Soon`, `aria-disabled`, or `dashboard-panel--coming-soon`.

Assert each row is a button named `View <title>`, only the title and formatted start date are visible, and only the linked row contains an element with accessible label `<title> has an external link`. Confirm neither end date nor content is visible before selection.

Click a linked row and assert its named dialog shows full content, start date, and `Open announcement`. Close it and confirm focus returns to the clicked row. Click the linkless row and assert no external link appears. Add loading, empty, error, and retry assertions.

Add CSS regression assertions for:

```ts
expect(css).toMatch(/\.dashboard-announcement-scroll\s*\{[^}]*max-height:\s*calc\(var\(--dashboard-row-height\)\s*\*\s*5\)/s)
expect(css).toMatch(/\.dashboard-announcement-scroll\s*\{[^}]*overflow-y:\s*auto/s)
expect(css).toMatch(/\.dashboard-announcement-scroll::-webkit-scrollbar\s*\{[^}]*display:\s*none/s)
```

- [ ] **Step 2: Run Home tests and verify RED**

```powershell
npm test -- src/pages/Home.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because Home still renders the static disabled list.

- [ ] **Step 3: Remove obsolete static announcement data**

Delete `DashboardAnnouncement` and `dashboardAnnouncements` from `dashboardData.ts`, and remove their Home import.

- [ ] **Step 4: Render the operational card and modal**

Import `LuExternalLink`, `TeamAnnouncementModal`, and `TeamAnnouncement`. Store selection as:

```ts
type SelectedAnnouncement = {
  readonly announcement: TeamAnnouncement
  readonly trigger: HTMLButtonElement
}

const [selectedAnnouncement, setSelectedAnnouncement] = useState<SelectedAnnouncement | null>(null)
```

Render loading, error with a dedicated `Try loading Teams announcements again` label, empty, and ready states. In ready state, use a keyboard-focusable scroll region wrapping a semantic list. Each list item contains one full-width row button; its click handler stores `event.currentTarget` with the announcement. Render `LuExternalLink` in a labeled non-interactive span only when `announcement.link` exists.

Use the existing Eastern Time formatter behavior to show a value such as `Sep 12, 2026 · 10:30 AM ET`. Render `TeamAnnouncementModal` after the dashboard when selection is non-null and clear selection through its `onClose` callback.

- [ ] **Step 5: Add focused card and modal styles**

Add `.dashboard-announcement-scroll` with five-row maximum height, `overflow-y: auto`, `scrollbar-width: none`, hidden WebKit scrollbar, and a visible focus outline. Replace marker-based list styling with a full-width row button, clear hover/focus states, truncated-safe title layout, and a fixed-size link indicator.

Add `.team-announcement-modal` as a viewport-fixed backdrop with a centered responsive dialog. Style a bounded content area, preserved line breaks, stacked mobile actions, and minimum 44-pixel interactive targets. Reuse existing color, radius, spacing, and button variables rather than adding a new visual system.

- [ ] **Step 6: Run Home and modal tests and verify GREEN**

```powershell
npm test -- src/pages/Home.test.tsx src/features/teamAnnouncements/TeamAnnouncementModal.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: all card and modal tests PASS.

- [ ] **Step 7: Commit the UI slice**

```powershell
git add oiac-engage/src/pages/Home.tsx oiac-engage/src/pages/Home.test.tsx oiac-engage/src/data/dashboardData.ts oiac-engage/src/styles/theme.css
git commit -m "feat: render live teams announcements"
```

---

### Task 5: Power Pages Web API Settings and Permission

**Files:**
- Create: `oiac-engage/src/features/teamAnnouncements/teamAnnouncementPowerPagesConfig.test.ts`
- Create with deterministic scripts after metadata validation: `oiac-engage/.powerpages-site/site-settings/Webapi-mss_teamsannouncements-enabled.sitesetting.yml`
- Create with deterministic scripts after metadata validation: `oiac-engage/.powerpages-site/site-settings/Webapi-mss_teamsannouncements-fields.sitesetting.yml`
- Create with deterministic scripts after metadata validation: `oiac-engage/.powerpages-site/site-settings/Webapi-mss_teamsannouncements-disableodatafilter.sitesetting.yml`
- Create with deterministic scripts after metadata validation: `oiac-engage/.powerpages-site/table-permissions/Authenticated-Teams-Announcements-Global-Read.tablepermission.yml`

**Interfaces:**
- Consumes: authenticated web role ID `0353acdd-7b95-4c07-8997-ae95dafd978d` and live OIAC Test/UAT Dataverse metadata.
- Produces: read-only browser access for the exact service query in Task 1.

- [ ] **Step 1: Validate live Dataverse names before configuration writes**

Temporarily select the existing PAC profile for `https://org97063a46.crm.dynamics.com/`, run `pac auth who`, and use `pac modelbuilder build` with an entity filter for `mss_teamsannouncements` into a verified workspace-local temporary directory. Restore the previously active PAC profile in `finally`.

Confirm the generated model contains:

```text
EntityLogicalName = mss_teamsannouncements
EntitySetName = mss_teamsannouncementses
Primary ID = mss_teamsannouncementsid
mss_announcementlink
mss_content
mss_enddate
mss_startdate
mss_title
```

If any value differs, update the service, tests, and this task to the generated exact value before writing YAML. Delete only the validated workspace-local temporary model directory after capturing the results.

- [ ] **Step 2: Write the failing configuration test**

Use eager `import.meta.glob` maps so absent files fail assertions rather than module resolution. Assert three settings have the exact names and values. Assert the fields allowlist contains exactly:

```text
mss_teamsannouncementsid,mss_announcementlink,mss_content,mss_enddate,mss_startdate,mss_title
```

Assert the table permission references only Authenticated Users, has `entitylogicalname: mss_teamsannouncements`, Global scope `756150000`, `read: true`, and every other privilege false.

- [ ] **Step 3: Run the configuration test and verify RED**

```powershell
npm test -- src/features/teamAnnouncements/teamAnnouncementPowerPagesConfig.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because the four generated metadata files do not exist.

- [ ] **Step 4: Generate settings and permission with plugin scripts**

Use `create-site-setting.js` three times:

```powershell
node C:/Users/Administrator/.codex/plugins/cache/power-platform-skills/power-pages/2.6.2/scripts/create-site-setting.js --projectRoot C:/Users/Administrator/Videos/PersonalPics/OAIC/oiac-engage --name "Webapi/mss_teamsannouncements/enabled" --value "true" --description "Enable Web API access for Teams Announcements" --type "boolean"
node C:/Users/Administrator/.codex/plugins/cache/power-platform-skills/power-pages/2.6.2/scripts/create-site-setting.js --projectRoot C:/Users/Administrator/Videos/PersonalPics/OAIC/oiac-engage --name "Webapi/mss_teamsannouncements/fields" --value "mss_teamsannouncementsid,mss_announcementlink,mss_content,mss_enddate,mss_startdate,mss_title" --description "Allowed fields for active Teams Announcement reads"
node C:/Users/Administrator/.codex/plugins/cache/power-platform-skills/power-pages/2.6.2/scripts/create-site-setting.js --projectRoot C:/Users/Administrator/Videos/PersonalPics/OAIC/oiac-engage --name "Webapi/mss_teamsannouncements/disableodatafilter" --value "false" --description "Require OData filtering rules for Teams Announcements" --type "boolean"
```

Use `create-table-permission.js` once:

```powershell
node C:/Users/Administrator/.codex/plugins/cache/power-platform-skills/power-pages/2.6.2/scripts/create-table-permission.js --projectRoot C:/Users/Administrator/Videos/PersonalPics/OAIC/oiac-engage --permissionName "Authenticated Teams Announcements Global Read" --tableName "mss_teamsannouncements" --webRoleIds "0353acdd-7b95-4c07-8997-ae95dafd978d" --scope "Global" --read
```

Do not add mutation or association flags.

- [ ] **Step 5: Validate generated metadata and verify GREEN**

Run:

```powershell
node C:/Users/Administrator/.codex/plugins/cache/power-platform-skills/power-pages/2.6.2/scripts/validate-permissions-schema.js --projectRoot C:/Users/Administrator/Videos/PersonalPics/OAIC/oiac-engage --fail-on-error
npm test -- src/features/teamAnnouncements/teamAnnouncementPowerPagesConfig.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: schema validation reports zero errors and warnings; all configuration tests PASS.

- [ ] **Step 6: Commit the configuration slice**

Stage only the four Teams Announcements metadata files and their test, then commit:

```powershell
git commit -m "feat: configure teams announcements web api access"
```

---

### Task 6: Final Verification and Power Pages Skill Tracking

**Files:**
- Modify through the required tracking script: `oiac-engage/.powerpages-site/site-settings/Site-AI-Skills-IntegrateWebApi.sitesetting.yml`

**Interfaces:**
- Consumes: all Tasks 1–5.
- Produces: verified local implementation ready for a separately authorized deployment.

- [ ] **Step 1: Run all focused feature tests**

```powershell
npm test -- src/features/teamAnnouncements/teamAnnouncementService.test.ts src/features/teamAnnouncements/TeamAnnouncementModal.test.tsx src/features/dashboard/useHomeDashboardData.test.tsx src/pages/Home.test.tsx src/features/teamAnnouncements/teamAnnouncementPowerPagesConfig.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run the complete regression suite**

```powershell
npm test -- --run
```

Expected: every test file and test PASS with exit code 0.

- [ ] **Step 3: Run the production build**

```powershell
npm run build
```

Expected: `tsc -b` and `vite build` finish with exit code 0.

- [ ] **Step 4: Review the final diff**

Run `git diff --check`, inspect `git status --short`, and review the complete feature diff. Confirm no temporary metadata directory, secret, token, compiled build output, or unrelated design-folder change is staged.

- [ ] **Step 5: Record Power Pages skill usage**

Read `C:/Users/Administrator/.codex/plugins/cache/power-platform-skills/power-pages/2.6.2/references/skill-tracking-reference.md`, then run:

```powershell
node C:/Users/Administrator/.codex/plugins/cache/power-platform-skills/power-pages/2.6.2/scripts/update-skill-tracking.js --projectRoot C:/Users/Administrator/Videos/PersonalPics/OAIC/oiac-engage --skillName "IntegrateWebApi" --authoringTool "Codex"
```

Commit only the tracking setting if it changes:

```powershell
git commit -m "chore: record teams announcements web api integration"
```

- [ ] **Step 6: Hand off without deploying**

Report the exact test count, build result, commits, configuration files, and the direct-Web-API security caveat. State that the feature is complete locally but will not be live until the code site and metadata are deployed. Ask for an explicit target environment only if the user wants deployment next.
