# Press Coverage view and Activity Channel discussions

The user's detailed 20 October request defines this scoped change. Only Press Coverage and Activity Channel and their own supporting services may change. Preserve all other deployed sources and current dirty workspace edits. The new source snapshot starts from the verified last deployed build, not unrelated pending work.

## Press Coverage

Reuse the inline CoverageForm for new/edit/view modes. Clicking any headline or View action fetches the latest record and displays the same form read-only above the existing listing. No record-details dialog. Show View for every listed record; retain the existing creator-or-Administrator Edit policy in both listing and view. Recheck latest permissions before edit and preserve existing server authorization.

During create/update and any following file transfer, show a scoped report-style loading overlay with exact title `Saving Press Coverage` and description `Please wait while your Press Coverage record is being saved.` Keep existing submit locks, navigation guards, uncertain-save handling, committed-record/file retry and ID association. Hide the overlay after success or failure.

The view form contains a dedicated attachment panel using the current authenticated download service. Show a type icon and filename. Images have a100×100 thumbnail linked to a full-size image in another tab. PDFs preview inline with a readable download fallback. Excel files have an Excel icon and download/open access. Use bounded local blob URLs; revoke them on record change/unmount and ignore stale responses. A failed preview offers an explicit retry without resubmitting a record. Do not use external document viewers or share authenticated files with third-party services.

Keep existing PNG/JPG/JPEG/WebP/PDF behavior; add GIF and XLS/XLSX recognition (XLSM remains disallowed) to this page's matching frontend/native file checks. Featured logos remain image-only and2MB; regular attachments remain10MB. Preserve the existing chunking, token storage, native persistence, record association and report upload service. No schema/global settings/dependency changes.

## Activity Channel

Move the colored left accent from the complete card to its Post section only; the Discussion container and indentation have no left border. Keep current avatar, text, timestamp and theme patterns.

Only parent comments may receive replies. The UI exposes Reply only on roots, and the native reply command rejects a child as its requested parent before any write. A parent still supports multiple children. Preserve existing deeper data: render older descendants at the child visual level and retain their original author, timestamp, text and stored parent association; do not migrate/delete records.

Each post's initial discussion preview shows one parent and its first available direct child. Hide other parents and children behind a compact `View Comments` control. Expanding reveals all currently loaded comments and can request further server pages through the existing continuation/retry path. Keep hidden reply composers mounted so draft state survives expansion, and preserve independent post pagination, pin/delete permissions, write concurrency and confirmed-save handling.

## Validation and deployment

Add meaningful failing regressions before changes: read-only inline view, role actions, saving overlay across record and upload promises, type-specific preview/cleanup/retry, accepted/rejected file formats, compact discussion preview, expansion, child Reply absence, legacy flattening and server rejection of nested replies. Run focused tests, relevant native suites, production build and a scoped source manifest review. Register only the changed existing Channel/file assemblies in the previously authorized UAT target and upload the reviewed bundle with all current site metadata preserved. No Production or site restart. Hosted checks use only new marked fixtures and retain append-only Activity Log entries.
