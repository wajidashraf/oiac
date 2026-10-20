import type { ContactOption } from '../meetingReports/meetingReportTypes'

export type CoverageVariant = 'press' | 'featured'
export type CoverageChoice = 'coverageType' | 'coverageLevel' | 'tone' | 'keyTopic'
export type CoverageDraft = {
  readonly headlineTitle: string
  readonly mediaOutlet: string
  readonly datePublishedAired: string
  readonly eventCampaign: string
  readonly personInterviewed: string
  readonly reporter: string
  readonly programSection: string
  readonly articleVideoUrl: string
  readonly summary: string
  readonly keyQuotes: string
  readonly publication: string
  readonly headline: string
  readonly shortSummary: string
  readonly publicationDate: string
  readonly originalArticleLink: string
  readonly coverageType: number | null
  readonly coverageLevel: number | null
  readonly tone: number | null
  readonly keyTopic: number | null
  readonly oiacMentioned: boolean | null
  readonly followUpNeeded: boolean | null
  readonly relatedContact: ContactOption | null
}

export type CoverageRecord = CoverageDraft & {
  readonly id: string
  readonly isFeatured: boolean
  readonly submittedById: string | null
  readonly fileName: string | null
  readonly fileId: string | null
  readonly choiceLabels?: Partial<Record<CoverageChoice, string>>
}

export type CoveragePage = {
  readonly records: readonly CoverageRecord[]
  readonly nextLink: string | null
}

export type CoverageOption = { readonly label: string; readonly value: number }

// Labels and every option value verified against Test/UAT mss_presscoverage metadata
// on 16 October 2026; the verified values are contiguous from 866530000 in this order.
// Evidence: docs/superpowers/specs/2026-10-16-press-coverage-design.md.
export const COVERAGE_OPTIONS: Readonly<Record<CoverageChoice, readonly CoverageOption[]>> = {
  coverageType: ['TV', 'Radio', 'Print', 'Online', 'Podcast'].map((label, index) => ({ label, value: 866530000 + index })),
  coverageLevel: ['National', 'International', 'Local'].map((label, index) => ({ label, value: 866530000 + index })),
  tone: ['Positive', 'Neutral', 'Mixed', 'Negative'].map((label, index) => ({ label, value: 866530000 + index })),
  keyTopic: ['Iran', 'Executions', 'Human Rights', 'NCRI', 'Rally'].map((label, index) => ({ label, value: 866530000 + index })),
}

export function emptyCoverageDraft(): CoverageDraft {
  return {
    headlineTitle: '', mediaOutlet: '', datePublishedAired: '', eventCampaign: '',
    personInterviewed: '', reporter: '', programSection: '', articleVideoUrl: '', summary: '',
    keyQuotes: '', publication: '', headline: '', shortSummary: '', publicationDate: '', originalArticleLink: '',
    coverageType: null, coverageLevel: null, tone: null, keyTopic: null,
    oiacMentioned: null, followUpNeeded: null, relatedContact: null,
  }
}
