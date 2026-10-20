# Coverage uploads and requested UI corrections

Goal: reliably attach and retrieve coverage files on their saved records, and apply the user's explicit appointment/Activity presentation changes.

Execution stays in the existing dirty workspace, with before snapshots and no commits. Follow the debugging and verification workflows directly; no delegation is needed. User requests already authorize these corrections and the established Test/UAT target. Production and unrelated report upload behavior remain outside this change.

- [ ] Snapshot affected source and inspect the working report attachment mechanism and current coverage transport. Reproduce the hosted failure with only uniquely named own test records and capture sanitized status/size evidence. A signed-in testing account is required for native verification.
- [ ] Hide the appointment status badge only when response actions are available. Other Pending/Accepted/Cancelled badges retain their current placement and behavior.
- [ ] Replace Activity card delete text with an accessible trash-icon button; label moderation buttons Pin/Unpin. Use a real styled Open button in the collapsed Create Activity section, preserving focus restoration and existing draft behavior.
- [ ] Fix the proven upload boundary using the existing authorized coverage File storage. Preserve creator checks, type/size/signature validation, existing-record file-only retry and direct-table API restrictions. Verify downloads and association with the exact coverage ID. Expose a file control on the relevant coverage row without changing table structure.
- [ ] Run focused regressions, full suite/build and relevant browser checks. Upload the reviewed fix to the previously approved UAT site with fresh metadata preservation and no restart. Verify the actual hosted form/file round trip, replacement/retry and requested UI, and clean up only new test records. Update documentation with evidence and remaining account limits.

Coverage backend implementation details will be recorded after reproduction establishes the failing boundary; this plan does not assume that a schema or report-flow change is necessary.
