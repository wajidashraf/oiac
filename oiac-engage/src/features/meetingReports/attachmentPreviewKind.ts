export type AttachmentPreviewKind = 'pdf' | 'image' | 'unsupported'

type AttachmentPreviewSource = {
  readonly contentType?: string | null
  readonly fileName: string
}

const GENERIC_CONTENT_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream'])
const IMAGE_CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

export function getAttachmentPreviewKind(source: AttachmentPreviewSource): AttachmentPreviewKind {
  const contentType = source.contentType?.split(';', 1)[0].trim().toLowerCase() ?? ''
  if (contentType === 'application/pdf') return 'pdf'
  if (contentType.startsWith('image/')) return 'image'
  if (!GENERIC_CONTENT_TYPES.has(contentType)) return 'unsupported'

  const extension = fileExtension(source.fileName)
  if (extension === '.pdf') return 'pdf'
  return extension in IMAGE_CONTENT_TYPES ? 'image' : 'unsupported'
}

export function getAttachmentPreviewContentType(
  source: AttachmentPreviewSource,
  kind: Exclude<AttachmentPreviewKind, 'unsupported'>,
): string {
  if (kind === 'pdf') return 'application/pdf'
  const contentType = source.contentType?.split(';', 1)[0].trim().toLowerCase() ?? ''
  if (contentType.startsWith('image/')) return contentType
  return IMAGE_CONTENT_TYPES[fileExtension(source.fileName)]
}

function fileExtension(fileName: string): string {
  return fileName.trim().toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
}
