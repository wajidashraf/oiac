export type EventItem = {
  readonly id: string
  readonly title: string
  readonly eventFormat: string
  readonly eventFormatValue: number | null
  readonly eventStatus: string
  readonly eventStatusValue: number | null
  readonly eventType: string
  readonly eventTypeValue: number | null
  readonly startDateTime: string | null
  readonly endDateTime: string | null
  readonly meetingUrl: string | null
  readonly venueName: string | null
  readonly description: string | null
}

export type EventInput = {
  readonly title: string
  readonly startDateTime: string
  readonly endDateTime: string
  readonly eventTypeValue: number
  readonly eventFormatValue: number
  readonly eventStatusValue: number
  readonly venueName: string | null
  readonly meetingUrl: string | null
  readonly description: string | null
}
