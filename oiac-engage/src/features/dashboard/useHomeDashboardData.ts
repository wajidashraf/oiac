import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getCalendarEvents } from '../events/eventService'
import type { EventItem } from '../events/eventTypes'
import {
  EVENT_REGISTRATION_STATUS,
  getEventRegistrations,
} from '../eventRegistrations/eventRegistrationService'
import {
  getMeetingReportCount,
  getMeetingReports,
} from '../meetingReports/meetingReportService'
import type { MeetingReportSummary } from '../meetingReports/meetingReportTypes'
import {
  acceptMeetingInvite,
  getMeetingInvites,
} from '../meetingInvites/meetingInviteService'
import type { MeetingInvite } from '../meetingInvites/meetingInviteTypes'
import { getActiveTeamAnnouncements } from '../teamAnnouncements/teamAnnouncementService'
import type { TeamAnnouncement } from '../teamAnnouncements/teamAnnouncementTypes'
import { selectUpcomingMeetings } from './upcomingMeetings'
import {
  classifyPowerPagesLoadFailure,
  type PowerPagesLoadFailureKind,
} from '../../shared/powerPagesApi'

export type DashboardLoadStatus = 'loading' | 'ready' | 'error'

export type HomeDashboardData = {
  readonly reports: readonly MeetingReportSummary[]
  readonly reportCount: number | null
  readonly registeredEventCount: number | null
  readonly upcomingEvents: readonly EventItem[]
  readonly reportsStatus: DashboardLoadStatus
  readonly registrationsStatus: DashboardLoadStatus
  readonly registrationsFailureKind: PowerPagesLoadFailureKind | null
  readonly meetingInvites: readonly MeetingInvite[]
  readonly upcomingMeetings: readonly MeetingInvite[]
  readonly invitesStatus: DashboardLoadStatus
  readonly invitesFailureKind: PowerPagesLoadFailureKind | null
  readonly teamAnnouncements: readonly TeamAnnouncement[]
  readonly announcementsStatus: DashboardLoadStatus
  readonly acceptingInviteIds: ReadonlySet<string>
  readonly inviteError: string | null
  readonly acceptInvite: (inviteId: string) => Promise<void>
  readonly retryInvites: () => void
  readonly retryAnnouncements: () => void
  readonly retry: () => void
}

export function useHomeDashboardData(contactId?: string): HomeDashboardData {
  const [reports, setReports] = useState<readonly MeetingReportSummary[]>([])
  const [reportCount, setReportCount] = useState<number | null>(null)
  const [registeredEventCount, setRegisteredEventCount] = useState<number | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<readonly EventItem[]>([])
  const [reportsStatus, setReportsStatus] = useState<DashboardLoadStatus>('loading')
  const [registrationsStatus, setRegistrationsStatus] = useState<DashboardLoadStatus>('loading')
  const [registrationsFailureKind, setRegistrationsFailureKind] = useState<PowerPagesLoadFailureKind | null>(null)
  const [meetingInvites, setMeetingInvites] = useState<readonly MeetingInvite[]>([])
  const [invitesStatus, setInvitesStatus] = useState<DashboardLoadStatus>('loading')
  const [invitesFailureKind, setInvitesFailureKind] = useState<PowerPagesLoadFailureKind | null>(null)
  const [teamAnnouncements, setTeamAnnouncements] = useState<readonly TeamAnnouncement[]>([])
  const [announcementsStatus, setAnnouncementsStatus] = useState<DashboardLoadStatus>('loading')
  const [acceptingInviteIds, setAcceptingInviteIds] = useState<ReadonlySet<string>>(new Set())
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [inviteRetryKey, setInviteRetryKey] = useState(0)
  const [announcementRetryKey, setAnnouncementRetryKey] = useState(0)
  const meetingInvitesRef = useRef<readonly MeetingInvite[]>([])
  const contactFullNameRef = useRef('')
  const acceptingInviteIdsRef = useRef(new Set<string>())
  const retry = useCallback(() => setRetryKey((value) => value + 1), [])
  const retryInvites = useCallback(() => setInviteRetryKey((value) => value + 1), [])
  const retryAnnouncements = useCallback(
    () => setAnnouncementRetryKey((value) => value + 1),
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    setReportsStatus('loading')
    setReports([])
    setReportCount(null)
    void getMeetingReports({ limit: 5 }, signal).then((page) => {
      if (signal.aborted) return
      const latestReports = page.reports.slice(0, 5)
      setReports(latestReports)
      setReportsStatus('ready')
    }).catch(() => {
      if (signal.aborted) return
      setReports([])
      setReportsStatus('error')
    })
    void getMeetingReportCount(signal).then((count) => {
      if (signal.aborted) return
      setReportCount(count)
    }).catch(() => {
      if (signal.aborted) return
      setReportCount(null)
    })

    setRegistrationsStatus('loading')
    setRegistrationsFailureKind(null)
    setRegisteredEventCount(null)
    setUpcomingEvents([])
    if (!contactId) {
      setRegistrationsFailureKind('processing')
      setRegistrationsStatus('error')
    } else {
      void getEventRegistrations(contactId, signal).then((registrations) => {
        const activeEventIds = Array.from(new Set(
          registrations
            .filter((registration) => registration.status === EVENT_REGISTRATION_STATUS.registered)
            .map((registration) => registration.eventId),
        ))
        if (signal.aborted) return
        setRegisteredEventCount(activeEventIds.length)
        if (activeEventIds.length === 0) {
          setUpcomingEvents([])
          setRegistrationsStatus('ready')
          return
        }
        void getCalendarEvents(activeEventIds, signal).then((events) => {
          if (signal.aborted) return
          setUpcomingEvents(events.slice(0, 3))
          setRegistrationsFailureKind(null)
          setRegistrationsStatus('ready')
        }).catch((error: unknown) => {
          if (signal.aborted) return
          setUpcomingEvents([])
          setRegistrationsFailureKind(classifyPowerPagesLoadFailure(error))
          setRegistrationsStatus('error')
        })
      }).catch((error: unknown) => {
        if (signal.aborted) return
        setRegisteredEventCount(null)
        setUpcomingEvents([])
        setRegistrationsFailureKind(classifyPowerPagesLoadFailure(error))
        setRegistrationsStatus('error')
      })
    }

    return () => controller.abort()
  }, [contactId, retryKey])

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    setInvitesStatus('loading')
    setInvitesFailureKind(null)
    setInviteError(null)
    setMeetingInvites([])
    meetingInvitesRef.current = []
    contactFullNameRef.current = ''

    if (!contactId) {
      setInvitesFailureKind('processing')
      setInvitesStatus('error')
      return () => controller.abort()
    }

    void getMeetingInvites(contactId, signal).then((collection) => {
      if (signal.aborted) return
      contactFullNameRef.current = collection.contactFullName
      meetingInvitesRef.current = collection.invites
      setMeetingInvites(collection.invites)
      setInvitesFailureKind(null)
      setInvitesStatus('ready')
    }).catch((error: unknown) => {
      if (signal.aborted) return
      meetingInvitesRef.current = []
      setMeetingInvites([])
      setInvitesFailureKind(classifyPowerPagesLoadFailure(error))
      setInvitesStatus('error')
    })

    return () => controller.abort()
  }, [contactId, inviteRetryKey])

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    setAnnouncementsStatus('loading')
    setTeamAnnouncements([])
    void getActiveTeamAnnouncements({ signal }).then((announcements) => {
      if (signal.aborted) return
      setTeamAnnouncements(announcements)
      setAnnouncementsStatus('ready')
    }).catch(() => {
      if (signal.aborted) return
      setTeamAnnouncements([])
      setAnnouncementsStatus('error')
    })

    return () => controller.abort()
  }, [announcementRetryKey])

  const acceptInvite = useCallback(async (inviteId: string): Promise<void> => {
    if (!contactId || acceptingInviteIdsRef.current.has(inviteId)) return
    const invite = meetingInvitesRef.current.find((item) => item.id === inviteId)
    if (!invite) return

    acceptingInviteIdsRef.current.add(inviteId)
    setAcceptingInviteIds(new Set(acceptingInviteIdsRef.current))
    setInviteError(null)
    try {
      const participant = await acceptMeetingInvite({
        contactId,
        contactFullName: contactFullNameRef.current,
        invite,
      })
      const updatedInvites = meetingInvitesRef.current.map((item) => (
        item.id === inviteId ? { ...item, participant } : item
      ))
      meetingInvitesRef.current = updatedInvites
      setMeetingInvites(updatedInvites)
    } catch {
      setInviteError(`${invite.title} could not be accepted. Try again.`)
    } finally {
      acceptingInviteIdsRef.current.delete(inviteId)
      setAcceptingInviteIds(new Set(acceptingInviteIdsRef.current))
    }
  }, [contactId])

  const upcomingMeetings = useMemo(
    () => selectUpcomingMeetings(meetingInvites),
    [meetingInvites],
  )

  return {
    reports,
    reportCount,
    registeredEventCount,
    upcomingEvents,
    reportsStatus,
    registrationsStatus,
    registrationsFailureKind,
    meetingInvites,
    upcomingMeetings,
    invitesStatus,
    invitesFailureKind,
    teamAnnouncements,
    announcementsStatus,
    acceptingInviteIds,
    inviteError,
    acceptInvite,
    retryInvites,
    retryAnnouncements,
    retry,
  }
}
