import { useCallback, useEffect, useRef } from 'react'
import { getAttachmentPreviewKind } from './attachmentPreviewKind'
import {
  viewAttachment,
  type AttachmentViewResult,
  type MeetingReportAttachment,
} from './meetingReportAttachmentService'

export type AttachmentContentLoader = (
  attachment: MeetingReportAttachment,
) => Promise<AttachmentViewResult>

type InFlightRequest = {
  readonly controller: AbortController
  readonly promise: Promise<AttachmentViewResult>
}

export function useAttachmentPreviewCache(
  attachments: readonly MeetingReportAttachment[],
  enabled: boolean,
): AttachmentContentLoader {
  const cacheRef = useRef(new Map<string, AttachmentViewResult>())
  const inFlightRef = useRef(new Map<string, InFlightRequest>())

  const load = useCallback((
    attachment: MeetingReportAttachment,
    parentSignal?: AbortSignal,
  ): Promise<AttachmentViewResult> => {
    const attachmentId = attachment.attachmentId
    const cached = cacheRef.current.get(attachmentId)
    if (cached) return Promise.resolve(cached)

    const pending = inFlightRef.current.get(attachmentId)
    if (pending && !pending.controller.signal.aborted) return pending.promise
    if (pending) inFlightRef.current.delete(attachmentId)

    const controller = new AbortController()
    const abortFromParent = () => controller.abort()
    if (parentSignal?.aborted) controller.abort()
    else parentSignal?.addEventListener('abort', abortFromParent, { once: true })

    const promise = viewAttachment(attachment, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) cacheRef.current.set(attachmentId, result)
        return result
      })
      .finally(() => {
        parentSignal?.removeEventListener('abort', abortFromParent)
        const current = inFlightRef.current.get(attachmentId)
        if (current?.promise === promise) inFlightRef.current.delete(attachmentId)
      })

    inFlightRef.current.set(attachmentId, { controller, promise })
    return promise
  }, [])

  useEffect(() => {
    const currentIds = new Set(attachments.map((attachment) => attachment.attachmentId))
    for (const attachmentId of cacheRef.current.keys()) {
      if (!currentIds.has(attachmentId)) cacheRef.current.delete(attachmentId)
    }
    for (const [attachmentId, request] of inFlightRef.current) {
      if (!currentIds.has(attachmentId)) {
        request.controller.abort()
        inFlightRef.current.delete(attachmentId)
      }
    }

    if (!enabled) return

    const controller = new AbortController()
    const previewable = attachments.filter(
      (attachment) => getAttachmentPreviewKind(attachment) !== 'unsupported',
    )

    void (async () => {
      // Deferring one microtask avoids starting a duplicate request during React's
      // development-only Strict Mode effect replay.
      await Promise.resolve()
      for (const attachment of previewable) {
        if (controller.signal.aborted) return
        try {
          await load(attachment, controller.signal)
        } catch {
          // Background failures stay silent. A later View click retries normally.
        }
      }
    })()

    return () => controller.abort()
  }, [attachments, enabled, load])

  useEffect(() => () => {
    for (const request of inFlightRef.current.values()) request.controller.abort()
    inFlightRef.current.clear()
    cacheRef.current.clear()
  }, [])

  return useCallback((attachment: MeetingReportAttachment) => load(attachment), [load])
}
