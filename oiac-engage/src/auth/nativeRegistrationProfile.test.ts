/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import header from '../../.powerpages-site/web-templates/oiac-auth-header/OIAC-Auth-Header.webtemplate.source.html?raw'

const registrationAssets = import.meta.glob(
  '../../public/registration-profile.js',
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>

const scriptPath = '../../public/registration-profile.js'
const storageKey = 'oiac.registrationProfile.pending.v1'

function registrationScript(): string {
  const script = registrationAssets[scriptPath]
  expect(script, 'registration-profile.js must be a deployable web file').toBeTypeOf('string')
  return script
}

function renderNativeRegistrationForm(): HTMLFormElement {
  document.body.innerHTML = `
    <form id="Register">
      <div class="row mb-3" id="email-row">
        <label for="EmailTextBox">Email Address</label>
        <div><input id="EmailTextBox" name="EmailTextBox" type="email"></div>
      </div>
      <div class="row mb-3">
        <label for="UserNameTextBox">Username</label>
        <div><input id="UserNameTextBox" name="UserNameTextBox"></div>
      </div>
      <div class="row mb-3">
        <label for="PasswordTextBox">Password</label>
        <div><input id="PasswordTextBox" name="PasswordTextBox" type="password"></div>
      </div>
      <div class="row mb-3">
        <label for="ConfirmPasswordTextBox">Confirm Password</label>
        <div><input id="ConfirmPasswordTextBox" name="ConfirmPasswordTextBox" type="password"></div>
      </div>
      <button type="submit">Create Account</button>
    </form>
  `

  return document.querySelector<HTMLFormElement>('#Register')!
}

function executeRegistrationScript(): void {
  window.eval(registrationScript())
  if (!document.querySelector('#RegistrationFirstName')) {
    document.dispatchEvent(new Event('DOMContentLoaded'))
  }
}

beforeEach(() => {
  sessionStorage.clear()
  renderNativeRegistrationForm()
})

afterEach(() => {
  sessionStorage.clear()
  document.body.replaceChildren()
})

describe('native Power Pages registration profile fields', () => {
  test('ships as a compiled public asset for registration paths with runtime suffixes', () => {
    expect(registrationScript()).toContain("var STORAGE_KEY = 'oiac.registrationProfile.pending.v1'")
    expect(header).toContain("auth_path contains '/account/login/register'")
    expect(header).toContain('<script src="/registration-profile.js?v=3" defer></script>')
  })

  test('inserts First Name and Last Name immediately before Email', () => {
    executeRegistrationScript()

    const firstName = document.querySelector<HTMLInputElement>('#RegistrationFirstName')
    const lastName = document.querySelector<HTMLInputElement>('#RegistrationLastName')
    const formRows = [...document.querySelectorAll<HTMLDivElement>('#Register > .row')]

    expect(firstName).toHaveAttribute('autocomplete', 'given-name')
    expect(firstName).toBeRequired()
    expect(lastName).toHaveAttribute('autocomplete', 'family-name')
    expect(lastName).toBeRequired()
    expect(formRows.map((row) => row.id)).toEqual([
      'registration-first-name-row',
      'registration-last-name-row',
      'email-row',
      '',
      '',
      '',
    ])
  })

  test('prevents submission, reports both missing names, and focuses the first field', () => {
    const form = document.querySelector<HTMLFormElement>('#Register')!
    executeRegistrationScript()
    let submitReached = false
    form.addEventListener('submit', () => {
      submitReached = true
    })

    form.requestSubmit()

    const firstName = document.querySelector<HTMLInputElement>('#RegistrationFirstName')!
    const lastName = document.querySelector<HTMLInputElement>('#RegistrationLastName')!
    expect(submitReached).toBe(false)
    expect(screenText('RegistrationFirstNameError')).toBe('First Name is required.')
    expect(screenText('RegistrationLastNameError')).toBe('Last Name is required.')
    expect(firstName).toHaveAttribute('aria-invalid', 'true')
    expect(lastName).toHaveAttribute('aria-invalid', 'true')
    expect(firstName).toHaveFocus()
    expect(sessionStorage.getItem(storageKey)).toBeNull()
  })

  test('enforces the Dataverse Contact name length before native submission', () => {
    const form = document.querySelector<HTMLFormElement>('#Register')!
    executeRegistrationScript()

    const firstName = document.querySelector<HTMLInputElement>('#RegistrationFirstName')!
    const lastName = document.querySelector<HTMLInputElement>('#RegistrationLastName')!
    expect(firstName).toHaveAttribute('maxlength', '50')
    expect(lastName).toHaveAttribute('maxlength', '50')
    firstName.value = 'A'.repeat(51)
    lastName.value = 'Lovelace'

    const event = new Event('submit', { bubbles: true, cancelable: true })
    form.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(screenText('RegistrationFirstNameError')).toBe('First Name must be 50 characters or fewer.')
    expect(sessionStorage.getItem(storageKey)).toBeNull()
  })

  test('keeps the native submit and stores only trimmed non-sensitive profile data', () => {
    const form = document.querySelector<HTMLFormElement>('#Register')!
    executeRegistrationScript()

    document.querySelector<HTMLInputElement>('#RegistrationFirstName')!.value = '  Ada  '
    document.querySelector<HTMLInputElement>('#RegistrationLastName')!.value = '  Lovelace '
    document.querySelector<HTMLInputElement>('#EmailTextBox')!.value = 'ada@example.org'
    document.querySelector<HTMLInputElement>('#UserNameTextBox')!.value = 'ada.lovelace'
    document.querySelector<HTMLInputElement>('#PasswordTextBox')!.value = 'do-not-store-this'

    const event = new Event('submit', { bubbles: true, cancelable: true })
    form.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    const stored = JSON.parse(sessionStorage.getItem(storageKey)!) as Record<string, unknown>
    expect(Object.keys(stored).sort()).toEqual([
      'createdAt',
      'email',
      'firstName',
      'lastName',
      'username',
      'version',
    ])
    expect(stored).toMatchObject({
      version: 1,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.org',
      username: 'ada.lovelace',
    })
    expect(stored.createdAt).toEqual(expect.any(Number))
    expect(JSON.stringify(stored)).not.toContain('do-not-store-this')
  })

  test('restores an unexpired pending profile after native server validation rerenders', () => {
    sessionStorage.setItem(storageKey, JSON.stringify({
      version: 1,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.org',
      username: 'ada.lovelace',
      createdAt: Date.now(),
    }))

    executeRegistrationScript()

    expect(document.querySelector<HTMLInputElement>('#RegistrationFirstName')).toHaveValue('Ada')
    expect(document.querySelector<HTMLInputElement>('#RegistrationLastName')).toHaveValue('Lovelace')
  })

  test('removes expired pending data instead of restoring it', () => {
    sessionStorage.setItem(storageKey, JSON.stringify({
      version: 1,
      firstName: 'Old',
      lastName: 'Registration',
      email: 'old@example.org',
      username: 'old',
      createdAt: Date.now() - (31 * 60 * 1000),
    }))

    executeRegistrationScript()

    expect(document.querySelector<HTMLInputElement>('#RegistrationFirstName')).toHaveValue('')
    expect(document.querySelector<HTMLInputElement>('#RegistrationLastName')).toHaveValue('')
    expect(sessionStorage.getItem(storageKey)).toBeNull()
  })
})

function screenText(id: string): string | null {
  return document.getElementById(id)?.textContent ?? null
}
