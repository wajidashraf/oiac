/// <reference types="vite/client" />

import { expect, test } from 'vitest'
import authCss from '../../.powerpages-site/web-files/auth.css/auth.css?raw'
import authMetadata from '../../.powerpages-site/web-files/auth.css/auth.css.webfile.yml?raw'
import bootstrap from '../../.powerpages-site/web-files/bootstrap.min.css/bootstrap.min.css?raw'
import footer from '../../.powerpages-site/web-templates/oiac-auth-footer/OIAC-Auth-Footer.webtemplate.source.html?raw'
import header from '../../.powerpages-site/web-templates/oiac-auth-header/OIAC-Auth-Header.webtemplate.source.html?raw'
import codeSiteFooter from '../../.powerpages-site/web-templates/footer/Footer.webtemplate.source.html?raw'
import codeSiteHeader from '../../.powerpages-site/web-templates/header/Header.webtemplate.source.html?raw'
import website from '../../.powerpages-site/website.yml?raw'

test('native authentication shell renders a route-aware branded header while its form stylesheet stays disabled', () => {
  const activeHeader = header.replace(/<!--[\s\S]*?-->/g, '').trim()

  expect(header).toContain('<!-- <link rel="stylesheet" href="/auth.css?v=3"> -->')
  expect(activeHeader).not.toContain('<link')
  expect(header).toContain('request.path | downcase')
  expect(header).toContain("auth_path == '/signin'")
  expect(header).toContain("auth_path == '/register'")
  expect(header).toContain("auth_path contains '/account/login'")
  expect(header).toContain('class="auth-site-header"')
  expect(header).toContain('class="auth-site-header__inner"')
  expect(header).toContain('class="auth-site-brand" href="/"')
  expect(header).toContain('src="/logo.png"')
  expect(header).toContain('class="auth-site-button" href="#ContentContainer_MainContent_MainContent_LocalLogin"')
  expect(header).toContain('class="auth-site-button" href="/SignIn?returnUrl=%2F"')
  expect(header).toContain('@media (max-width: 720px)')
  expect(header).toContain('.auth-site-brand:focus-visible')
  expect(footer.trim()).toBe('')
  expect(website).toContain('headerwebtemplateid: 1a8d7f5c-7e6b-4a4f-b9d5-2f3c6a1e8b70')
  expect(website).toContain('footerwebtemplateid: 5c3e9a12-4b7d-4f8a-a6c1-9e2d7b5f3048')
  expect(codeSiteHeader.trim()).toBe('<div/>')
  expect(codeSiteFooter.trim()).toBe('<div/>')
})

test('dedicated native authentication web file is deployable after Bootstrap', () => {
  expect(authMetadata).toContain('displayorder: 3')
  expect(authMetadata).toContain('filename: auth.css')
  expect(authMetadata).toContain('mimetype: text/css')
  expect(authMetadata).toContain('partialurl: auth.css')
  expect(bootstrap).not.toContain('OIAC native authentication')
  expect(bootstrap).not.toContain('--auth-shell-width')
})

test('native account stylesheet scopes the responsive reference layout', () => {
  expect(authCss).toContain('body:has(.nav-account)')
  expect(authCss).toContain('body:has(.forgot-password)')
  expect(authCss).toContain('@media (max-width: 720px)')
  expect(authCss).toContain('grid-template-columns: 7rem minmax(0, 1fr)')
})

test('native account tabs stay 45px tall without vertical scrolling', () => {
  document.body.innerHTML = `
    <ul class="nav nav-tabs nav-account">
      <li class="nav-item"><a class="nav-link active">Sign in</a></li>
      <li class="nav-item"><a class="nav-link">Redeem invitation</a></li>
    </ul>
  `

  const style = document.createElement('style')
  style.textContent = authCss
  document.head.append(style)

  const accountTabs = document.querySelector<HTMLElement>('.nav-account')
  expect(accountTabs).not.toBeNull()
  expect(getComputedStyle(accountTabs!).height).toBe('45px')
  expect(getComputedStyle(accountTabs!).overflowY).toBe('hidden')

  style.remove()
  document.body.replaceChildren()
})

test('native account pages use a 42rem shell and a 500px form', () => {
  expect(authCss).toContain('--auth-shell-width: 42rem')
  expect(authCss).toContain('--auth-form-width: 31.25rem')
  expect(authCss).toMatch(/#content-container\.container\.wrapper-body[\s\S]*?max-width:\s*var\(--auth-shell-width\)\s*!important/)
  expect(authCss).toMatch(/\.portal-form[\s\S]*?max-width:\s*var\(--auth-form-width\)\s*!important/)
  expect(authCss).toMatch(/\.form-horizontal[\s\S]*?max-width:\s*var\(--auth-form-width\)\s*!important/)
})

test('native Register page uses the same full-width 500px form grid as Sign in', () => {
  const secureRegister = String.raw`\[id\$="_SecureRegister"\]`
  expect(authCss).not.toContain('#SecureRegister')
  expect(authCss).toMatch(new RegExp(`${secureRegister}\\s*>\\s*\\.row[\\s\\S]*?width:\\s*100%\\s*!important`))
  expect(authCss).toMatch(new RegExp(`${secureRegister}\\s*>\\s*\\.row\\s*>\\s*\\[class\\*="col-"\\]:has\\(\\.portal-form\\)[\\s\\S]*?flex:\\s*0 0 100%\\s*!important`))
  expect(authCss).toMatch(new RegExp(`${secureRegister}\\s+\\.portal-form\\s+\\.row\\.mb-3[\\s\\S]*?grid-template-columns:\\s*7rem minmax\\(0, 1fr\\)\\s*!important`))
  expect(authCss).toMatch(new RegExp(`@media \\(max-width: 720px\\)[\\s\\S]*?${secureRegister}\\s+\\.portal-form\\s+\\.row\\.mb-3[\\s\\S]*?grid-template-columns:\\s*1fr\\s*!important`))
})

test('protects native auth layout invariants from later Power Pages and Bootstrap rules', () => {
  expect(authCss).toMatch(/#content-container\.container\.wrapper-body[\s\S]*?width:\s*calc\(100% - 2rem\)\s*!important/)
  expect(authCss).toMatch(/#content-container\.container\.wrapper-body[\s\S]*?margin:\s*0 auto\s*!important/)
  expect(authCss).toMatch(/#content-container\.container\.wrapper-body[\s\S]*?float:\s*none\s*!important/)
  expect(authCss).toMatch(/\.page-content\s*>\s*\.row\s*>\s*\[class\*="col-"\][\s\S]*?width:\s*100%\s*!important/)
})

test('stylesheet does not introduce open registration or demo-role UI', () => {
  expect(`${header}\n${authCss}`).not.toMatch(/>\s*Register\s*</i)
  expect(`${header}\n${authCss}`).not.toContain('Demo: sign in as')
  expect(`${header}\n${authCss}`).not.toContain('Portal Administrator')
})
