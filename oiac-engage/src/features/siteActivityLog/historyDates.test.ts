import { expect, test } from 'vitest'
import { historyEasternDateRange } from './historyDates'
test.each([
 ['2026-03-08', '2026-03-08T05:00:00.000Z', '2026-03-09T04:00:00.000Z', 23],
 ['2026-11-01', '2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z', 25],
])('uses independent Eastern calendar boundaries on %s', (date, from, to, hours) => {
 const range = historyEasternDateRange(date, date)
 expect(range).toEqual({ from, to })
 expect((Date.parse(range.to!) - Date.parse(range.from!)) / 3600000).toBe(hours)
})
test('supports open ranges and rejects invalid or reversed calendar dates', () => {
 expect(historyEasternDateRange('', '')).toEqual({ from: null, to: null })
 expect(historyEasternDateRange('2026-10-19', '')).toEqual({ from: '2026-10-19T04:00:00.000Z', to: null })
 expect(() => historyEasternDateRange('2026-02-30', '')).toThrow()
 expect(() => historyEasternDateRange('2026-10-20', '2026-10-19')).toThrow()
})
