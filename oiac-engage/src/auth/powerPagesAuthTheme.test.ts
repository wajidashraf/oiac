/// <reference types="vite/client" />

import { expect, test } from 'vitest'
import footer from '../../.powerpages-site/web-templates/footer/Footer.webtemplate.source.html?raw'
import header from '../../.powerpages-site/web-templates/header/Header.webtemplate.source.html?raw'
import css from '../../.powerpages-site/web-files/theme.css/theme.css?raw'

test('native auth templates use the OIAC anonymous shell', () => {
  expect(header).toContain('class="auth-site-header"')
  expect(header).toContain('src="/logo.png"')
  expect(header).toContain('href="/SignIn?returnUrl=%2F"')
  expect(footer).toContain('class="auth-site-footer"')
  expect(footer).toContain('href="/resources"')
  expect(footer).toContain('href="/contact"')
})

test('native account styling is scoped and responsive', () => {
  expect(css).toContain('body:has(.nav-account)')
  expect(css).toContain('body:has(.forgot-password)')
  expect(css).toContain('.auth-site-header')
  expect(css).toContain('.auth-site-footer')
  expect(css).toContain('@media (max-width: 720px)')
})
