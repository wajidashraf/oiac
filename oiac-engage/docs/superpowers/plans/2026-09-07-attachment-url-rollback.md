# Attachment URL Rollback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore `mss_sharepointfileurl` as the only source for uploaded-document Open links and redeploy the corrected site to the existing OIAC Engage test website.

**Architecture:** Keep the public `MeetingReportAttachment.fileUrl` interface and edit-form rendering unchanged. Change only the Dataverse field selected and normalized by the attachment service, its Power Pages Web API allowlist, and the tests that enforce that contract.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Vitest 2, Power Pages YAML configuration, Dataverse Web API, PAC CLI 2.11.

## Global Constraints

- `mss_sharepointfileurl` is the sole attachment URL source.
- `mss_shareablelink` is not selected, allowed, mapped, or used as a fallback.
- Open remains conditional on a valid HTTPS URL.
- Delete behavior, invitation registration, and the Reports list District column remain unchanged.
- Deploy only to environment `16838866-275a-e2e7-838f-57313f30a416`, website `e7f400bd-1e04-4efa-b8b3-7a7a3b168662`.
- Preserve unrelated uncommitted source changes.

---

### Task 1: Restore the attachment URL contract

**Files:**
- Modify: `src/features/meetingReports/meetingReportAttachmentService.test.ts:131-233`
- Modify: `src/features/meetingReports/meetingReportPowerPagesConfig.test.ts:98-108`
- Modify: `src/features/meetingReports/meetingReportAttachmentService.ts:33-53,182-210`
- Modify: `.powerpages-site/site-settings/Webapi-mss_attachments-fields.sitesetting.yml:1-4`

**Interfaces:**
- Consumes: Dataverse `mss_sharepointfileurl?: unknown`.
- Produces: Existing `MeetingReportAttachment.fileUrl: string | null`, populated only from a valid HTTPS `mss_sharepointfileurl`.

- [ ] **Step 1: Change the service tests to require the restored field**

Use a valid legacy URL alongside a different shareable URL so the assertion proves which field wins:

```ts
mss_sharepointfileurl: 'https://contoso.sharepoint.com/Shared%20Documents/report/Meeting%20Notes.pdf',
mss_shareablelink: 'https://contoso.sharepoint.com/:b:/r/sites/OIAC/wrong-link.pdf?e=abc123',
```

```ts
expect(result.get(reportId)?.[0]?.fileUrl).toBe(
  'https://contoso.sharepoint.com/Shared%20Documents/report/Meeting%20Notes.pdf',
)
expect(parsedUrl.searchParams.get('$select')).toContain('mss_sharepointfileurl')
expect(parsedUrl.searchParams.get('$select')).not.toContain('mss_shareablelink')
```

Put `javascript:alert(1)` in the unsafe fixture's `mss_sharepointfileurl` and continue expecting `fileUrl: null`.

- [ ] **Step 2: Change the configuration test to require only the restored field**

```ts
expect(attachmentFields).toContain('mss_sharepointfileurl')
expect(attachmentFields).not.toContain('mss_shareablelink')
```

- [ ] **Step 3: Run the focused tests and verify the expected failure**

Run: `npm test -- src/features/meetingReports/meetingReportAttachmentService.test.ts src/features/meetingReports/meetingReportPowerPagesConfig.test.ts`

Expected: FAIL because production still selects, maps, and allows `mss_shareablelink`.

- [ ] **Step 4: Restore the Dataverse record type and select list**

```ts
type DataverseAttachmentRecord = {
  readonly mss_attachmentsid?: unknown
  readonly mss_attachmentname?: unknown
  readonly mss_filesize?: unknown
  readonly mss_filetype?: unknown
  readonly _mss_meetingreport_value?: unknown
  readonly mss_sharepointfileid?: unknown
  readonly mss_sharepointfilepath?: unknown
  readonly mss_sharepointfileurl?: unknown
}

const ATTACHMENT_LIST_SELECT = [
  'mss_attachmentsid',
  'mss_attachmentname',
  'mss_filesize',
  'mss_filetype',
  '_mss_meetingreport_value',
  'mss_sharepointfileid',
  'mss_sharepointfilepath',
  'mss_sharepointfileurl',
] as const
```

- [ ] **Step 5: Restore normalization to the legacy URL field**

```ts
const fileUrl = optionalHttpsUrl(record.mss_sharepointfileurl)
```

- [ ] **Step 6: Restore the Power Pages field allowlist**

```yaml
description: Allow only attachment metadata fields required by Meeting Report attachment displays
id: 89aa2636-179e-4467-90ee-ef58535f80fc
name: Webapi/mss_attachments/fields
value: "mss_attachmentsid,mss_attachmentname,mss_filesize,mss_filetype,mss_meetingreport,_mss_meetingreport_value,mss_sharepointfileid,mss_sharepointfilepath,mss_sharepointfileurl"
```

- [ ] **Step 7: Run the attachment and Report regression tests**

Run: `npm test -- src/features/meetingReports/meetingReportAttachmentService.test.ts src/features/meetingReports/meetingReportPowerPagesConfig.test.ts src/features/meetingReports/MeetingReportAttachments.test.tsx src/pages/Report.test.tsx`

Expected: PASS. The component continues showing Open only for non-null `fileUrl`, Delete remains available, and the Reports table remains District-only.

- [ ] **Step 8: Commit the rollback files**

```powershell
git add -- src/features/meetingReports/meetingReportAttachmentService.test.ts src/features/meetingReports/meetingReportPowerPagesConfig.test.ts src/features/meetingReports/meetingReportAttachmentService.ts .powerpages-site/site-settings/Webapi-mss_attachments-fields.sitesetting.yml
git commit -m "fix: restore attachment SharePoint URLs"
```

---

### Task 2: Verify and redeploy the rollback

**Files:**
- Verify: all Task 1 files and unchanged UI/report files.
- Update through PAC: `.powerpages-site` compiled web-file and manifest artifacts.

**Interfaces:**
- Consumes: The tested rollback and `powerpages.config.json` site metadata.
- Produces: A successful upload to the confirmed OIAC Engage test website.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: 50 test files and 377 tests pass with no failures.

- [ ] **Step 2: Build the production bundle**

Run: `npm run build`

Expected: TypeScript and Vite finish successfully.

- [ ] **Step 3: Reconfirm PAC authentication and site identity**

Run:

```powershell
pac auth who
Select-String -Path .powerpages-site/website.yml -Pattern '^id:|^name:'
```

Expected: Environment `16838866-275a-e2e7-838f-57313f30a416`; website `e7f400bd-1e04-4efa-b8b3-7a7a3b168662`, `OIAC Engage`.

- [ ] **Step 4: Upload the code site**

Run:

```powershell
pac pages upload-code-site --rootPath "C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage"
```

Expected: `Power Pages website upload succeeded` and `Upload complete`.

- [ ] **Step 5: Record deployment skill usage**

Run:

```powershell
node "C:\Users\Administrator\.codex\plugins\cache\power-platform-skills\power-pages\2.6.2\scripts\update-skill-tracking.js" --projectRoot "C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage" --skillName "DeploySite" --authoringTool "Codex"
```

- [ ] **Step 6: Commit only generated deployment artifacts**

```powershell
git add -A -- .powerpages-site
git commit -m "chore: redeploy attachment URL rollback to test"
```

- [ ] **Step 7: Inspect final repository state**

Run:

```powershell
git status --short
git log -5 --oneline
```

Expected: Task files and deployment artifacts are committed; unrelated source changes remain uncommitted and untouched.
