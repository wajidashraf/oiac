import { describe, expect, test } from 'vitest'
import { getAttachmentPreviewKind } from './attachmentPreviewKind'

describe('getAttachmentPreviewKind', () => {
  test.each([
    ['application/pdf', 'notes.bin', 'pdf'],
    [' Application/PDF; charset=binary ', 'notes.bin', 'pdf'],
    ['image/png', 'photo.bin', 'image'],
    ['IMAGE/WEBP; charset=binary', 'photo.bin', 'image'],
  ])('classifies %s as %s preview content', (contentType, fileName, expected) => {
    expect(getAttachmentPreviewKind({ contentType, fileName })).toBe(expected)
  })

  test.each([
    ['application/octet-stream', 'REPORT.PDF', 'pdf'],
    ['binary/octet-stream', 'photo.JpG', 'image'],
    [null, 'diagram.svg', 'image'],
    ['', 'scan.avif', 'image'],
  ])('falls back from %s to the %s filename', (contentType, fileName, expected) => {
    expect(getAttachmentPreviewKind({ contentType, fileName })).toBe(expected)
  })

  test.each([
    ['text/plain', 'misleading.pdf'],
    ['application/octet-stream', 'report.docx'],
    [null, 'archive.zip'],
  ])('classifies %s / %s as unsupported', (contentType, fileName) => {
    expect(getAttachmentPreviewKind({ contentType, fileName })).toBe('unsupported')
  })
})
