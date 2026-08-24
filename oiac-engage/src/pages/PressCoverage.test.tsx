import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import PressCoverage from './PressCoverage'

test('presents coverage with publication details and summaries', () => {
  render(<PressCoverage />)

  expect(screen.getByRole('heading', { name: 'Press Coverage' })).toBeInTheDocument()
  expect(screen.getByText('Community Review')).toBeInTheDocument()
  expect(screen.getByText('Partnership programme expands opportunities for members')).toBeInTheDocument()
  expect(screen.getByText('14 Aug 2026')).toBeInTheDocument()
  expect(screen.getByText(/latest programme milestone/i)).toBeInTheDocument()
  expect(document.title).toBe('Press Coverage — OIAC Engage')
})
