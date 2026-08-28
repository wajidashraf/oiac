import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const outputDirectory = fileURLToPath(new URL('../artifacts/events/', import.meta.url))
const viewports = [
  { name: 'desktop', width: 1600, height: 1000, columns: 2 },
  { name: 'mobile', width: 390, height: 844, columns: 1 },
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
  if (!baseUrl) throw new Error('Vite did not provide a local Events URL.')

  browser = await chromium.launch({ headless: true })

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto(new URL('/activity/events', baseUrl).toString(), { waitUntil: 'networkidle' })
    await page.locator('.oiac-event-card').first().waitFor({ state: 'visible' })
    await page.evaluate(() => document.fonts.ready)

    if (viewport.name === 'desktop') {
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      if (accessibility.violations.length > 0) {
        const summary = accessibility.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          targets: violation.nodes.flatMap((node) => node.target),
        }))
        throw new Error(`Events accessibility violations: ${JSON.stringify(summary)}`)
      }
    }

    await page.addStyleTag({
      content: `
        body button { background: rgb(13, 110, 253); border: 3px solid rgb(13, 110, 253); color: white; font: 20px/2 Georgia, serif; }
        body article { background: rgb(255, 0, 0); border-radius: 0; }
        body h1 { color: rgb(255, 0, 0); font: 48px/2 Arial, sans-serif; }
      `,
    })

    const listMetrics = await page.evaluate(() => {
      const grid = document.querySelector('.oiac-events-page__grid')
      const card = document.querySelector('.oiac-event-card')
      const filter = document.querySelector('.oiac-events-page__filters button[aria-pressed="true"]')
      const listButton = document.querySelector('.oiac-events-page__view-toggle button[aria-pressed="true"]')
      const action = document.querySelector('.oiac-event-card__actions button')
      const heading = document.querySelector('.oiac-events-page__header h1')
      const gridStyle = getComputedStyle(grid)
      const cardStyle = getComputedStyle(card)
      const filterStyle = getComputedStyle(filter)
      const listStyle = getComputedStyle(listButton)
      const actionStyle = getComputedStyle(action)
      const headingStyle = getComputedStyle(heading)

      return {
        columns: gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        cardBackground: cardStyle.backgroundColor,
        cardRadius: cardStyle.borderRadius,
        filterBackground: filterStyle.backgroundColor,
        listBackground: listStyle.backgroundColor,
        actionBackground: actionStyle.backgroundColor,
        actionBorderWidth: actionStyle.borderTopWidth,
        actionFontSize: actionStyle.fontSize,
        actionLineHeight: actionStyle.lineHeight,
        actionMinHeight: actionStyle.minHeight,
        headingColor: headingStyle.color,
        headingFamily: headingStyle.fontFamily,
      }
    })

    if (listMetrics.columns !== viewport.columns) {
      throw new Error(`${viewport.name}: expected ${viewport.columns} event columns, received ${listMetrics.columns}`)
    }
    if (listMetrics.pageOverflow > 1) {
      throw new Error(`${viewport.name}: Events list overflows horizontally by ${listMetrics.pageOverflow}px`)
    }
    if (listMetrics.cardBackground !== 'rgb(255, 255, 255)' || listMetrics.cardRadius === '0px') {
      throw new Error(`${viewport.name}: platform card styles won: ${JSON.stringify(listMetrics)}`)
    }
    if (listMetrics.filterBackground !== 'rgb(243, 246, 245)' || listMetrics.listBackground !== 'rgb(238, 242, 241)') {
      throw new Error(`${viewport.name}: selected control styles were overwritten: ${JSON.stringify(listMetrics)}`)
    }
    if (listMetrics.actionBackground !== 'rgb(255, 255, 255)' || listMetrics.actionBorderWidth !== '1px') {
      throw new Error(`${viewport.name}: platform button chrome won: ${JSON.stringify(listMetrics)}`)
    }
    if (Number.parseFloat(listMetrics.actionMinHeight) < 44 || listMetrics.actionLineHeight === '40px') {
      throw new Error(`${viewport.name}: action sizing or line height was overwritten: ${JSON.stringify(listMetrics)}`)
    }
    if (listMetrics.headingColor === 'rgb(255, 0, 0)' || listMetrics.headingFamily.startsWith('Arial')) {
      throw new Error(`${viewport.name}: platform heading styles won: ${JSON.stringify(listMetrics)}`)
    }

    await page.screenshot({ path: `${outputDirectory}${viewport.name}-list.png`, fullPage: true })
    await page.getByRole('button', { name: 'Calendar', exact: true }).click()
    await page.getByRole('grid', { name: 'Events September 2026 calendar' }).waitFor({ state: 'visible' })

    const calendarMetrics = await page.evaluate(() => {
      const grid = document.querySelector('.oiac-calendar__grid')
      const panel = document.querySelector('.oiac-calendar__panel')
      const scrollRegion = document.querySelector('.oiac-month-calendar')
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
        panelHeight: panel.getBoundingClientRect().height,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        scrollOverflow: scrollRegion.scrollWidth - scrollRegion.clientWidth,
      }
    })

    if (calendarMetrics.columns !== 7 || Math.abs(calendarMetrics.panelHeight - 490) > 1) {
      throw new Error(`${viewport.name}: shared calendar dimensions changed: ${JSON.stringify(calendarMetrics)}`)
    }
    if (calendarMetrics.pageOverflow > 1) {
      throw new Error(`${viewport.name}: Events calendar overflows the page by ${calendarMetrics.pageOverflow}px`)
    }
    if (viewport.name === 'mobile' && calendarMetrics.scrollOverflow < 300) {
      throw new Error(`mobile: expected local calendar scrolling, received ${calendarMetrics.scrollOverflow}px`)
    }

    await page.screenshot({ path: `${outputDirectory}${viewport.name}-calendar.png`, fullPage: true })
    console.log(`${viewport.name} Events list: ${JSON.stringify(listMetrics)}`)
    console.log(`${viewport.name} Events calendar: ${JSON.stringify(calendarMetrics)}`)
    await context.close()
  }
} finally {
  await browser?.close()
  await server.close()
}
