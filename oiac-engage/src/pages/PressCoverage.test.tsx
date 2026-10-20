import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { emptyCoverageDraft, type CoverageRecord } from '../features/pressCoverage/pressCoverageTypes'
import * as service from '../features/pressCoverage/pressCoverageService'
import * as files from '../features/pressCoverage/pressCoverageFiles'
import PressCoverage from './PressCoverage'

vi.mock('../features/pressCoverage/pressCoverageService', async (original) => ({
  ...await original<typeof service>(),
  getCoveragePage: vi.fn(), getCoverage: vi.fn(), createCoverage: vi.fn(), updateCoverage: vi.fn(),
  searchCoverageContacts: vi.fn().mockResolvedValue([]),
}))
vi.mock('../features/pressCoverage/pressCoverageFiles', async (original) => ({
  ...await original<typeof files>(), uploadCoverageFile: vi.fn(), downloadCoverageFile: vi.fn(),
}))

const owner = '11111111-1111-4111-8111-111111111111'
const press: CoverageRecord = {
  ...emptyCoverageDraft(), id: '22222222-2222-4222-8222-222222222222', isFeatured: false,
  submittedById: owner, headlineTitle: 'Community advocacy interview', mediaOutlet: 'Local News',
  datePublishedAired: '2026-10-15', coverageType: 866530000, tone: 866530000,
  coverageLevel: 866530000, fileName: null, fileId: null,
}
const featured: CoverageRecord = {
  ...emptyCoverageDraft(), id: '33333333-3333-4333-8333-333333333333', isFeatured: true,
  submittedById: null, publication: 'Daily Journal', headline: 'Featured advocacy article',
  publicationDate: '2026-10-14', shortSummary: 'A high-impact article.',
  originalArticleLink: 'https://example.org/article', fileName: 'logo.png', fileId: 'logo-file',
}

beforeEach(() => {
  vi.mocked(service.searchCoverageContacts).mockResolvedValue([])
  vi.mocked(service.getCoveragePage).mockResolvedValue({ records: [press, featured], nextLink: null })
  vi.mocked(service.getCoverage).mockResolvedValue(press)
  vi.mocked(service.createCoverage).mockResolvedValue({ id: press.id })
  vi.mocked(service.updateCoverage).mockResolvedValue({ id: press.id })
  vi.mocked(files.uploadCoverageFile).mockResolvedValue(undefined)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals() })

async function openForm(variant: 'press' | 'featured' = 'press') {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: '+ Add Coverage' }))
  await user.click(screen.getByRole('button', { name: variant === 'press' ? /Press Coverage Log complete media/ : /Featured Coverage Create a highlighted record/ }))
  return user
}
async function fillPress(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Headline / Title'), 'New interview')
  await user.type(screen.getByLabelText('Media Outlet'), 'Public Radio')
  fireEvent.change(screen.getByLabelText('Date Published / Aired'), { target: { value: '2026-10-16' } })
}
async function fillFeatured(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Publication'), 'Journal')
  await user.type(screen.getByLabelText('Headline'), 'New feature')
  await user.type(screen.getByLabelText('Short Summary'), 'Summary of the article.')
  fireEvent.change(screen.getByLabelText('Publication Date'), { target: { value: '2026-10-16' } })
  await user.type(screen.getByLabelText('Original Article Link'), 'https://example.org/news')
  await user.upload(screen.getByLabelText('Publication Logo'), new File(['png'], 'logo.png', { type: 'image/png' }))
}

test('lists both variants in the required eight columns with readable dates and choices', async () => {
  render(<PressCoverage contactId={owner} />)
  const table = await screen.findByRole('table', { name: 'Press coverage' })
  expect(within(table).getAllByRole('columnheader').map((el) => el.textContent)).toEqual([
    'Headline', 'Date', 'Media Outlet', 'Coverage Type', 'Tone', 'Coverage Level', 'Featured', 'Actions',
  ])
  expect(within(table).getByText('Oct 15, 2026')).toBeInTheDocument()
  expect(within(table).getByText('TV')).toBeInTheDocument()
  expect(within(table).getByText('Featured Coverage')).toBeInTheDocument()
  expect(within(table).getByText('Daily Journal')).toBeInTheDocument()
  expect(within(table).getByText('No')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit Community advocacy interview' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit Featured advocacy article' })).not.toBeInTheDocument()
})

test('omits attachment details from the listing and orders permitted actions Edit then View', async () => {
  render(<PressCoverage contactId={owner} isAdmin />)
  const row = (await screen.findByRole('rowheader', { name: featured.headline })).closest('tr')!
  const actions = row.querySelector('.coverage-row-actions') as HTMLElement
  expect(within(actions).getAllByRole('button').map(button => button.textContent)).toEqual(['Edit', 'View'])
  expect(within(row).queryByText('logo.png')).not.toBeInTheDocument()
  expect(within(row).queryByRole('button', { name: /Download/ })).not.toBeInTheDocument()
  expect(files.downloadCoverageFile).not.toHaveBeenCalled()
})
test('opens the type selector and keeps the listing below either inline form', async () => {
  render(<PressCoverage contactId={owner} />)
  const user = await openForm()
  const form = screen.getByRole('form', { name: 'New Press Coverage' })
  expect(form.compareDocumentPosition(screen.getByRole('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByLabelText('Related Contact')).toHaveAttribute('role', 'combobox')
  await user.click(screen.getByRole('button', { name: 'Change type' }))
  await user.click(screen.getByRole('button', { name: /Featured Coverage Create a highlighted record/ }))
  expect(screen.getByRole('form', { name: 'New Featured Coverage' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Tone')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})

test('focuses the first invalid field and never creates an incomplete press record', async () => {
  render(<PressCoverage contactId={owner} />)
  const user = await openForm()
  await user.click(screen.getByRole('button', { name: 'Save Press Coverage' }))
  expect(screen.getByLabelText('Headline / Title')).toHaveFocus()
  expect(screen.getByLabelText('Headline / Title')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByText('Media Outlet is required.')).toBeInTheDocument()
  expect(service.createCoverage).not.toHaveBeenCalled()
})

test('creates valid coverage and refreshes the server listing', async () => {
  render(<PressCoverage contactId={owner} />)
  const user = await openForm()
  await fillPress(user)
  vi.mocked(service.getCoveragePage).mockResolvedValue({ records: [{ ...press, headlineTitle: 'New interview' }], nextLink: null })
  await user.click(screen.getByRole('button', { name: 'Save Press Coverage' }))
  expect(await screen.findByText('Press coverage saved.')).toBeInTheDocument()
  expect(await screen.findByRole('rowheader', { name: 'New interview' })).toBeInTheDocument()
  expect(service.createCoverage).toHaveBeenCalledWith('press', expect.objectContaining({ headlineTitle: 'New interview' }))
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})

test('preserves a failed save and gives the user an actionable error', async () => {
  vi.mocked(service.createCoverage).mockRejectedValue(new Error('You do not have permission to create coverage.'))
  render(<PressCoverage contactId={owner} />)
  const user = await openForm()
  await fillPress(user)
  await user.click(screen.getByRole('button', { name: 'Save Press Coverage' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('permission')
  expect(screen.getByLabelText('Headline / Title')).toHaveValue('New interview')
})

test('requires confirmation before discarding a dirty draft on cancel or type change', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<PressCoverage contactId={owner} />)
  const user = await openForm()
  await user.type(screen.getByLabelText('Headline / Title'), 'Unsaved')
  await user.click(screen.getByRole('button', { name: 'Change type' }))
  expect(screen.getByLabelText('Headline / Title')).toHaveValue('Unsaved')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByLabelText('Headline / Title')).toHaveValue('Unsaved')
  confirm.mockReturnValue(true)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})

test('requires all six featured fields including a publication logo', async () => {
  render(<PressCoverage contactId={owner} />)
  const user = await openForm('featured')
  await user.click(screen.getByRole('button', { name: 'Save Featured Coverage' }))
  expect(screen.getByLabelText('Publication Logo')).toHaveFocus()
  expect(screen.getAllByText(/is required\./)).toHaveLength(6)
  expect(service.createCoverage).not.toHaveBeenCalled()
})

test('retries only the upload after a featured record has already been created', async () => {
  vi.mocked(files.uploadCoverageFile).mockRejectedValueOnce(new Error('Upload unavailable')).mockResolvedValueOnce(undefined)
  render(<PressCoverage contactId={owner} />)
  const user = await openForm('featured')
  await fillFeatured(user)
  await user.click(screen.getByRole('button', { name: 'Save Featured Coverage' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Upload unavailable')
  expect(screen.queryByText('Featured coverage saved.')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Headline')).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Retry file upload' }))
  expect(await screen.findByText('Featured coverage saved.')).toBeInTheDocument()
  expect(service.createCoverage).toHaveBeenCalledTimes(1)
  expect(files.uploadCoverageFile).toHaveBeenCalledTimes(2)
  expect(files.uploadCoverageFile).toHaveBeenLastCalledWith(press.id, expect.any(File), 'featured')
})

test('retrieves the latest record for edit and updates its existing ID', async () => {
  vi.mocked(service.getCoverage).mockResolvedValue({ ...press, headlineTitle: 'Latest headline' })
  render(<PressCoverage contactId={owner} />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Edit Community advocacy interview' }))
  expect(await screen.findByRole('form', { name: 'Edit Press Coverage' })).toBeInTheDocument()
  expect(screen.getByLabelText('Headline / Title')).toHaveValue('Latest headline')
  expect(screen.queryByRole('button', { name: 'Change type' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByText('Press coverage saved.')
  expect(service.updateCoverage).toHaveBeenCalledWith(press.id, 'press', expect.any(Object), expect.objectContaining({ headlineTitle: 'Latest headline' }))
  expect(service.createCoverage).not.toHaveBeenCalled()
})

test('accepts the existing persisted logo when editing featured coverage', async () => {
  vi.mocked(service.getCoverage).mockResolvedValue(featured)
  render(<PressCoverage contactId={owner} isAdmin />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Edit Featured advocacy article' }))
  await screen.findByRole('form', { name: 'Edit Featured Coverage' })
  expect(within(screen.getByRole('form', { name: 'Edit Featured Coverage' })).getByRole('button', { name: 'Download logo.png' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Featured coverage saved.')).toBeInTheDocument()
  expect(files.uploadCoverageFile).not.toHaveBeenCalled()
})

test('hides create actions for read-only users and allows administrator edits of legacy records', async () => {
  render(<PressCoverage contactId={owner} canCreate={false} isAdmin />)
  await screen.findByRole('table')
  expect(screen.queryByRole('button', { name: '+ Add Coverage' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit Featured advocacy article' })).toBeInTheDocument()
})

test('locks repeated submission and every switching action while save is in flight', async () => {
  let finish!: (value: { id: string }) => void
  vi.mocked(service.createCoverage).mockReturnValue(new Promise((resolve) => { finish = resolve }))
  render(<PressCoverage contactId={owner} />)
  const user = await openForm()
  await fillPress(user)
  const form = screen.getByRole('form')
  fireEvent.submit(form)
  fireEvent.submit(form)
  expect(service.createCoverage).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Change type' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '+ Add Coverage' })).toBeDisabled()
  await act(async () => finish({ id: press.id }))
  expect(await screen.findByText('Press coverage saved.')).toBeInTheDocument()
})

test('prevents an automatic create retry when the server result is uncertain', async () => {
  vi.mocked(service.createCoverage).mockRejectedValue(new service.CoverageSaveUncertainError())
  render(<PressCoverage contactId={owner} />)
  const user = await openForm()
  await fillPress(user)
  await user.click(screen.getByRole('button', { name: 'Save Press Coverage' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/refresh|check/i)
  expect(screen.getByRole('button', { name: 'Save Press Coverage' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Refresh coverage list' })).toBeInTheDocument()
})

test('paginates forward and back using saved page links', async () => {
  vi.mocked(service.getCoveragePage).mockResolvedValueOnce({ records: [press], nextLink: '/_api/mss_presscoverages?$skiptoken=next' })
    .mockResolvedValueOnce({ records: [featured], nextLink: null }).mockResolvedValueOnce({ records: [press], nextLink: '/_api/mss_presscoverages?$skiptoken=next' })
  render(<PressCoverage contactId={owner} />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Next' }))
  expect(await screen.findByRole('rowheader', { name: 'Featured advocacy article' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Previous' }))
  expect(await screen.findByRole('rowheader', { name: 'Community advocacy interview' })).toBeInTheDocument()
  expect(service.getCoveragePage).toHaveBeenLastCalledWith({ nextLink: undefined }, expect.any(AbortSignal))
})

test('shows a retry action on listing failure', async () => {
  vi.mocked(service.getCoveragePage).mockRejectedValueOnce(new Error('Coverage could not be loaded.'))
  render(<PressCoverage contactId={owner} />)
  const user = userEvent.setup()
  expect(await screen.findByRole('alert')).toHaveTextContent('Coverage could not be loaded.')
  await user.click(screen.getByRole('button', { name: 'Retry loading coverage' }))
  expect(await screen.findByRole('table')).toBeInTheDocument()
})

test('does not reopen a canceled edit after a slow response arrives', async () => {
  let finish!: (record: CoverageRecord) => void
  vi.mocked(service.getCoverage).mockReturnValue(new Promise((resolve) => { finish = resolve }))
  render(<PressCoverage contactId={owner} />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Edit Community advocacy interview' }))
  await user.click(screen.getByRole('button', { name: 'Cancel loading edit' }))
  await act(async () => finish(press))
  await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument())
})

function renderWithNavigation() {
  return render(<MemoryRouter initialEntries={['/press-coverage']}>
    <Link to="/contact">Portal Contacts</Link>
    <Routes><Route path="/press-coverage" element={<PressCoverage contactId={owner} />} /><Route path="/contact" element={<h1>Contacts destination</h1>} /></Routes>
  </MemoryRouter>)
}

test('guards real portal links before React Router discards a dirty coverage draft', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  renderWithNavigation()
  const user = await openForm()
  await user.type(screen.getByLabelText('Headline / Title'), 'Unsaved headline')
  await user.click(screen.getByRole('link', { name: 'Portal Contacts' }))
  expect(screen.getByLabelText('Headline / Title')).toHaveValue('Unsaved headline')
  expect(screen.queryByRole('heading', { name: 'Contacts destination' })).not.toBeInTheDocument()
  expect(confirm).toHaveBeenCalledTimes(1)
  confirm.mockReturnValue(true)
  await user.click(screen.getByRole('link', { name: 'Portal Contacts' }))
  expect(screen.getByRole('heading', { name: 'Contacts destination' })).toBeInTheDocument()
  expect(confirm).toHaveBeenCalledTimes(2)
})

test('blocks portal navigation during a pending save and explains why', async () => {
  let finish!: (value: { id: string }) => void
  vi.mocked(service.createCoverage).mockReturnValue(new Promise((resolve) => { finish = resolve }))
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  renderWithNavigation()
  const user = await openForm()
  await fillPress(user)
  await user.click(screen.getByRole('button', { name: 'Save Press Coverage' }))
  await user.click(screen.getByRole('link', { name: 'Portal Contacts' }))
  expect(screen.getByRole('form')).toBeInTheDocument()
  expect(screen.getByText('Coverage is still saving. Wait until it finishes before leaving this page.')).toHaveAttribute('role', 'status')
  expect(confirm).not.toHaveBeenCalled()
  await act(async () => finish({ id: press.id }))
  await user.click(screen.getByRole('link', { name: 'Portal Contacts' }))
  expect(screen.getByRole('heading', { name: 'Contacts destination' })).toBeInTheDocument()
})

test('disables stale Next after a failed page request and retries the same page', async () => {
  const pageTwo = '/_api/serverlogics/press-coverage?page=2'
  vi.mocked(service.getCoveragePage).mockResolvedValueOnce({ records: [press], nextLink: pageTwo })
    .mockRejectedValueOnce(new Error('Page two unavailable.'))
    .mockResolvedValueOnce({ records: [featured], nextLink: null })
    .mockResolvedValueOnce({ records: [press], nextLink: pageTwo })
  render(<PressCoverage contactId={owner} />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Next' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Page two unavailable.')
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Retry loading coverage' }))
  expect(await screen.findByRole('rowheader', { name: 'Featured advocacy article' })).toBeInTheDocument()
  expect(service.getCoveragePage).toHaveBeenLastCalledWith({ nextLink: pageTwo }, expect.any(AbortSignal))
  await user.click(screen.getByRole('button', { name: 'Previous' }))
  expect(await screen.findByRole('rowheader', { name: 'Community advocacy interview' })).toBeInTheDocument()
  expect(screen.getByText('Page 1')).toBeInTheDocument()
})

test('introduces the selector with the specified title and instructions', async () => {
  render(<PressCoverage contactId={owner} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: '+ Add Coverage' }))
  expect(screen.getByRole('heading', { name: 'Select coverage type' })).toBeInTheDocument()
  expect(screen.getByText('Choose the type of record you want to add. The form will update with the relevant fields.')).toBeInTheDocument()
})

test('uses one selected related contact and restores its search with the keyboard clear action', async () => {
  vi.mocked(service.searchCoverageContacts).mockResolvedValue([{ id: owner, name: 'Sara Rahimi', email: null, jobTitle: null }])
  render(<PressCoverage contactId={owner} />)
  const user = await openForm()
  await user.click(screen.getByRole('combobox', { name: 'Related Contact' }))
  await user.click(await screen.findByRole('option', { name: 'Sara Rahimi' }))
  expect(screen.queryByRole('combobox', { name: 'Related Contact' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Clear Related Contact' })).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('combobox', { name: 'Related Contact' })).toHaveFocus()
  await user.selectOptions(screen.getByLabelText('OIAC Mentioned?'), 'false')
  expect(screen.getByLabelText('OIAC Mentioned?')).toHaveValue('false')
})


test('every reader can view latest coverage inline without editing or a details dialog', async () => {
  vi.mocked(service.getCoverage).mockResolvedValue({ ...press, headlineTitle: 'Latest headline' })
  render(<PressCoverage canCreate={false} />)
  const viewAction = await screen.findByRole('button', { name: 'View Community advocacy interview' })
  expect(viewAction.parentElement).toHaveTextContent(/^View$/)
  expect(screen.getByRole('button', { name: `View ${featured.headline}` })).toBeInTheDocument()
  await userEvent.click(viewAction)
  const form = await screen.findByRole('form', { name: 'View Press Coverage' })
  expect(within(form).getByLabelText('Headline / Title')).toHaveValue('Latest headline')
  expect(within(form).getByLabelText('Headline / Title')).toHaveAttribute('readonly')
  expect(within(form).getByLabelText('Tone')).toBeDisabled()
  expect(within(form).queryByRole('button', { name: /Save|Edit/ })).not.toBeInTheDocument()
  expect(within(form).queryByLabelText('Attachment')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(form.compareDocumentPosition(screen.getByRole('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.submit(form)
  expect(service.createCoverage).not.toHaveBeenCalled()
  expect(service.updateCoverage).not.toHaveBeenCalled()
})

test('headline opens latest view and owner edit rechecks permission on the latest record', async () => {
  render(<PressCoverage contactId={owner} />)
  await userEvent.click(await screen.findByRole('button', { name: press.headlineTitle }))
  const form = await screen.findByRole('form', { name: 'View Press Coverage' })
  vi.mocked(service.getCoverage).mockResolvedValue({ ...press, submittedById: 'other' })
  await userEvent.click(within(form).getByRole('button', { name: 'Edit coverage' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('no longer have permission')
  expect(screen.queryByRole('form', { name: 'Edit Press Coverage' })).not.toBeInTheDocument()
})

test('saving overlay covers record save and upload and closes on upload failure without losing retry', async () => {
  let saved!: (result: { id: string }) => void
  let failed!: (error: Error) => void
  vi.mocked(service.createCoverage).mockReturnValue(new Promise(resolve => { saved = resolve }))
  vi.mocked(files.uploadCoverageFile).mockReturnValue(new Promise((_resolve, reject) => { failed = reject }))
  render(<PressCoverage contactId={owner} />)
  const user = await openForm('featured')
  await fillFeatured(user)
  await user.click(screen.getByRole('button', { name: 'Save Featured Coverage' }))
  expect(screen.getByRole('status', { name: 'Saving Press Coverage' })).toHaveTextContent('Please wait while your Press Coverage record is being saved.')
  await act(async () => saved({ id: press.id }))
  expect(screen.getByRole('status', { name: 'Saving Press Coverage' })).toBeInTheDocument()
  await act(async () => failed(new Error('Transfer interrupted')))
  expect(screen.queryByRole('status', { name: 'Saving Press Coverage' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retry file upload' })).toBeEnabled()
  expect(screen.getByRole('alert')).toHaveTextContent('Transfer interrupted')
})


test('administrator sees edit in both listing and view and can open latest editable form', async () => {
  vi.mocked(service.getCoverage).mockResolvedValue(featured)
  vi.mocked(files.downloadCoverageFile).mockResolvedValue({ blob: new Blob(['png'], { type: 'image/png' }), fileName: 'logo.png' })
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:logo'); static revokeObjectURL = vi.fn() })
  render(<PressCoverage isAdmin canCreate={false} />)
  expect(await screen.findByRole('button', { name: `Edit ${featured.headline}` })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: `View ${featured.headline}` }))
  const view = await screen.findByRole('form', { name: 'View Featured Coverage' })
  expect(within(view).getByLabelText('Headline')).toHaveAttribute('readonly')
  expect(await within(view).findByRole('img', { name: 'logo.png' })).toBeInTheDocument()
  await userEvent.click(within(view).getByRole('button', { name: 'Edit coverage' }))
  expect(await screen.findByRole('form', { name: 'Edit Featured Coverage' })).toBeInTheDocument()
  expect(screen.getByLabelText('Headline')).not.toHaveAttribute('readonly')
  expect(service.getCoverage).toHaveBeenCalledTimes(2)
})

test('latest requested view wins when record responses arrive out of order', async () => {
  let old!: (record: CoverageRecord) => void
  vi.mocked(service.getCoverage).mockReturnValueOnce(new Promise(resolve => { old = resolve })).mockResolvedValueOnce({ ...press, headlineTitle: 'Second record latest' })
  render(<PressCoverage />)
  await userEvent.click(await screen.findByRole('button', { name: `View ${press.headlineTitle}` }))
  await userEvent.click(screen.getByRole('button', { name: `View ${featured.headline}` }))
  await screen.findByRole('form', { name: 'View Press Coverage' })
  expect(screen.getByLabelText('Headline / Title')).toHaveValue('Second record latest')
  await act(async () => old({ ...press, headlineTitle: 'Obsolete response' }))
  expect(screen.getByLabelText('Headline / Title')).toHaveValue('Second record latest')
})
