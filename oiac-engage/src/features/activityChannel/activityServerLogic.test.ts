const vmModule = 'node:vm'
const { runInNewContext } = await import(/* @vite-ignore */ vmModule) as { runInNewContext(code: string, context: Record<string, unknown>): string }
import { expect, it, vi } from 'vitest'
const scripts = import.meta.glob('../../../.powerpages-site/server-logic/activity-channel/activity-channel.js', { eager: true, query: '?raw', import: 'default' })
const source = Object.values(scripts)[0] as string
const actor = '12345678-1234-1234-1234-123456789abc'
function run(body: unknown, user: unknown = { contactid: actor }, countFails = false, countResult: unknown = { ok: true, totalCount: 3 }) {
  const invoke = vi.fn((_verb, _api, input) => {
    const args = JSON.parse(input)
    if (args.Command === 'count' && countFails) throw Error('secret')
    return { StatusCode: 200, Body: JSON.stringify({ Result: JSON.stringify(args.Command === 'count' ? countResult : { ok: true, posts: [], totalCount: null, countUnavailable: true }) }) }
  })
  const result = JSON.parse(runInNewContext(source + '\npost()', { Server: { User: user, Context: { HttpMethod: 'POST', QueryParameters: {}, Body: JSON.stringify(body) }, Connector: { Dataverse: { InvokeCustomApi: invoke } } } }))
  return { result, invoke }
}
it('uses trusted lowercase identity and separate count request', () => {
  const { result, invoke } = run({ command: 'feed', payload: { phase: 'pinned', page: 1 } })
  expect(result).toMatchObject({ ok: true, totalCount: 3, countUnavailable: false })
  expect(invoke).toHaveBeenCalledTimes(2)
  expect(JSON.parse(invoke.mock.calls[0][2])).toMatchObject({ ActorContactId: actor, Command: 'feed' })
  expect(invoke.mock.calls[0].slice(0, 2)).toEqual(['post', 'mss_ActivityChannelCommand'])
})
it('retains usable feed after independent count failure', () => {
  expect(run({ command: 'feed', payload: { phase: 'pinned', page: 1 } }, undefined, true).result).toMatchObject({ ok: true, totalCount: null, countUnavailable: true })
})
it.each([
  { ok: false, error: { code: 'unavailable' } },
  null,
  'malformed',
  { totalCount: 3 },
  { ok: true, totalCount: -1 },
  { ok: true, totalCount: 1.5 },
  { ok: true, totalCount: '3' },
  { ok: true, totalCount: Number.MAX_SAFE_INTEGER + 1 },
])('retains feed when independent count result is false, malformed, or invalid: %j', countResult => {
  const { result, invoke } = run({ command: 'feed', payload: { phase: 'pinned', page: 1 } }, undefined, false, countResult)
  expect(result).toMatchObject({ ok: true, posts: [], totalCount: null, countUnavailable: true })
  expect(invoke).toHaveBeenCalledTimes(2)
})
it('preserves escape-heavy 8000-character decoded content through the bridge', () => {
  const content = '"\\\n\t'.repeat(2000)
  expect(content).toHaveLength(8000)
  const { result, invoke } = run({ command: 'post', payload: { content, requestId: actor } })
  expect(result.ok).toBe(true)
  expect(invoke).toHaveBeenCalledTimes(1)
  const outer = JSON.parse(invoke.mock.calls[0][2])
  expect(JSON.parse(outer.Payload)).toEqual({ content, requestId: actor })
})
it.each([{ command: 'count', payload: {} }, { command: 'pin', payload: { id: actor, author: actor } }, { command: 'feed', payload: { phase: 'regular', page: 2501 } }])('rejects forged command before invocation', body => {
  const { result, invoke } = run(body)
  expect(result.ok).toBe(false)
  expect(invoke).not.toHaveBeenCalled()
})
it('denies anonymous callers', () => {
  const { result, invoke } = run({ command: 'feed', payload: { phase: 'pinned', page: 1 } }, null)
  expect(result.error.code).toBe('unauthenticated')
  expect(invoke).not.toHaveBeenCalled()
})
