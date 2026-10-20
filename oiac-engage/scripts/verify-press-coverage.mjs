import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'
import { createServer } from 'vite'

// Local UI fixtures only. This does not establish Dataverse permissions or
// exercise the deployed ServerLogic runtime; those require signed-in UAT users.
const owner = '11111111-1111-4111-8111-111111111111'
const record = {
  mss_presscoverageid: '22222222-2222-4222-8222-222222222222',
  mss_headlinetitle: 'Community advocacy interview', mss_mediaoutlet: 'Public Radio',
  mss_datepublishedaired: '2026-10-15', mss_coveragetype: 866530001,
  mss_tone: 866530000, mss_coveragelevel: 866530000,
  _mss_submittedby_value: owner, mss_isfeatured: false,
}
const featured = {
  mss_presscoverageid: '33333333-3333-4333-8333-333333333333', mss_isfeatured: true,
  mss_headline: 'Featured advocacy article', mss_publication: 'Daily Journal',
  mss_publicationdate: '2026-10-14', mss_shortsummary: 'Community advocacy in the news.',
  mss_originalarticlelink: 'https://example.org/article', mss_coveragefile_name: 'logo.png',
}
const output = new URL('../artifacts/press-coverage-ui/', import.meta.url)
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } })
let browser
try {
  await server.listen()
  const base = server.resolvedUrls.local[0]
  try { browser = await chromium.launch({ headless: true }) }
  catch { browser = await chromium.launch({ headless: true, channel: 'msedge' }) }
  const context = await browser.newContext()
  await context.addInitScript((contactId) => {
    window.Microsoft = { Dynamic365: { Portal: { User: {
      userName: 'coverage.test@example.org', firstName: 'Coverage', lastName: 'Test',
      contactId, userRoles: ['Volunteer'],
    } } } }
  }, owner)
  await context.route('**/_layout/tokenhtml', (route) => route.fulfill({ contentType: 'text/html', body: '<input name="__RequestVerificationToken" value="local-test-token">' }))
  await context.route('**/_api/**', (route) => {
    const url = new URL(route.request().url())
    const payload = url.pathname === '/_api/serverlogics/press-coverage'
      ? { success: true, data: JSON.stringify({ ok: true, records: [featured, record], nextLink: null }) }
      : { value: [] }
    return route.fulfill({ json: payload })
  })
  const page = await context.newPage()
  await page.goto(new URL('/resources', base).href)
  await page.getByRole('link', { name: 'Press Coverage', exact: true }).click()
  await page.getByRole('button', { name: '+ Add Coverage' }).click()
  await page.getByRole('button', { name: /Press Coverage Log complete media/ }).click()
  await page.getByLabel('Headline / Title', { exact: true }).fill('Preserve this draft')
  const index = await page.evaluate(() => history.state.idx)
  const dialog = page.waitForEvent('dialog', { timeout: 5000 })
  await page.evaluate(() => history.back())
  await (await dialog).dismiss()
  await page.waitForFunction((idx) => location.pathname === '/press-coverage' && history.state.idx === idx, index)
  assert.equal(await page.getByLabel('Headline / Title', { exact: true }).inputValue(), 'Preserve this draft')
  assert.equal(await page.getByRole('heading', { name: 'Press Coverage', exact: true }).count(), 1)
  const accepted = page.waitForEvent('dialog')
  await page.evaluate(() => history.back())
  await (await accepted).accept()
  await page.waitForURL('**/resources')
  // The guard is inactive outside this module, including forward navigation.
  await page.evaluate(() => history.forward())
  await page.waitForURL('**/press-coverage')
  await page.getByRole('button', { name: '+ Add Coverage' }).waitFor()
  await page.getByRole('button', { name: '+ Add Coverage' }).click()
  await page.getByRole('button', { name: /Press Coverage Log complete media/ }).click()
  await page.getByLabel('Headline / Title', { exact: true }).fill('Save before leaving')
  await page.getByLabel('Media Outlet', { exact: true }).fill('Public Radio')
  await page.getByLabel('Date Published / Aired', { exact: true }).fill('2026-10-16')
  let finishSave
  const pendingSave = new Promise((resolve) => { finishSave = resolve })
  await page.route('**/_api/serverlogics/press-coverage', async (route) => {
    await pendingSave
    await route.fulfill({ json: { success: true, data: JSON.stringify({ ok: true, id: record.mss_presscoverageid }) } })
  })
  await page.getByRole('button', { name: 'Save Press Coverage', exact: true }).click()
  await page.getByRole('button', { name: 'Saving…', exact: true }).waitFor()
  await page.getByRole('link', { name: 'Resources', exact: true }).click()
  await page.getByText('Coverage is still saving. Wait until it finishes before leaving this page.').waitFor()
  await page.evaluate(() => history.back())
  await page.waitForFunction((idx) => location.pathname === '/press-coverage' && history.state.idx === idx, index)
  assert.equal(await page.getByLabel('Headline / Title', { exact: true }).inputValue(), 'Save before leaving')
  finishSave()
  await page.getByText('Press coverage saved.', { exact: true }).waitFor()
  await page.getByRole('link', { name: 'Resources', exact: true }).click()
  await page.waitForURL('**/resources')
  await page.close()
  console.log('Browser Back: declined navigation preserves draft; accepted navigation and Forward work.')
  console.log('Pending save: links and browser Back are blocked until the save finishes.')

  await mkdir(output, { recursive: true })
  let audits = 0
  for (const [name, width] of [['desktop', 1440], ['tablet', 820], ['mobile', 390]]) {
    const view = await context.newPage()
    await view.setViewportSize({ width, height: 1000 })
    await view.goto(new URL('/press-coverage', base).href)
    await view.getByRole('button', { name: '+ Add Coverage' }).click()
    for (const state of ['selector', 'press', 'featured']) {
      if (state === 'press') await view.getByRole('button', { name: /Press Coverage Log complete media/ }).click()
      if (state === 'featured') {
        await view.getByRole('button', { name: 'Change type' }).click()
        await view.getByRole('button', { name: /Featured Coverage Create a highlighted record/ }).click()
      }
      const audit = await new AxeBuilder({ page: view }).include('.page--press-coverage')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      assert.deepEqual(audit.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })), [], `${name}/${state} accessibility`)
      assert.equal(await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}/${state} page overflow`)
      await view.screenshot({ path: fileURLToPath(new URL(`${name}-${state}.png`, output)), fullPage: true })
      audits++
    }
    await view.close()
  }
  await context.close()
  console.log(`${audits} scoped accessibility and responsive checks passed; screenshots saved in artifacts/press-coverage-ui.`)
} finally {
  await browser?.close()
  await server.close()
}
