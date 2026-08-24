import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import App from './App'

test('shows the OIAC Engage scaffold at the home route', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )

  expect(screen.getByText('Building OIAC Engage')).toBeInTheDocument()
})
