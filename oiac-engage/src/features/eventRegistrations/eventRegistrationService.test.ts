import { beforeEach, describe, expect, test, vi } from 'vitest'
import { powerPagesFetch, powerPagesRequest } from '../../shared/powerPagesApi'
import {
  EVENT_REGISTRATION_STATUS,
  getEventRegistrations,
  registerForEvent,
} from './eventRegistrationService'

vi.mock('../../shared/powerPagesApi', () => ({
  powerPagesFetch: vi.fn(),
  powerPagesRequest: vi.fn(),
}))

const contactId = '11111111-1111-4111-8111-111111111111'
const eventId = '22222222-2222-4222-8222-222222222222'
const registrationId = '33333333-3333-4333-8333-333333333333'
const fetchMock = vi.mocked(powerPagesFetch)
const requestMock = vi.mocked(powerPagesRequest)

function registrationRow(status: number) {
  return {
    mss_eventregistrationid: registrationId,
    _mss_contact_value: contactId,
    _mss_event_value: eventId,
    mss_registrationdate: '2026-08-30T10:00:00Z',
    mss_registrationnumber: 'REG-1001',
    mss_registrationstatus: status,
  }
}

describe('Event Registration service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('loads only registrations owned by the signed-in Contact', async () => {
    const controller = new AbortController()
    fetchMock.mockResolvedValue({ value: [registrationRow(EVENT_REGISTRATION_STATUS.registered)] })

    await expect(getEventRegistrations(
      `{${contactId.toUpperCase()}}`,
      controller.signal,
    )).resolves.toEqual([{
      id: registrationId,
      contactId,
      eventId,
      registrationDate: '2026-08-30T10:00:00Z',
      registrationNumber: 'REG-1001',
      status: EVENT_REGISTRATION_STATUS.registered,
    }])

    const requestPath = vi.mocked(fetchMock).mock.calls[0][0]
    const requestUrl = new URL(requestPath, 'https://oiac-engage.powerappsportals.com')
    expect(requestUrl.pathname).toBe('/_api/mss_eventregistrations')
    expect(requestUrl.searchParams.get('$filter')).toBe(`_mss_contact_value eq ${contactId}`)
    expect(requestUrl.searchParams.get('$select')).toContain('_mss_event_value')
    expect(fetchMock.mock.calls[0][1]).toEqual({ signal: controller.signal })
  })

  test('rejects invalid Contact and Event identifiers before sending a request', async () => {
    await expect(getEventRegistrations('not-a-guid')).rejects.toThrow('valid Contact ID')
    await expect(registerForEvent(contactId, 'not-a-guid')).rejects.toThrow('valid Event ID')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(requestMock).not.toHaveBeenCalled()
  })

  test('creates a Registered row with Contact and Event lookup bindings', async () => {
    fetchMock.mockResolvedValue({ value: [] })
    requestMock.mockResolvedValue(new Response(null, {
      status: 204,
      headers: { entityid: `{${registrationId.toUpperCase()}}` },
    }))

    await expect(registerForEvent(contactId, eventId, new Date('2026-08-30T12:00:00Z')))
      .resolves.toMatchObject({ outcome: 'registered', registration: { id: registrationId } })

    expect(requestMock).toHaveBeenCalledWith('/_api/mss_eventregistrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mss_registrationdate: '2026-08-30T12:00:00.000Z',
        mss_registrationstatus: EVENT_REGISTRATION_STATUS.registered,
        'mss_Event@odata.bind': `/mss_eventses(${eventId})`,
        'mss_Contact@odata.bind': `/contacts(${contactId})`,
      }),
    })
  })

  test('recovers a committed registration when the create request reports an error', async () => {
    fetchMock
      .mockResolvedValueOnce({ value: [] })
      .mockResolvedValueOnce({ value: [registrationRow(EVENT_REGISTRATION_STATUS.registered)] })
    requestMock.mockRejectedValue(new Error('The response was interrupted.'))

    await expect(registerForEvent(contactId, eventId)).resolves.toMatchObject({
      outcome: 'already-registered',
      registration: { id: registrationId, status: EVENT_REGISTRATION_STATUS.registered },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(requestMock).toHaveBeenCalledTimes(1)
  })

  test('recovers a committed registration when the create response omits entityid', async () => {
    fetchMock
      .mockResolvedValueOnce({ value: [] })
      .mockResolvedValueOnce({ value: [registrationRow(EVENT_REGISTRATION_STATUS.registered)] })
    requestMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(registerForEvent(contactId, eventId)).resolves.toMatchObject({
      outcome: 'already-registered',
      registration: { id: registrationId, status: EVENT_REGISTRATION_STATUS.registered },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(requestMock).toHaveBeenCalledTimes(1)
  })

  test('does not create a duplicate when the Contact is already Registered', async () => {
    fetchMock.mockResolvedValue({ value: [registrationRow(EVENT_REGISTRATION_STATUS.registered)] })

    await expect(registerForEvent(contactId, eventId)).resolves.toMatchObject({
      outcome: 'already-registered',
      registration: { id: registrationId, status: EVENT_REGISTRATION_STATUS.registered },
    })
    expect(requestMock).not.toHaveBeenCalled()
  })

  test('preserves a Waitlisted row without adding it to the Registered state', async () => {
    fetchMock.mockResolvedValue({ value: [registrationRow(EVENT_REGISTRATION_STATUS.waitlisted)] })

    await expect(registerForEvent(contactId, eventId)).resolves.toMatchObject({
      outcome: 'waitlisted',
      registration: { id: registrationId, status: EVENT_REGISTRATION_STATUS.waitlisted },
    })
    expect(requestMock).not.toHaveBeenCalled()
  })

  test('reactivates a Cancelled row and refreshes its registration date', async () => {
    fetchMock.mockResolvedValue({ value: [registrationRow(EVENT_REGISTRATION_STATUS.cancelled)] })
    requestMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(registerForEvent(contactId, eventId, new Date('2026-08-30T14:15:00Z')))
      .resolves.toMatchObject({
        outcome: 'registered',
        registration: {
          id: registrationId,
          status: EVENT_REGISTRATION_STATUS.registered,
          registrationDate: '2026-08-30T14:15:00.000Z',
        },
      })

    expect(requestMock).toHaveBeenCalledWith(`/_api/mss_eventregistrations(${registrationId})`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mss_registrationdate: '2026-08-30T14:15:00.000Z',
        mss_registrationstatus: EVENT_REGISTRATION_STATUS.registered,
      }),
    })
  })

  test('prefers an existing Registered row when legacy duplicates are returned', async () => {
    fetchMock.mockResolvedValue({
      value: [
        { ...registrationRow(EVENT_REGISTRATION_STATUS.cancelled), mss_eventregistrationid: '44444444-4444-4444-8444-444444444444' },
        registrationRow(EVENT_REGISTRATION_STATUS.registered),
      ],
    })

    await expect(registerForEvent(contactId, eventId)).resolves.toMatchObject({
      outcome: 'already-registered',
      registration: { id: registrationId },
    })
    expect(requestMock).not.toHaveBeenCalled()
  })
})
