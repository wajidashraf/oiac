import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const outputDirectory = fileURLToPath(new URL('../artifacts/calendar/', import.meta.url))
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
]

const server = await createServer({
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})

let browser

try {
  mkdirSync(outputDirectory, { recursive: true })
  await server.listen()
  const baseUrl = server.resolvedUrls?.local[0]
  if (!baseUrl) throw new Error('Vite did not provide a local calendar URL.')

  browser = await chromium.launch({ headless: true })

  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport })
    await page.goto(new URL('/my-calendar', baseUrl).toString(), { waitUntil: 'networkidle' })
    await page.locator('.oiac-calendar__panel').waitFor({ state: 'visible' })
    await page.evaluate(() => document.fonts.ready)

    const metrics = await page.evaluate(() => {
      const panel = document.querySelector('.oiac-calendar__panel')
      const grid = document.querySelector('.oiac-calendar__grid')
      const scrollRegion = document.querySelector('.oiac-calendar__scroll')
      const monthButton = document.querySelector('.oiac-calendar__month-button')
      const gridStyle = getComputedStyle(grid)
      const buttonStyle = getComputedStyle(monthButton)
      return {
        panelHeight: panel.getBoundingClientRect().height,
        gridColumns: gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        scrollOverflow: scrollRegion.scrollWidth - scrollRegion.clientWidth,
        buttonBackground: buttonStyle.backgroundColor,
        buttonBorderStyle: buttonStyle.borderStyle,
      }
    })

    await page.screenshot({ path: `${outputDirectory}${viewport.name}.png`, fullPage: true })

    if (Math.abs(metrics.panelHeight - 490) > 1) {
      throw new Error(`${viewport.name}: expected a 490px panel, received ${metrics.panelHeight}px`)
    }
    if (metrics.gridColumns !== 7) {
      throw new Error(`${viewport.name}: expected seven calendar columns, received ${metrics.gridColumns}`)
    }
    if (metrics.pageOverflow > 1) {
      throw new Error(`${viewport.name}: page overflows horizontally by ${metrics.pageOverflow}px`)
    }
    if (viewport.name === 'mobile' && metrics.scrollOverflow < 300) {
      throw new Error(`mobile: expected the labeled calendar region to scroll, received ${metrics.scrollOverflow}px overflow`)
    }
    if (metrics.buttonBackground !== 'rgba(0, 0, 0, 0)' || metrics.buttonBorderStyle !== 'none') {
      throw new Error(`${viewport.name}: calendar navigation retained platform button chrome: ${JSON.stringify(metrics)}`)
    }

    console.log(`${viewport.name} calendar layout: ${JSON.stringify(metrics)}`)
    await page.close()
  }
} finally {
  await browser?.close()
  await server.close()
}
