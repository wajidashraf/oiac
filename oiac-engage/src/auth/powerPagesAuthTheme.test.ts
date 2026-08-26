/// <reference types="vite/client" />

import { expect, test } from 'vitest'
import css from '../../.powerpages-site/web-files/theme.css/theme.css?raw'
import footer from '../../.powerpages-site/web-templates/oiac-auth-footer/OIAC-Auth-Footer.webtemplate.source.html?raw'
import header from '../../.powerpages-site/web-templates/oiac-auth-header/OIAC-Auth-Header.webtemplate.source.html?raw'
import codeSiteFooter from '../../.powerpages-site/web-templates/footer/Footer.webtemplate.source.html?raw'
import codeSiteHeader from '../../.powerpages-site/web-templates/header/Header.webtemplate.source.html?raw'
import website from '../../.powerpages-site/website.yml?raw'

test('native auth templates use the OIAC anonymous shell', () => {
  expect(header).toContain('class="auth-site-header"')
  expect(header).toContain('src="/logo.png"')
  expect(header).toContain('href="/SignIn?returnUrl=%2F"')
  expect(footer).toContain('class="auth-site-footer"')
  expect(footer).toContain('href="/resources"')
  expect(footer).toContain('href="/contact"')
  expect(header).toContain("request.path | downcase")
  expect(footer).toContain("request.path | downcase")
  expect(website).toContain('headerwebtemplateid: 1a8d7f5c-7e6b-4a4f-b9d5-2f3c6a1e8b70')
  expect(website).toContain('footerwebtemplateid: 5c3e9a12-4b7d-4f8a-a6c1-9e2d7b5f3048')
  expect(codeSiteHeader.trim()).toBe('<div/>')
  expect(codeSiteFooter.trim()).toBe('<div/>')
})

test('native account styling is scoped and responsive', () => {
  expect(css).toContain('body:has(.nav-account)')
  expect(css).toContain('body:has(.forgot-password)')
  expect(css).toContain('.auth-site-header')
  expect(css).toContain('.auth-site-footer')
  expect(css).toContain('@media (max-width: 720px)')
})
