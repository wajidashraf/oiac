# Press Coverage implementation plan

> For agentic workers: use subagent-driven-development for independent UI and data-service tasks; keep remote schema/auth operations with the primary agent.

Goal: implement the approved Press Coverage module in the existing SPA and prepare secure Test/UAT integration without affecting Production.

Architecture: retain React Router, existing shells, ContactLookup and CSRF-safe shared API. Store both variants in mss_presscoverage. Add the approved server-stamped immutable Submitted By Contact lookup and one File column if required. A coverage-specific server endpoint controls creation and updates; server permissions must independently reject unauthorized direct requests.

Tech stack: React 19, TypeScript, React Router 7, Vite, Vitest, Power Pages and Dataverse.

## Constraints

- Match supplied screenshots; all new visual rules scoped to Press Coverage.
- No production writes or deployment; only the approved additions in Test/UAT.
- Preserve existing Join Event source/test edits, deleted flow.json, untracked design folder.
- Do not modify shared authentication or API behavior; coverage-only route exception for authenticated pending users.
- No new dependencies; no global ordinary-user update grant.
- Never confuse Related Contact with Submitted By. Legacy imported rows remain admin-editable only.
- Do not change existing Meeting Report upload flow.
- Verify metadata, dates, file API, and ownership enforcement rather than inferring.

## Tasks and progress

- [x] Review app and supplied requirements; confirm Test/UAT source table and enum mappings.
- [x] Obtain approval for Submitted By lookup and coverage-specific file storage.
- [x] Verify detailed schema and acquire supported SDK/API access; apply only approved missing additions in Test/UAT and validate resulting metadata.
- [x] Define shared module contract; write failing service tests; implement mapping, safe pagination, current-record reads, narrow Contact lookup, variant-scoped mutations, file validation/upload/download.
- [x] Write failing UI tests; implement listing, type selector, two create/edit forms, dirty guards, duplicate-submit prevention, status/errors, upload-only retry.
- [x] Implement/test server-side authenticated creator stamping, field/variant validation, portal-permission write checks and file access with a simulated SDK; prepare exact least-privilege configuration.
- [x] Add targeted route/navigation integration and regression tests, maintaining other pending-user restrictions.
- [x] Review implementation and fix substantive findings; run all tests/build and scoped browser checks.
- [x] Update delivery/deployment notes, field mappings and exact configuration; report remaining work truthfully.
- [x] Obtain approval for a portal code/configuration deployment to the identified Test/UAT site; no Production deployment.
- [x] Back up UAT, preserve fresh target metadata, deploy the reviewed build/configuration and read back source/permissions/settings. PAC upload succeeded; previous PAC profile restored.
- [ ] Verify Test/UAT direct unauthorized API denial, real role permissions, file limits and persist/reload behavior using representative signed-in portal sessions. Upload succeeded; runtime cache refresh and an authenticated test-browser session remain pending. Local fixtures cannot verify this.

## Verification commands

Use the project's existing npm test command and npm run build. On this host esbuild needs access outside the filesystem sandbox to resolve config paths; rerun the existing commands with the approved execution context rather than modifying Vite configuration.

Service and UI tests must cover success and failure paths, legacy records, duplicate create uncertainty, wrong-creator denial, variant immutability, Contact search escaping/limits, invalid dates/URLs, file validation, and retry without creating duplicate records.

Use browser checks with the appropriate authenticated roles and mocked data locally for rendering. A local mocked browser result cannot establish Dataverse authorization. Remote permission verification requires representative Test/UAT portal sessions.

## Recovery ledger

Plan identity: docs/superpowers/plans/2026-10-16-press-coverage.md

Baseline before feature: 552 tests/61 files passed, production build succeeded. No feature implementation or remote writes had occurred when this plan was created.

Current handoff: [docs/press-coverage.md](../../press-coverage.md). On 16 October 2026 the feature implementation passed all 693 tests in 67 files, the TypeScript/Vite production build, and the repeatable local Chromium check (Back/Forward, pending-save navigation, 9 scoped axe/layout checks with no violations or document overflow). Review fixes covered uncertain-create duplication, base64 canonical padding, stale pagination after errors, native browser event ordering, and screenshot form grouping. Branch: `feature/press-coverage`; changes remain uncommitted for review, preserving pre-existing edits.

Remote state: approved Submitted By lookup and File column created/verified in Test/UAT, added to CRMSolution and table schema published. User subsequently approved deployment to the exact site URL. PAC upload succeeded in 138.90 seconds; readback confirmed byte-identical ServerLogic, the authenticated endpoint role, all three coverage permissions and both settings, with existing functional settings/permissions unchanged. Runtime cache refresh and authenticated UAT acceptance remain outstanding; the automated browser did not share the user's normal signed-in session. No Production changes. Evidence: `docs/alm/press-coverage-uat-deployment.json`.
