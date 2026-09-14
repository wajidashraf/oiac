import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import TrainingResource from './TrainingResource'

test.each([
  ['Volunteer Onboarding Guide', 'Volunteer Onboarding Guide — OIAC Engage'],
  ['Teams Quick Start', 'Teams Quick Start — OIAC Engage'],
  ['Meeting Report Instructions', 'Meeting Report Instructions — OIAC Engage'],
])('renders the %s placeholder resource page', (title, documentTitle) => {
  render(
    <MemoryRouter>
      <TrainingResource title={title} />
    </MemoryRouter>,
  )

  expect(screen.getByRole('heading', { name: title, level: 1 })).toBeInTheDocument()
  expect(screen.getByText('This resource will be updated soon.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to Resources' })).toHaveAttribute('href', '/resources')
  expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/')
  expect(document.title).toBe(documentTitle)
})
