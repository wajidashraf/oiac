# Meeting Report Attachment Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preview retrieved meeting-report PDFs and images in the existing same-page modal even when the attachment flow returns a generic MIME type, while downloading unsupported files.

**Architecture:** Add a pure classifier beside the meeting-report attachment components. It treats trustworthy PDF and image MIME types as authoritative, falls back to a case-insensitive filename extension only for missing or generic MIME types, and returns `unsupported` for everything else. `MeetingReportAttachments` uses the classifier to select the existing preview modal or existing download path, and the modal assigns generic preview blobs the corresponding browser-viewable MIME type before creating their object URLs.

**Tech Stack:** React 19, TypeScript 5.7, Vitest 2, Testing Library, Vite 6

## Global Constraints

- Retain the existing modal Download and Close actions.
- Preserve immediate download behavior for unsupported formats.
- Preserve loading, duplicate-click protection, inline errors, Escape handling, focus restoration, and object URL cleanup.
- Do not change upload validation, attachment storage, or the Power Automate contract.
- Do not add previews for Office documents, text files, audio, video, or archives.

---

### Task 1: Attachment preview classifier

**Files:**
- Create: `oiac-engage/src/features/meetingReports/attachmentPreviewKind.ts`
- Create: `oiac-engage/src/features/meetingReports/attachmentPreviewKind.test.ts`

**Interfaces:**
- Consumes: `{ readonly contentType?: string | null; readonly fileName: string }`
- Produces: `getAttachmentPreviewKind(source): 'pdf' | 'image' | 'unsupported'`

- [ ] **Step 1: Write the failing classifier tests**

Create `attachmentPreviewKind.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { getAttachmentPreviewKind } from './attachmentPreviewKind'

describe('getAttachmentPreviewKind', () => {
  test.each([
    ['application/pdf', 'notes.bin', 'pdf'],
    [' Application/PDF; charset=binary ', 'notes.bin', 'pdf'],
    ['image/png', 'photo.bin', 'image'],
    ['IMAGE/WEBP; charset=binary', 'photo.bin', 'image'],
  ])('classifies %s as %s preview content', (contentType, fileName, expected) => {
    expect(getAttachmentPreviewKind({ contentType, fileName })).toBe(expected)
  })

  test.each([
    ['application/octet-stream', 'REPORT.PDF', 'pdf'],
    ['binary/octet-stream', 'photo.JpG', 'image'],
    [null, 'diagram.svg', 'image'],
    ['', 'scan.avif', 'image'],
  ])('falls back from %s to the %s filename', (contentType, fileName, expected) => {
    expect(getAttachmentPreviewKind({ contentType, fileName })).toBe(expected)
  })

  test.each([
    ['text/plain', 'misleading.pdf'],
    ['application/octet-stream', 'report.docx'],
    [null, 'archive.zip'],
  ])('classifies %s / %s as unsupported', (contentType, fileName) => {
    expect(getAttachmentPreviewKind({ contentType, fileName })).toBe('unsupported')
  })
})
```

- [ ] **Step 2: Run the test and verify the missing module causes failure**

Run from `oiac-engage`:

```powershell
npm test -- src/features/meetingReports/attachmentPreviewKind.test.ts
```

Expected: FAIL because `./attachmentPreviewKind` does not exist.

- [ ] **Step 3: Implement the pure classifier**

Create `attachmentPreviewKind.ts`:

```ts
export type AttachmentPreviewKind = 'pdf' | 'image' | 'unsupported'

type AttachmentPreviewSource = {
  readonly contentType?: string | null
  readonly fileName: string
}

const GENERIC_CONTENT_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream'])
const IMAGE_EXTENSIONS = new Set([
  '.avif', '.bmp', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.webp',
])

export function getAttachmentPreviewKind(source: AttachmentPreviewSource): AttachmentPreviewKind {
  const contentType = source.contentType?.split(';', 1)[0].trim().toLowerCase() ?? ''
  if (contentType === 'application/pdf') return 'pdf'
  if (contentType.startsWith('image/')) return 'image'
  if (!GENERIC_CONTENT_TYPES.has(contentType)) return 'unsupported'

  const extension = source.fileName.trim().toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
  if (extension === '.pdf') return 'pdf'
  return IMAGE_EXTENSIONS.has(extension) ? 'image' : 'unsupported'
}
```

- [ ] **Step 4: Run the classifier tests and verify they pass**

Run:

```powershell
npm test -- src/features/meetingReports/attachmentPreviewKind.test.ts
```

Expected: PASS with all classifier cases green.

- [ ] **Step 5: Commit the classifier**

```powershell
git add oiac-engage/src/features/meetingReports/attachmentPreviewKind.ts oiac-engage/src/features/meetingReports/attachmentPreviewKind.test.ts
git commit -m "feat: classify attachment preview formats"
```

### Task 2: Route generic PDFs and images into the modal

**Files:**
- Modify: `oiac-engage/src/features/meetingReports/MeetingReportAttachments.tsx`
- Modify: `oiac-engage/src/features/meetingReports/MeetingReportAttachments.test.tsx`
- Modify: `oiac-engage/src/features/meetingReports/AttachmentPreviewModal.tsx`
- Modify: `oiac-engage/src/features/meetingReports/AttachmentPreviewModal.test.tsx`

**Interfaces:**
- Consumes: `getAttachmentPreviewKind(result): 'pdf' | 'image' | 'unsupported'` from Task 1
- Produces: View-click behavior that opens `AttachmentPreviewModal` for classified PDF/image content and calls `downloadAttachment` for `unsupported`
- Produces: browser-viewable object URLs whose Blob type is `application/pdf` or the image type inferred from trusted MIME metadata or a recognized extension

- [ ] **Step 1: Add failing integration cases for generic response types**

Extend the existing preview routing table in `MeetingReportAttachments.test.tsx`:

```ts
test.each([
  ['application/pdf', 'Returned Notes.pdf', 'PDF preview of Returned Notes.pdf'],
  ['image/webp', 'Returned Photo.webp', 'Returned Photo.webp'],
  ['application/octet-stream', 'Returned Notes.PDF', 'PDF preview of Returned Notes.PDF'],
  ['application/octet-stream', 'Returned Photo.PNG', 'Returned Photo.PNG'],
])('routes %s content named %s to its browser preview', async (contentType, fileName, previewName) => {
  const actor = userEvent.setup()
  vi.mocked(viewAttachment).mockResolvedValue({
    blob: new Blob(['content'], { type: contentType }),
    fileName,
    contentType,
  })
  renderAttachments({ existingAttachments: [existingAttachment], listStatus: 'ready' })

  await actor.click(screen.getByRole('button', { name: 'View Existing Report.pdf' }))

  expect(await screen.findByRole('dialog', { name: `Preview ${fileName}` })).toBeInTheDocument()
  if (previewName.startsWith('PDF preview')) {
    expect(screen.getByTitle(previewName)).toBeInTheDocument()
  } else {
    expect(screen.getByRole('img', { name: previewName })).toBeInTheDocument()
  }
})
```

Add an explicit-MIME precedence test:

```ts
test('downloads an explicitly unsupported MIME type despite a previewable extension', async () => {
  const actor = userEvent.setup()
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  vi.mocked(viewAttachment).mockResolvedValue({
    blob: new Blob(['text'], { type: 'text/plain' }),
    fileName: 'Misleading.pdf',
    contentType: 'text/plain',
  })
  renderAttachments({ existingAttachments: [existingAttachment], listStatus: 'ready' })

  await actor.click(screen.getByRole('button', { name: 'View Existing Report.pdf' }))

  expect(clickSpy).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the component tests and verify generic types fail to preview**

Run:

```powershell
npm test -- src/features/meetingReports/MeetingReportAttachments.test.tsx
```

Expected: FAIL because current routing downloads `application/octet-stream` results.

- [ ] **Step 3: Integrate the classifier with the existing handler**

Import the helper in `MeetingReportAttachments.tsx`:

```ts
import { getAttachmentPreviewKind } from './attachmentPreviewKind'
```

Replace the direct MIME checks inside `handleView`:

```ts
const result = await viewAttachment(attachment)
const kind = getAttachmentPreviewKind(result)
if (kind === 'pdf' || kind === 'image') {
  setPreview({ result, kind, returnFocusTo })
} else {
  downloadAttachment(result)
}
```

Import `getAttachmentPreviewContentType` into `AttachmentPreviewModal.tsx`, then create its URL from a correctly typed Blob:

```ts
const contentType = getAttachmentPreviewContentType(result, kind)
const previewBlob = result.blob.type === contentType
  ? result.blob
  : new Blob([result.blob], { type: contentType })
const objectUrl = URL.createObjectURL(previewBlob)
```

Keep the effect dependencies synchronized with `kind`, `result.blob`, `result.contentType`, and `result.fileName`. Preserve the original bytes, filename, Download action, URL revocation, and focus behavior.

- [ ] **Step 4: Run classifier, attachment component, and modal tests**

Run:

```powershell
npm test -- src/features/meetingReports/attachmentPreviewKind.test.ts src/features/meetingReports/MeetingReportAttachments.test.tsx src/features/meetingReports/AttachmentPreviewModal.test.tsx
```

Expected: PASS with all focused suites green.

- [ ] **Step 5: Run the production build**

Run:

```powershell
npm run build
```

Expected: TypeScript and Vite finish with exit code 0.

- [ ] **Step 6: Inspect the final diff**

Run from the repository root:

```powershell
git diff --check
git status --short
git diff -- oiac-engage/src/features/meetingReports/attachmentPreviewKind.ts oiac-engage/src/features/meetingReports/attachmentPreviewKind.test.ts oiac-engage/src/features/meetingReports/MeetingReportAttachments.tsx oiac-engage/src/features/meetingReports/MeetingReportAttachments.test.tsx
```

Expected: no whitespace errors; only the planned source and test changes are present alongside any unrelated pre-existing work.

- [ ] **Step 7: Commit the integration**

```powershell
git add oiac-engage/src/features/meetingReports/MeetingReportAttachments.tsx oiac-engage/src/features/meetingReports/MeetingReportAttachments.test.tsx
git commit -m "fix: preview generic PDF and image attachments"
```
