import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import MonthCalendar, { type MonthCalendarItem } from './MonthCalendar'

type TestItem = MonthCalendarItem & { marker: string }

const items: readonly TestItem[] = [
  { id: 'sep', date: '2026-09-08', title: 'September event', kind: 'event', marker: 'SEP' },
  { id: 'oct', date: '2026-10-02', title: 'October event', kind: 'event', marker: 'OCT' },
]

test('places consumer-rendered items in the correct month cells', () => {
  render(
    <MonthCalendar
      items={items}
      initialMonth={new Date(2026, 8, 1)}
      ariaLabelPrefix="Events"
      renderItem={(item) => <span>{item.marker}</span>}
    />,
  )

  expect(screen.getByRole('heading', { name: 'September 2026', level: 2 })).toBeInTheDocument()
  expect(screen.getByRole('grid', { name: 'Events September 2026 calendar' })).toBeInTheDocument()
  expect(within(screen.getByRole('gridcell', { name: 'Tuesday, September 8, 2026' })).getByText('SEP')).toBeInTheDocument()
  expect(screen.queryByText('OCT')).not.toBeInTheDocument()
})

test('moves months and reports the selected month to its consumer', async () => {
  const user = userEvent.setup()
  const onMonthChange = vi.fn()
  render(
    <MonthCalendar
      items={items}
      initialMonth={new Date(2026, 8, 1)}
      ariaLabelPrefix="Events"
      renderItem={(item) => <span>{item.marker}</span>}
      onMonthChange={onMonthChange}
    />,
  )

  await user.click(screen.getByRole('button', { name: 'Show October 2026' }))

  expect(screen.getByRole('heading', { name: 'October 2026', level: 2 })).toBeInTheDocument()
  expect(screen.getByText('OCT')).toBeInTheDocument()
  expect(onMonthChange).toHaveBeenCalledTimes(1)
  expect(onMonthChange.mock.calls[0][0]).toEqual(new Date(2026, 9, 1))
})
