import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { runInNewContext } from 'node:vm'

// Local UI fixtures only. No requests leave this Vite origin, and this script
// does not prove hosted saves, account permissions, or Dataverse persistence.
const output = new URL('../artifacts/module-corrections-ui/', import.meta.url)
const actor = { id: '11111111-1111-4111-8111-111111111111', name: 'Alex Volunteer' }
const contact = { id: '22222222-2222-4222-8222-222222222222', name: 'Morgan Representative' }
const longContact = { ...contact, name: 'Morgan Representative with a long organizational contact name '.repeat(4) }
const record = (number, extra = {}) => ({
  id: `33333333-3333-4333-8333-${String(number).padStart(12, '0')}`,
  title: 'Community policy discussion', status: 866530000, statusLabel: 'Pending', meetingFormat: 1, meetingFormatLabel: 'Microsoft Teams',
  preferredDateTime: '2026-10-20T14:00:00Z', suggestedDateTime: null, agenda: 'Discuss community priorities.', meetingLink: null,
  reschedulingReason: '', requester: contact, recipient: actor, rowVersion: '123456', ...extra,
})
const records = [record(1), record(2, { title: 'Long appointment title '.repeat(35), agenda: 'A long agenda that stays on one line without covering the response buttons or extending the card.', requester: longContact }),
  record(3, { title: 'Proposed policy review', status: 866530003, statusLabel: 'Rescheduled', suggestedDateTime: '2026-10-21T15:30:00Z', reschedulingReason: 'Committee meeting overlaps the original time.' }),
  record(4, { title: 'Accepted advocacy briefing', status: 866530001, statusLabel: 'Accepted', requester: actor, recipient: contact, meetingLink: 'https://example.org/meeting' })]
const envelope = (body) => ({ success: true, data: JSON.stringify({ ok: true, ...body }) })
const proxySource = await readFile(new URL('../.powerpages-site/server-logic/appointments/appointments.js', import.meta.url), 'utf8')
const results = { fixtureOnly: true, measurements: [], audits: [], screenshots: [] }
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } })
let browser
async function audit(page, scope, label) {
  const findings = await new AxeBuilder({ page }).include(scope).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  const violations = findings.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))
  results.audits.push({ label, violations })
  assert.deepEqual(violations, [], label)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${label}: no document overflow`)
}
async function screenshot(page, filename) {
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }) })
  await page.screenshot({ path: fileURLToPath(new URL(filename, output)), fullPage: true })
  results.screenshots.push(filename)
}
try {
  await mkdir(output, { recursive: true })
  await server.listen()
  const base = server.resolvedUrls.local[0]
  try { browser = await chromium.launch({ headless: true }) }
  catch { browser = await chromium.launch({ headless: true, channel: 'msedge' }) }
  for (const [name, width] of [['desktop', 1440], ['tablet', 820], ['mobile', 390]]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: 'Asia/Riyadh', hasTouch: width === 390 })
    await context.addInitScript((user) => { window.Microsoft = { Dynamic365: { Portal: { User: { userName: 'module-ui@example.org', firstName: 'Alex', lastName: 'Volunteer', contactId: user.id, userRoles: ['Volunteer'] } } } } }, actor)
    await context.route('**/_layout/tokenhtml', (route) => route.fulfill({ contentType: 'text/html', body: '<input name="__RequestVerificationToken" value="local-ui-token">' }))
    await context.route('**/_api/**', (route) => {
      const url = new URL(route.request().url())
      assert.equal(url.origin, new URL(base).origin)
      assert.equal(route.request().method(), 'GET', 'UI correction verification must not save business records')
      if (url.pathname === '/_api/serverlogics/appointments') {
        if (url.searchParams.get('view') === 'contacts') return route.fulfill({ json: envelope({ contacts: [contact] }) })
        const appointments = records.filter((item) => url.searchParams.get('view') === 'incoming' ? item.recipient.id === actor.id : item.requester.id === actor.id)
        return route.fulfill({ json: envelope({ appointments, nextLink: null, awaitingCount: 2 }) })
      }
      if (url.pathname === '/_api/serverlogics/press-coverage') return route.fulfill({ json: envelope({ records: [], nextLink: null }) })
      if (url.pathname === '/_api/contacts') return route.fulfill({ json: { value: [{ contactid: contact.id, fullname: contact.name }] } })
      return route.fulfill({ json: { value: [] } })
    })
    const page = await context.newPage()
    await page.goto(new URL('/activity/appointments', base).href)
    await page.getByText('2 awaiting response', { exact: true }).waitFor()
    await page.evaluate(() => document.fonts.ready)
    const measurements = await page.locator('.appointment-card').evaluateAll((cards) => cards.map((card) => {
      const row = card.querySelector('.appointment-card__row')
      const details = card.querySelector('.appointment-card__details')
      const title = card.querySelector('h3')
      const status = card.querySelector('.appointment-status')
      const actions = card.querySelector('.appointment-card__actions')
      const content = card.querySelectorAll('.appointment-card__details > p')
      return { height: card.getBoundingClientRect().height, rowHeight: row.getBoundingClientRect().height, title: title.textContent,
        statusLeft: status.getBoundingClientRect().left, statusRight: status.getBoundingClientRect().right, actionsRight: actions.getBoundingClientRect().right,
        detailsRight: details.getBoundingClientRect().right, actionsLeft: actions.childElementCount ? actions.getBoundingClientRect().left : null,
        contentLines: [...content].map((line) => ({ height: line.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(line).lineHeight), text: line.textContent })),
        overflow: card.scrollWidth > card.clientWidth }
    }))
    results.measurements.push({ name, width, cards: measurements })
    await screenshot(page, `${name}-appointments-cards.png`)
    if (width >= 820) {
      assert.equal(measurements.every(({ height }) => height === 110), true, `${name}: all collapsed cards must be exactly 110px including borders: ${JSON.stringify(measurements.map(({ height }) => height))}`)
      assert.equal(measurements.every(({ statusLeft, statusRight, actionsLeft, actionsRight }) => statusLeft >= actionsLeft && statusRight <= actionsRight), true, `${name}: status must be in the right action area`)
      assert.equal(measurements.every(({ detailsRight, actionsLeft }) => actionsLeft === null || actionsLeft >= detailsRight), true, `${name}: actions must not overlap long content`)
      assert.equal(measurements.every(({ contentLines }) => contentLines.length === 2 && contentLines.every(({ height, lineHeight }) => height <= lineHeight + 1)), true, `${name}: metadata and agenda must each occupy one line`)
    }
    assert.equal(measurements.every(({ overflow }) => !overflow), true, `${name}: long card content must not overflow`)
    const widthMatch = await page.evaluate(() => Math.abs(document.querySelector('.page--appointments').getBoundingClientRect().width - document.querySelector('#main-content > .site-container').getBoundingClientRect().width) < 1)
    assert.equal(widthMatch, true, 'Appointments must use the existing shell page width')
    await audit(page, '.page--appointments', `${name}/appointments-cards`)
    const proposalTrigger = page.getByRole('button', { name: 'Rescheduled', exact: true })
    if (width === 390) await proposalTrigger.tap()
    else await proposalTrigger.press('Enter')
    const proposalPanel = page.getByRole('dialog', { name: 'Proposal awaiting agreement', exact: true })
    await proposalPanel.waitFor()
    assert.equal(await proposalPanel.evaluate((node) => node === document.activeElement), true, 'Proposal disclosure takes keyboard focus')
    assert.equal(await page.locator('.appointment-card').nth(2).evaluate((card) => card.getBoundingClientRect().height), measurements[2].height, 'Opening proposal details must not grow its collapsed card')
    assert.equal(await proposalPanel.getByText('Committee meeting overlaps the original time.', { exact: false }).isVisible(), true)
    await audit(page, '.page--appointments', `${name}/proposal-disclosure`)
    await screenshot(page, `${name}-proposal-disclosure.png`)
    await proposalPanel.press('Escape')
    assert.equal(await proposalPanel.count(), 0)
    assert.equal(await proposalTrigger.evaluate((node) => node === document.activeElement), true, 'Escape restores proposal trigger focus')
    await proposalTrigger.click()
    await page.getByRole('button', { name: 'Close proposal details', exact: true }).click()
    assert.equal(await proposalPanel.count(), 0)
    await page.getByRole('button', { name: 'Accept Community policy discussion', exact: true }).click()
    assert.equal(await page.locator('.appointment-card').first().evaluate((card) => card.getBoundingClientRect().height > 110), true, 'Expanded response can grow')
    await audit(page, '.page--appointments', `${name}/expanded-accept`)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByRole('button', { name: '+ New Appointment', exact: true }).click()
    await page.getByRole('combobox', { name: 'Contact', exact: true }).click()
    await page.getByRole('option', { name: contact.name, exact: true }).click()
    assert.equal(await page.getByRole('combobox', { name: 'Contact', exact: true }).count(), 0)
    const clear = page.getByRole('button', { name: 'Clear Contact', exact: true })
    assert.equal(await clear.evaluate((node) => node === document.activeElement), true)
    await audit(page, '.page--appointments', `${name}/selected-contact`)
    await screenshot(page, `${name}-appointment-selected-contact.png`)
    await clear.press('Enter')
    assert.equal(await page.getByRole('combobox', { name: 'Contact', exact: true }).evaluate((node) => node === document.activeElement), true)
    // Full navigation intentionally discards this local draft for an independent Press fixture.
    page.on('dialog', (dialog) => dialog.accept())
    await page.goto(new URL('/press-coverage', base).href)
    await page.getByRole('button', { name: '+ Add Coverage', exact: true }).click()
    await page.getByRole('button', { name: /Press Coverage Log complete media/ }).click()
    await page.getByRole('combobox', { name: 'Related Contact', exact: true }).click()
    await page.getByRole('option', { name: contact.name, exact: true }).click()
    assert.equal(await page.getByRole('combobox', { name: 'Related Contact', exact: true }).count(), 0)
    const alignment = await page.evaluate(() => {
      const yesNo = document.getElementById('coverage-oiacMentioned').getBoundingClientRect()
      const lookup = document.querySelector('.meeting-report-lookup__control').getBoundingClientRect()
      return { yesNo: { top: yesNo.top, height: yesNo.height }, lookup: { top: lookup.top, height: lookup.height } }
    })
    results.measurements.push({ name, width, pressSelectedAlignment: alignment })
    if (width >= 820) assert.equal(Math.abs(alignment.yesNo.top - alignment.lookup.top) < 1 && Math.abs(alignment.yesNo.height - alignment.lookup.height) < 1, true, `${name}: Yes/No and Related Contact must align: ${JSON.stringify(alignment)}`)
    await audit(page, '.page--press-coverage', `${name}/press-selected-contact`)
    await screenshot(page, `${name}-press-selected-contact.png`)
    await page.getByRole('button', { name: 'Clear Related Contact', exact: true }).press('Enter')
    assert.equal(await page.getByRole('combobox', { name: 'Related Contact', exact: true }).evaluate((node) => node === document.activeElement), true)
    await page.getByLabel('OIAC Mentioned?', { exact: true }).selectOption('false')
    assert.equal(await page.getByLabel('OIAC Mentioned?', { exact: true }).inputValue(), 'false')
    await context.close()
    console.log(`${name} (${width}px): compact card measurements, selected contact keyboard behavior, alignment, responsive overflow and scoped axe checks passed.`)
  }
  // Actual browser service -> trusted proxy -> fixed action boundary, using local action fixtures.
  // The SDK suite separately verifies exact site-role authorization on the real action implementation.
  for (const isAdmin of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    await context.addInitScript(({ user, admin }) => { window.Microsoft = { Dynamic365: { Portal: { User: { userName: 'views@example.org', firstName: 'Alex', lastName: 'Volunteer', contactId: user.id, userRoles: admin ? ['Administrators'] : ['Volunteer'] } } } } }, { user: actor, admin: isAdmin })
    await context.route('**/_layout/tokenhtml', (route) => route.fulfill({ contentType: 'text/html', body: '<input name="__RequestVerificationToken" value="local-ui-token">' }))
    const requests = []
    const unrelated = record(90, { title: 'Unrelated administrator overview appointment', requester: contact, recipient: { id: '99999999-9999-4999-8999-999999999999', name: 'Another recipient' } })
    const fixtureRecords = [records[0], unrelated]
    await context.route('**/_api/**', async (route) => {
      const url = new URL(route.request().url())
      assert.equal(url.origin, new URL(base).origin)
      assert.equal(route.request().method(), 'GET')
      if (url.pathname !== '/_api/serverlogics/appointments') return route.fulfill({ json: { value: [] } })
      const vm = { Server: { User: { contactid: actor.id }, Context: { HttpMethod: 'GET', QueryParameters: Object.fromEntries(url.searchParams), ActivityId: records[0].id }, Connector: { Dataverse: { InvokeCustomApi(method, action, payload) {
        assert.equal(method, 'post'); assert.equal(action, 'mss_AppointmentCommand')
        const input = JSON.parse(payload); const data = JSON.parse(input.Payload)
        assert.equal(input.ActorContactId, actor.id); assert.deepEqual(Object.keys(data), ['page'])
        requests.push(input.Command)
        const body = input.Command === 'all' && !isAdmin ? { ok: false, error: { code: 'forbidden' } } : { ok: true, appointments: input.Command === 'all' ? fixtureRecords : fixtureRecords.filter(row => input.Command === 'incoming' ? row.recipient.id === actor.id : row.requester.id === actor.id), nextLink: null, awaitingCount: 1 }
        return JSON.stringify({ StatusCode: 200, IsSuccessStatusCode: true, Body: JSON.stringify({ Result: JSON.stringify(body) }) })
      } } } } }
      runInNewContext(proxySource, vm)
      return route.fulfill({ json: { success: true, data: vm.get() } })
    })
    const page = await context.newPage()
    await page.goto(new URL('/activity/appointments', base).href)
    await page.getByRole('heading', { name: records[0].title, exact: true }).waitFor()
    assert.equal(await page.getByText(unrelated.title, { exact: true }).count(), 0)
    assert.equal(requests.includes('all'), false, 'all must remain lazy')
    const allButton = page.getByRole('button', { name: 'All Appointments', exact: true })
    assert.equal(await allButton.count(), isAdmin ? 1 : 0)
    if (isAdmin) {
      await allButton.click()
      const card = page.locator('.appointment-card').filter({ has: page.getByRole('heading', { name: unrelated.title, exact: true }) })
      await card.waitFor()
      assert.equal(await card.getByRole('button', { name: /^Accept / }).count(), 0, 'unrelated admin cannot respond')
      assert.equal(await card.getByText(/Requested by Morgan Representative.*Requested for Another recipient/).count(), 1)
      assert.equal(await page.getByRole('button', { name: `Accept ${records[0].title}`, exact: true }).count(), 1, 'admin can respond as own recipient')
      assert.equal(await page.locator('.appointment-count').count(), 0, 'admin overview has no user-owned awaiting count')
      assert.equal(requests.filter(view => view === 'all').length, 1)
      await audit(page, '.page--appointments', 'admin/all-view')
      await screenshot(page, 'admin-all-appointments.png')
      await page.getByRole('button', { name: 'My Appointments', exact: true }).click()
      assert.equal(await page.getByText(unrelated.title, { exact: true }).count(), 0)
      await audit(page, '.page--appointments', 'admin/personal-view')
    }
    results.audits.push({ label: isAdmin ? 'admin/service-proxy-boundary' : 'ordinary/service-proxy-boundary', violations: [] })
    await context.close()
  }
} finally {
  await writeFile(new URL('results.json', output), `${JSON.stringify(results, null, 2)}\n`)
  await browser?.close()
  await server.close()
}
