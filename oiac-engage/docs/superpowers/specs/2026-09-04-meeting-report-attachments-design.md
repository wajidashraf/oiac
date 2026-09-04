# Meeting Report Attachments Design

## Goal

Replace the optional `Documents Provided` text input on the final Meeting Report form step with a multi-file attachment control. The React client will create or update the Meeting Report first, then call the existing Power Automate HTTP trigger with `list`, `upload`, or `delete` operations. Power Automate, SharePoint, and the Dataverse attachment/reference table remain managed manually outside this code change.

## Scope

The code change covers the React create/edit form, a focused HTTP-flow client, attachment state and validation, retry-safe save orchestration, styling, automated tests, and the Meeting Report technical documentation. It does not create or modify the Power Automate flow, SharePoint library, Dataverse attachment table, table permissions, or cloud-flow-consumer metadata.

The HTTP trigger URL supplied by the user will be used directly from the browser and hardcoded in the attachment-flow service. No Vite environment variable will be introduced. Because the signed URL is shipped in the compiled JavaScript, it is visible to portal users and changing its signature requires a source update, rebuild, and redeployment.

## Form behavior

### New reports

- Replace `Documents Provided` with an optional file picker labelled `Documents Provided`.
- Enable the native `multiple` attribute.
- Allow at most 10 selected files and at most 10 MB per file.
- Do not restrict extensions or MIME types beyond the filename rule below; SharePoint or the flow may apply additional restrictions and report an upload failure.
- Show each selected file's name and formatted size.
- Allow a selected file to be removed locally before submission.
- Do not call the flow when no files are selected.

### Existing reports

- When an edit form finishes loading its Meeting Report, call the flow's `list` operation with that report ID.
- Show existing attachment names, sizes when available, and links when the flow returns a URL.
- Provide a Delete button for each existing attachment.
- Ask for browser confirmation before deletion.
- On confirmation, call the `delete` operation immediately. Remove the item from the page only after a successful response.
- Keep the report form usable if attachment listing fails, while showing a focused retry action for the attachment list.
- The file picker remains available so users can add new attachments during an edit.

The existing Dataverse column `mss_documentsprovided` remains in the environment for compatibility, but the React application stops selecting, displaying, and writing it.

## Filename validation

Every selected filename must match:

```text
^[A-Za-z0-9_-](?:[A-Za-z0-9 _-]*[A-Za-z0-9_-])?\.[A-Za-z0-9]+$
```

The base filename therefore permits ASCII letters, digits, spaces, hyphens, and underscores. It must start and end with a non-space character. A single final dot separates a required alphanumeric extension. Valid examples are `meeting-notes_2026.pdf`, `Meeting Notes_2026.pdf`, and `Photo_01.JPG`. Invalid examples include ` report.pdf`, `report .pdf`, `report.final.pdf`, `report(1).pdf`, `.env`, and `report`.

The validation message is:

```text
File names can contain only letters, numbers, spaces, hyphens, and underscores, followed by a file extension.
```

The client also rejects empty files, files larger than 10 MB, more than 10 files, and duplicate selected filenames compared case-insensitively. Validation happens when files are selected and is repeated before upload.

## Client-to-flow contract

All flow calls use `POST`, `Content-Type: application/json`, and the same hardcoded HTTP trigger URL. The common request body contains an operation and normalized Meeting Report GUID.

### Power Automate HTTP trigger schema

Use this JSON schema in **When an HTTP request is received**. The common fields are required by the trigger. Operation-specific requirements are validated in the flow's Switch branches: `file` is required for `upload`, and `attachmentId` is required for `delete`.

```json
{
  "type": "object",
  "properties": {
    "operation": {
      "type": "string",
      "enum": [
        "list",
        "upload",
        "delete"
      ]
    },
    "meetingReportId": {
      "type": "string",
      "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
    },
    "attachmentId": {
      "type": "string",
      "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
    },
    "file": {
      "type": "object",
      "properties": {
        "fileName": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-](?:[A-Za-z0-9 _-]*[A-Za-z0-9_-])?\\.[A-Za-z0-9]+$"
        },
        "contentType": {
          "type": "string"
        },
        "size": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10485760
        },
        "contentBase64": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "fileName",
        "contentType",
        "size",
        "contentBase64"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "operation",
    "meetingReportId"
  ],
  "additionalProperties": false
}
```

### List operation

Request:

```json
{
  "operation": "list",
  "meetingReportId": "11111111-1111-4111-8111-111111111111"
}
```

Successful response, status 200:

```json
{
  "attachments": [
    {
      "attachmentId": "22222222-2222-4222-8222-222222222222",
      "fileName": "meeting-notes_2026.pdf",
      "fileUrl": "https://contoso.sharepoint.com/sites/example/Documents/meeting-notes_2026.pdf",
      "contentType": "application/pdf",
      "size": 12345
    }
  ]
}
```

`contentType`, `size`, and `fileUrl` may be null or omitted when the reference table does not contain them. `attachmentId` and `fileName` are required for every list item.

### Upload operation

The client reads each file as Base64 and sends one request per file, sequentially:

```json
{
  "operation": "upload",
  "meetingReportId": "11111111-1111-4111-8111-111111111111",
  "file": {
    "fileName": "meeting-notes_2026.pdf",
    "contentType": "application/pdf",
    "size": 12345,
    "contentBase64": "JVBERi0xLjQK..."
  }
}
```

`contentBase64` contains only the Base64 payload. It does not include a `data:*;base64,` prefix. If the browser does not provide a MIME type, `contentType` is `application/octet-stream`.

Successful response, status 200 or 201:

```json
{
  "attachment": {
    "attachmentId": "22222222-2222-4222-8222-222222222222",
    "fileName": "meeting-notes_2026.pdf",
    "fileUrl": "https://contoso.sharepoint.com/sites/example/Documents/meeting-notes_2026.pdf",
    "contentType": "application/pdf",
    "size": 12345
  }
}
```

### Delete operation

Request:

```json
{
  "operation": "delete",
  "meetingReportId": "11111111-1111-4111-8111-111111111111",
  "attachmentId": "22222222-2222-4222-8222-222222222222"
}
```

Successful response, status 200:

```json
{
  "deleted": true,
  "attachmentId": "22222222-2222-4222-8222-222222222222"
}
```

A 204 response is also accepted as a successful deletion.

### Error response

For a rejected operation, the flow should return an appropriate 4xx or 5xx status and this body where practical:

```json
{
  "error": {
    "code": "AttachmentUploadFailed",
    "message": "The attachment could not be uploaded."
  }
}
```

The React client does not display raw server details. It maps failures to focused user messages and logs diagnostic context without logging Base64 file content or the signed trigger URL.

## Save and retry behavior

The existing duplicate-prevention lock remains in place.

For a new report:

1. Create the Meeting Report and capture its GUID.
2. Save staff and volunteer relationships.
3. Upload selected files sequentially.
4. Navigate to the Meeting Reports list only after all stages succeed.

For an existing report:

1. Update the Meeting Report.
2. Reconcile staff and volunteer relationships.
3. Upload newly selected files sequentially.
4. Navigate to the Meeting Reports list only after all stages succeed.

If one or more uploads fail, the page states that the report itself was saved but some files were not uploaded. It retains the persisted Meeting Report GUID and only failed/unattempted file selections. A `Retry file uploads` action retries those files without recreating or re-updating the Meeting Report and without repeating successful relationship operations.

Deleting an existing attachment is independent of the form save. A failed deletion leaves the item visible and allows retry.

## CORS and security boundary

The selected direct-client architecture requires the Power Automate endpoint to accept cross-origin browser requests from the Power Pages site and to return readable responses for `list`, `upload`, and `delete`. Runtime validation must confirm that the browser's preflight and POST requests succeed.

The signed endpoint is not an authorization boundary once exposed in the bundle. The manually managed flow should independently validate `operation`, both GUIDs, filename, size, and the Meeting Report/attachment relationship before reading or deleting data. Portal route-role checks continue to limit access through the UI but cannot protect the copied endpoint URL.

## Testing

Automated tests will cover:

- File-picker rendering on create and edit forms.
- Multiple selection and removal before submission.
- Filename, zero-byte, per-file size, count, and duplicate-name validation.
- Report creation before the first upload call.
- Existing report update before new-file uploads.
- One sequential upload call per selected file using the persisted report GUID.
- Base64 conversion without a data URL prefix.
- Retry of failed/unattempted uploads without duplicate report creation.
- Listing, rendering, linking, confirmation, successful deletion, deletion failure, and list retry for existing attachments.
- No flow call when a submission has no selected files.
- Removal of `mss_documentsprovided` from Meeting Report payloads and reads.
- Existing Meeting Report relationships, authorization, and duplicate-prevention tests continuing to pass.

The relevant Vitest suites and production build must pass before completion. A deployed runtime test must verify CORS and the agreed request/response contract against the manually configured flow.
