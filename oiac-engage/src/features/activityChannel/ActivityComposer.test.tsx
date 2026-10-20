import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import ActivityComposer from './ActivityComposer'
import { ActivityValidationError, createActivity } from './activityService'
import { powerPagesFetch } from '../../shared/powerPagesApi'

vi.mock('../../shared/powerPagesApi', () => ({ powerPagesFetch: vi.fn() }))
beforeEach(() => vi.resetAllMocks())

const author = { id: null, name: 'Member', jobTitle: null }

test.each(['Activity', 'Comment', 'Reply'] as const)('%s permits correction after definitive no-write validation', async kind => {
  vi.mocked(powerPagesFetch).mockResolvedValue({ ok: false, error: { code: 'validation', message: 'secret' } })
  const onSave = vi.fn().mockImplementationOnce(async (content, requestId) => { await createActivity(content, requestId) }).mockResolvedValue(undefined)
  render(<ActivityComposer kind={kind} author={author} onSave={onSave} />)
  const field = screen.getByRole('textbox')
  fireEvent.change(field, { target: { value: 'Rejected\u000btext' } })
  await userEvent.click(screen.getByRole('button', { name: `Post ${kind}` }))
  await screen.findByRole('alert')
  expect(field).not.toHaveAttribute('readonly')
  expect(field).toHaveValue('Rejected\u000btext')
  fireEvent.change(field, { target: { value: 'Corrected text' } })
  await userEvent.click(screen.getByRole('button', { name: `Post ${kind}` }))
  await waitFor(() => expect(field).toHaveValue(''))
  expect(onSave).toHaveBeenCalledTimes(2)
  expect(onSave.mock.calls[1][0]).toBe('Corrected text')
  expect(onSave.mock.calls[1][1]).not.toBe(onSave.mock.calls[0][1])
})

test('uncertain save stays locked across cancel/reopen and retries identical content and UUID', async () => {
  const onSave = vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue(undefined)
  render(<ActivityComposer kind="Activity" author={author} onSave={onSave} collapsible />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create Activity' }))
  await user.type(screen.getByRole('textbox'), 'Uncertain draft')
  await user.click(screen.getByRole('button', { name: 'Post Activity' }))
  await screen.findByRole('alert')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await user.click(screen.getByRole('button', { name: 'Create Activity' }))
  expect(screen.getByRole('textbox')).toHaveAttribute('readonly')
  await user.type(screen.getByRole('textbox'), 'changed')
  expect(screen.getByRole('textbox')).toHaveValue('Uncertain draft')
  await user.click(screen.getByRole('button', { name: 'Post Activity' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
  expect(onSave.mock.calls[1]).toEqual(onSave.mock.calls[0])
  await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument())
})

test('a validation response after an uncertain attempt cannot replace the original request', async () => {
  const onSave = vi.fn().mockRejectedValueOnce(new Error('Lost response')).mockRejectedValueOnce(new ActivityValidationError()).mockResolvedValue(undefined)
  render(<ActivityComposer kind="Comment" author={author} onSave={onSave} />)
  await userEvent.type(screen.getByRole('textbox'), 'Possibly saved')
  const submit = screen.getByRole('button', { name: 'Post Comment' })
  await userEvent.click(submit)
  await screen.findByRole('alert')
  await userEvent.click(submit)
  await screen.findByText('Check the activity fields and try again.')
  expect(screen.getByRole('textbox')).toHaveAttribute('readonly')
  await userEvent.click(submit)
  await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''))
  expect(onSave).toHaveBeenCalledTimes(3)
  expect(onSave.mock.calls[1]).toEqual(onSave.mock.calls[0])
  expect(onSave.mock.calls[2]).toEqual(onSave.mock.calls[0])
})
