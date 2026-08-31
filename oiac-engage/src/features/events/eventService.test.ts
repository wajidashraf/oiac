import { beforeEach, describe, expect, test, vi } from 'vitest'
import { powerPagesFetch, powerPagesRequest } from '../../shared/powerPagesApi'
import { createEvent, getCalendarEvents, getEvents, updateEvent } from './eventService'
import type { EventInput, EventItem } from './eventTypes'

vi.mock('../../shared/powerPagesApi', () => ({
  powerPagesFetch: vi.fn(),
  powerPagesRequest: vi.fn(),
}))

const powerPagesFetchMock = vi.mocked(powerPagesFetch)
const powerPagesRequestMock = vi.mocked(powerPagesRequest)
const calendarEventId = '22222222-2222-4222-8222-222222222222'
const event: EventItem = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Volunteer Orientation Webinar',
  eventFormat: 'Virtual',
  eventFormatValue: 866530001,
  eventStatus: 'Registration Open',
  eventStatusValue: 866530002,
  eventType: 'Webinar',
  eventTypeValue: 866530005,
  startDateTime: '2026-09-16T18:00:00Z',
  endDateTime: '2026-09-16T19:30:00Z',
  meetingUrl: 'https://teams.microsoft.com/example',
  venueName: null,
  description: 'Volunteer orientation details.',
}

const eventApiRecord = {
  mss_eventsid: event.id,
  mss_eventname: event.title,
  mss_description: event.description,
  mss_eventtype: event.eventTypeValue,
  'mss_eventtype@OData.Community.Display.V1.FormattedValue': event.eventType,
  mss_eventformat: event.eventFormatValue,
  'mss_eventformat@OData.Community.Display.V1.FormattedValue': event.eventFormat,
  mss_startdatetime: event.startDateTime,
  mss_enddatetime: event.endDateTime,
  mss_eventstatus: event.eventStatusValue,
  'mss_eventstatus@OData.Community.Display.V1.FormattedValue': event.eventStatus,
  mss_venuename: event.venueName,
  mss_address: null,
  mss_city: null,
  mss_meetingurl: event.meetingUrl,
}

const eventInput: EventInput = {
  title: 'Community Engagement Meeting',
  startDateTime: '2026-09-22T17:30:00.000Z',
  endDateTime: '2026-09-22T19:00:00.000Z',
  eventTypeValue: 866530002,
  eventFormatValue: 866530000,
  eventStatusValue: 866530000,
  venueName: 'District Office Meeting Room',
  meetingUrl: null,
  description: 'Meet local volunteers and community partners.',
}

describe('eventService', () => {
  beforeEach(() => {
    powerPagesFetchMock.mockReset()
    powerPagesRequestMock.mockReset()
    vi.useRealTimers()
  })

  test('loads future Published and Registration Open events directly for volunteers', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-31T12:34:56.000Z'))
    const controller = new AbortController()
    powerPagesFetchMock.mockResolvedValue({ value: [eventApiRecord] })

    await expect(getEvents(false, controller.signal)).resolves.toEqual([event])
    expect(powerPagesFetchMock).toHaveBeenCalledTimes(1)
    const [path, options] = powerPagesFetchMock.mock.calls[0]
    const url = new URL(path, 'https://powerpages.local')
    expect(url.pathname).toBe('/_api/mss_eventses')
    expect(url.searchParams.get('$select')).toBe([
      'mss_eventsid', 'mss_eventname', 'mss_description', 'mss_eventtype',
      'mss_eventformat', 'mss_startdatetime', 'mss_enddatetime', 'mss_eventstatus',
      'mss_venuename', 'mss_address', 'mss_city', 'mss_meetingurl',
    ].join(','))
    expect(url.searchParams.get('$filter')).toBe(
      '(mss_eventstatus eq 866530001 or mss_eventstatus eq 866530002)'
      + ' and mss_startdatetime ge 2026-08-31T12:34:56.000Z',
    )
    expect(url.searchParams.get('$orderby')).toBe('mss_startdatetime asc')
    expect(options).toEqual({
      signal: controller.signal,
      headers: { Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' },
    })
  })

  test('loads all events directly for administrators in ascending start order', async () => {
    powerPagesFetchMock.mockResolvedValue({ value: [eventApiRecord] })

    await expect(getEvents(true)).resolves.toEqual([event])
    const [path] = powerPagesFetchMock.mock.calls[0]
    const url = new URL(path, 'https://powerpages.local')
    expect(url.pathname).toBe('/_api/mss_eventses')
    expect(url.searchParams.has('$filter')).toBe(false)
    expect(url.searchParams.get('$orderby')).toBe('mss_startdatetime asc')
  })

  test('uses fallback labels when formatted choice annotations are absent', async () => {
    powerPagesFetchMock.mockResolvedValue({ value: [{
      ...eventApiRecord,
      'mss_eventtype@OData.Community.Display.V1.FormattedValue': undefined,
      'mss_eventformat@OData.Community.Display.V1.FormattedValue': undefined,
      'mss_eventstatus@OData.Community.Display.V1.FormattedValue': undefined,
    }] })

    await expect(getEvents(true)).resolves.toEqual([event])
  })

  test('loads future registered Event details directly through the Events Web API', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-31T12:34:56.000Z'))
    const controller = new AbortController()
    powerPagesFetchMock.mockResolvedValue({
      value: [{ ...eventApiRecord, mss_eventsid: calendarEventId }],
    })

    await expect(getCalendarEvents(
      [calendarEventId, calendarEventId],
      controller.signal,
    )).resolves.toEqual([
      { ...event, id: calendarEventId },
    ])
    const [path, options] = powerPagesFetchMock.mock.calls[0]
    const url = new URL(path, 'https://powerpages.local')
    expect(url.pathname).toBe('/_api/mss_eventses')
    expect(url.searchParams.get('$filter')).toBe(
      '(mss_eventstatus eq 866530001 or mss_eventstatus eq 866530002'
      + ' or mss_eventstatus eq 866530003 or mss_eventstatus eq 866530004)'
      + ' and mss_startdatetime ge 2026-08-31T12:34:56.000Z'
      + ` and (mss_eventsid eq ${calendarEventId})`,
    )
    expect(url.searchParams.get('$orderby')).toBe('mss_startdatetime asc')
    expect(options).toEqual({
      signal: controller.signal,
      headers: { Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' },
    })
  })

  test('does not call the Events Web API when there are no Registered event IDs', async () => {
    await expect(getCalendarEvents([])).resolves.toEqual([])
    expect(powerPagesFetchMock).not.toHaveBeenCalled()
  })

  test('rejects malformed registered Events Web API responses', async () => {
    powerPagesFetchMock.mockResolvedValue({ value: null })
    await expect(getCalendarEvents([calendarEventId])).rejects.toThrow(
      'Registered events could not be loaded.',
    )
  })

  test('rejects malformed Event Web API responses', async () => {
    powerPagesFetchMock.mockResolvedValue(null as never)
    await expect(getEvents(false)).rejects.toThrow('Events could not be loaded')

    powerPagesFetchMock.mockResolvedValue({ value: 'not-an-array' })
    await expect(getEvents(false)).rejects.toThrow('Events could not be loaded')

    powerPagesFetchMock.mockResolvedValue({ value: [{ ...eventApiRecord, mss_eventsid: null }] })
    await expect(getEvents(false)).rejects.toThrow('Events could not be loaded')
  })

  test('creates an event directly through the Events Web API', async () => {
    const createdId = '33333333-3333-4333-8333-333333333333'
    powerPagesRequestMock.mockResolvedValue(new Response(null, {
      status: 204,
      headers: { entityid: createdId },
    }))

    await expect(createEvent(eventInput)).resolves.toEqual({ id: createdId })
    expect(powerPagesRequestMock).toHaveBeenCalledWith('/_api/mss_eventses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mss_eventname: eventInput.title,
        mss_startdatetime: eventInput.startDateTime,
        mss_enddatetime: eventInput.endDateTime,
        mss_eventtype: eventInput.eventTypeValue,
        mss_eventformat: eventInput.eventFormatValue,
        mss_eventstatus: eventInput.eventStatusValue,
        mss_venuename: eventInput.venueName,
        mss_meetingurl: eventInput.meetingUrl,
        mss_description: eventInput.description,
      }),
      signal: undefined,
    })
  })

  test('accepts a successful event creation when Dataverse returns no entity id', async () => {
    powerPagesRequestMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(createEvent(eventInput)).resolves.toEqual({ id: null })
  })

  test('updates an event directly through the Events Web API', async () => {
    const existingId = '44444444-4444-4444-8444-444444444444'
    powerPagesRequestMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(updateEvent(existingId, eventInput)).resolves.toEqual({
      id: existingId,
    })
    expect(powerPagesRequestMock).toHaveBeenCalledWith(
      `/_api/mss_eventses(${existingId})`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String),
        signal: undefined,
      },
    )
  })

  test('propagates direct Event Web API mutation failures', async () => {
    powerPagesRequestMock.mockRejectedValue(new Error('Forbidden'))
    await expect(createEvent(eventInput)).rejects.toThrow('Event could not be saved.')
    await expect(updateEvent('existing-event-id', eventInput)).rejects.toThrow(
      'Event could not be saved.',
    )
  })
})
