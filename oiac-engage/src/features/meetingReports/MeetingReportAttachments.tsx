import { useCallback, useId, useRef, useState, type ChangeEvent, type MouseEvent } from 'react'
import { LuEye, LuFile, LuTrash2, LuUpload, LuX } from 'react-icons/lu'
import { AttachmentPreviewModal } from './AttachmentPreviewModal'
import { getAttachmentPreviewKind } from './attachmentPreviewKind'
import {
  MeetingReportAttachmentFlowError,
  viewAttachment,
  type AttachmentViewResult,
  type MeetingReportAttachment,
} from './meetingReportAttachmentService'
import type { AttachmentContentLoader } from './useAttachmentPreviewCache'

type PreviewState = {
  readonly result: AttachmentViewResult
  readonly kind: 'pdf' | 'image'
  readonly returnFocusTo: HTMLButtonElement | null
}

const VIEW_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  InvalidViewRequest: 'The file request is invalid. Refresh the page and try again.',
  MeetingReportNotFound: 'This meeting report is unavailable or you do not have access to it.',
  AttachmentNotFound: 'This attachment is unavailable or you do not have access to it.',
  FileContentNotFound: 'The stored file content is unavailable.',
  AttachmentLookupFailed: 'The attachment could not be retrieved. Try again.',
}

const DEFAULT_VIEW_ERROR = 'The attachment could not be viewed. Try again.'

export type MeetingReportAttachmentsProps = {
  readonly selectedFiles: readonly File[]
  readonly existingAttachments: readonly MeetingReportAttachment[]
  readonly listStatus: 'idle' | 'loading' | 'ready' | 'error'
  readonly selectionErrors: readonly string[]
  readonly deletingAttachmentIds: ReadonlySet<string>
  readonly disabled: boolean
  readonly loadAttachmentContent?: AttachmentContentLoader
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
  loadAttachmentContent = viewAttachment,
  onFilesSelected,
  onSelectedFileRemoved,
  onDeleteExisting,
  onRetryList,
}: MeetingReportAttachmentsProps) {
  const inputId = useId()
  const helpId = useId()
  const errorId = useId()
  const viewingIdsRef = useRef(new Set<string>())
  const [viewingAttachmentIds, setViewingAttachmentIds] = useState<ReadonlySet<string>>(new Set())
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [viewError, setViewError] = useState<string | null>(null)

  const closePreview = useCallback(() => setPreview(null), [])

  function handleSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    if (files.length > 0) onFilesSelected(files)
    event.currentTarget.value = ''
  }

  async function handleView(
    attachment: MeetingReportAttachment,
    event: MouseEvent<HTMLButtonElement>,
  ) {
    if (viewingIdsRef.current.has(attachment.attachmentId)) return
    const returnFocusTo = event.currentTarget
    viewingIdsRef.current.add(attachment.attachmentId)
    setViewingAttachmentIds((current) => new Set(current).add(attachment.attachmentId))
    setViewError(null)
    try {
      const result = await loadAttachmentContent(attachment)
      const kind = getAttachmentPreviewKind(result)
      if (kind === 'pdf' || kind === 'image') {
        setPreview({ result, kind, returnFocusTo })
      } else {
        downloadAttachment(result)
      }
    } catch (error) {
      const code = error instanceof MeetingReportAttachmentFlowError ? error.code : null
      setViewError(code ? VIEW_ERROR_MESSAGES[code] ?? DEFAULT_VIEW_ERROR : DEFAULT_VIEW_ERROR)
    } finally {
      viewingIdsRef.current.delete(attachment.attachmentId)
      setViewingAttachmentIds((current) => {
        const next = new Set(current)
        next.delete(attachment.attachmentId)
        return next
      })
    }
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
          {viewError ? <div className="form-alert" role="alert">{viewError}</div> : null}
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
                const viewing = viewingAttachmentIds.has(attachment.attachmentId)
                return (
                  <li className="meeting-report-attachments__item" key={attachment.attachmentId}>
                    <LuFile aria-hidden="true" />
                    <span className="meeting-report-attachments__meta">
                      <strong>{attachment.fileName}</strong>
                      {attachment.size === null ? null : <small>{formatFileSize(attachment.size)}</small>}
                    </span>
                    <span className="meeting-report-attachments__actions">
                      <button
                        type="button"
                        aria-label={`${viewing ? 'Loading' : 'View'} ${attachment.fileName}`}
                        disabled={disabled || viewing}
                        onClick={(event) => void handleView(attachment, event)}
                      >
                        <LuEye aria-hidden="true" />
                        <span>{viewing ? 'Loading…' : 'View'}</span>
                      </button>
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
      {preview ? (
        <AttachmentPreviewModal
          result={preview.result}
          kind={preview.kind}
          returnFocusTo={preview.returnFocusTo}
          onClose={closePreview}
        />
      ) : null}
    </section>
  )
}

function downloadAttachment(result: AttachmentViewResult) {
  const url = URL.createObjectURL(result.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = result.fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024)} KB`
  return `${formatNumber(bytes / (1024 * 1024))} MB`
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
