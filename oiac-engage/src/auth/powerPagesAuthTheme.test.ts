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

test('native authentication shell loads its stylesheet without visible header or footer markup', () => {
  expect(header.trim()).toBe('<link rel="stylesheet" href="/auth.css?v=1">')
  expect(header).not.toContain('<header')
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

test('native account pages use a 42rem shell and a 500px form', () => {
  expect(authCss).toContain('--auth-shell-width: 42rem')
  expect(authCss).toContain('--auth-form-width: 31.25rem')
  expect(authCss).toMatch(/#content-container\.container\.wrapper-body[\s\S]*?max-width:\s*var\(--auth-shell-width\)\s*!important/)
  expect(authCss).toMatch(/\.portal-form[\s\S]*?max-width:\s*var\(--auth-form-width\)\s*!important/)
  expect(authCss).toMatch(/\.form-horizontal[\s\S]*?max-width:\s*var\(--auth-form-width\)\s*!important/)
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
