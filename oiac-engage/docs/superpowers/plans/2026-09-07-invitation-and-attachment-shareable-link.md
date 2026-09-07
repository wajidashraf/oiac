# Invitation Registration and Attachment Shareable Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Power Pages invitation redemption alongside open registration and make the Meeting Report edit form's existing attachment Open action use `mss_shareablelink`.

**Architecture:** Power Pages site settings remain the source of truth for registration modes and Web API field access. The attachment service keeps its public `MeetingReportAttachment.fileUrl` interface, but fills it exclusively from the Dataverse `mss_shareablelink` column so the existing edit-form UI needs no component changes.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Vitest 2, Power Pages YAML configuration, Dataverse Web API.

## Global Constraints

- Keep open registration enabled while enabling invitation-based registration.
- Keep the Reports list unchanged with its District column and no Documents column.
- Keep the Meeting Report edit form's existing Open and Delete controls unchanged.
- Use only valid HTTPS values from `mss_shareablelink`; do not fall back to `mss_sharepointfileurl`.
- Preserve all unrelated working-tree changes.

---

### Task 1: Enable invitation redemption alongside open registration

**Files:**
- Modify: `src/auth/powerPagesAuthSettings.test.ts:27-33`
- Modify: `.powerpages-site/site-settings/Authentication-Registration-InvitationEnabled.sitesetting.yml:3`

**Interfaces:**
- Consumes: Power Pages `Authentication/Registration/*` site settings.
- Produces: Both `InvitationEnabled=true` and `OpenRegistrationEnabled=true` in the deployed site configuration.

- [ ] **Step 1: Update the authentication test first**

```ts
test('enables invitation redemption alongside open local registration', () => {
  expect(settingValue(registrationEnabled)).toBe('true')
  expect(settingValue(invitationEnabled)).toBe('true')
  expect(settingValue(localLogin)).toBe('true')
  expect(settingValue(openRegistration)).toBe('true')
})
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run: `npm test -- src/auth/powerPagesAuthSettings.test.ts`

Expected: FAIL because `InvitationEnabled` is currently `false`.

- [ ] **Step 3: Enable the existing invitation setting**

```yaml
id: a35e37c3-e4d3-4b62-a107-f69cd337d71b
name: Authentication/Registration/InvitationEnabled
value: true
```

- [ ] **Step 4: Re-run the authentication test**

Run: `npm test -- src/auth/powerPagesAuthSettings.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit only the registration files**

```powershell
git add -- src/auth/powerPagesAuthSettings.test.ts .powerpages-site/site-settings/Authentication-Registration-InvitationEnabled.sitesetting.yml
git commit -m "feat: enable invitation registration"
```

---

### Task 2: Source existing attachment Open links from `mss_shareablelink`

**Files:**
- Modify: `src/features/meetingReports/meetingReportAttachmentService.test.ts:131-233`
- Modify: `src/features/meetingReports/meetingReportPowerPagesConfig.test.ts:98-106`
- Modify: `src/features/meetingReports/meetingReportAttachmentService.ts:33-53,182-210`
- Modify: `.powerpages-site/site-settings/Webapi-mss_attachments-fields.sitesetting.yml:1-4`
- Verify unchanged: `src/features/meetingReports/MeetingReportAttachments.tsx`
- Verify unchanged: `src/pages/Report.tsx`

**Interfaces:**
- Consumes: Dataverse attachment metadata field `mss_shareablelink?: unknown`.
- Produces: Existing `MeetingReportAttachment.fileUrl: string | null`, populated only by a valid HTTPS shareable link.

- [ ] **Step 1: Change fixture data and assertions to require the shareable link**

In the attachment-list tests, replace each fixture's URL field with `mss_shareablelink`. Use a share URL that differs from the legacy URL and assert the normalized result uses it:

```ts
mss_shareablelink: 'https://contoso.sharepoint.com/:b:/r/sites/OIAC/Meeting%20Notes.pdf?e=abc123',
mss_sharepointfileurl: 'https://contoso.sharepoint.com/legacy/Meeting%20Notes.pdf',
```

```ts
expect(result.get(reportId)?.[0]?.fileUrl).toBe(
  'https://contoso.sharepoint.com/:b:/r/sites/OIAC/Meeting%20Notes.pdf?e=abc123',
)
expect(parsedUrl.searchParams.get('$select')).toContain('mss_shareablelink')
expect(parsedUrl.searchParams.get('$select')).not.toContain('mss_sharepointfileurl')
```

Keep the unsafe URL case by placing `javascript:alert(1)` in `mss_shareablelink` and expecting `fileUrl: null`.

- [ ] **Step 2: Change the Power Pages configuration test first**

Require `mss_shareablelink` and explicitly reject the legacy URL field:

```ts
expect(attachmentFields).toContain('mss_shareablelink')
expect(attachmentFields).not.toContain('mss_sharepointfileurl')
```

- [ ] **Step 3: Run both tests and verify the expected failures**

Run: `npm test -- src/features/meetingReports/meetingReportAttachmentService.test.ts src/features/meetingReports/meetingReportPowerPagesConfig.test.ts`

Expected: FAIL because the service query and allowed-fields setting still use `mss_sharepointfileurl`.

- [ ] **Step 4: Update the attachment record and query field**

In `DataverseAttachmentRecord` and `ATTACHMENT_LIST_SELECT`, replace `mss_sharepointfileurl` with `mss_shareablelink`:

```ts
type DataverseAttachmentRecord = {
  readonly mss_attachmentsid?: unknown
  readonly mss_attachmentname?: unknown
  readonly mss_filesize?: unknown
  readonly mss_filetype?: unknown
  readonly _mss_meetingreport_value?: unknown
  readonly mss_sharepointfileid?: unknown
  readonly mss_sharepointfilepath?: unknown
  readonly mss_shareablelink?: unknown
}

const ATTACHMENT_LIST_SELECT = [
  'mss_attachmentsid',
  'mss_attachmentname',
  'mss_filesize',
  'mss_filetype',
  '_mss_meetingreport_value',
  'mss_sharepointfileid',
  'mss_sharepointfilepath',
  'mss_shareablelink',
] as const
```

- [ ] **Step 5: Map only the validated shareable link**

```ts
const fileUrl = optionalHttpsUrl(record.mss_shareablelink)
```

Leave `MeetingReportAttachment.fileUrl`, `optionalHttpsUrl`, and the existing form rendering unchanged.

- [ ] **Step 6: Update the Web API field allowlist**

Replace `mss_sharepointfileurl` with `mss_shareablelink` in the YAML value and make its description refer to Meeting Report attachment displays rather than the Reports list:

```yaml
description: Allow only attachment metadata fields required by Meeting Report attachment displays
id: 89aa2636-179e-4467-90ee-ef58535f80fc
name: Webapi/mss_attachments/fields
value: "mss_attachmentsid,mss_attachmentname,mss_filesize,mss_filetype,mss_meetingreport,_mss_meetingreport_value,mss_sharepointfileid,mss_sharepointfilepath,mss_shareablelink"
```

- [ ] **Step 7: Re-run the attachment tests**

Run: `npm test -- src/features/meetingReports/meetingReportAttachmentService.test.ts src/features/meetingReports/meetingReportPowerPagesConfig.test.ts src/features/meetingReports/MeetingReportAttachments.test.tsx src/pages/Report.test.tsx`

Expected: PASS. The component test confirms Open/Delete rendering remains intact; the Reports test confirms the current District-only table is unaffected.

- [ ] **Step 8: Commit only the attachment files**

```powershell
git add -- src/features/meetingReports/meetingReportAttachmentService.test.ts src/features/meetingReports/meetingReportPowerPagesConfig.test.ts src/features/meetingReports/meetingReportAttachmentService.ts .powerpages-site/site-settings/Webapi-mss_attachments-fields.sitesetting.yml
git commit -m "feat: use attachment shareable links"
```

---

### Task 3: Verify the integrated change

**Files:**
- Verify: all files changed by Tasks 1 and 2.

**Interfaces:**
- Consumes: Completed registration and attachment changes.
- Produces: Test and build evidence that the requested behavior is ready for deployment.

- [ ] **Step 1: Run the complete focused suite**

Run: `npm test -- src/auth/powerPagesAuthSettings.test.ts src/features/meetingReports/meetingReportAttachmentService.test.ts src/features/meetingReports/meetingReportPowerPagesConfig.test.ts src/features/meetingReports/MeetingReportAttachments.test.tsx src/pages/Report.test.tsx`

Expected: PASS with no failed tests.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite complete successfully.

- [ ] **Step 3: Inspect the final scoped diff**

Run:

```powershell
git diff --check
git status --short
```

Expected: No whitespace errors. Existing unrelated modifications remain present and untouched.
