# Secure Attachment View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace direct SharePoint attachment links in the meeting-report edit form with secure binary retrieval through the existing Power Automate `view` operation.

**Architecture:** Keep Dataverse responsible only for non-sensitive attachment metadata and add a reusable service that returns a typed Blob descriptor from the flow. The edit-form attachment component owns request/loading/error routing, while a focused modal component owns accessible PDF/image preview and Blob URL lifecycle.

**Tech Stack:** React 19, TypeScript 5.7, CSS, Vitest, Testing Library, Vite 6, Power Pages Web API, Power Automate HTTP flow

## Global Constraints

- The deployed flow already supports `view`; do not modify `flow.json`.
- The main Meeting Reports table remains unchanged; replace only the edit form's uploaded-document **Open** action.
- View requests must POST exactly `operation`, `meetingReportId`, and `attachmentId`.
- Do not send or directly use `mss_sharepointfileurl`, `mss_sharepointfilepath`, `mss_sharepointfileid`, `mss_clientfileid`, or Base64 content in the View path.
- Successful View responses must use `response.blob()` and must not call `response.json()`.
- Failed View responses may attempt guarded JSON parsing and must expose only a safe status/code error.
- Preview only `application/pdf` and `image/*`; automatically download all other types.
- Revoke every temporary Blob URL after automatic download or when a preview closes, changes, or unmounts.
- Use the existing `form-alert`/`role="alert"` UI; never call `alert()` for View errors.
- Preserve existing upload, delete, form-state, validation, accessibility, and backend behavior.

---

### Task 1: Add the Binary View Service

**Files:**
- Modify: `oiac-engage/src/features/meetingReports/meetingReportAttachmentService.test.ts`
- Modify: `oiac-engage/src/features/meetingReports/meetingReportAttachmentService.ts`

**Interfaces:**
- Consumes: `MEETING_REPORT_ATTACHMENT_FLOW_URL`, normalized GUIDs, Dataverse fallback filename and MIME type
- Produces: `AttachmentViewSource`, `AttachmentViewResult`, extended `MeetingReportAttachmentFlowError`, and `viewAttachment(source, signal?)`

- [ ] **Step 1: Write failing service tests**

Add `viewAttachment` to the service imports and add tests with these concrete assertions:

```ts
test('posts only attachment identities and reads a successful view as a Blob', async () => {
  const blob = new Blob(['pdf'], { type: 'application/pdf' })
  const json = vi.fn()
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({
      'Content-Type': 'application/pdf; charset=binary',
      'X-File-Name': 'Returned Notes.pdf',
    }),
    blob: vi.fn().mockResolvedValue(blob),
    json,
  } as unknown as Response)

  await expect(viewAttachment({
    meetingReportId: reportId,
    attachmentId,
    fileName: 'Fallback.pdf',
    contentType: 'application/octet-stream',
  })).resolves.toMatchObject({
    fileName: 'Returned Notes.pdf',
    contentType: 'application/pdf',
  })

  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
    operation: 'view', meetingReportId: reportId, attachmentId,
  })
  expect(json).not.toHaveBeenCalled()
})

test('uses Dataverse metadata when response headers are unavailable', async () => {
  fetchMock.mockResolvedValue(new Response(new Blob(['image']), { status: 200 }))

  await expect(viewAttachment({
    meetingReportId: reportId,
    attachmentId,
    fileName: 'Fallback.png',
    contentType: 'image/png',
  })).resolves.toMatchObject({ fileName: 'Fallback.png', contentType: 'image/png' })
})

test.each([
  'InvalidViewRequest',
  'MeetingReportNotFound',
  'AttachmentNotFound',
  'FileContentNotFound',
  'AttachmentLookupFailed',
])('safely preserves the flow error code %s', async (code) => {
  fetchMock.mockResolvedValue(jsonResponse({ error: { code } }, 404))

  await expect(viewAttachment({
    meetingReportId: reportId,
    attachmentId,
    fileName: 'Fallback.pdf',
    contentType: 'application/pdf',
  })).rejects.toMatchObject({ status: 404, code })
})
```

Also add one failed-response test whose `json()` rejects and one network-rejection test; both must yield `MeetingReportAttachmentFlowError` with `code: null` and the safe existing message.

- [ ] **Step 2: Run the focused service test and verify RED**

Run from `oiac-engage`:

```powershell
npm test -- src/features/meetingReports/meetingReportAttachmentService.test.ts
```

Expected: FAIL because `viewAttachment` and its view-result types do not exist.

- [ ] **Step 3: Implement the minimal service contract**

Add these public types and extend the safe flow error:

```ts
export type AttachmentViewSource = {
  readonly meetingReportId: string
  readonly attachmentId: string
  readonly fileName: string
  readonly contentType: string | null
}

export type AttachmentViewResult = {
  readonly blob: Blob
  readonly fileName: string
  readonly contentType: string
}

export class MeetingReportAttachmentFlowError extends Error {
  readonly status: number | null
  readonly code: string | null

  constructor(status: number | null = null, code: string | null = null) {
    super('The attachment request could not be completed.')
    this.name = 'MeetingReportAttachmentFlowError'
    this.status = status
    this.code = code
  }
}
```

Implement `viewAttachment` with the exact payload and separate success/error parsing paths:

```ts
export async function viewAttachment(
  source: AttachmentViewSource,
  signal?: AbortSignal,
): Promise<AttachmentViewResult> {
  const meetingReportId = requiredGuid(source.meetingReportId, 'Meeting Report identifier')
  const attachmentId = requiredGuid(source.attachmentId, 'Attachment identifier')
  let response: Response
  try {
    response = await fetch(MEETING_REPORT_ATTACHMENT_FLOW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'view', meetingReportId, attachmentId }),
      signal,
    })
  } catch {
    throw new MeetingReportAttachmentFlowError()
  }
  if (!response.ok) {
    throw new MeetingReportAttachmentFlowError(response.status, await safeViewErrorCode(response))
  }
  const contentType = responseMediaType(response.headers.get('Content-Type'))
    ?? responseMediaType(source.contentType)
    ?? 'application/octet-stream'
  const rawFileName = safeHeaderFileName(response.headers.get('X-File-Name')) ?? source.fileName
  const received = await response.blob()
  const blob = received.type === contentType ? received : new Blob([received], { type: contentType })
  return { blob, fileName: rawFileName, contentType }
}
```

Implement private helpers that strip MIME parameters, reject empty media types, remove `\u0000-\u001f` and `\u007f` control characters from `X-File-Name`, fall back when the cleaned name is empty, and inspect `error.code`, `code`, then `errorCode` only inside a guarded failed-response `json()` call.

- [ ] **Step 4: Run the focused service test and verify GREEN**

Run: `npm test -- src/features/meetingReports/meetingReportAttachmentService.test.ts`

Expected: all service tests pass.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- docs/superpowers/plans/2026-09-12-secure-attachment-view.md oiac-engage/src/features/meetingReports/meetingReportAttachmentService.ts oiac-engage/src/features/meetingReports/meetingReportAttachmentService.test.ts
git commit -m "feat: add secure attachment view service"
```

---

### Task 2: Add the Accessible Blob Preview Modal

**Files:**
- Create: `oiac-engage/src/features/meetingReports/AttachmentPreviewModal.tsx`
- Create: `oiac-engage/src/features/meetingReports/AttachmentPreviewModal.test.tsx`
- Modify: `oiac-engage/src/styles/theme.css`

**Interfaces:**
- Consumes: `AttachmentViewResult`, `kind: 'pdf' | 'image'`, `onClose`, and the triggering button element
- Produces: `AttachmentPreviewModal` with modal dialog semantics and owned preview Blob URL lifecycle

- [ ] **Step 1: Write failing modal tests**

Create tests that stub `URL.createObjectURL` to return `blob:attachment-preview` and spy on `URL.revokeObjectURL`. Render a PDF preview and assert:

```ts
expect(await screen.findByRole('dialog', { name: 'Preview Returned Notes.pdf' })).toBeInTheDocument()
expect(screen.getByTitle('PDF preview of Returned Notes.pdf')).toHaveAttribute('src', 'blob:attachment-preview')
expect(screen.getByRole('link', { name: 'Download Returned Notes.pdf' })).toHaveAttribute('download', 'Returned Notes.pdf')
```

Click **Close**, verify `onClose`, Blob URL revocation, and focus restoration to the supplied trigger. Add an image case asserting a responsive image with `alt="Returned Photo.png"`. Add an Escape-key case and an unmount case that each revoke the active URL exactly once.

- [ ] **Step 2: Run the modal test and verify RED**

Run: `npm test -- src/features/meetingReports/AttachmentPreviewModal.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the modal**

Create the component with this interface:

```ts
export type AttachmentPreviewModalProps = {
  readonly result: AttachmentViewResult
  readonly kind: 'pdf' | 'image'
  readonly returnFocusTo: HTMLButtonElement | null
  readonly onClose: () => void
}
```

Use an effect to create one Blob URL per `result.blob`, set it into component state, and revoke it in cleanup. Use another effect to focus the Close button on open, listen for Escape, and restore focus during cleanup. Render `role="dialog"`, `aria-modal="true"`, an accessible heading `Preview {fileName}`, a Close button, a Download anchor using the active URL and `download={fileName}`, an `<iframe title="PDF preview of {fileName}">` for PDFs, or `<img alt={fileName}>` for images.

- [ ] **Step 4: Add focused modal styles**

Add CSS for a fixed translucent backdrop, centered responsive dialog, action row, PDF frame, and image containment. Use these layout constraints:

```css
.attachment-preview { position: fixed; z-index: 200; inset: 0; display: grid; place-items: center; background: rgb(15 31 28 / 72%); padding: 1rem; }
.attachment-preview__dialog { display: grid; width: min(70rem, 100%); height: min(52rem, calc(100vh - 2rem)); grid-template-rows: auto 1fr; overflow: hidden; border-radius: var(--radius-lg); background: var(--color-surface); box-shadow: var(--shadow-sm); }
.attachment-preview__frame { width: 100%; height: 100%; border: 0; background: #fff; }
.attachment-preview__image { display: block; max-width: 100%; max-height: 100%; margin: auto; object-fit: contain; }
```

Style modal controls with existing `.button` classes and add a scroll-safe image stage.

- [ ] **Step 5: Run the modal tests and verify GREEN**

Run: `npm test -- src/features/meetingReports/AttachmentPreviewModal.test.tsx`

Expected: all modal tests pass.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- oiac-engage/src/features/meetingReports/AttachmentPreviewModal.tsx oiac-engage/src/features/meetingReports/AttachmentPreviewModal.test.tsx oiac-engage/src/styles/theme.css
git commit -m "feat: add attachment preview modal"
```

---

### Task 3: Replace Direct Links and Tighten Metadata Exposure

**Files:**
- Modify: `oiac-engage/src/features/meetingReports/meetingReportAttachmentService.ts`
- Modify: `oiac-engage/src/features/meetingReports/meetingReportAttachmentService.test.ts`
- Modify: `oiac-engage/src/features/meetingReports/MeetingReportAttachments.tsx`
- Modify: `oiac-engage/src/features/meetingReports/MeetingReportAttachments.test.tsx`
- Modify: `oiac-engage/src/features/meetingReports/meetingReportPowerPagesConfig.test.ts`
- Modify: `oiac-engage/src/pages/Report.test.tsx`
- Modify: `oiac-engage/.powerpages-site/site-settings/Webapi-mss_attachments-fields.sitesetting.yml`
- Modify: `oiac-engage/src/styles/theme.css`
- Delete: `oiac-engage/src/features/meetingReports/ReportFilesCell.tsx`

**Interfaces:**
- Consumes: `viewAttachment`, `MeetingReportAttachmentFlowError`, and `AttachmentPreviewModal`
- Produces: secure edit-form View interaction, automatic unsupported-file download, safe error messaging, and a non-sensitive Dataverse metadata model

- [ ] **Step 1: Write failing metadata-boundary tests**

Update attachment fixtures to include `meetingReportId` and remove `fileUrl`. Change the list assertions so each Dataverse row maps independently to:

```ts
{
  meetingReportId: reportId,
  attachmentId,
  fileName: 'Meeting Notes.pdf',
  contentType: 'application/pdf',
  size: 2048,
}
```

Assert `$select` equals the exact safe list:

```ts
expect(parsedUrl.searchParams.get('$select')).toBe(
  'mss_attachmentsid,mss_attachmentname,mss_filesize,mss_filetype,_mss_meetingreport_value',
)
for (const forbidden of [
  'mss_sharepointfileurl', 'mss_sharepointfilepath', 'mss_sharepointfileid', 'mss_clientfileid',
]) expect(parsedUrl.searchParams.get('$select')).not.toContain(forbidden)
```

Update the Power Pages configuration test to assert the allowlist contains the five required fields plus `mss_meetingreport`, and excludes all four forbidden fields.

- [ ] **Step 2: Write failing View interaction tests**

Mock `viewAttachment` in `MeetingReportAttachments.test.tsx`. Add tests proving:

- The old Open link is absent and a `View Existing Report.pdf` button is present.
- While its promise is pending, the button reads `Loading Existing Report.pdf`, is disabled, and two rapid clicks call `viewAttachment` once.
- A PDF result opens the PDF dialog; an image result opens an image dialog.
- DOCX and other unsupported results create/click/remove a temporary download anchor, do not open a dialog, and revoke their Blob URL after the queued timer.
- Each known flow error code renders its mapped text in a `form-alert` with `role="alert"`, does not call `window.alert`, and re-enables the View button in `finally`.
- Closing a preview restores focus to the View button.

Update `Report.test.tsx` so its edit-form attachment case expects a View button rather than a direct SharePoint link.

- [ ] **Step 3: Run affected tests and verify RED**

Run:

```powershell
npm test -- src/features/meetingReports/meetingReportAttachmentService.test.ts src/features/meetingReports/MeetingReportAttachments.test.tsx src/features/meetingReports/meetingReportPowerPagesConfig.test.ts src/pages/Report.test.tsx
```

Expected: FAIL because the metadata boundary and View interaction are not implemented.

- [ ] **Step 4: Remove sensitive metadata from the frontend model and query**

Make `MeetingReportAttachment` extend `AttachmentViewSource` and retain only `size` plus the source fields. Remove SharePoint fields, URL normalization, preview URL construction, and SharePoint-key grouping from the service. Map each valid Dataverse record directly and preserve its normalized `_mss_meetingreport_value` as `meetingReportId`. When normalizing upload results, pass the known normalized report ID so newly uploaded attachments receive `meetingReportId` without trusting extra response fields.

Update `Webapi-mss_attachments-fields.sitesetting.yml` to:

```yaml
value: "mss_attachmentsid,mss_attachmentname,mss_filesize,mss_filetype,mss_meetingreport,_mss_meetingreport_value"
```

Delete the unused `ReportFilesCell.tsx` direct-link component.

- [ ] **Step 5: Implement View, preview routing, errors, and automatic download**

In `MeetingReportAttachments.tsx`, add:

```ts
type PreviewState = {
  readonly result: AttachmentViewResult
  readonly kind: 'pdf' | 'image'
  readonly returnFocusTo: HTMLButtonElement | null
}
```

Maintain `viewingAttachmentIds`, `preview`, and `viewError` state. Capture `event.currentTarget` before awaiting. Guard the same attachment ID, add it to the set, clear the prior error, await `viewAttachment(attachment)`, and route `application/pdf` to `kind: 'pdf'`, `image/*` to `kind: 'image'`, and all other types to this helper:

```ts
function downloadAttachment(result: AttachmentViewResult) {
  const url = URL.createObjectURL(result.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = result.fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
```

Always remove the attachment ID from the loading set in `finally`. Replace the Open anchor with a View button using `LuEye`; show `Loading…` and disable only that file's View button during its request. Render `AttachmentPreviewModal` for preview state.

Map known errors exactly:

```ts
const VIEW_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  InvalidViewRequest: 'The file request is invalid. Refresh the page and try again.',
  MeetingReportNotFound: 'This meeting report is unavailable or you do not have access to it.',
  AttachmentNotFound: 'This attachment is unavailable or you do not have access to it.',
  FileContentNotFound: 'The stored file content is unavailable.',
  AttachmentLookupFailed: 'The attachment could not be retrieved. Try again.',
}
```

Unknown errors use `The attachment could not be viewed. Try again.` Render the message with the existing `form-alert` class and `role="alert"` inside the uploaded-documents group. Do not call `alert()`.

- [ ] **Step 6: Run affected tests and verify GREEN**

Run the same four-file command from Step 3.

Expected: all affected tests pass.

- [ ] **Step 7: Commit Task 3**

```powershell
git add -- oiac-engage/src/features/meetingReports/meetingReportAttachmentService.ts oiac-engage/src/features/meetingReports/meetingReportAttachmentService.test.ts oiac-engage/src/features/meetingReports/MeetingReportAttachments.tsx oiac-engage/src/features/meetingReports/MeetingReportAttachments.test.tsx oiac-engage/src/features/meetingReports/meetingReportPowerPagesConfig.test.ts oiac-engage/src/pages/Report.test.tsx oiac-engage/.powerpages-site/site-settings/Webapi-mss_attachments-fields.sitesetting.yml oiac-engage/src/styles/theme.css oiac-engage/src/features/meetingReports/ReportFilesCell.tsx
git commit -m "feat: view attachments through secure flow"
```

---

### Task 4: Final Verification

**Files:**
- Verify only; modify production or test files only if a failing check reveals a defect within this feature

**Interfaces:**
- Consumes: completed Tasks 1-3
- Produces: verified secure attachment View feature

- [ ] **Step 1: Scan for forbidden direct-use remnants**

Run:

```powershell
rg -n "mss_sharepointfileurl|mss_sharepointfilepath|mss_sharepointfileid|mss_clientfileid|buildMeetingReportAttachmentPreviewUrl" oiac-engage/src oiac-engage/.powerpages-site/site-settings/Webapi-mss_attachments-fields.sitesetting.yml
```

Expected: no matches in frontend source or the attachment field allowlist, except negative assertions in tests that explicitly name forbidden fields.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`

Expected: all Vitest files and tests pass.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite complete successfully.

- [ ] **Step 4: Verify repository hygiene**

Run from the repository root:

```powershell
git diff --check
git status --short
git log -4 --oneline
```

Expected: no uncommitted feature files, three implementation commits after the design commit, and only the pre-existing unrelated `Minimal Volunteer Portal Design.make/` directory remains untracked.
