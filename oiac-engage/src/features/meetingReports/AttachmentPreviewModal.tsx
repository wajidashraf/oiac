import { useEffect, useId, useRef, useState } from 'react'
import { LuDownload, LuX } from 'react-icons/lu'
import type { AttachmentViewResult } from './meetingReportAttachmentService'

export type AttachmentPreviewModalProps = {
  readonly result: AttachmentViewResult
  readonly kind: 'pdf' | 'image'
  readonly returnFocusTo: HTMLButtonElement | null
  readonly onClose: () => void
}

export function AttachmentPreviewModal({
  result,
  kind,
  returnFocusTo,
  onClose,
}: AttachmentPreviewModalProps) {
  const titleId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(result.blob)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [result.blob])

  useEffect(() => {
    closeButtonRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      returnFocusTo?.focus()
    }
  }, [onClose, returnFocusTo])

  return (
    <div className="attachment-preview">
      <section
        className="attachment-preview__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="attachment-preview__header">
          <div className="attachment-preview__title">
            <span>File preview</span>
            <h2 id={titleId}>Preview {result.fileName}</h2>
          </div>
          <div className="attachment-preview__actions">
            {previewUrl ? (
              <a
                className="button button--secondary"
                href={previewUrl}
                download={result.fileName}
                aria-label={`Download ${result.fileName}`}
              >
                <LuDownload aria-hidden="true" />
                Download
              </a>
            ) : null}
            <button
              ref={closeButtonRef}
              className="button button--secondary"
              type="button"
              aria-label="Close preview"
              onClick={onClose}
            >
              <LuX aria-hidden="true" />
              Close
            </button>
          </div>
        </header>
        <div className={`attachment-preview__stage attachment-preview__stage--${kind}`}>
          {previewUrl && kind === 'pdf' ? (
            <iframe
              className="attachment-preview__frame"
              src={previewUrl}
              title={`PDF preview of ${result.fileName}`}
            />
          ) : null}
          {previewUrl && kind === 'image' ? (
            <img
              className="attachment-preview__image"
              src={previewUrl}
              alt={result.fileName}
            />
          ) : null}
        </div>
      </section>
    </div>
  )
}
