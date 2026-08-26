import { expect, test } from 'vitest'
import { buildSignInUrl } from './signInUrl'

test.each([
  ['/', '/SignIn?returnUrl=%2F'],
  ['/resources', '/SignIn?returnUrl=%2Fresources'],
  ['/contact?from=footer', '/SignIn?returnUrl=%2Fcontact%3Ffrom%3Dfooter'],
])('builds a local Power Pages sign-in URL for %s', (returnUrl, expected) => {
  expect(buildSignInUrl(returnUrl)).toBe(expected)
})

test.each([
  'https://example.com',
  '//example.com',
  'resources',
])('rejects unsafe return URL %s', (returnUrl) => {
  expect(buildSignInUrl(returnUrl)).toBe('/SignIn?returnUrl=%2F')
})
