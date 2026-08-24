import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import NotFound from './NotFound'

test('helps a member recover from an unknown route', () => {
  render(<MemoryRouter><NotFound /></MemoryRouter>)

  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/')
})
