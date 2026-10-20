const easternParts = new Intl.DateTimeFormat('en-US', {
 timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})
function calendarDay(value: string): Date {
 const day = new Date(`${value}T00:00:00.000Z`)
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value || day.getUTCFullYear() < 1753) throw new Error('Choose a valid date.')
 return day
}
function easternStart(day: Date): string {
 const wallTime = day.getTime()
 let candidate = wallTime
 // Resolve midnight using the offset at the target wall time, independently for each boundary.
 for (let attempt = 0; attempt < 3; attempt++) {
  const parts = Object.fromEntries(easternParts.formatToParts(new Date(candidate)).map(part => [part.type, part.value]))
  const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
  const correction = wallTime - represented
  if (correction === 0) return new Date(candidate).toISOString()
  candidate += correction
 }
 throw new Error('Choose a valid Eastern date.')
}
export function historyEasternDateRange(from: string, to: string): { from: string | null; to: string | null } {
 if (from && to && from > to) throw new Error('From date must be on or before To date.')
 const start = from ? calendarDay(from) : null
 const end = to ? calendarDay(to) : null
 if (end) end.setUTCDate(end.getUTCDate() + 1)
 return { from: start ? easternStart(start) : null, to: end ? easternStart(end) : null }
}
