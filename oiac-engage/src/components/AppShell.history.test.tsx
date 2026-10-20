import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import AppShell from './AppShell'
test('Activity Log is linked only in the authenticated footer', () => {
 render(<MemoryRouter><AppShell user={{ userName: 'Alice', userRoles: ['Volunteers'] }}><h1>Home</h1></AppShell></MemoryRouter>)
 expect(within(screen.getByRole('navigation', { name: 'Footer navigation' })).getByRole('link', { name: 'Activity Log' })).toHaveAttribute('href', '/activity/history')
 expect(within(screen.getByRole('banner')).queryByRole('link', { name: 'Activity Log' })).not.toBeInTheDocument()
})

