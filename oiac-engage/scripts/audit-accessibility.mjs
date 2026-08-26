import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const scenarios = [
  { name: 'anonymous-home', route: '/', authenticated: false },
  { name: 'member-home', route: '/', authenticated: true },
  { name: 'my-reports', route: '/my-reports', authenticated: true },
  { name: 'my-calendar', route: '/my-calendar', authenticated: true },
  { name: 'contact', route: '/contact', authenticated: true },
  { name: 'activity-log', route: '/activity/activity-log', authenticated: true },
  { name: 'events', route: '/activity/events', authenticated: true },
  { name: 'appointments', route: '/activity/appointments', authenticated: true },
  { name: 'press-coverage', route: '/press-coverage', authenticated: true },
  { name: 'resources', route: '/resources', authenticated: true },
]

async function launchBrowser() {
  const attempts = [
    { label: 'Playwright Chromium', options: {} },
    { label: 'Microsoft Edge', options: { channel: 'msedge' } },
    { label: 'Google Chrome', options: { channel: 'chrome' } },
  ]

  const failures = []
  for (const attempt of attempts) {
    try {
      return await chromium.launch({ headless: true, ...attempt.options })
    } catch (error) {
      failures.push(`${attempt.label}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
    }
  }

  throw new Error(`No supported browser could be launched. Run "npx playwright install chromium" or install Edge/Chrome.\n${failures.join('\n')}`)
}

const server = await createServer({
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})

let browser
let context

try {
  await server.listen()
  const baseUrl = server.resolvedUrls?.local[0]
  if (!baseUrl) throw new Error('Vite did not provide a local audit URL.')

  browser = await launchBrowser()
  context = await browser.newContext()
  const results = []

  for (const scenario of scenarios) {
    const page = await context.newPage()
    if (scenario.authenticated) {
      await page.addInitScript(() => {
        window.Microsoft = {
          Dynamic365: {
            Portal: {
              User: {
                userName: 'audit.member@oiac.org',
                firstName: 'Audit',
                lastName: 'Member',
                contactId: 'audit-contact',
              },
            },
          },
        }
      })
    }

    const url = new URL(scenario.route, baseUrl).toString()
    await page.goto(url, { waitUntil: 'networkidle' })

    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    results.push({
      name: scenario.name,
      route: scenario.route,
      authenticated: scenario.authenticated,
      violations: audit.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        targets: violation.nodes.flatMap((node) => node.target),
      })),
      passes: audit.passes.length,
      incomplete: audit.incomplete.map((check) => ({
        id: check.id,
        impact: check.impact,
        description: check.description,
        targets: check.nodes.flatMap((node) => node.target),
      })),
    })
    await page.close()
  }

  console.log(JSON.stringify(results, null, 2))

  const violationCount = results.reduce((total, result) => total + result.violations.length, 0)
  if (violationCount > 0) {
    throw new Error(`Accessibility audit found ${violationCount} violation${violationCount === 1 ? '' : 's'}.`)
  }
} finally {
  await context?.close()
  await browser?.close()
  await server.close()
}
