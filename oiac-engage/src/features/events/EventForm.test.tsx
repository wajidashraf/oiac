import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import EventForm from './EventForm'
import type { EventItem } from './eventTypes'

const editableEvent: EventItem = {
  id: '34a65162-7706-451f-b4c9-ddee5c47b5af',
  title: 'Community Engagement Meeting',
  eventFormat: 'Hybrid',
  eventFormatValue: 866530002,
  eventStatus: 'Registration Open',
  eventStatusValue: 866530002,
  eventType: 'Meeting',
  eventTypeValue: 866530002,
  startDateTime: '2026-09-22T17:30:45.000Z',
  endDateTime: '2026-09-22T19:00:30.000Z',
  meetingUrl: 'https://teams.microsoft.com/example',
  venueName: 'District Office Meeting Room',
  description: 'Meet local volunteers and community partners.',
}

function renderCreate(onSave = vi.fn()) {
  render(<EventForm mode="create" pending={false} onSave={onSave} onCancel={vi.fn()} />)
  return onSave
}

async function selectFormat(format: '866530000' | '866530001' | '866530002') {
  await userEvent.setup().selectOptions(screen.getByLabelText('Event Format'), format)
}

function setDateTimes(start: string, end: string) {
  fireEvent.change(screen.getByLabelText('Start Date & Time'), { target: { value: start } })
  fireEvent.change(screen.getByLabelText('End Date & Time'), { target: { value: end } })
}

function localDateTimeWithSeconds(value: string): string {
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.000`
}

describe('EventForm', () => {
  test('defaults new events to Draft', () => {
    renderCreate()

    expect(screen.getByRole('form', { name: 'Create Event' })).toBeInTheDocument()
    expect(screen.getByLabelText('Event Status')).toHaveValue('866530000')
    expect(screen.getByLabelText('Event Subject')).toBeRequired()
    expect(screen.getByLabelText('Start Date & Time')).toBeRequired()
    expect(screen.getByLabelText('End Date & Time')).toBeRequired()
    expect(screen.getByLabelText('Event Type')).toBeRequired()
    expect(screen.getByLabelText('Event Format')).toBeRequired()
    expect(screen.getByLabelText('Event Status')).toBeRequired()
  })

  test('shows and requires Venue only for In Person events', async () => {
    const user = userEvent.setup()
    const onSave = renderCreate()
    await selectFormat('866530000')

    expect(screen.getByLabelText('Venue Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Venue Name')).toBeRequired()
    expect(screen.queryByLabelText('Meeting URL')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create Event' }))
    expect(await screen.findByText('Venue Name is required for In Person events.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  test('shows and requires Meeting URL only for Virtual events', async () => {
    const user = userEvent.setup()
    const onSave = renderCreate()
    await selectFormat('866530001')

    expect(screen.getByLabelText('Meeting URL')).toBeInTheDocument()
    expect(screen.getByLabelText('Meeting URL')).toBeRequired()
    expect(screen.queryByLabelText('Venue Name')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create Event' }))
    expect(await screen.findByText('Meeting URL is required for Virtual events.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  test('requires both Venue and Meeting URL for Hybrid events', async () => {
    const user = userEvent.setup()
    const onSave = renderCreate()
    await selectFormat('866530002')

    expect(screen.getByLabelText('Venue Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Meeting URL')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create Event' }))
    expect(await screen.findByText('Venue Name is required for Hybrid events.')).toBeInTheDocument()
    expect(screen.getByText('Meeting URL is required for Hybrid events.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  test('blocks an end time that is not later than the start time', async () => {
    const user = userEvent.setup()
    const onSave = renderCreate()
    await user.type(screen.getByLabelText('Event Subject'), 'Volunteer Briefing')
    await user.selectOptions(screen.getByLabelText('Event Type'), '866530010')
    await selectFormat('866530000')
    await user.type(screen.getByLabelText('Venue Name'), 'OIAC Office')
    setDateTimes('2026-09-22T19:00', '2026-09-22T18:00')

    await user.click(screen.getByRole('button', { name: 'Create Event' }))

    expect(await screen.findByText('End Date & Time must be later than Start Date & Time.')).toBeInTheDocument()
    expect(screen.getByLabelText('End Date & Time')).toHaveFocus()
    expect(onSave).not.toHaveBeenCalled()
  })

  test('hydrates editable values and submits local datetimes as ISO strings', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <EventForm
        mode="edit"
        event={editableEvent}
        pending={false}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByRole('form', { name: 'Edit Event' })).toBeInTheDocument()
    expect(screen.getByLabelText('Event Subject')).toHaveValue('Community Engagement Meeting')
    expect(screen.getByLabelText('Event Format')).toHaveValue('866530002')
    expect(screen.getByLabelText('Event Status')).toHaveValue('866530002')
    expect(screen.getByLabelText('Venue Name')).toHaveValue('District Office Meeting Room')
    expect(screen.getByLabelText('Meeting URL')).toHaveValue('https://teams.microsoft.com/example')
    expect(screen.getByLabelText('Description')).toHaveValue('Meet local volunteers and community partners.')
    expect(screen.getByLabelText('Start Date & Time')).toHaveValue(
      localDateTimeWithSeconds(editableEvent.startDateTime as string),
    )
    expect(screen.getByLabelText('End Date & Time')).toHaveValue(
      localDateTimeWithSeconds(editableEvent.endDateTime as string),
    )

    setDateTimes('2026-10-01T09:15', '2026-10-01T10:45')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Community Engagement Meeting',
      startDateTime: new Date('2026-10-01T09:15').toISOString(),
      endDateTime: new Date('2026-10-01T10:45').toISOString(),
      eventTypeValue: 866530002,
      eventFormatValue: 866530002,
      eventStatusValue: 866530002,
      venueName: 'District Office Meeting Room',
      meetingUrl: 'https://teams.microsoft.com/example',
      description: 'Meet local volunteers and community partners.',
    }))
  })

  test('renders request errors and disables form actions while saving', () => {
    render(
      <EventForm
        mode="create"
        pending
        requestError="Event could not be saved."
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Event could not be saved.')
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })
})
