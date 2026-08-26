import { expect, test } from 'vitest'
import { resources } from './resources'

test('defines unique resources with real internal and external destinations', () => {
  const ids = resources.map((resource) => resource.id)
  expect(ids).toHaveLength(new Set(ids).size)
  expect(resources).toEqual(expect.arrayContaining([
    expect.objectContaining({
      title: 'OIAC official website',
      href: 'https://oiac.org/',
      destination: 'external',
    }),
    expect.objectContaining({
      title: 'Press coverage',
      href: '/press-coverage',
      destination: 'internal',
    }),
    expect.objectContaining({
      title: 'Contact OIAC',
      href: '/contact',
      destination: 'internal',
    }),
  ]))
})
