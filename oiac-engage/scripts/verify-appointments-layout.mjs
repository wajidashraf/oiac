import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const outputDirectory = fileURLToPath(new URL('../artifacts/appointments/', import.meta.url))
const viewports = [
  { name: 'desktop', width: 1600, height: 1000, formColumns: 2 },
  { name: 'mobile', width: 390, height: 844, formColumns: 1 },
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
  if (!baseUrl) throw new Error('Vite did not provide a local Appointments URL.')

  browser = await chromium.launch({ headless: true })

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto(new URL('/activity/appointments', baseUrl).toString(), { waitUntil: 'networkidle' })
    await page.locator('.oiac-appointment-card').first().waitFor({ state: 'visible' })
    await page.evaluate(() => document.fonts.ready)

    await page.addStyleTag({
      content: `
        body button, body input, body select, body textarea { background: rgb(13, 110, 253); border: 4px solid rgb(13, 110, 253); color: white; font: 20px/2 Georgia, serif; }
        body li { display: block; background: rgb(255, 0, 0); border-radius: 0; padding: 40px; }
        body h1, body h2 { color: rgb(255, 0, 0); font: 48px/2 Arial, sans-serif; }
      `,
    })

    const listMetrics = await page.evaluate(() => {
      const card = document.querySelector('.oiac-appointment-card')
      const action = document.querySelector('.oiac-appointments-page__new')
      const heading = document.querySelector('.oiac-appointments-page__header h1')
      const cardStyle = getComputedStyle(card)
      const actionStyle = getComputedStyle(action)
      const headingStyle = getComputedStyle(heading)
      return {
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        cardDisplay: cardStyle.display,
        cardBackground: cardStyle.backgroundColor,
        cardRadius: cardStyle.borderRadius,
        cardPadding: cardStyle.padding,
        actionBackground: actionStyle.backgroundColor,
        actionBorderWidth: actionStyle.borderTopWidth,
        actionMinHeight: actionStyle.minHeight,
        headingColor: headingStyle.color,
        headingFamily: headingStyle.fontFamily,
      }
    })

    if (listMetrics.pageOverflow > 1) throw new Error(`${viewport.name}: page overflows by ${listMetrics.pageOverflow}px`)
    if (listMetrics.cardDisplay !== 'flex' || listMetrics.cardBackground !== 'rgb(255, 255, 255)' || listMetrics.cardRadius === '0px') {
      throw new Error(`${viewport.name}: platform list styles won: ${JSON.stringify(listMetrics)}`)
    }
    if (listMetrics.actionBackground !== 'rgb(89, 110, 106)' || listMetrics.actionBorderWidth !== '1px' || Number.parseFloat(listMetrics.actionMinHeight) < 44) {
      throw new Error(`${viewport.name}: platform button styles won: ${JSON.stringify(listMetrics)}`)
    }
    if (listMetrics.headingColor === 'rgb(255, 0, 0)' || listMetrics.headingFamily.startsWith('Arial')) {
      throw new Error(`${viewport.name}: platform heading styles won: ${JSON.stringify(listMetrics)}`)
    }

    await page.screenshot({ path: `${outputDirectory}${viewport.name}-list.png`, fullPage: true })
    await page.getByRole('button', { name: '+ New Appointment' }).click()
    await page.getByRole('form', { name: 'New Appointment' }).waitFor({ state: 'visible' })

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
        throw new Error(`Appointments accessibility violations: ${JSON.stringify(summary)}`)
      }
    }

    const formMetrics = await page.evaluate(() => {
      const form = document.querySelector('.oiac-appointment-form')
      const grid = document.querySelector('.oiac-appointment-form__grid')
      const input = document.querySelector('.oiac-appointment-field input')
      const formStyle = getComputedStyle(form)
      const inputStyle = getComputedStyle(input)
      return {
        formColumns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        formBackground: formStyle.backgroundColor,
        formRadius: formStyle.borderRadius,
        inputBackground: inputStyle.backgroundColor,
        inputBorderWidth: inputStyle.borderTopWidth,
        inputFontSize: inputStyle.fontSize,
      }
    })

    if (formMetrics.formColumns !== viewport.formColumns || formMetrics.pageOverflow > 1) {
      throw new Error(`${viewport.name}: form layout changed: ${JSON.stringify(formMetrics)}`)
    }
    if (formMetrics.formBackground !== 'rgb(255, 255, 255)' || formMetrics.formRadius === '0px' || formMetrics.inputBackground !== 'rgb(255, 255, 255)' || formMetrics.inputBorderWidth !== '1px') {
      throw new Error(`${viewport.name}: platform form styles won: ${JSON.stringify(formMetrics)}`)
    }

    await page.screenshot({ path: `${outputDirectory}${viewport.name}-form.png`, fullPage: true })
    console.log(`${viewport.name} Appointments list: ${JSON.stringify(listMetrics)}`)
    console.log(`${viewport.name} Appointments form: ${JSON.stringify(formMetrics)}`)
    await context.close()
  }
} finally {
  await browser?.close()
  await server.close()
}
