import { validateCoverageFile } from './pressCoverageFiles'
import type { CoverageDraft, CoverageVariant } from './pressCoverageTypes'

export type CoverageErrors = Partial<Record<keyof CoverageDraft | 'file', string>>
export const COVERAGE_TEXT_LIMITS = { headlineTitle: 850, mediaOutlet: 100, eventCampaign: 100, personInterviewed: 100, reporter: 100, programSection: 100, articleVideoUrl: 100, summary: 100, keyQuotes: 100, publication: 100, headline: 100, shortSummary: 100, originalArticleLink: 100 } as const
const labels: Partial<Record<keyof CoverageDraft, string>> = {
  headlineTitle: 'Headline / Title', mediaOutlet: 'Media Outlet', datePublishedAired: 'Date Published / Aired',
  publication: 'Publication', headline: 'Headline', shortSummary: 'Short Summary', publicationDate: 'Publication Date', originalArticleLink: 'Original Article Link',
}
const pressTextKeys = ['headlineTitle', 'mediaOutlet', 'eventCampaign', 'personInterviewed', 'reporter', 'programSection', 'articleVideoUrl', 'summary', 'keyQuotes'] as const
const featuredTextKeys = ['publication', 'headline', 'shortSummary', 'originalArticleLink'] as const

export function validateCoverageDraft(variant: CoverageVariant, draft: CoverageDraft, file: File | null, hasExistingFile: boolean): CoverageErrors {
  const errors: CoverageErrors = {}
  const featured = variant === 'featured'
  // Insertion order follows the form, so keyboard focus lands on its first invalid field.
  if (featured && !file && !hasExistingFile) errors.file = 'Publication Logo is required.'
  const required: readonly (keyof CoverageDraft)[] = featured ? ['publication', 'headline', 'shortSummary', 'publicationDate', 'originalArticleLink'] : ['headlineTitle', 'mediaOutlet', 'datePublishedAired']
  for (const key of required) if (typeof draft[key] !== 'string' || !(draft[key] as string).trim()) errors[key] = `${labels[key]} is required.`
  const dateKey = featured ? 'publicationDate' : 'datePublishedAired'
  if (draft[dateKey]) {
    const value = draft[dateKey]
    const parsed = new Date(`${value}T12:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) errors[dateKey] = 'Enter a valid date.'
  }
  const urlKey = featured ? 'originalArticleLink' : 'articleVideoUrl'
  if (draft[urlKey].trim()) {
    try { const url = new URL(draft[urlKey].trim()); if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error() }
    catch { errors[urlKey] = 'Enter a valid http:// or https:// link.' }
  }
  for (const key of featured ? featuredTextKeys : pressTextKeys) {
    if (draft[key].length > COVERAGE_TEXT_LIMITS[key]) errors[key] = `Use ${COVERAGE_TEXT_LIMITS[key]} characters or fewer.`
  }
  if (file) { const fileError = validateCoverageFile(file, variant); if (fileError) errors.file = fileError }
  return errors
}
