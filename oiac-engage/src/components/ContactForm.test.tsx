import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import ContactForm from './ContactForm'

test('validates required fields and confirms a valid local submission', async () => {
  const user = userEvent.setup()
  render(<ContactForm />)

  await user.click(screen.getByRole('button', { name: 'Prepare message' }))
  expect(screen.getByText('Enter your name.')).toBeInTheDocument()
  expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
  expect(screen.getByText('Enter a subject.')).toBeInTheDocument()
  expect(screen.getByText('Enter your message.')).toBeInTheDocument()
  expect(screen.getByLabelText('Name')).toHaveFocus()
  expect(screen.getByLabelText('Name')).toHaveAttribute('name', 'name')
  expect(screen.getByLabelText('Name')).toHaveAttribute('autocomplete', 'name')
  expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
  expect(screen.getByLabelText('Message')).toBeRequired()

  await user.type(screen.getByLabelText('Name'), 'Amina Khan')
  await user.type(screen.getByLabelText('Email'), 'amina@example.com')
  await user.type(screen.getByLabelText('Subject'), 'Report question')
  await user.type(screen.getByLabelText('Message'), 'Please help me understand my latest report.')
  await user.click(screen.getByRole('button', { name: 'Prepare message' }))

  expect(screen.getByRole('status')).toHaveTextContent('Message ready')
})
