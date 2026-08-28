import { describe, expect, test } from 'vitest'
import { activityItems, appointments, pressCoverage, reports } from './portalData'

const collections = { reports, activityItems, appointments, pressCoverage }

describe('portal static data', () => {
  test.each(Object.entries(collections))('%s contains multiple uniquely identified records', (_, records) => {
    expect(records.length).toBeGreaterThanOrEqual(2)
    expect(new Set(records.map((record) => record.id)).size).toBe(records.length)
  })

  test('records expose the fields their pages display', () => {
    expect(reports[0]).toMatchObject({ title: expect.any(String), period: expect.any(String), status: expect.any(String) })
    expect(activityItems[0]).toMatchObject({ type: expect.any(String), subject: expect.any(String), date: expect.any(String), status: expect.any(String) })
    expect(appointments[0]).toMatchObject({ title: expect.any(String), date: expect.any(String), status: expect.any(String) })
    expect(pressCoverage[0]).toMatchObject({
      newsTitle: expect.any(String),
      date: expect.any(String),
      source: expect.any(String),
      coverageType: expect.any(String),
      sentiment: expect.any(String),
      country: expect.any(String),
    })
  })
})
