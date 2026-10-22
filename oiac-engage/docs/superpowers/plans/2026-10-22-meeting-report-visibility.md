# Meeting Report Access Implementation Plan

Goal: Administrators read/edit all reports; other users read/edit only their own. Preserve reporter, submission workflow, personal Home scope and unrelated modules.

- [x] Inspect source and fresh Production permission metadata read-only.
- [x] Reproduce missing administrator read/edit and attachment metadata access with failing tests.
- [x] Add administrator-only report Read/Write/Append/Append To and parent attachment Read metadata; preserve original Contact-owned permissions.
- [x] Add role/ownership-aware Edit links and reuse existing edit workflow; retain reporter lookup during updates.
- [x] Preserve personal Home queries, including missing Contact guard and continuation scope.
- [x] Run final full frontend suite/build and refreshed access review.
- [x] Refresh prepared deployment package and document hosted verification needs; keep Production unchanged until deployment requested.

No schema, Contact, native plug-in, file storage or workflow changes. Global create/delete and attachment writes remain disabled in the new permissions.
