export type TeamAnnouncement = {
  readonly id: string
  readonly title: string
  readonly content: string
  readonly startDateTime: string
  readonly endDateTime: string
  readonly link: string | null
}

export type TeamAnnouncementQuery = {
  readonly now?: Date
  readonly signal?: AbortSignal
}
