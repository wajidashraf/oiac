import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Appointments from './Appointments'

test('renders appointment status and actions', () => {
  render(<Appointments />)
  expect(screen.getByRole('heading', { name: 'Appointments' })).toBeInTheDocument()
  expect(screen.getByText('Programme consultation')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /view programme consultation/i })).toHaveAttribute('type', 'button')
})
