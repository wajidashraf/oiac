import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'
import { createServer } from 'vite'

// Fixture-backed local UI verification only. This does not prove hosted portal
// identity, Dataverse permissions, plugin concurrency, or deployed runtime behavior.
const actor = { id: '11111111-1111-4111-8111-111111111111', name: 'Alex Volunteer' }
const contact = { id: '22222222-2222-4222-8222-222222222222', name: 'Morgan Representative' }
const pending = 866530000
const accepted = 866530001
const rescheduled = 866530003
const output = new URL('../artifacts/appointments-ui/', import.meta.url)
const results = { screenshots: [], audits: [], checks: [], limitations: [
  'Local fixture responses only; no remote Dataverse reads or mutations.',
  'Scoped automated axe checks do not replace keyboard, assistive technology, or hosted signed-in UAT.',
] }
const fixture = (number, values) => ({
  id: `33333333-3333-4333-8333-${String(number).padStart(12, '0')}`,
  title: 'Community policy discussion', status: pending, statusLabel: 'Pending',
  meetingFormat: 1, meetingFormatLabel: 'Microsoft Teams', preferredDateTime: '2026-10-20T14:00:00Z',
  suggestedDateTime: null, agenda: 'Discuss community priorities.', meetingLink: null,
  reschedulingReason: '', requester: contact, recipient: actor, rowVersion: '123456', ...values,
})
const initial = () => [
  fixture(1, {}),
  fixture(2, { title: 'Phone planning call', meetingFormat: 2, meetingFormatLabel: 'Phone Call' }),
  fixture(3, { title: 'Community office visit', meetingFormat: 3, meetingFormatLabel: 'In Person' }),
  fixture(4, { title: 'Accepted advocacy briefing', status: accepted, statusLabel: 'Accepted', requester: actor, recipient: contact, meetingLink: 'https://example.org/meeting' }),
  fixture(5, { title: 'Proposed policy review', status: rescheduled, statusLabel: 'Rescheduled', requester: actor, recipient: contact, suggestedDateTime: '2026-10-21T15:30:00Z', reschedulingReason: 'A committee meeting overlaps the original time.' }),
  fixture(6, { title: 'Cancelled budget review', status: 866530004, statusLabel: 'Cancelled', requester: actor, recipient: contact, meetingFormat: 2, meetingFormatLabel: 'Phone Call' }),
  fixture(7, { title: 'Legacy request', requester: null, status: 866530002, statusLabel: 'Rejected' }),
]
const envelope = (data) => ({ success: true, data: JSON.stringify({ ok: true, ...data }) })
let browser
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } })

async function fixtureContext() {
  const context = await browser.newContext({ timezoneId: 'Asia/Riyadh' })
  const records = initial()
  const writes = []
  let waitForWrite = null
  await context.addInitScript((user) => {
    window.Microsoft = { Dynamic365: { Portal: { User: {
      userName: 'appointments.test@example.org', firstName: 'Alex', lastName: 'Volunteer',
      contactId: user.id, userRoles: ['Volunteer'],
    } } } }
  }, actor)
  await context.route('**/_layout/tokenhtml', (route) => route.fulfill({ contentType: 'text/html', body: '<input name="__RequestVerificationToken" value="local-test-token">' }))
  await context.route('**/_api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    assert.equal(url.origin, new URL(base).origin, 'fixture requests must remain on local host')
    if (url.pathname !== '/_api/serverlogics/appointments') return route.fulfill({ json: { value: [] } })
    if (request.method() === 'POST') {
      const body = request.postDataJSON()
      writes.push(body)
      if (waitForWrite) await waitForWrite
      return route.fulfill({ json: envelope({ id: body.id ?? records[0].id }) })
    }
    if (url.searchParams.get('view') === 'contacts') return route.fulfill({ json: envelope({ contacts: [contact] }) })
    const view = url.searchParams.get('view')
    const appointments = records.filter((item) => view === 'incoming' ? item.recipient?.id === actor.id : item.requester?.id === actor.id)
    return route.fulfill({ json: envelope({ appointments, nextLink: null, awaitingCount: records.filter((item) => item.recipient?.id === actor.id && item.status === pending).length }) })
  })
  return { context, writes, holdWrite: () => {
    let release
    waitForWrite = new Promise((resolve) => { release = resolve })
    return release
  } }
}

async function openAppointments(page) {
  await page.goto(new URL('/activity/appointments', base).href)
  await page.getByRole('heading', { name: 'Appointments', exact: true }).waitFor()
  await page.getByText('3 awaiting response', { exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Cancelled budget review', exact: true }).waitFor()
}

async function fillRequest(page, title) {
  await page.getByLabel('Appointment Title', { exact: true }).fill(title)
  await page.getByRole('combobox', { name: 'Contact', exact: true }).fill('Morgan')
  await page.getByRole('option', { name: contact.name, exact: true }).click()
  await page.getByLabel('Meeting Format', { exact: true }).selectOption('1')
  await page.getByLabel('Preferred Date', { exact: true }).fill('2026-10-22')
  await page.getByLabel('Preferred Time (Eastern Time)', { exact: true }).fill('10:30')
  await page.getByLabel('Purpose / Agenda', { exact: true }).fill('Discuss advocacy priorities.')
}

let base
try {
  await mkdir(output, { recursive: true })
  await server.listen()
  base = server.resolvedUrls.local[0]
  try { browser = await chromium.launch({ headless: true }) }
  catch { browser = await chromium.launch({ headless: true, channel: 'msedge' }) }

  for (const [name, width] of [['desktop', 1440], ['tablet', 820], ['mobile', 390]]) {
    const { context } = await fixtureContext()
    const page = await context.newPage()
    await page.setViewportSize({ width, height: 1000 })
    for (const state of ['lists', 'create', 'accept', 'reschedule']) {
      await openAppointments(page)
      if (state === 'create') await page.getByRole('button', { name: '+ New Appointment', exact: true }).click()
      if (state === 'accept') await page.getByRole('button', { name: 'Accept Community policy discussion', exact: true }).click()
      if (state === 'reschedule') await page.getByRole('button', { name: 'Request reschedule Community policy discussion', exact: true }).click()
      const audit = await new AxeBuilder({ page }).include('.page--appointments')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      const violations = audit.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map((node) => ({ target: node.target, failureSummary: node.failureSummary })) }))
      results.audits.push({ viewport: name, width, state, violations })
      const overflow = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth }))
      assert.equal(overflow.documentWidth <= overflow.width, true, `${name}/${state} page overflow: ${JSON.stringify(overflow)}`)
      const screenshot = `${name}-${state}.png`
      await page.screenshot({ path: fileURLToPath(new URL(screenshot, output)), fullPage: true })
      results.screenshots.push(screenshot)
      console.log(`${name}/${state}: ${violations.length} scoped axe violations; no page overflow.`)
    }
    await context.close()
  }
  console.log('12 Appointments screenshots and page overflow checks completed at 1440/820/390; scoped WCAG findings recorded.')

  const navigation = await fixtureContext()
  const page = await navigation.context.newPage()
  await page.goto(new URL('/resources', base).href)
  await page.getByRole('button', { name: 'Activity', exact: true }).click()
  await page.getByRole('link', { name: 'Appointments', exact: true }).click()
  await page.getByRole('button', { name: '+ New Appointment', exact: true }).click()
  await page.getByLabel('Appointment Title', { exact: true }).fill('Preserve this appointment draft')
  const index = await page.evaluate(() => history.state.idx)
  const declined = page.waitForEvent('dialog')
  await page.evaluate(() => history.back())
  await (await declined).dismiss()
  await page.waitForFunction((idx) => location.pathname === '/activity/appointments' && history.state.idx === idx, index)
  assert.equal(await page.getByLabel('Appointment Title', { exact: true }).inputValue(), 'Preserve this appointment draft')
  assert.equal(await page.getByRole('heading', { name: 'Appointments', exact: true }).count(), 1)
  const acceptedBack = page.waitForEvent('dialog')
  await page.evaluate(() => history.back())
  await (await acceptedBack).accept()
  await page.waitForURL('**/resources')
  await page.evaluate(() => history.forward())
  await page.waitForURL('**/activity/appointments')
  await page.getByRole('button', { name: '+ New Appointment', exact: true }).click()
  await fillRequest(page, 'Save before leaving')
  const release = navigation.holdWrite()
  await page.getByRole('button', { name: 'Submit Request', exact: true }).click()
  await page.getByRole('button', { name: 'Sending…', exact: true }).waitFor()
  await page.getByRole('link', { name: 'Resources', exact: true }).click()
  await page.getByText('Your appointment is still saving. Wait until it finishes before leaving this page.', { exact: true }).waitFor()
  await page.evaluate(() => history.back())
  await page.waitForFunction((idx) => location.pathname === '/activity/appointments' && history.state.idx === idx, index)
  assert.equal(await page.getByLabel('Appointment Title', { exact: true }).inputValue(), 'Save before leaving')
  assert.equal(await page.getByLabel('Appointment Title', { exact: true }).isDisabled(), true)
  assert.equal(navigation.writes.length, 1)
  release()
  await page.getByText('Appointment request sent.', { exact: true }).waitFor()
  assert.deepEqual(navigation.writes[0], { operation: 'create', payload: {
    title: 'Save before leaving', recipientId: contact.id, meetingFormat: 1, preferredDate: '2026-10-22',
    preferredTime: '10:30', preferredOffsetMinutes: -240, agenda: 'Discuss advocacy priorities.',
  } })
  await page.getByRole('link', { name: 'Resources', exact: true }).click()
  await page.waitForURL('**/resources')
  await navigation.context.close()
  results.checks.push('Browser Back declined preserves draft; accepted Back and subsequent Forward work.', 'Pending create blocks links and Browser Back, disables inputs, submits once and unlocks navigation after success.', 'Create payload uses explicit Eastern UTC offset despite browser timezone Asia/Riyadh; no requester supplied.')
  console.log('Browser Back, pending-save navigation protection, and Eastern create payload checks passed.')

  const actions = await fixtureContext()
  const actionPage = await actions.context.newPage()
  await openAppointments(actionPage)
  assert.equal(await actionPage.getByText('Requested by Unknown requester', { exact: false }).count(), 1)
  const join = actionPage.getByRole('link', { name: 'Join meeting', exact: true })
  assert.equal(await join.count(), 1)
  assert.equal(await join.getAttribute('target'), '_blank')
  assert.equal(await join.getAttribute('rel'), 'noopener noreferrer')
  for (const [title, online] of [['Community policy discussion', true], ['Phone planning call', false], ['Community office visit', false]]) {
    await actionPage.getByRole('button', { name: `Accept ${title}`, exact: true }).click()
    if (online) {
      await actionPage.getByRole('button', { name: 'Confirm Acceptance', exact: true }).click()
      await actionPage.getByText('Enter a valid HTTPS meeting link.', { exact: true }).waitFor()
      assert.equal(actions.writes.length, 0)
      await actionPage.getByLabel('Microsoft Teams meeting link', { exact: true }).fill('https://example.org/confirmed-meeting')
    } else assert.equal(await actionPage.getByLabel('Microsoft Teams meeting link', { exact: true }).count(), 0)
    await actionPage.getByRole('button', { name: 'Confirm Acceptance', exact: true }).click()
    await actionPage.getByText('Appointment accepted.', { exact: true }).waitFor()
    assert.equal(actions.writes.at(-1).operation, 'accept')
    assert.equal(actions.writes.at(-1).payload.meetingLink, online ? 'https://example.org/confirmed-meeting' : '')
  }
  await actionPage.getByRole('button', { name: 'Request reschedule Community policy discussion', exact: true }).click()
  await actionPage.getByLabel('Rescheduling reason', { exact: true }).fill('Committee meeting overlaps.')
  await actionPage.getByLabel('Suggested Date', { exact: true }).fill('2026-10-23')
  await actionPage.getByLabel('Suggested Time (Eastern Time)', { exact: true }).fill('11:30')
  await actionPage.getByRole('button', { name: 'Send Reschedule Request', exact: true }).click()
  await actionPage.getByText('Reschedule proposal sent. It is awaiting agreement.', { exact: true }).waitFor()
  assert.deepEqual(actions.writes.at(-1), { operation: 'reschedule', id: initial()[0].id, expectedRowVersion: '123456', payload: {
    reason: 'Committee meeting overlaps.', suggestedDate: '2026-10-23', suggestedTime: '11:30', suggestedOffsetMinutes: -240,
  } })
  await actions.context.close()
  results.checks.push('Teams acceptance requires HTTPS link; Phone and In Person acceptance submit no meeting URL.', 'Reschedule submits suggested date/time/reason with row version, leaving original preferred time out of mutation.', 'Lists show exact incoming Pending count, honest legacy requester label, proposal explanation, and safe accepted meeting link.')
  console.log('Acceptance, rescheduling, list semantics, and safe join-link checks passed.')

  const daylightSaving = await fixtureContext()
  const dstPage = await daylightSaving.context.newPage()
  await openAppointments(dstPage)
  await dstPage.getByRole('button', { name: '+ New Appointment', exact: true }).click()
  await fillRequest(dstPage, 'Explicit Eastern daylight-saving occurrence')
  await dstPage.getByLabel('Preferred Date', { exact: true }).fill('2026-03-08')
  await dstPage.getByLabel('Preferred Time (Eastern Time)', { exact: true }).fill('02:30')
  await dstPage.getByRole('button', { name: 'Submit Request', exact: true }).click()
  await dstPage.getByText('This Eastern Time does not exist. Choose another date or time.', { exact: true }).waitFor()
  assert.equal(daylightSaving.writes.length, 0, 'Nonexistent spring-forward time must not POST')
  await dstPage.getByLabel('Preferred Date', { exact: true }).fill('2026-11-01')
  await dstPage.getByLabel('Preferred Time (Eastern Time)', { exact: true }).fill('01:30')
  const occurrence = dstPage.getByLabel('Time occurrence (Eastern Time)', { exact: true })
  await occurrence.waitFor()
  assert.equal(await occurrence.inputValue(), '')
  await dstPage.getByRole('button', { name: 'Submit Request', exact: true }).click()
  await dstPage.getByText('Choose which occurrence of this time you mean.', { exact: true }).waitFor()
  assert.equal(daylightSaving.writes.length, 0, 'Ambiguous fall-back time must require an explicit occurrence before POST')
  await occurrence.selectOption('-300')
  await dstPage.getByRole('button', { name: 'Submit Request', exact: true }).click()
  await dstPage.getByText('Appointment request sent.', { exact: true }).waitFor()
  assert.equal(daylightSaving.writes.length, 1)
  assert.equal(daylightSaving.writes[0].payload.preferredDate, '2026-11-01')
  assert.equal(daylightSaving.writes[0].payload.preferredTime, '01:30')
  assert.equal(daylightSaving.writes[0].payload.preferredOffsetMinutes, -300)
  await daylightSaving.context.close()
  results.checks.push('Eastern spring-forward 2026-03-08 02:30 is rejected without a POST; fall-back 2026-11-01 01:30 requires an occurrence and selecting -300 posts that explicit offset.')
  console.log('Real-browser Eastern DST gap rejection and explicit fall-back occurrence checks passed.')
  assert.deepEqual(results.audits.filter((audit) => audit.violations.length), [], 'All 12 scoped WCAG accessibility audits must pass; see artifacts/appointments-ui/results.json')
} finally {
  await writeFile(new URL('results.json', output), `${JSON.stringify(results, null, 2)}\n`)
  await browser?.close()
  await server.close()
}
