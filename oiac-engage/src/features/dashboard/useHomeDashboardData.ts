import { useCallback, useEffect, useState } from 'react'
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

export type DashboardLoadStatus = 'loading' | 'ready' | 'error'

export type HomeDashboardData = {
  readonly reports: readonly MeetingReportSummary[]
  readonly reportCount: number | null
  readonly registeredEventCount: number | null
  readonly upcomingEvents: readonly EventItem[]
  readonly reportsStatus: DashboardLoadStatus
  readonly registrationsStatus: DashboardLoadStatus
  readonly retry: () => void
}

export function useHomeDashboardData(contactId?: string): HomeDashboardData {
  const [reports, setReports] = useState<readonly MeetingReportSummary[]>([])
  const [reportCount, setReportCount] = useState<number | null>(null)
  const [registeredEventCount, setRegisteredEventCount] = useState<number | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<readonly EventItem[]>([])
  const [reportsStatus, setReportsStatus] = useState<DashboardLoadStatus>('loading')
  const [registrationsStatus, setRegistrationsStatus] = useState<DashboardLoadStatus>('loading')
  const [retryKey, setRetryKey] = useState(0)
  const retry = useCallback(() => setRetryKey((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    setReportsStatus('loading')
    setReports([])
    setReportCount(null)
    void getMeetingReports({ limit: 5 }, signal).then((page) => {
      if (signal.aborted) return
      setReports(page.reports.slice(0, 5))
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
    setRegisteredEventCount(null)
    setUpcomingEvents([])
    if (!contactId) {
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
          setRegistrationsStatus('ready')
        }).catch(() => {
          if (signal.aborted) return
          setUpcomingEvents([])
          setRegistrationsStatus('error')
        })
      }).catch(() => {
        if (signal.aborted) return
        setRegisteredEventCount(null)
        setUpcomingEvents([])
        setRegistrationsStatus('error')
      })
    }

    return () => controller.abort()
  }, [contactId, retryKey])

  return {
    reports,
    reportCount,
    registeredEventCount,
    upcomingEvents,
    reportsStatus,
    registrationsStatus,
    retry,
  }
}
