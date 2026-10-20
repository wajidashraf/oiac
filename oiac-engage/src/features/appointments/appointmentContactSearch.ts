// Match the appointment server's query bound without altering the typed input.
export function normalizeAppointmentContactSearch(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 100).trim()
}
