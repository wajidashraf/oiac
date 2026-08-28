import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const outputDirectory = fileURLToPath(new URL('../artifacts/activity-review/', import.meta.url))
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 820, height: 1100 },
  { name: 'mobile', width: 390, height: 844 },
]

mkdirSync(outputDirectory, { recursive: true })
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } })
await server.listen()
const baseUrl = server.resolvedUrls?.local[0]
if (!baseUrl) throw new Error('Vite did not provide a local URL.')

const browser = await chromium.launch({ headless: true })
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport })
    await page.addInitScript(() => {
      window.Microsoft = { Dynamic365: { Portal: { User: {
        userName: 'volunteer@oiac.org', firstName: 'Volunteer', lastName: '', contactId: 'review-contact',
      } } } }
    })
    await page.goto(new URL('/activity/activity-log', baseUrl).toString(), { waitUntil: 'networkidle' })
    await page.screenshot({ path: `${outputDirectory}${viewport.name}-list.png`, fullPage: true })
    await page.getByRole('button', { name: '+ Submit Activity' }).click()
    await page.screenshot({ path: `${outputDirectory}${viewport.name}-form.png`, fullPage: true })

    const overflowReport = await page.evaluate(() => {
      const tableScroll = document.querySelector('.activity-log-table-scroll')
      window.scrollTo(10000, 0)
      return {
        windowScrollX: window.scrollX,
        tableClientWidth: tableScroll?.clientWidth ?? 0,
        tableScrollWidth: tableScroll?.scrollWidth ?? 0,
      }
    })
    if (overflowReport.windowScrollX !== 0) throw new Error(`${viewport.name} permits ${overflowReport.windowScrollX}px page-level horizontal scrolling.`)
    if (viewport.width < 928 && overflowReport.tableScrollWidth <= overflowReport.tableClientWidth) {
      throw new Error(`${viewport.name} table does not retain local horizontal scrolling.`)
    }
    console.log(`Captured ${viewport.name}; page scroll ${overflowReport.windowScrollX}px; table ${overflowReport.tableClientWidth}/${overflowReport.tableScrollWidth}px`)
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
