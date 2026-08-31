function isSameLocalDate(first: Date, second: Date): boolean {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate()
}

export function eventDateLabel(startIso: string | null, endIso: string | null): string {
  if (!startIso) return 'Date to be announced'
  const start = new Date(startIso)
  if (Number.isNaN(start.getTime())) return 'Date to be announced'
  const end = endIso ? new Date(endIso) : null
  const startLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(start)

  if (!end) return startLabel
  if (!isSameLocalDate(start, end)) {
    const endLabel = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(end)
    return `${startLabel}–${endLabel}`
  }

  const endTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(end)
  return `${startLabel}–${endTime}`
}

export function eventLocationLabel(
  eventFormat: string,
  venueName: string | null,
  meetingUrl: string | null,
): string {
  const venue = venueName?.trim()
  const isVirtual = eventFormat.trim().toLowerCase() === 'virtual'
  const isHybrid = eventFormat.trim().toLowerCase() === 'hybrid'

  if (isHybrid && venue && meetingUrl) return `${venue} / Online`
  if (venue) return venue
  if (isVirtual || meetingUrl) return 'Online meeting'
  return 'Venue to be announced'
}

export function eventCalendarDate(startIso: string | null): `${number}-${number}-${number}` | null {
  if (!startIso) return null
  const date = new Date(startIso)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}` as `${number}-${number}-${number}`
}
