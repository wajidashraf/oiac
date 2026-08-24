import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Events from './Events'
import { events } from '../data/portalData'

test('renders upcoming and past Events', () => {
  render(<Events />)
  expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Member briefing session', level: 3 })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Past events' })).toBeInTheDocument()
})

test('shows a section-level empty state when no past events exist', () => {
  render(<Events items={[events[0]]} />)
  expect(screen.getByRole('heading', { name: 'No past events' })).toBeInTheDocument()
})
