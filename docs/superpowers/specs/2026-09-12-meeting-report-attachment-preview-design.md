# Meeting Report Attachment Preview Design

## Goal

When a user selects **View** for an uploaded document on the meeting report edit form, show PDFs and browser-supported images in a modal on the same page. Preserve the current immediate download behavior for files that cannot be previewed.

## Existing Context

`MeetingReportAttachments` already retrieves attachment content securely through `viewAttachment`, displays a loading state, and opens `AttachmentPreviewModal` for recognized PDF and image MIME types. The modal already provides Download and Close actions, closes on Escape, restores focus, and revokes its temporary object URL.

The current routing checks only the returned content type. When the attachment flow returns a generic type such as `application/octet-stream`, a PDF or image is incorrectly treated as unsupported and downloaded.

## Design

### Preview classification

Add a small, pure attachment preview classifier with this precedence:

1. Recognize a normalized `application/pdf` content type as PDF.
2. Recognize a normalized `image/*` content type as an image.
3. If the content type is absent or generic (`application/octet-stream`), inspect the returned filename extension case-insensitively.
4. Recognize `.pdf` as PDF and common browser image extensions (`.avif`, `.bmp`, `.gif`, `.ico`, `.jpeg`, `.jpg`, `.png`, `.svg`, and `.webp`) as images.
5. Classify every other file as unsupported.

An explicit, non-generic unsupported MIME type takes precedence over a misleading filename extension. This avoids attempting to preview content that the server identifies as another format.

### User interaction

- **View** continues to retrieve the attachment through the secure flow.
- A PDF opens in the existing modal using its embedded PDF frame.
- An image opens in the existing modal using a responsive image element.
- The modal retains **Download** and **Close** actions.
- An unsupported file downloads immediately using its returned filename.
- Loading, duplicate-click protection, safe error messages, Escape handling, focus restoration, and object URL cleanup remain unchanged.

### Component boundaries

- The pure classifier owns file-preview eligibility and returns `pdf`, `image`, or `unsupported`.
- `MeetingReportAttachments` uses that result to choose between opening `AttachmentPreviewModal` and invoking the existing download helper.
- `AttachmentPreviewModal` assigns a browser-viewable MIME type to generic PDF and image blobs before creating their object URL, then displays the content and owns modal interaction.
- `meetingReportAttachmentService` remains responsible for secure retrieval and response normalization.

## Error Handling

Retrieval errors continue to use the existing inline alert messages. A preview classification failure is represented by `unsupported` and triggers the existing download path; it does not produce a new error state.

## Testing

Focused tests will verify:

- PDF and image MIME types open the correct preview.
- MIME types with casing or parameters are normalized before classification.
- Generic or absent MIME types fall back to case-insensitive filename extensions.
- Generic preview blobs are assigned the correct PDF or image MIME type before their object URLs are created.
- Explicit unsupported MIME types and unsupported extensions download instead of opening a modal.
- Existing modal Download and Close behavior remains covered.
- The TypeScript build and relevant Vitest suites pass after implementation.

## Scope

This change does not add previews for Office documents, text files, audio, video, or archives. It does not alter upload validation, attachment storage, or the Power Automate contract.
