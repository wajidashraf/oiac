# Press Coverage View and Channel Discussion Implementation Plan

> **For agentic workers:** Use subagent-driven-development for independent scoped tasks, then review and verify the combined result.

**Goal:** Implement the user's specified Press Coverage saving/view/attachment UX and compact two-level Channel discussions.

**Architecture:** Reuse the current inline coverage form and authenticated file service; add page-local overlay/attachment presentation. Keep Channel mutations unchanged except the explicit child-reply prohibition. Preserve old nested records through flattened presentation.

**Tech Stack:** React19, TypeScript, Vitest, current react-icons, existing signed Dataverse native handlers and Power Pages deployment.

## Global constraints

- Change only the two named pages and their own feature/backend/test files. No shared LoadingBackdrop, navigation, profile, report service, schema, dependencies, site restart or Production changes.
- Workspace is dirty and Git metadata read-only: no commits, staging, resets or stashes. Work in `.superpowers/sdd/2026-10-20-coverage-view-and-channel-discussions/app`, copied from the last verified deployment. Preserve artifacts.
- Existing save/retry/idempotency/concurrency, actor/role checks, history observers and file associations remain intact.
- Exact overlay text and100×100 thumbnails follow the user request. View Comments supersedes the previous five-root initial discussion limit; post10-plus-pinned pagination stays unchanged.

## Task1: Press Coverage

Files: isolated `src/pages/PressCoverage.tsx` and tests, `src/features/pressCoverage/CoverageForm.tsx`, new local attachment/overlay components and tests, feature CSS, file service/tests; root `oiac-engage/backend/coverageFiles/CoverageFileCommandPlugin.cs` and tests only.

- [x] Write/run failing tests for View/headline fetch, read-only fields/no record modal, View/Edit permissions, overlay until both save/upload settle and failure recovery.
- [x] Add local attachment presenter using `downloadCoverageFile(id) -> {blob,fileName}` with image/PDF/Excel classification,100×100 image/full-size link, inline PDF, download fallback, stale-request handling and object-URL cleanup.
- [x] Add GIF/XLS/XLSX MIME/extension/signature cases to matching private frontend/native validators; preserve existing sizes/featured image-only rule and transfer algorithm. Run frontend and native coverage suites.
- [x] Implement form view state and exact overlay copy, preserving guards, latest edit permissions and upload-only retry. Report exact changed paths and tests.

## Task2: Activity Channel

Files: isolated `src/features/activityChannel/ActivityDiscussion.tsx`, `activityPresentation.tsx`, feature CSS and affected tests; root `oiac-engage/backend/activityChannel/ActivityChannelCommandPlugin.cs` and native tests only.

- [x] Write/run failing tests for one-parent/one-child preview, View Comments expansion, root-only Reply, flattened preserved legacy descendants and native child-parent rejection with zero creates.
- [x] Implement compact preview and expansion through existing comment continuation; keep independent drafts and confirmed-save handling. Cap visual nesting at one child level without altering data.
- [x] Move the colored card accent to `.ac-post`; remove discussion/thread left borders. Preserve post pagination, moderation, author permissions and other theme styling.
- [x] Reject requested reply parent if it already has a parent; retain same-post/active/root validation and replay behavior. Run relevant frontend/native suites and report.

## Task3: Review, integration and UAT

- [x] Review both tasks against the design and diff only allowed paths. Copy only authorized reviewed sources to the main app for review; leave other dirty sources intact.
- [x] Run combined focused tests and production build in isolated app; compare unrelated source/config hashes to baseline. Review object-URL lifecycle, inline view accessibility, save errors, server depth enforcement and old data preservation.
- [x] Deploy only the two changed existing native assemblies and exact scoped frontend bundle to the previously authorized UAT website, preserving downloaded current metadata and history configuration.
- [x] Verify readback/runtime hashes and hosted UX using the signed-in Work8 test window where available. Use only fresh marked fixtures, verify file linkage, root replies and child-reply rejection, then clean up owned source fixtures and record limitations accurately.
