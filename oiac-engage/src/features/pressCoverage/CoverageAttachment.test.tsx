import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import CoverageAttachment from './CoverageAttachment'
import { downloadCoverageFile } from './pressCoverageFiles'
vi.mock('./pressCoverageFiles', () => ({ downloadCoverageFile: vi.fn() }))
const download = vi.mocked(downloadCoverageFile)
const create = vi.fn(() => 'blob:local-file')
const revoke = vi.fn()
beforeEach(() => { vi.resetAllMocks(); create.mockReturnValue('blob:local-file'); vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
test('image thumbnail is 100 by 100 and links to full image; URL is revoked on change and unmount', async () => {
  download.mockResolvedValue({ blob: new Blob(['image'], { type: 'image/gif' }), fileName: 'photo.gif' })
  const view = render(<CoverageAttachment id="one" fileName="photo.gif" />)
  const image = await screen.findByRole('img', { name: 'photo.gif' })
  expect(image).toHaveAttribute('width', '100'); expect(image).toHaveAttribute('height', '100')
  expect(image.closest('a')).toHaveAttribute('href', 'blob:local-file')
  expect(image.closest('a')).toHaveAttribute('target', '_blank')
  view.rerender(<CoverageAttachment id="two" fileName="other.gif" />)
  expect(screen.queryByRole('img', { name: 'photo.gif' })).not.toBeInTheDocument()
  await screen.findByRole('img', { name: 'photo.gif' })
  expect(revoke).toHaveBeenCalledTimes(1)
  view.unmount(); expect(revoke).toHaveBeenCalledTimes(2)
})
test('PDF has an inline preview and readable download fallback', async () => {
  download.mockResolvedValue({ blob: new Blob(['pdf'], { type: 'application/pdf' }), fileName: 'story.pdf' })
  render(<CoverageAttachment id="one" fileName="story.pdf" />)
  expect(await screen.findByTitle('Preview story.pdf')).toHaveAttribute('src', 'blob:local-file')
  expect(screen.getByRole('link', { name: 'Download story.pdf' })).toHaveAttribute('download', 'story.pdf')
})
test('Excel exposes its type, filename and local open/download links', async () => {
  download.mockResolvedValue({ blob: new Blob(['xls'], { type: 'application/vnd.ms-excel' }), fileName: 'data.xls' })
  render(<CoverageAttachment id="one" fileName="data.xls" />)
  expect(await screen.findByLabelText('Excel attachment')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open data.xls' })).toHaveAttribute('href', 'blob:local-file')
  expect(screen.getByRole('link', { name: 'Download data.xls' })).toHaveAttribute('download', 'data.xls')
})
test('preview failure retries only the download and ignores an older record response', async () => {
  let stale!: (value: { blob: Blob; fileName: string }) => void
  download.mockReturnValueOnce(new Promise(resolve => { stale = resolve })).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce({ blob: new Blob(['img'], { type: 'image/png' }), fileName: 'new.png' })
  const view = render(<CoverageAttachment id="one" fileName="old.png" />)
  view.rerender(<CoverageAttachment id="two" fileName="new.png" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable')
  await act(async () => stale({ blob: new Blob(['old'], { type: 'image/png' }), fileName: 'old.png' }))
  expect(create).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Retry attachment preview' }))
  expect(await screen.findByRole('img', { name: 'new.png' })).toBeInTheDocument()
  expect(create).toHaveBeenCalledTimes(1)
  view.unmount(); expect(revoke).toHaveBeenCalledTimes(1)
})


test('image rendering failure keeps download available and retries with URL replacement', async () => {
  download.mockResolvedValue({ blob: new Blob(['image'], { type: 'image/png' }), fileName: 'photo.png' })
  render(<CoverageAttachment id="one" fileName="photo.png" />)
  fireEvent.error(await screen.findByRole('img', { name: 'photo.png' }))
  expect(screen.getByRole('alert')).toHaveTextContent('could not be displayed')
  expect(screen.getByRole('link', { name: 'Download photo.png' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry attachment preview' }))
  await screen.findByRole('img', { name: 'photo.png' })
  expect(revoke).toHaveBeenCalledTimes(1)
  expect(create).toHaveBeenCalledTimes(2)
})

test('a pending download cannot allocate a URL after unmount', async () => {
  let finish!: (result: { blob: Blob; fileName: string }) => void
  download.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const view = render(<CoverageAttachment id="one" fileName="photo.png" />)
  view.unmount()
  await act(async () => finish({ blob: new Blob(['img'], { type: 'image/png' }), fileName: 'photo.png' }))
  expect(create).not.toHaveBeenCalled()
})
