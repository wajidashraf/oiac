import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { ContactLookup, DistrictLookup } from './ContactLookup'
import { MultiContactLookup } from './MultiContactLookup'
import type { ContactOption, DistrictOption } from './meetingReportTypes'

const sara: ContactOption = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Sara Rahimi',
  email: 'sara@example.com',
  jobTitle: 'Volunteer',
}
const ali: ContactOption = {
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Ali Staff',
  email: 'ali@example.com',
  jobTitle: 'Staff',
}

function StatefulMultiContactLookup() {
  const [values, setValues] = useState<readonly ContactOption[]>([ali])
  return (
    <MultiContactLookup
      label="Tag OIAC Staff Members"
      values={values}
      onChange={setValues}
      loadOptions={async () => [ali, sara]}
      debounceMs={0}
    />
  )
}

afterEach(() => {
  vi.useRealTimers()
})

test('debounces Contact search and ignores stale results', async () => {
  vi.useFakeTimers()
  const pending: Array<(value: readonly ContactOption[]) => void> = []
  const loadOptions = vi.fn((_search: string) => new Promise<readonly ContactOption[]>((resolve) => pending.push(resolve)))
  const onChange = vi.fn()
  render(<ContactLookup label="Representative / Office" value={null} onChange={onChange} loadOptions={loadOptions} />)

  const input = screen.getByRole('combobox', { name: 'Representative / Office' })
  await act(async () => {
    input.focus()
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'a' }))
    await vi.advanceTimersByTimeAsync(350)
  })
  expect(loadOptions).toHaveBeenCalledTimes(1)

  await act(async () => {
    pending[0]([sara])
    await Promise.resolve()
  })
  expect(screen.getByRole('option', { name: /Sara Rahimi/ })).toBeInTheDocument()
})

test('invalidates an in-flight lookup immediately when raw search text changes', async () => {
  vi.useFakeTimers()
  const pending: Array<(value: readonly ContactOption[]) => void> = []
  const loadOptions = vi.fn((_search: string) => new Promise<readonly ContactOption[]>((resolve) => pending.push(resolve)))
  render(<ContactLookup label="Representative / Office" value={null} onChange={vi.fn()} loadOptions={loadOptions} />)

  const input = screen.getByRole('combobox', { name: 'Representative / Office' })
  await act(async () => {
    input.focus()
    await vi.advanceTimersByTimeAsync(350)
  })
  expect(loadOptions).toHaveBeenCalledTimes(1)

  await act(async () => {
    fireEvent.change(input, { target: { value: 'new' } })
    pending[0]([sara])
    await Promise.resolve()
  })

  expect(screen.queryByRole('option', { name: /Sara Rahimi/ })).not.toBeInTheDocument()
})

test('selects and clears a representative', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(
    <ContactLookup
      label="Representative / Office"
      value={null}
      onChange={onChange}
      loadOptions={async () => [sara]}
      debounceMs={0}
    />,
  )

  await user.click(screen.getByRole('combobox', { name: 'Representative / Office' }))
  await user.click(await screen.findByRole('option', { name: /Sara Rahimi/ }))
  expect(onChange).toHaveBeenCalledWith(sara)

  await user.click(screen.getByRole('combobox', { name: 'Representative / Office' }))
  expect(screen.getByRole('option', { name: /Sara Rahimi/ })).toBeInTheDocument()
})

test('keeps selected values inside every single lookup field', () => {
  const district: DistrictOption = { id: '33333333-3333-3333-3333-333333333333', name: 'DC' }
  render(
    <>
      <ContactLookup label="Representative / Office" value={sara} onChange={vi.fn()} loadOptions={async () => []} />
      <DistrictLookup label="State / District" value={district} onChange={vi.fn()} loadOptions={async () => []} />
    </>,
  )

  const representativeControl = screen.getByRole('combobox', { name: 'Representative / Office' }).parentElement
  const districtControl = screen.getByRole('combobox', { name: 'State / District' }).parentElement

  expect(representativeControl).toHaveClass('meeting-report-lookup__control')
  expect(representativeControl).toContainElement(screen.getByText('Sara Rahimi'))
  expect(representativeControl).toContainElement(screen.getByRole('button', { name: 'Clear Representative / Office' }))
  expect(districtControl).toHaveClass('meeting-report-lookup__control')
  expect(districtControl).toContainElement(screen.getByText('DC'))
  expect(districtControl).toContainElement(screen.getByRole('button', { name: 'Clear State / District' }))
})

test('renders every multi-select as a checkbox dropdown with an in-field selection count', async () => {
  const user = userEvent.setup()
  render(<StatefulMultiContactLookup />)

  const trigger = screen.getByRole('combobox', { name: 'Tag OIAC Staff Members' })
  expect(trigger).toHaveTextContent('1 selected')
  await user.click(trigger)

  const aliCheckbox = await screen.findByRole('checkbox', { name: /Ali Staff/ })
  const saraCheckbox = screen.getByRole('checkbox', { name: /Sara Rahimi/ })
  expect(aliCheckbox).toBeChecked()
  expect(saraCheckbox).not.toBeChecked()
  expect(screen.getByRole('searchbox', { name: 'Search Tag OIAC Staff Members' })).toBeInTheDocument()

  await user.click(saraCheckbox)
  expect(trigger).toHaveTextContent('2 selected')
  expect(trigger).toHaveAttribute('aria-expanded', 'true')

  await user.click(aliCheckbox)
  expect(trigger).toHaveTextContent('1 selected')
  expect(aliCheckbox).not.toBeChecked()

  await user.keyboard('{Escape}')
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
})

test('renders District loading errors and allows retry', async () => {
  const user = userEvent.setup()
  const district: DistrictOption = { id: '33333333-3333-3333-3333-333333333333', name: 'DC' }
  const loadOptions = vi.fn()
    .mockRejectedValueOnce(new Error('failed'))
    .mockResolvedValueOnce([district])
  render(
    <DistrictLookup
      label="State / District"
      value={null}
      onChange={vi.fn()}
      loadOptions={loadOptions}
      debounceMs={0}
    />,
  )

  await user.click(screen.getByRole('combobox', { name: 'State / District' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Options could not be loaded.')
  await user.click(screen.getByRole('button', { name: 'Retry State / District lookup' }))
  expect(await screen.findByRole('option', { name: 'DC' })).toBeInTheDocument()
})
