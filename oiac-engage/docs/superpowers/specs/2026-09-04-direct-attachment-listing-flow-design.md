# Direct Attachment Listing and Flow Operations Design

## Objective

Meeting Report attachment metadata will be read directly from the Dataverse `mss_attachments` table through the Power Pages Web API. Power Automate will handle only operations that also modify SharePoint: batch upload and delete.

## Dataverse mapping

The attachment table is `mss_attachments`. The implementation will resolve and use the exact lowercase logical names and entity-set name exposed by Dataverse metadata for these supplied schema columns:

| Purpose | Supplied Dataverse column |
|---|---|
| Attachment name | `mss_AttachmentName` |
| Attachment identifier | `mss_AttachmentsId` |
| Stable client file identifier | `mss_ClientFileID` |
| File size | `mss_FileSize` |
| MIME type | `mss_FileType` |
| Meeting Report lookup | `mss_MeetingReport` |
| SharePoint file identifier | `mss_SharePointFileID` |
| SharePoint server path | `mss_SharePointFilePath` |
| SharePoint URL | `mss_SharePointFileURL` |

The Meeting Report table uses `mss_meetingreports` and primary key `mss_meetingreportid`.

## Direct list operation

The SPA will replace the flow `list` call with a same-origin Power Pages Web API query against the attachment entity set. It will select only the attachment fields needed by the interface and filter on the Meeting Report lookup GUID. The response will be normalized to the existing frontend `MeetingReportAttachment` type.

The edit form will show each record with an icon selected from its MIME type or extension, its file name and size, an Open link using the stored SharePoint URL, and a Delete icon button. Supported visual categories are PDF, document, spreadsheet, image, archive, and generic file.

The SharePoint URL stored by the flow must be usable by the intended portal user. If the library URL requires permissions those users do not have, the flow must store an appropriate sharing or download URL instead.

## Power Pages access

The attachment table will be enabled for the Power Pages Web API with an explicit field allowlist. It will receive Read permission only. The permission will be a child of the existing contact-scoped Meeting Report permission through the `mss_MeetingReport` relationship and will apply to the same authorized portal roles. Create and Delete permission will not be exposed through the portal API because those mutations remain in Power Automate.

## Flow structure

`flow.json` will keep the existing HTTP request trigger and SharePoint connection, add an embedded Dataverse connection reference, and switch between `upload` and `delete`. The obsolete `list` case will be removed. An unknown operation returns HTTP 400.

### Upload

Upload accepts one to ten files in one request. It validates the Meeting Report GUID, file count, individual 10 MB limit, combined 70 MB raw-size limit, filename pattern, duplicate client identifiers, and duplicate filenames before performing mutations.

Folder preparation uses a Try scope and a Catch scope. Files are processed sequentially so array-variable updates are safe. Each file has its own Try and Catch scopes so one failure does not stop later files.

For each file, the flow first queries `mss_attachments` by Meeting Report and `clientFileId`. An existing match is returned as succeeded without creating another file. Otherwise, the flow creates the SharePoint file and then creates the attachment row with all supplied metadata and the Meeting Report lookup. If attachment-row creation fails after SharePoint creation, the Catch scope attempts to remove the orphaned SharePoint file.

The flow returns HTTP 200 with exactly one result for each request file. Successful results contain the created or existing attachment metadata. Failed results contain the same `clientFileId`, the same filename, `status: failed`, and a safe error code. Request-level validation failures return HTTP 400. Unexpected failures before per-file processing return HTTP 500.

### Delete

Delete requires both the Meeting Report GUID and attachment GUID. Its Try scope retrieves a Dataverse attachment filtered by both identifiers, ensuring the attachment belongs to the supplied report. It deletes the SharePoint file using the stored identifier or path, treating an already-missing SharePoint file as retry-safe, and then deletes the Dataverse attachment row.

Its Catch scope returns a safe 404 when no matching attachment exists or an appropriate safe 4xx/5xx response for deletion failure. Success returns HTTP 200 with `deleted: true` and the attachment GUID.

## Frontend behavior

Newly uploaded attachments continue to be added immediately from the upload response. On edit load and after uncertain or partial upload outcomes, the SPA refreshes attachment metadata directly from Dataverse. Delete continues to call the flow and removes the row locally only after a confirmed successful response.

The existing filename rules and the limits of ten files, 10 MB per file, and 70 MB combined remain unchanged.

## Verification

Automated checks will cover direct Dataverse mapping and filtering, icon selection, safe link rendering, delete behavior, batch upload response handling, Try/Catch structure, operation response contracts, and Power Pages Web API settings and table permissions. The final `flow.json` must parse as JSON and pass available Power Automate definition validation before handoff.
