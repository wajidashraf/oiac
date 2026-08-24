import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Contact from './Contact'

test('explains the contact channel and renders the message form', () => {
  render(<Contact />)
  expect(screen.getByRole('heading', { name: 'Contact' })).toBeInTheDocument()
  expect(screen.getByText(/member services team/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Prepare message' })).toBeInTheDocument()
  expect(document.title).toBe('Contact — OIAC Engage')
})
