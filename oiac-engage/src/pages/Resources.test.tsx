import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import Resources from './Resources'

test('renders available resources with correct link behavior', () => {
  render(<MemoryRouter><Resources /></MemoryRouter>)

  expect(screen.getByRole('heading', { name: 'Resources', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /OIAC official website/ })).toHaveAttribute('target', '_blank')
  expect(screen.getByRole('link', { name: /Press coverage/ })).toHaveAttribute('href', '/press-coverage')
  expect(screen.getByRole('link', { name: /Contact OIAC/ })).toHaveAttribute('href', '/contact')
  expect(document.title).toBe('Resources — OIAC Engage')
})

test('renders an explicit empty state', () => {
  render(<MemoryRouter><Resources items={[]} /></MemoryRouter>)

  expect(screen.getByRole('heading', { name: 'No resources available' })).toBeInTheDocument()
})
