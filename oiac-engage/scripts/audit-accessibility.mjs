import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const routes = [
  '/',
  '/my-reports',
  '/my-calendar',
  '/contact',
  '/activity/activity-log',
  '/activity/events',
  '/activity/appointments',
  '/press-coverage',
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

  for (const route of routes) {
    const page = await context.newPage()
    const url = new URL(route, baseUrl).toString()
    await page.goto(url, { waitUntil: 'networkidle' })

    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    results.push({
      route,
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
