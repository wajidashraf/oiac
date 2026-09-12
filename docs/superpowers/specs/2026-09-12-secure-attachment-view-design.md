# Secure Attachment View Design

## Goal

Replace the direct SharePoint **Open** action in the meeting-report edit form with a secure **View** action. Attachment metadata continues to load from the Dataverse `mss_attachments` table, while file bytes are retrieved only through the existing Power Automate HTTP flow.

The deployed flow already supports the `view` operation. The checked-in `flow.json` is not part of this change.

## Scope

The active attachment interface is the **Uploaded documents** section on the final step of the meeting-report edit form. The main Meeting Reports table will remain unchanged. The unused `ReportFilesCell` component will be removed because it preserves the obsolete direct-SharePoint behavior and has no callers.

Upload and delete behavior will remain unchanged except where the shared attachment metadata type must stop carrying SharePoint locations.

## Dataverse Metadata Boundary

The frontend attachment query will select only:

- `mss_attachmentsid`
- `mss_attachmentname`
- `mss_filesize`
- `mss_filetype`
- `_mss_meetingreport_value`

The frontend model will contain the normalized meeting-report ID, attachment ID, filename, MIME type, and size. It will not contain `mss_sharepointfileurl`, `mss_sharepointfilepath`, `mss_sharepointfileid`, or `mss_clientfileid`.

The Power Pages Web API field allowlist will also stop exposing those SharePoint location fields. This does not affect the Power Automate flow's Dataverse connector permissions.

Because SharePoint identifiers and paths are no longer visible to the browser, client-side grouping by SharePoint file identity will be removed. Each valid Dataverse attachment row will be represented by its own attachment ID.

## View Service

Add a reusable `viewAttachment` function to the meeting-report attachment service. It will validate the attachment and meeting-report GUIDs and send exactly this JSON body to the existing flow URL:

```json
{
  "operation": "view",
  "meetingReportId": "<normalized meeting-report GUID>",
  "attachmentId": "<normalized attachment GUID>"
}
```

No filename, MIME type, SharePoint location, client file ID, Base64 content, or other value will be included in the request.

For a successful HTTP response, the service will call `response.blob()` and will not call `response.json()`. The effective MIME type will be the normalized media type from the response `Content-Type` header, excluding parameters such as `charset`; if that header is absent or empty, the Dataverse `mss_filetype` value will be used; if both are absent, `application/octet-stream` will be used. If the returned Blob does not carry the effective type, the service will create a typed Blob wrapper.

The effective filename will come from a non-empty `X-File-Name` response header after removing control characters. If that header is absent or unusable, the Dataverse `mss_attachmentname` value will be used.

For a failed HTTP response, the service will attempt JSON parsing inside a guarded `try`/`catch` only on that error path. It will recognize an error code from `error.code`, `code`, or `errorCode` and throw a typed `MeetingReportAttachmentFlowError` containing only the HTTP status and normalized code. Network failures and malformed/non-JSON error bodies will produce the same safe generic error type without exposing the endpoint, response body, or file content.

## Edit-Form Interaction

Replace each existing attachment **Open** link with a **View** button. The component will maintain a set of attachment IDs currently loading. Clicking **View** will:

1. Ignore another click for the same attachment while its request is active.
2. Add the attachment ID to the loading set, clear the previous view error, and show `Loading…` on the button.
3. Call `viewAttachment`.
4. Preview or download the returned Blob based on the effective MIME type.
5. Remove the attachment ID from the loading set in `finally`, regardless of success or failure.

Other attachments may remain interactive while one file is loading. Existing form-wide disabled behavior will continue to disable all attachment actions during report saves.

## Preview and Download Behavior

Only two categories will be previewed:

- `application/pdf`: open an accessible modal containing an `<iframe>` whose title identifies the file.
- MIME types beginning with `image/`: open the same modal shell with a responsive `<img>` and the original filename.

The modal will use dialog semantics, expose visible **Close** and **Download** controls, close with the Escape key, and return focus to the triggering **View** button when closed. It will create a Blob URL for the preview and revoke it when the modal closes, when another preview replaces it, or when the component unmounts.

Every other MIME type—including DOC, DOCX, XLS, XLSX, CSV, ZIP, JS, and unknown formats—will bypass the modal and automatically download. The download helper will create a temporary Blob URL and `<a download>` element, append it to the document, click it, remove it, and revoke the URL after the click has been initiated.

The modal Download control will use the active preview URL. That URL remains valid while the modal is open and is revoked on close.

## Error Presentation

No `alert()` call will be used. View failures will render through the existing `form-alert`/`role="alert"` pattern inside the uploaded-documents group.

Known flow codes will receive concise user-facing messages:

- `InvalidViewRequest`: the request is invalid; refresh and try again.
- `MeetingReportNotFound`: the meeting report is unavailable or cannot be accessed.
- `AttachmentNotFound`: the attachment is unavailable or cannot be accessed.
- `FileContentNotFound`: the stored file content is unavailable.
- `AttachmentLookupFailed`: the attachment could not be retrieved; try again.

Unknown codes, non-JSON errors, and network failures will show a generic retry message. Raw flow messages and endpoint details will not be displayed.

## Components and Responsibilities

- `meetingReportAttachmentService.ts`: Dataverse metadata normalization, exact flow request, success Blob parsing, safe error parsing, MIME/filename fallback, and typed errors.
- `MeetingReportAttachments.tsx`: View-button state, per-file loading locks, MIME routing, automatic download orchestration, and existing inline error presentation.
- `AttachmentPreviewModal.tsx`: accessible PDF/image presentation, Close/Download controls, focus restoration, Escape handling, and preview Blob URL lifecycle.
- `theme.css`: modal, responsive image, embedded PDF viewer, and View/loading-button styling.
- Power Pages site settings: reduce the attachment Web API field allowlist to metadata required by the browser.

## Testing

Tests will be written before each production change and will cover:

- The Dataverse `$select` excludes every prohibited SharePoint/client field while retaining required metadata.
- The normalized attachment model carries the meeting-report ID and no direct file URL.
- The View request is POSTed with exactly `operation`, `meetingReportId`, and `attachmentId`.
- Successful responses use `blob()` without JSON parsing.
- Error responses alone attempt safe JSON parsing and preserve recognized error codes.
- Response MIME type and filename headers take precedence, with Dataverse fallbacks.
- PDF and image results open the correct accessible modal content.
- Unsupported types trigger a temporary-anchor download instead of rendering.
- The same View button shows loading, rejects repeat clicks, and is re-enabled in `finally` after success or failure.
- Known errors use the inline form alert and never call `alert()`.
- Blob URLs are revoked after automatic downloads and when previews close or unmount.
- Existing attachment listing, upload, delete, form, and build tests remain green.

## Acceptance Criteria

- No active or unused frontend code opens a SharePoint attachment URL directly.
- The browser sends only the three approved View payload properties.
- Attachment bytes and preview/download behavior originate only from the flow's binary response.
- PDFs and images have usable modal previews; unsupported files download automatically.
- Loading, retry prevention, error messages, focus, and URL cleanup behave as specified.
- Dataverse listing, upload, delete, and meeting-report form behavior remain functional.
