import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const outputDirectory = fileURLToPath(new URL('../artifacts/auth-guard/', import.meta.url))
const server = await createServer({
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})

let browser

try {
  mkdirSync(outputDirectory, { recursive: true })
  await server.listen()
  const baseUrl = server.resolvedUrls?.local[0]
  if (!baseUrl) throw new Error('Vite did not provide a local auth-guard URL.')

  browser = await chromium.launch({ headless: true })

  const anonymousContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const anonymousPage = await anonymousContext.newPage()
  for (const route of ['/', '/report', '/my-calendar', '/activity/appointments', '/resources']) {
    await anonymousPage.goto(new URL(route, baseUrl).toString(), { waitUntil: 'networkidle' })
    await anonymousPage.locator('.anonymous-hero').waitFor({ state: 'visible' })
    if (await anonymousPage.locator('.site-header, .portal-nav__links').count()) {
      throw new Error(`Anonymous route ${route} exposed the authenticated shell.`)
    }
  }
  await anonymousPage.screenshot({ path: `${outputDirectory}anonymous.png`, fullPage: true })
  await anonymousContext.close()

  const authenticatedContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await authenticatedContext.addInitScript(() => {
    window.Microsoft = {
      Dynamic365: {
        Portal: {
          User: {
            userName: 'staff@oiac.org',
            firstName: 'OIAC',
            lastName: 'Staff',
            contactId: '00000000-0000-0000-0000-000000000001',
            userRoles: ['Authenticated Users', 'Staff'],
          },
        },
      },
    }
  })
  const authenticatedPage = await authenticatedContext.newPage()
  await authenticatedPage.goto(new URL('/activity/appointments', baseUrl).toString(), { waitUntil: 'networkidle' })
  await authenticatedPage.getByRole('heading', { name: 'Appointments', level: 1 }).waitFor({ state: 'visible' })
  await authenticatedPage.getByRole('navigation', { name: 'Primary navigation' }).waitFor({ state: 'visible' })
  await authenticatedPage.getByRole('group', { name: 'Account' }).getByText('Staff').waitFor({ state: 'visible' })
  if (await authenticatedPage.locator('.anonymous-hero').count()) {
    throw new Error('Authenticated route rendered the anonymous welcome experience.')
  }
  await authenticatedPage.screenshot({ path: `${outputDirectory}authenticated.png`, fullPage: true })
  await authenticatedContext.close()

  console.log('Anonymous routes are restricted to the welcome experience.')
  console.log('Authenticated Power Pages users can access protected routes with their web-role label.')
} finally {
  await browser?.close()
  await server.close()
}
