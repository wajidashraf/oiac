import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

// All records and identity below exist only in this local verification harness.
const output = resolve('../.superpowers/sdd/2026-10-17-activity-channel/browser')
await mkdir(output, { recursive: true })
const server = await createServer({ server: { host: '127.0.0.1', port: 5187, strictPort: true } })
await server.listen()
const browser = await chromium.launch({ headless: true })
const author = { id: '11111111-1111-4111-8111-111111111111', name: 'Sara Rahimi', jobTitle: 'Volunteer Coordinator' }
const other = { id: '77777777-7777-4777-8777-777777777777', name: 'Ali Khan', jobTitle: 'Community Volunteer' }
const post = { id: '22222222-2222-4222-8222-222222222222', content: 'A strong community starts with a conversation.\n\nThank you to everyone who joined our outreach this week. Share your ideas for our next community gathering below.', author, createdOn: '2026-10-17T14:00:00Z', modifiedOn: '2026-10-17T14:00:00Z', isPinned: true, pinnedOn: '2026-10-17T14:00:00Z', pinnedById: author.id, rowVersion: '1', canDelete: true, canModerate: true }
const root = { id: '33333333-3333-4333-8333-333333333333', postId: post.id, parentId: null, content: 'It was wonderful to connect with so many new volunteers. Looking forward to the next event!', author: other, createdOn: '2026-10-17T15:00:00Z' }
const reply = { ...root, id: '44444444-4444-4444-8444-444444444444', parentId: root.id, author, content: 'Thank you, Ali! Your support made a real difference.' }
const nested = { ...root, id: '55555555-5555-4555-8555-555555555555', parentId: reply.id, content: 'Happy to help. I can coordinate the welcome team next time.' }
const summary = []
try {
  for (const width of [1440, 820, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } })
    const page = await context.newPage()
    await page.addInitScript(({ author }) => { window.Microsoft = { Dynamic365: { Portal: { User: { userName: 'local-verification@example.test', contactId: author.id, firstName: 'Sara', lastName: 'Rahimi', userRoles: ['Authenticated Users', 'Administrators'] } } } } }, { author })
    let posts = [structuredClone(post), { ...post, id: '66666666-6666-4666-8666-666666666666', content: 'What are you working on this week?\n\nUse this space to share progress, ask a question, or celebrate a community milestone.', author: other, isPinned: false, pinnedOn: null, pinnedById: null, canDelete: false }]
    let comments = [root, reply, nested]
    await page.route('**/_layout/tokenhtml', route => route.fulfill({ contentType: 'text/html', body: '<input name="__RequestVerificationToken" value="local-token">' }))
    await page.route('**/_api/**', async route => {
      assert.equal(new URL(route.request().url()).origin, 'http://127.0.0.1:5187')
      if (!route.request().url().endsWith('/serverlogics/activity-channel')) return route.fulfill({ status: 404, body: '{}' })
      const { command, payload } = route.request().postDataJSON()
      let result
      if (command === 'feed') result = { ok: true, posts, nextLink: null, totalCount: posts.length, countUnavailable: false, currentUser: author, canModerate: true }
      else if (command === 'comments') result = { ok: true, comments: comments.filter(c => payload.postIds.includes(c.postId)), nextLink: null }
      else if (command === 'post') { const saved = { ...post, id: payload.requestId, content: payload.content, isPinned: false, pinnedOn: null, pinnedById: null }; posts = [saved, ...posts]; result = { ok: true, post: saved } }
      else if (command === 'comment' || command === 'reply') { const saved = { ...root, author, id: payload.requestId, postId: payload.postId, parentId: payload.parentId ?? null, content: payload.content }; comments = [...comments, saved]; result = { ok: true, comment: saved } }
      else throw new Error(`Unexpected test mutation: ${command}`)
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) })
    })
    await page.goto('http://127.0.0.1:5187/activity/channel')
    await page.getByText(root.content, { exact: true }).waitFor()
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}`)
    await page.screenshot({ path: resolve(output, `activity-${width}-collapsed.png`), fullPage: true })
    await page.getByRole('button', { name: 'Create Activity', exact: true }).click()
    await page.getByRole('textbox', { name: 'Activity content' }).fill('A community update, ready to share.\n\nThank you to our volunteers.')
    assert.equal(await page.getByRole('textbox', { name: 'Activity content' }).evaluate(node => document.activeElement === node), true)
    await page.screenshot({ path: resolve(output, `activity-${width}-composer.png`), fullPage: true })
    const results = await new AxeBuilder({ page }).include('.activity-channel').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    await writeFile(resolve(output, `axe-${width}.json`), JSON.stringify(results, null, 2))
    assert.equal(results.violations.length, 0, JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))))
    await page.getByRole('button', { name: 'Post Activity', exact: true }).click()
    await page.getByText('Activity posted.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Reply to Ali Khan', exact: true }).first().click()
    await page.getByRole('textbox', { name: 'Reply content' }).fill('A local browser reply')
    await page.getByRole('button', { name: 'Post Reply', exact: true }).click()
    await page.getByText('Reply posted.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Delete Activity', exact: true }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Delete Activity' })
    await dialog.waitFor()
    const dialogAxe = await new AxeBuilder({ page }).include('.ac-delete-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    assert.equal(dialogAxe.violations.length, 0)
    await page.screenshot({ path: resolve(output, `activity-${width}-delete.png`), fullPage: true })
    await page.keyboard.press('Escape'); assert.equal(await dialog.count(), 0)
    summary.push({ width, overflow: false, axeViolations: results.violations.length, dialogAxeViolations: dialogAxe.violations.length, create: 'passed', reply: 'passed', deleteCancel: 'passed' })
    await context.close()
  }
  await writeFile(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify({ output, summary }, null, 2))
} finally { await browser.close(); await server.close() }
