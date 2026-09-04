# Meeting Report Batch Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-file Power Automate upload calls with one request containing all selected files, capped at 70 MB raw content, while preserving failed-file-only retry.

**Architecture:** Keep list and delete contracts unchanged. The attachment service assigns stable client IDs to browser `File` objects, encodes files concurrently, sends one upload request, strictly reconciles every response result, and returns successful attachments plus failed files to the form.

**Tech Stack:** React 19, TypeScript 5.7, Vitest, Power Pages SPA, Power Automate HTTP trigger.

## Global Constraints

- Maximum 10 files, 10 MB per file, and 70 MB combined raw content.
- One upload HTTP call per save or retry attempt.
- The flow continues processing every file and returns one result per input file.
- A retry contains only failed files and reuses stable `clientFileId` values.
- Do not modify the Power Automate flow, SharePoint, or Dataverse schema.
- Do not stage PAC-generated credential-bearing deployment bundles.

### Task 1: Batch service contract

**Files:** Modify `meetingReportAttachmentService.ts` and its tests.

- [ ] Write failing tests for the total-size limit, one `files` payload, stable IDs, partial results, and malformed reconciliation.
- [ ] Run the focused service suite and verify expected failures.
- [ ] Implement `uploadMeetingReportAttachments(reportId, files)` and the 70 MB validation.
- [ ] Run the focused suite and verify it passes.

### Task 2: Form orchestration

**Files:** Modify `MeetingReportForm.tsx`, `MeetingReportAttachments.tsx`, `Report.test.tsx`, and report-scoped help text.

- [ ] Write failing integration assertions for one batch call and failed-file-only retry.
- [ ] Replace the per-file loop with one batch request and retain returned failed files.
- [ ] Update the upload help copy to include the 70 MB combined limit.
- [ ] Run focused integration and component suites.

### Task 3: Verify and hand off

- [ ] Run the full test suite and production build.
- [ ] Confirm the signed URL remains only in ignored files/generated deployment output.
- [ ] Commit source/tests/docs without PAC-generated bundles.
