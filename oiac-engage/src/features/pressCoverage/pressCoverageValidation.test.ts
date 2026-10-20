import { expect, test } from 'vitest'
import { emptyCoverageDraft } from './pressCoverageTypes'
import { validateCoverageDraft } from './pressCoverageValidation'

test('rejects impossible dates and unsafe article URLs', () => {
  const errors = validateCoverageDraft('press', { ...emptyCoverageDraft(), headlineTitle: 'Story', mediaOutlet: 'Outlet', datePublishedAired: '2026-02-30', articleVideoUrl: 'javascript:alert(1)' }, null, false)
  expect(errors.datePublishedAired).toBe('Enter a valid date.')
  expect(errors.articleVideoUrl).toBe('Enter a valid http:// or https:// link.')
})

test('accepts a leap day and an existing featured logo', () => {
  expect(validateCoverageDraft('featured', { ...emptyCoverageDraft(), publication: 'Publication', headline: 'Story', shortSummary: 'Summary', publicationDate: '2024-02-29', originalArticleLink: 'https://example.org/story' }, null, true)).toEqual({})
})
