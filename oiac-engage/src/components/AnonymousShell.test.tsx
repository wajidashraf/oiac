import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import AnonymousShell from './AnonymousShell'

test('uses the supplied branding and footer-only resource link', () => {
  render(
    <MemoryRouter>
      <AnonymousShell><p>Page content</p></AnonymousShell>
    </MemoryRouter>,
  )

  expect(screen.getByRole('img', { name: 'Organization of Iranian American Communities' }))
    .toHaveAttribute('src', '/logo.png')
  expect(screen.getByRole('link', { name: 'Sign In' }))
    .toHaveAttribute('href', '/SignIn?returnUrl=%2F')
  expect(screen.getByRole('link', { name: 'Resources' })).toHaveAttribute('href', '/resources')
  expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact')
  expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument()
})
