import { describe, expect, test } from 'vitest'
import { activityItems, agendaItems, appointments, events, pressCoverage, reports } from './portalData'

const collections = { reports, agendaItems, activityItems, events, appointments, pressCoverage }

describe('portal static data', () => {
  test.each(Object.entries(collections))('%s contains multiple uniquely identified records', (_, records) => {
    expect(records.length).toBeGreaterThanOrEqual(2)
    expect(new Set(records.map((record) => record.id)).size).toBe(records.length)
  })

  test('records expose the fields their pages display', () => {
    expect(reports[0]).toMatchObject({ title: expect.any(String), period: expect.any(String), status: expect.any(String) })
    expect(agendaItems[0]).toMatchObject({ title: expect.any(String), date: expect.any(String), time: expect.any(String) })
    expect(activityItems[0]).toMatchObject({ title: expect.any(String), timestamp: expect.any(String), category: expect.any(String) })
    expect(events[0]).toMatchObject({ title: expect.any(String), date: expect.any(String), location: expect.any(String) })
    expect(appointments[0]).toMatchObject({ title: expect.any(String), date: expect.any(String), status: expect.any(String) })
    expect(pressCoverage[0]).toMatchObject({ publication: expect.any(String), headline: expect.any(String), date: expect.any(String), summary: expect.any(String) })
  })
})
