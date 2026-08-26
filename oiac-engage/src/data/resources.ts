export type ResourceRecord = {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly type: 'Website' | 'Portal page'
  readonly href: string
  readonly destination: 'internal' | 'external'
}

export const resources: readonly ResourceRecord[] = [
  {
    id: 'resource-oiac-site',
    title: 'OIAC official website',
    description: 'Read public organizational news, statements, and information.',
    type: 'Website',
    href: 'https://oiac.org/',
    destination: 'external',
  },
  {
    id: 'resource-press-coverage',
    title: 'Press coverage',
    description: 'Review reporting and commentary connected to OIAC priorities.',
    type: 'Portal page',
    href: '/press-coverage',
    destination: 'internal',
  },
  {
    id: 'resource-contact',
    title: 'Contact OIAC',
    description: 'Reach the OIAC team for portal or membership support.',
    type: 'Portal page',
    href: '/contact',
    destination: 'internal',
  },
]
