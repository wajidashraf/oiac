import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(new URL('../../.powerpages-site/server-logic/site-activity-log/site-activity-log.js', import.meta.url), 'utf8');
const actor = '11111111-1111-4111-8111-111111111111';
const payload = { scope: 'mine', page: 1, module: null, action: null, from: null, to: null };
function run(body, options = {}) {
  const calls = [];
  const Server = { User: options.anonymous ? null : { contactid: actor }, Context: { HttpMethod: 'POST', QueryParameters: {}, Body: JSON.stringify(body) }, Connector: { Dataverse: { InvokeCustomApi(method, api, text) {
    const input = JSON.parse(text); calls.push(input);
    assert.equal(input.ActorContactId, actor); assert.equal(api, 'mss_SiteActivityLogRead');
    if (input.Command === 'count' && options.countFails) throw Error('native count failed');
    const result = input.Command === 'count' ? { ok: true, totalCount: 42 } : { ok: true, entries: [], nextPage: null, totalCount: null, canViewAll: false };
    return { StatusCode: 200, Body: { Result: JSON.stringify(result) } };
  } } } };
  const context = vm.createContext({ Server }); vm.runInContext(code, context);
  return { result: JSON.parse(context.post()), calls };
}
assert.equal(run({ command: 'list', payload }).result.totalCount, 42);
assert.equal(run({ command: 'list', payload }, { countFails: true }).result.totalCount, null);
assert.equal(run({ command: 'list', payload }, { countFails: true }).result.ok, true);
for (const body of [{ command: 'append', payload }, { command: 'count', payload }, { command: 'list', payload, actor }, { command: 'list', payload: { ...payload, actor } }]) {
 const x = run(body); assert.equal(x.result.error.code, 'validation'); assert.equal(x.calls.length, 0);
}
assert.equal(run({ command: 'list', payload }, { anonymous: true }).result.error.code, 'unauthenticated');
assert.equal(run({ command: 'detail', payload: { scope: 'mine', id: actor } }).calls.length, 1);
for (const p of [{ ...payload, page: 0 }, { ...payload, from: '2026-01-01' }, { ...payload, from: '2026-10-01T00:00:00Z', to: '2026-09-01T00:00:00Z' }]) assert.equal(run({ command: 'list', payload: p }).result.error.code, 'validation');
console.log('PASS trusted bridge actor stamping, rejected forged fields/arbitrary append, separate count failure, strict date and paging validation');
