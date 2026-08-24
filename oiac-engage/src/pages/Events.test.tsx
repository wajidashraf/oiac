import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Events from './Events'

test('renders upcoming and past Events', () => {
  render(<Events />)
  expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument()
  expect(screen.getByText('Member briefing session')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Past events' })).toBeInTheDocument()
})
