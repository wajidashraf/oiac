import {
  LuDownload,
  LuExternalLink,
  LuFile,
  LuFileArchive,
  LuFileCode2,
  LuFileImage,
  LuFileSpreadsheet,
  LuFileText,
} from 'react-icons/lu'
import {
  buildMeetingReportAttachmentPreviewUrl,
  type MeetingReportAttachment,
} from './meetingReportAttachmentService'

type ReportFilesCellProps = {
  readonly attachments: readonly MeetingReportAttachment[]
  readonly reportSubject: string
  readonly status: 'loading' | 'ready' | 'error'
}

const INLINE_FILE_LIMIT = 2

export function ReportFilesCell({ attachments, reportSubject, status }: ReportFilesCellProps) {
  if (status === 'loading') {
    return <span className="report-files__state" role="status">Loading…</span>
  }
  if (status === 'error') {
    return <span className="report-files__state report-files__state--error" title="Files could not be loaded">Unavailable</span>
  }
  if (attachments.length === 0) {
    return <span className="report-files__state" aria-label="No files">—</span>
  }

  const inlineAttachments = attachments.slice(0, INLINE_FILE_LIMIT)
  const remainingCount = attachments.length - inlineAttachments.length
  return (
    <div className="report-files">
      <div className="report-files__inline" role="group" aria-label={`First ${inlineAttachments.length} files`}>
        {inlineAttachments.map((attachment) => (
          <CompactFileActions attachment={attachment} key={attachment.attachmentId} />
        ))}
      </div>
      {remainingCount > 0 ? (
        <details className="report-files__more">
          <summary>+{remainingCount} more</summary>
          <div className="report-files__popover">
            <ul aria-label={`All files for ${reportSubject}`}>
              {attachments.map((attachment) => (
                <li key={attachment.attachmentId}>
                  <FileTypeIcon attachment={attachment} />
                  <span className="report-files__name" title={attachment.fileName}>{attachment.fileName}</span>
                  <FileLinks attachment={attachment} showOpenIcon />
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </div>
  )
}

function CompactFileActions({ attachment }: { readonly attachment: MeetingReportAttachment }) {
  const downloadUrl = attachment.fileUrl ? buildDownloadUrl(attachment.fileUrl) : null
  return (
    <span className="report-file-wrap">
      <span className="report-file" data-file-kind={attachmentFileKind(attachment)}>
        {attachment.fileUrl ? (
          <a
            className="report-file__open"
            href={buildMeetingReportAttachmentPreviewUrl(attachment.fileUrl)}
            target="_blank"
            rel="noreferrer"
            title={attachment.fileName}
            aria-label={`Open ${attachment.fileName}`}
          >
            <FileTypeIcon attachment={attachment} />
          </a>
        ) : (
          <span className="report-file__open report-file__open--disabled" title={attachment.fileName} aria-label={`${attachment.fileName} is unavailable`}>
            <FileTypeIcon attachment={attachment} />
          </span>
        )}
        {downloadUrl ? (
          <a
            className="report-file__download"
            href={downloadUrl}
            aria-label={`Download ${attachment.fileName}`}
            title={`Download ${attachment.fileName}`}
          >
            <LuDownload aria-hidden="true" />
          </a>
        ) : null}
      </span>
      <span className="report-file__tooltip" aria-hidden="true">{attachment.fileName}</span>
    </span>
  )
}

function FileLinks({
  attachment,
  showOpenIcon,
}: {
  readonly attachment: MeetingReportAttachment
  readonly showOpenIcon?: boolean
}) {
  if (!attachment.fileUrl) return <span className="report-files__unavailable">Unavailable</span>
  const downloadUrl = buildDownloadUrl(attachment.fileUrl)
  return (
    <span className="report-files__actions">
      <a href={buildMeetingReportAttachmentPreviewUrl(attachment.fileUrl)} target="_blank" rel="noreferrer" aria-label={`Open ${attachment.fileName}`}>
        {showOpenIcon ? <LuExternalLink aria-hidden="true" /> : null}<span>Open</span>
      </a>
      <a href={downloadUrl} aria-label={`Download ${attachment.fileName}`}>
        <LuDownload aria-hidden="true" /><span>Download</span>
      </a>
    </span>
  )
}

function FileTypeIcon({ attachment }: { readonly attachment: MeetingReportAttachment }) {
  const kind = attachmentFileKind(attachment)
  if (kind === 'spreadsheet') return <LuFileSpreadsheet aria-hidden="true" />
  if (kind === 'image') return <LuFileImage aria-hidden="true" />
  if (kind === 'archive') return <LuFileArchive aria-hidden="true" />
  if (kind === 'code') return <LuFileCode2 aria-hidden="true" />
  if (kind === 'document') return <LuFileText aria-hidden="true" />
  return <LuFile aria-hidden="true" />
}

function attachmentFileKind(attachment: MeetingReportAttachment): 'document' | 'spreadsheet' | 'image' | 'archive' | 'code' | 'file' {
  const type = attachment.contentType?.toLowerCase() ?? ''
  const extension = attachment.fileName.split('.').pop()?.toLowerCase() ?? ''
  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) return 'image'
  if (type.includes('spreadsheet') || type.includes('excel') || ['xls', 'xlsx', 'csv'].includes(extension)) return 'spreadsheet'
  if (type.includes('zip') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return 'archive'
  if (type.includes('javascript') || type.includes('json') || type.includes('xml') || ['js', 'jsx', 'ts', 'tsx', 'json', 'xml', 'html', 'css'].includes(extension)) return 'code'
  if (type.startsWith('text/') || type.includes('pdf') || type.includes('word') || ['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(extension)) return 'document'
  return 'file'
}

function buildDownloadUrl(fileUrl: string): string {
  const downloadUrl = new URL(fileUrl)
  downloadUrl.searchParams.delete('web')
  downloadUrl.searchParams.set('download', '1')
  return downloadUrl.href
}
