# Attachment URL Rollback Design

## Goal

Restore `mss_sharepointfileurl` as the sole source for the Meeting Report edit form's uploaded-document **Open** links, then deploy the rollback to the existing OIAC Engage test site.

## Scope

- Replace `mss_shareablelink` with `mss_sharepointfileurl` in the attachment metadata query and normalization.
- Replace `mss_shareablelink` with `mss_sharepointfileurl` in the Power Pages Web API field allowlist.
- Keep the existing conditional Open-link rendering and HTTPS-only validation.
- Keep attachment deletion, invitation registration, and the Reports list District column unchanged.
- Build and deploy to environment `16838866-275a-e2e7-838f-57313f30a416`, website `e7f400bd-1e04-4efa-b8b3-7a7a3b168662`.

## Data Flow

The attachment service will request `mss_sharepointfileurl` from the `mss_attachments` Web API endpoint and normalize a valid HTTPS value into the existing `MeetingReportAttachment.fileUrl` property. The edit form will continue to render **Open** only when `fileUrl` is non-null. Missing, malformed, or non-HTTPS values will keep the link hidden.

`mss_shareablelink` will not be selected, allowed, mapped, or used as a fallback.

## Testing and Deployment

- Update attachment-service fixtures and assertions to prove `mss_sharepointfileurl` is selected and mapped while `mss_shareablelink` is excluded.
- Update the Power Pages configuration test to require only the restored URL field.
- Run the focused attachment and Report tests, the full test suite, and the production build.
- Upload with `pac pages upload-code-site` to the already confirmed test environment and website.
- Preserve unrelated uncommitted source changes.
