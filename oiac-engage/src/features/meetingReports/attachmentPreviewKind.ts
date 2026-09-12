export type AttachmentPreviewKind = 'pdf' | 'image' | 'unsupported'

type AttachmentPreviewSource = {
  readonly contentType?: string | null
  readonly fileName: string
}

const GENERIC_CONTENT_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream'])
const IMAGE_EXTENSIONS = new Set([
  '.avif', '.bmp', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.webp',
])

export function getAttachmentPreviewKind(source: AttachmentPreviewSource): AttachmentPreviewKind {
  const contentType = source.contentType?.split(';', 1)[0].trim().toLowerCase() ?? ''
  if (contentType === 'application/pdf') return 'pdf'
  if (contentType.startsWith('image/')) return 'image'
  if (!GENERIC_CONTENT_TYPES.has(contentType)) return 'unsupported'

  const extension = source.fileName.trim().toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
  if (extension === '.pdf') return 'pdf'
  return IMAGE_EXTENSIONS.has(extension) ? 'image' : 'unsupported'
}
