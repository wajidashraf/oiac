import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'

// Local fixture only. No hosted endpoint or business records are used.
const server = await createServer({ server: { host: '127.0.0.1', port: 5188, strictPort: true } })
await server.listen()
const browser = await chromium.launch({ headless: true })
const author = { id: '11111111-1111-4111-8111-111111111111', name: 'Local Member', jobTitle: null }
const sample = { id: '22222222-2222-4222-8222-222222222222', content: 'Local fixture', author, createdOn: '2026-10-17T14:00:00Z', modifiedOn: '2026-10-17T14:00:00Z', isPinned: false, pinnedOn: null, pinnedById: null, rowVersion: '1', canDelete: true, canModerate: false }
try {
  for (const scenario of ['definitive validation', 'uncertain then validation']) {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.addInitScript(({ author }) => { window.Microsoft = { Dynamic365: { Portal: { User: { userName: 'local@example.test', contactId: author.id, userRoles: ['Authenticated Users'] } } } } }, { author })
    await page.route('**/_layout/tokenhtml', route => route.fulfill({ contentType: 'text/html', body: '<input name="__RequestVerificationToken" value="fixture">' }))
    const attempts = []
    const posts = []
    await page.route('**/_api/**', async route => {
      assert.equal(new URL(route.request().url()).origin, 'http://127.0.0.1:5188')
      if (!route.request().url().endsWith('/serverlogics/activity-channel')) return route.fulfill({ status: 404, body: '{}' })
      const body = route.request().postDataJSON()
      let result
      if (body.command === 'feed') result = { ok: true, posts, nextLink: null, totalCount: posts.length, countUnavailable: false, currentUser: author, canModerate: false }
      else if (body.command === 'comments') result = { ok: true, comments: [], nextLink: null }
      else if (body.command === 'post') {
        attempts.push(body)
        if (scenario === 'uncertain then validation' && attempts.length === 1) return route.abort('failed')
        if (attempts.length === (scenario === 'definitive validation' ? 1 : 2)) result = { ok: false, error: { code: 'validation', message: 'hidden server detail' } }
        else { const saved = { ...sample, id: body.payload.requestId, content: body.payload.content }; posts.push(saved); result = { ok: true, post: saved } }
      } else throw Error(`Unexpected mutation ${body.command}`)
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) })
    })
    await page.goto('http://127.0.0.1:5188/activity/channel')
    await page.getByRole('button', { name: 'Create Activity', exact: true }).click()
    const field = page.getByRole('textbox', { name: 'Activity content' })
    const submit = page.getByRole('button', { name: 'Post Activity', exact: true })
    await field.fill(scenario === 'definitive validation' ? 'Rejected\u000btext' : 'Possibly saved')
    await submit.click()
    await page.getByRole('alert').waitFor()
    if (scenario === 'definitive validation') {
      assert.equal(await field.evaluate(node => node.readOnly), false)
      assert.equal(await field.inputValue(), 'Rejected\u000btext')
      await field.fill('Corrected draft')
      await submit.click()
      await page.getByText('Activity posted.', { exact: true }).waitFor()
      assert.notEqual(attempts[0].payload.requestId, attempts[1].payload.requestId)
      assert.equal(attempts[1].payload.content, 'Corrected draft')
    } else {
      assert.equal(await field.evaluate(node => node.readOnly), true)
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await page.getByRole('button', { name: 'Create Activity', exact: true }).click()
      assert.equal(await field.evaluate(node => node.readOnly), true)
      await submit.click()
      await page.getByText('Check the activity fields and try again.', { exact: true }).waitFor()
      assert.equal(await field.evaluate(node => node.readOnly), true)
      await submit.click()
      await page.getByText('Activity posted.', { exact: true }).waitFor()
      assert.deepEqual(attempts[1], attempts[0])
      assert.deepEqual(attempts[2], attempts[0])
    }
    assert.equal(posts.length, 1)
    assert.equal(await page.getByText('hidden server detail', { exact: true }).count(), 0)
    console.log(`PASS ${scenario}: ${attempts.length} requests; one confirmed fixture create`)
    await context.close()
  }
} finally {
  await browser.close()
  await server.close()
}
