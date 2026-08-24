import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Events from './Events'

test('renders upcoming and past Events', () => {
  render(<Events />)
  expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Member briefing session', level: 3 })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Past events' })).toBeInTheDocument()
})
