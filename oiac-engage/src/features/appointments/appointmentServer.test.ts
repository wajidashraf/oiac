const vmModule = 'node:vm'
const { runInNewContext } = await import(/* @vite-ignore */ vmModule) as { runInNewContext(code: string, context: Record<string, unknown>): unknown }
import { describe, expect, test, vi } from 'vitest'
const scripts = import.meta.glob('../../../.powerpages-site/server-logic/appointments/appointments.js', { eager: true, query: '?raw', import: 'default' })
const source = Object.values(scripts)[0] as string | undefined
const actor = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', activity = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const payload = { title: 'Budget', recipientId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', meetingFormat: 1, preferredDate: '2026-07-10', preferredTime: '09:30', preferredOffsetMinutes: -240, agenda: '' }
const envelope = (body: unknown, status = 200) => JSON.stringify({ StatusCode: status, IsSuccessStatusCode: status >= 200 && status < 300, Body: JSON.stringify(body) })
function harness(method = 'POST', body: unknown = { operation: 'create', payload }, query: Record<string, unknown> = {}) {
 const invoke = vi.fn((_method: string, _name: string, _payload: string) => envelope({ Result: JSON.stringify({ ok: true, id: activity }) }))
 const server = { User: { ContactId: actor } as unknown, Context: { HttpMethod: method, Body: JSON.stringify(body), QueryParameters: query, ActivityId: activity }, Connector: { Dataverse: { InvokeCustomApi: invoke } }, Logger: { Error: vi.fn() } }
 const context: Record<string, unknown> = { Server: server }; runInNewContext(source || '', context)
 return { server, invoke, context, call() { expect(context[method.toLowerCase()], 'missing supported entry point').toBeTypeOf('function'); return JSON.parse((context[method.toLowerCase()] as () => string)()) } }
}
describe('Appointments trusted proxy', () => {
 test('avoids the hosted runtime prohibited Function pattern, including anonymous callbacks', () => { expect(source).not.toMatch(/Function\s*\(/i) })
 test('uses the trusted Dataverse contactid attribute exposed by the hosted Server.User', () => { const h = harness(); h.server.User = { contactid: actor }; expect(h.call()).toEqual({ ok: true, id: activity }); expect(JSON.parse(h.invoke.mock.calls[0][2]).ActorContactId).toBe(actor) })
 test('stamps server actor and activity, invoking only fixed action', () => { const h = harness(); expect(h.call()).toEqual({ ok: true, id: activity }); const [method, name, data] = h.invoke.mock.calls[0]; expect([method, name]).toEqual(['post', 'mss_AppointmentCommand']); expect(JSON.parse(data)).toEqual({ ActorContactId: actor, Command: 'create', Payload: JSON.stringify({ ...payload, id: activity }) }) })
 test.each([null, {}, { ContactId: 'invalid' }, { id: 'invalid', isAdmin: true }])('denies invalid trusted identity %j', user => { const h = harness(); h.server.User = user; expect(h.call()).toMatchObject({ ok: false, error: { code: 'unauthenticated' } }); expect(h.invoke).not.toHaveBeenCalled() })
 test.each([{ contactid: `{${actor}}` }, { Id: actor }, { id: actor }, { contactid: { toString: (): string => actor } }])('normalizes trusted platform Contact identifiers without browser input', user => { const h = harness(); h.server.User = user; expect(h.call()).toEqual({ ok: true, id: activity }); expect(JSON.parse(h.invoke.mock.calls[0][2]).ActorContactId).toBe(actor) })
 test.each(['ActorContactId', 'requesterId', 'isAdmin', 'id', 'Command', '__proto__'])('denies browser extra envelope %s', key => { const h = harness('POST', JSON.parse(JSON.stringify({ operation: 'create', payload }).slice(0, -1) + `,"${key}":"forged"}`)); expect(h.call()).toMatchObject({ ok: false, error: { code: 'validation' } }); expect(h.invoke).not.toHaveBeenCalled() })
 test.each(['requesterId', 'ActorContactId', 'mss_appointmentstatus', 'id', 'isAdmin'])('denies browser payload extra %s', key => { const h = harness('POST', { operation: 'create', payload: { ...payload, [key]: actor } }); expect(h.call()).toMatchObject({ ok: false, error: { code: 'validation' } }); expect(h.invoke).not.toHaveBeenCalled() })
 test('converts bounded query page to numeric action payload', () => { const h = harness('GET', {}, { view: 'calendar', page: '2', month: '2026-10' }); h.invoke.mockReturnValue(envelope({ Result: JSON.stringify({ ok: true, appointments: [], nextLink: null, awaitingCount: 0 }) })); expect(h.call()).toMatchObject({ ok: true, appointments: [] }); expect(JSON.parse(h.invoke.mock.calls[0][2])).toEqual({ ActorContactId: actor, Command: 'calendar', Payload: JSON.stringify({ page: 2, month: '2026-10' }) }) })
 test.each([{ view: 'global' }, { view: 'incoming', page: '0' }, { view: 'incoming', page: '3334' }, { view: 'incoming', actor }, { view: 'calendar', month: '2026-99' }, { view: 'contacts', page: '1' }, { view: 'outgoing', month: '2026-10' }])('rejects unknown or malformed query %j', query => { const h = harness('GET', {}, query); expect(h.call()).toMatchObject({ ok: false, error: { code: 'validation' } }); expect(h.invoke).not.toHaveBeenCalled() })
 test('forwards accept with exact envelope', () => { const body = { operation: 'accept', id: activity, expectedRowVersion: '7', payload: { meetingLink: 'https://example.com' } }; const h = harness('POST', body); h.call(); expect(JSON.parse(JSON.parse(h.invoke.mock.calls[0][2]).Payload)).toEqual({ id: activity, expectedRowVersion: '7', payload: body.payload }) })
 test.each([envelope({ Result: JSON.stringify({ ok: false, error: { code: 'conflict', message: 'private tenant' } }) }), envelope({ error: 'private tenant' }, 500), 'invalid', envelope({ Result: JSON.stringify({ ok: false, error: { code: 'unknown', message: 'private tenant' } }) })])('sanitizes result or transport failure', raw => { const h = harness(); h.invoke.mockReturnValue(raw); const result = h.call(); expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain('private tenant') })
 test('sanitizes thrown errors', () => { const h = harness(); h.invoke.mockImplementation(() => { throw Error('private tenant') }); expect(h.call()).toMatchObject({ ok: false, error: { code: 'unavailable' } }) })
 test('exports only supported top-level functions, with no external globals', () => { const h = harness(); expect(Object.keys(h.context).sort()).toEqual(['Server', 'get', 'post']); expect(source).not.toMatch(/\b(fetch|window|document|require|process)\s*[.(]/) })
 test('rejects method mismatch and POST query injection', () => { const h = harness(); h.server.Context.HttpMethod = 'DELETE'; expect(h.call()).toMatchObject({ ok: false, error: { code: 'validation' } }); const q = harness('POST', { operation: 'create', payload }, { isAdmin: 'true' }); expect(q.call()).toMatchObject({ ok: false, error: { code: 'validation' } }) })
})

test('forwards all through the fixed action with only page and trusted actor', () => {
 const h = harness('GET', {}, { view: 'all', page: '2' })
 h.invoke.mockReturnValue(envelope({ Result: JSON.stringify({ ok: true, appointments: [], nextLink: '/_api/serverlogics/appointments?view=all&page=3', awaitingCount: 0 }) }))
 expect(h.call()).toMatchObject({ ok: true, nextLink: '/_api/serverlogics/appointments?view=all&page=3' })
 expect(JSON.parse(h.invoke.mock.calls[0][2])).toEqual({ ActorContactId: actor, Command: 'all', Payload: JSON.stringify({ page: 2 }) })
})
test('rejects a swapped continuation returned by the action', () => {
 const h = harness('GET', {}, { view: 'incoming' })
 h.invoke.mockReturnValue(envelope({ Result: JSON.stringify({ ok: true, appointments: [], nextLink: '/_api/serverlogics/appointments?view=outgoing&page=2', awaitingCount: 0 }) }))
 expect(h.call()).toMatchObject({ ok: false, error: { code: 'unavailable' } })
})
