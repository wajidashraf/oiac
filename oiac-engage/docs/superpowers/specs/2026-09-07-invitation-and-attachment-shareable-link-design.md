# Invitation Registration and Attachment Shareable Link Design

## Goal

Allow users with a Power Pages invitation code to redeem it without disabling the existing open-registration path. On the Meeting Report edit form, make each uploaded document's existing **Open** action use the attachment record's `mss_shareablelink` value.

## Scope

- Enable invitation-based registration and keep open registration enabled.
- Add `mss_shareablelink` to the allowed Web API fields for `mss_attachments`.
- Read and validate `mss_shareablelink` when attachment metadata is loaded.
- Keep the existing uploaded-document presentation and delete action unchanged.
- Keep the Reports list unchanged, including its District column and absence of a Documents column.

## Design

`Authentication/Registration/InvitationEnabled` will change from `false` to `true`. `Authentication/Registration/OpenRegistrationEnabled` and the other current local-registration settings will remain unchanged, allowing either normal registration or invitation redemption.

The attachment metadata query will select `mss_shareablelink` instead of `mss_sharepointfileurl`. The service will map a valid HTTPS `mss_shareablelink` value to the existing `MeetingReportAttachment.fileUrl` property. This keeps the form component's interface stable: its **Open** link will automatically point to the shareable URL, while **Delete** continues to identify the same attachment record.

The old `mss_sharepointfileurl` value will not be used as a fallback. Missing, malformed, or non-HTTPS shareable links will map to `null`, preserving the existing unavailable-link behavior.

## Error Handling and Security

- Shareable links continue through the existing HTTPS-only URL validation.
- Invalid or absent URLs do not render a clickable **Open** action.
- Attachment listing and deletion retain their current error and retry behavior.
- No invitation code is handled or stored by the React application; Power Pages owns invitation redemption.

## Testing

- Update the authentication-settings test to require both invitation and open registration to be enabled.
- Update attachment-service tests to prove `mss_shareablelink` is requested and mapped to `fileUrl`.
- Update the Power Pages attachment field-permission test to require `mss_shareablelink`.
- Run focused authentication, attachment-service, attachment-form, and configuration tests, followed by the production build.
