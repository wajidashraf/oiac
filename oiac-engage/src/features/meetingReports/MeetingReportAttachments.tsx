import { useId, type ChangeEvent } from 'react'
import { LuExternalLink, LuFile, LuTrash2, LuUpload, LuX } from 'react-icons/lu'
import {
  buildMeetingReportAttachmentPreviewUrl,
  type MeetingReportAttachment,
} from './meetingReportAttachmentService'

export type MeetingReportAttachmentsProps = {
  readonly selectedFiles: readonly File[]
  readonly existingAttachments: readonly MeetingReportAttachment[]
  readonly listStatus: 'idle' | 'loading' | 'ready' | 'error'
  readonly selectionErrors: readonly string[]
  readonly deletingAttachmentIds: ReadonlySet<string>
  readonly disabled: boolean
  readonly onFilesSelected: (files: readonly File[]) => void
  readonly onSelectedFileRemoved: (fileName: string) => void
  readonly onDeleteExisting: (attachment: MeetingReportAttachment) => void
  readonly onRetryList: () => void
}

export function MeetingReportAttachments({
  selectedFiles,
  existingAttachments,
  listStatus,
  selectionErrors,
  deletingAttachmentIds,
  disabled,
  onFilesSelected,
  onSelectedFileRemoved,
  onDeleteExisting,
  onRetryList,
}: MeetingReportAttachmentsProps) {
  const inputId = useId()
  const helpId = useId()
  const errorId = useId()

  function handleSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    if (files.length > 0) onFilesSelected(files)
    event.currentTarget.value = ''
  }

  return (
    <section className="meeting-report-attachments field field--full" aria-label="Meeting report documents">
      <span className="meeting-report-attachments__label">Documents Provided</span>
      <p className="meeting-report-attachments__help" id={helpId}>
        Up to 10 files, 10 MB each, and 70 MB combined. File names may use letters, numbers, spaces, hyphens, underscores, and parentheses.
      </p>
      <label className="meeting-report-attachments__picker" htmlFor={inputId}>
        <LuUpload aria-hidden="true" />
        <span>Choose files</span>
        <input
          id={inputId}
          name="documentsProvided"
          type="file"
          multiple
          disabled={disabled}
          aria-label="Documents Provided"
          aria-describedby={`${helpId}${selectionErrors.length > 0 ? ` ${errorId}` : ''}`}
          onChange={handleSelection}
        />
      </label>

      {selectionErrors.length > 0 ? (
        <div className="meeting-report-attachments__errors" id={errorId} role="alert">
          <ul>{selectionErrors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      ) : null}

      {selectedFiles.length > 0 ? (
        <div className="meeting-report-attachments__group">
          <h3>Ready to upload</h3>
          <ul className="meeting-report-attachments__list" aria-label="Files selected for upload">
            {selectedFiles.map((file) => (
              <li className="meeting-report-attachments__item" key={file.name.toLowerCase()}>
                <LuFile aria-hidden="true" />
                <span className="meeting-report-attachments__meta">
                  <strong>{file.name}</strong>
                  <small>{formatFileSize(file.size)}</small>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  disabled={disabled}
                  onClick={() => onSelectedFileRemoved(file.name)}
                >
                  <LuX aria-hidden="true" />
                  <span>Remove</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {listStatus !== 'idle' ? (
        <div className="meeting-report-attachments__group">
          <h3>Uploaded documents</h3>
          {listStatus === 'loading' ? <p className="meeting-report-attachments__state" role="status">Loading uploaded documents…</p> : null}
          {listStatus === 'error' ? (
            <div className="meeting-report-attachments__state meeting-report-attachments__state--error" role="alert">
              <span>Uploaded documents could not be loaded.</span>
              <button type="button" disabled={disabled} onClick={onRetryList}>Retry uploaded documents</button>
            </div>
          ) : null}
          {listStatus === 'ready' && existingAttachments.length === 0 ? (
            <p className="meeting-report-attachments__state">No documents have been uploaded.</p>
          ) : null}
          {listStatus === 'ready' && existingAttachments.length > 0 ? (
            <ul className="meeting-report-attachments__list" aria-label="Uploaded documents">
              {existingAttachments.map((attachment) => {
                const deleting = deletingAttachmentIds.has(attachment.attachmentId)
                return (
                  <li className="meeting-report-attachments__item" key={attachment.attachmentId}>
                    <LuFile aria-hidden="true" />
                    <span className="meeting-report-attachments__meta">
                      <strong>{attachment.fileName}</strong>
                      {attachment.size === null ? null : <small>{formatFileSize(attachment.size)}</small>}
                    </span>
                    <span className="meeting-report-attachments__actions">
                      {attachment.fileUrl ? (
                        <a
                          href={buildMeetingReportAttachmentPreviewUrl(attachment.fileUrl)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${attachment.fileName}`}
                        >
                          <LuExternalLink aria-hidden="true" />
                          <span>Open</span>
                        </a>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`${deleting ? 'Deleting' : 'Delete'} ${attachment.fileName}`}
                        disabled={disabled || deleting}
                        onClick={() => onDeleteExisting(attachment)}
                      >
                        <LuTrash2 aria-hidden="true" />
                        <span>{deleting ? 'Deleting…' : 'Delete'}</span>
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024)} KB`
  return `${formatNumber(bytes / (1024 * 1024))} MB`
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
