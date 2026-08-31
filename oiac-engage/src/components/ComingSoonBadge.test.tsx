import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import ComingSoonBadge from './ComingSoonBadge'

test('renders the shared visible Coming Soon status', () => {
  render(<ComingSoonBadge />)

  expect(screen.getByText('Coming Soon')).toHaveClass('coming-soon-badge')
})
