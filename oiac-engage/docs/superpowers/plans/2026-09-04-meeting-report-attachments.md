# Meeting Report Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Meeting Report `Documents Provided` text field with a validated multi-file attachment experience that invokes the existing Power Automate HTTP endpoint for list, upload, and delete operations after the Meeting Report has a Dataverse ID.

**Architecture:** Keep Dataverse Meeting Report persistence in `meetingReportService.ts` and isolate direct Power Automate communication, file validation, response parsing, and Base64 conversion in a new `meetingReportAttachmentService.ts`. Render attachments through a focused React component while `MeetingReportForm.tsx` owns save ordering and retry state, ensuring a failed attachment operation cannot create a duplicate report.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Vitest 2, Testing Library, Power Pages SPA, Dataverse Web API, Power Automate HTTP trigger.

## Global Constraints

- Call the supplied Power Automate HTTP trigger directly from the browser using `src/config/flowUrl.js`; do not introduce a Vite environment variable or Power Pages cloud-flow-consumer metadata.
- Keep `src/config/flowUrl.js` ignored by Git. Commit `flowUrl.example.js` and `flowUrl.d.ts` so a clean checkout documents the required export and TypeScript can resolve the local JavaScript module.
- Support attachment selection and upload on both new and edit Meeting Report forms.
- Support listing and deleting existing attachments on edit forms.
- Permit at most 10 newly selected files and at most 10 MB per file; reject empty files and duplicate names case-insensitively.
- Permit ASCII letters, numbers, internal spaces, hyphens, underscores, and parentheses in the base filename, followed by one alphanumeric extension.
- Use `^[A-Za-z0-9_()-](?:[A-Za-z0-9 _()-]*[A-Za-z0-9_()-])?\.[A-Za-z0-9]+$` in frontend validation.
- Send one sequential `upload` request per file, with Base64 content that has no data-URL prefix.
- Create or update the Dataverse Meeting Report and complete contact relationships before uploading files.
- Retry only failed/unattempted uploads using the persisted Meeting Report ID.
- Keep `mss_documentsprovided` in Dataverse, but stop selecting, displaying, exposing, and writing it from the SPA.
- Do not create or modify the Power Automate flow, SharePoint library, attachment/reference table, or their permissions.
- Do not log the signed endpoint or Base64 file content.
- Preserve the unrelated untracked `Minimal Volunteer Portal Design.make/` directory.

---

### Task 1: Remove the legacy Documents Provided text mapping

**Files:**
- Modify: `src/features/meetingReports/meetingReportTypes.ts`
- Modify: `src/features/meetingReports/meetingReportService.ts`
- Modify: `src/features/meetingReports/meetingReportService.test.ts`
- Modify: `src/features/meetingReports/meetingReportPowerPagesConfig.test.ts`
- Modify: `.powerpages-site/site-settings/Webapi-mss_meetingreport-fields.sitesetting.yml`

**Interfaces:**
- Consumes: Existing `MeetingReportDraft`, `MeetingReportDetails`, `buildMeetingReportPayload()`, and `getMeetingReport()` contracts.
- Produces: Meeting Report contracts with no `documentsProvided` property and Dataverse requests that do not select or write `mss_documentsprovided`.

- [ ] **Step 1: Write failing removal assertions**

Remove `documentsProvided` from the shared test fixtures and add these assertions:

```ts
expect(payload).not.toHaveProperty('mss_documentsprovided')
expect(decodeURIComponent(requestPath)).not.toContain('mss_documentsprovided')
expect(reportFields).not.toContain('mss_documentsprovided')
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

```powershell
npm test -- src/features/meetingReports/meetingReportService.test.ts src/features/meetingReports/meetingReportPowerPagesConfig.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because the type, payload, query, and site-setting allowlist still contain the legacy field.

- [ ] **Step 3: Remove the legacy property and Dataverse mapping**

Delete `documentsProvided` from `MeetingReportDraft`, `REPORT_SELECT`, `ReportApiRecord`, `buildMeetingReportPayload()`, and the `getMeetingReport()` result. Remove `mss_documentsprovided` from the comma-separated Power Pages field allowlist without changing unrelated fields.

- [ ] **Step 4: Run the focused tests and confirm they pass**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit the legacy-field removal**

```powershell
git add src/features/meetingReports/meetingReportTypes.ts src/features/meetingReports/meetingReportService.ts src/features/meetingReports/meetingReportService.test.ts src/features/meetingReports/meetingReportPowerPagesConfig.test.ts .powerpages-site/site-settings/Webapi-mss_meetingreport-fields.sitesetting.yml
git commit -m "refactor: remove meeting report document text mapping"
```

### Task 2: Build the typed attachment-flow client and validation

**Files:**
- Modify: `.gitignore`
- Create locally, ignored: `src/config/flowUrl.js`
- Create: `src/config/flowUrl.example.js`
- Create: `src/config/flowUrl.d.ts`
- Create: `src/features/meetingReports/meetingReportAttachmentService.ts`
- Create: `src/features/meetingReports/meetingReportAttachmentService.test.ts`

**Interfaces:**
- Consumes: Browser `File`, `fetch`, `AbortSignal`, `normalizeGuid()`, and the ignored `MEETING_REPORT_ATTACHMENT_FLOW_URL` export.
- Produces: `MeetingReportAttachment`, `AttachmentSelectionResult`, `validateAndMergeAttachmentFiles()`, `fileToBase64()`, `listMeetingReportAttachments()`, `uploadMeetingReportAttachment()`, and `deleteMeetingReportAttachment()`.

- [ ] **Step 1: Write failing filename and selection-validation tests**

Cover these exact cases:

```ts
expect(isValidAttachmentFileName('Meeting Notes_2026.pdf')).toBe(true)
expect(isValidAttachmentFileName('report(1).pdf')).toBe(true)
expect(isValidAttachmentFileName(' report.pdf')).toBe(false)
expect(isValidAttachmentFileName('report .pdf')).toBe(false)
expect(isValidAttachmentFileName('report.final.pdf')).toBe(false)
expect(isValidAttachmentFileName('report&notes.pdf')).toBe(false)
```

Create `File` fixtures and assert that `validateAndMergeAttachmentFiles(current, incoming)` accepts valid files; rejects empty, oversized, eleventh, and case-insensitive duplicate files; and retains valid files from a mixed selection while returning focused errors for rejected files.

- [ ] **Step 2: Write failing HTTP-contract tests**

Mock global `fetch` and verify a list call:

```ts
await listMeetingReportAttachments(reportId)
expect(fetch).toHaveBeenCalledWith(MEETING_REPORT_ATTACHMENT_FLOW_URL, expect.objectContaining({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ operation: 'list', meetingReportId: reportId }),
}))
```

Also assert Base64 conversion returns `aGVsbG8=` without a prefix; upload uses the approved file object; missing MIME type becomes `application/octet-stream`; list/upload reject malformed required fields; delete sends `attachmentId` and accepts 200 or 204; and non-2xx responses throw a safe error without URL or file content.

- [ ] **Step 3: Run the new tests and confirm they fail**

```powershell
npm test -- src/features/meetingReports/meetingReportAttachmentService.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because the service does not exist.

- [ ] **Step 4: Add the ignored direct-URL module contract**

Add this exact ignore rule:

```gitignore
src/config/flowUrl.js
```

Create local ignored `src/config/flowUrl.js` as a one-line ES module that exports `MEETING_REPORT_ATTACHMENT_FLOW_URL` with the exact signed URL supplied in the active user request. The credential is deliberately not reproduced in this tracked plan.

Create committed `src/config/flowUrl.example.js`:

```js
export const MEETING_REPORT_ATTACHMENT_FLOW_URL = ''
```

Create committed `src/config/flowUrl.d.ts`:

```ts
export const MEETING_REPORT_ATTACHMENT_FLOW_URL: string
```

Run `git check-ignore src/config/flowUrl.js` and require it to print the path before continuing. The actual URL must not appear in `git diff --cached` or any committed file.

- [ ] **Step 5: Implement the service interfaces**

Create these exports:

```ts
export const MAX_ATTACHMENT_FILES = 10
export const MAX_ATTACHMENT_FILE_SIZE = 10 * 1024 * 1024
export const ATTACHMENT_FILE_NAME_PATTERN = /^[A-Za-z0-9_()-](?:[A-Za-z0-9 _()-]*[A-Za-z0-9_()-])?\.[A-Za-z0-9]+$/
export { MEETING_REPORT_ATTACHMENT_FLOW_URL } from '../../config/flowUrl.js'

export type MeetingReportAttachment = {
  readonly attachmentId: string
  readonly fileName: string
  readonly fileUrl: string | null
  readonly contentType: string | null
  readonly size: number | null
}

export type AttachmentSelectionResult = {
  readonly files: readonly File[]
  readonly errors: readonly string[]
}

export function isValidAttachmentFileName(fileName: string): boolean
export function validateAndMergeAttachmentFiles(current: readonly File[], incoming: readonly File[]): AttachmentSelectionResult
export async function fileToBase64(file: File): Promise<string>
export async function listMeetingReportAttachments(meetingReportId: string, signal?: AbortSignal): Promise<readonly MeetingReportAttachment[]>
export async function uploadMeetingReportAttachment(meetingReportId: string, file: File): Promise<MeetingReportAttachment>
export async function deleteMeetingReportAttachment(meetingReportId: string, attachmentId: string): Promise<void>
```

The private request helper uses raw `fetch`, `Content-Type: application/json`, and the approved `list`, `upload`, and `delete` bodies. It does not use the Dataverse OData wrapper.

- [ ] **Step 6: Run the new tests and confirm they pass**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 7: Commit the safe attachment service files**

```powershell
git add .gitignore src/config/flowUrl.example.js src/config/flowUrl.d.ts src/features/meetingReports/meetingReportAttachmentService.ts src/features/meetingReports/meetingReportAttachmentService.test.ts
git commit -m "feat: add meeting report attachment flow client"
```

### Task 3: Add the accessible attachment control

**Files:**
- Create: `src/features/meetingReports/MeetingReportAttachments.tsx`
- Create: `src/features/meetingReports/MeetingReportAttachments.test.tsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: `MeetingReportAttachment`, selected files, list state, delete state, and callbacks supplied by the form.
- Produces: A controlled `MeetingReportAttachments` component used on the final form step.

- [ ] **Step 1: Write failing component tests**

Use this prop contract:

```ts
type MeetingReportAttachmentsProps = {
  readonly selectedFiles: readonly File[]
  readonly existingAttachments: readonly MeetingReportAttachment[]
  readonly listStatus: 'idle' | 'loading' | 'ready' | 'error'
  readonly selectionErrors: readonly string[]
  readonly deletingAttachmentIds: ReadonlySet<string>
  readonly disabled: boolean
  readonly onFilesSelected: (files: readonly File[]) => void
  readonly onSelectedFileRemoved: (fileName: string) => void
  readonly onDeleteExisting: (attachment: MeetingReportAttachment) => void
  readonly onRetryList: () => void
}
```

Test a labelled multiple file input, input reset after selection, selected-file names and sizes, local removal, accessible validation alerts, edit-mode loading/list retry, download links, Delete buttons, and disabled states.

- [ ] **Step 2: Run the component tests and confirm they fail**

```powershell
npm test -- src/features/meetingReports/MeetingReportAttachments.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the controlled component**

Use semantic lists and accessible actions:

```tsx
<button type="button" aria-label={`Remove ${file.name}`}>Remove</button>
<button type="button" aria-label={`Delete ${attachment.fileName}`}>Delete</button>
```

Show: `Up to 10 files, 10 MB each. File names may use letters, numbers, spaces, hyphens, underscores, and parentheses.`

- [ ] **Step 4: Add responsive styles**

Add report-scoped attachment picker, list, item, metadata, error, and action styles. Preserve visible focus, 44px interactive targets, ellipsis for long names, and one-column mobile layout.

- [ ] **Step 5: Run component and CSS tests**

```powershell
npm test -- src/features/meetingReports/MeetingReportAttachments.test.tsx src/styles/designRegression.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: PASS.

- [ ] **Step 6: Commit the attachment control**

```powershell
git add src/features/meetingReports/MeetingReportAttachments.tsx src/features/meetingReports/MeetingReportAttachments.test.tsx src/styles/theme.css
git commit -m "feat: add meeting report attachment control"
```

### Task 4: Integrate listing, deletion, upload ordering, and retry

**Files:**
- Modify: `src/pages/MeetingReportForm.tsx`
- Modify: `src/pages/Report.test.tsx`

**Interfaces:**
- Consumes: The attachment component/client and existing Meeting Report persistence and relationship operations.
- Produces: End-to-end create/edit attachment orchestration without duplicate Meeting Report writes.

- [ ] **Step 1: Mock the attachment client and update fixtures**

```ts
vi.mock('../features/meetingReports/meetingReportAttachmentService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../features/meetingReports/meetingReportAttachmentService')>()
  return {
    ...original,
    deleteMeetingReportAttachment: vi.fn(),
    listMeetingReportAttachments: vi.fn(),
    uploadMeetingReportAttachment: vi.fn(),
  }
})
```

Remove `documentsProvided` from `existingReport` and initialize list/upload/delete mocks in `beforeEach`.

- [ ] **Step 2: Write failing create/upload and validation tests**

Prove the final step contains a multiple-file input rather than a text input; valid names are accepted; invalid names are rejected immediately; create resolves before relationship operations; relationships finish before sequential uploads; each upload receives `reportId`; and no files means no upload call.

- [ ] **Step 3: Write failing edit/list/delete tests**

Prove edit mode lists attachments; renders returned links; confirmation controls deletion; successful deletion removes the row; failure retains it; and list failure offers retry without blocking editing.

- [ ] **Step 4: Write failing retry-safety tests**

Simulate one successful and one failed upload. Require `Retry file uploads`, then assert:

```ts
expect(createMeetingReport).toHaveBeenCalledTimes(1)
expect(runRelationshipOperations).toHaveBeenCalledTimes(1)
expect(uploadMeetingReportAttachment).toHaveBeenLastCalledWith(reportId, failedFile)
```

Extend relationship retry coverage so successful relationship retry proceeds to file uploads instead of navigating early.

- [ ] **Step 5: Run page tests and confirm they fail**

```powershell
npm test -- src/pages/Report.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: FAIL because the form still uses text and lacks attachment orchestration.

- [ ] **Step 6: Add state, lifecycle, and handlers**

Add selected-file, validation-error, existing-attachment, list-status/retry, deleting-ID, and pending-upload state. Use an abortable edit-only list effect. Validate selection immediately, remove selected files locally, and use `window.confirm` before immediate existing-attachment deletion.

- [ ] **Step 7: Add sequential upload and retry orchestration**

```ts
async function uploadFiles(reportId: string, files: readonly File[]): Promise<readonly File[]> {
  const failures: File[] = []
  for (const file of files) {
    try {
      await uploadMeetingReportAttachment(reportId, file)
    } catch {
      failures.push(file)
    }
  }
  return failures
}
```

Call it after report persistence and relationships. If failures remain, retain only those files, lock report fields, and retry only uploads. A successful relationship retry must upload pending files before navigation.

- [ ] **Step 8: Replace the legacy control and update messages**

Render `MeetingReportAttachments` after Follow-Up Note. Disable Back, Cancel, and Submit while a retry stage is pending and show only the relevant retry action.

- [ ] **Step 9: Run page tests and confirm they pass**

Run the command from Step 5. Expected: PASS.

- [ ] **Step 10: Commit form integration**

```powershell
git add src/pages/MeetingReportForm.tsx src/pages/Report.test.tsx
git commit -m "feat: integrate meeting report attachments"
```

### Task 5: Document and verify the complete SPA

**Files:**
- Modify: `docs/contacts-and-meeting-reports-technical-report.md`
- Modify: `docs/superpowers/plans/2026-09-04-meeting-report-attachments.md`

**Interfaces:**
- Consumes: Completed attachment implementation.
- Produces: Accurate documentation and verified production artifacts.

- [ ] **Step 1: Update technical documentation**

Document filename/size validation, all three operations, create/update → relationships → uploads ordering, retry behavior, direct-client/CORS limitations, and removal of `mss_documentsprovided` from SPA exposure.

- [ ] **Step 2: Run focused feature tests**

```powershell
npm test -- src/features/meetingReports/meetingReportAttachmentService.test.ts src/features/meetingReports/MeetingReportAttachments.test.tsx src/features/meetingReports/meetingReportService.test.ts src/features/meetingReports/meetingReportPowerPagesConfig.test.ts src/pages/Report.test.tsx src/styles/designRegression.test.ts --no-file-parallelism --maxWorkers=1 --reporter=verbose
```

Expected: all selected suites pass.

- [ ] **Step 3: Run the complete suite**

```powershell
npm test -- --no-file-parallelism --maxWorkers=1
```

Expected: all tests pass with no unhandled promise rejections.

- [ ] **Step 4: Run the production build**

```powershell
npm run build
```

Expected: TypeScript compilation and Vite build succeed.

- [ ] **Step 5: Inspect the final diff**

```powershell
git diff --check
git status --short
git diff --stat
```

Confirm the endpoint appears only in ignored `src/config/flowUrl.js`, is absent from tracked files, logs, and user-facing errors, and `Minimal Volunteer Portal Design.make/` remains untouched.

- [ ] **Step 6: Commit documentation updates**

```powershell
git add docs/contacts-and-meeting-reports-technical-report.md docs/superpowers/plans/2026-09-04-meeting-report-attachments.md
git commit -m "docs: document meeting report attachments"
```

- [ ] **Step 7: Verify runtime after a separate deployment request**

On the deployed site, test create upload, edit list, download, and confirmed delete with an allowed portal role. Confirm browser preflight/POST requests have no CORS errors and responses match the approved contract. Deployment is not part of this implementation plan unless separately requested.
