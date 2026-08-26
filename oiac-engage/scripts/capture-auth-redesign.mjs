import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
]

const outputDirectory = fileURLToPath(new URL('../artifacts/auth-redesign/', import.meta.url))

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

try {
  mkdirSync(outputDirectory, { recursive: true })
  await server.listen()
  const baseUrl = server.resolvedUrls?.local[0]
  if (!baseUrl) throw new Error('Vite did not provide a local capture URL.')

  browser = await launchBrowser()

  for (const viewport of viewports) {
    let context
    let page

    try {
      context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      })
      page = await context.newPage()
      await page.goto(new URL('/', baseUrl).toString(), { waitUntil: 'networkidle' })
      await page.locator('.anonymous-hero').waitFor({ state: 'visible' })
      await page.evaluate(() => document.fonts.ready)
      await page.evaluate(() => new Promise((resolveImage, rejectImage) => {
        const image = new Image()
        image.addEventListener('load', resolveImage, { once: true })
        image.addEventListener('error', rejectImage, { once: true })
        image.src = '/MainHomeImage.jpg'
      }))

      const outputPath = `${outputDirectory}${viewport.name}.png`
      await page.screenshot({ path: outputPath, fullPage: true })
      console.log(`Captured ${viewport.name}: ${outputPath}`)
    } finally {
      await page?.close()
      await context?.close()
    }
  }
} finally {
  await browser?.close()
  await server.close()
}
