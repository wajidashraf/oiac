function post() {
    function fail(code) { throw { historyCode: code }; }
    function object(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
    function keys(v, allowed) { if (!object(v) || Object.keys(v).length !== allowed.length || Object.keys(v).some((key) => { return allowed.indexOf(key) < 0; })) fail('validation'); }
    function guid(v) { return typeof v === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v) && v !== '00000000-0000-0000-0000-000000000000'; }
    function parse(v) { return typeof v === 'string' ? JSON.parse(v) : v; }
    function invoke(command, payload, actor) {
        const raw = parse(Server.Connector.Dataverse.InvokeCustomApi('post', 'mss_SiteActivityLogRead', JSON.stringify({ ActorContactId: actor, Command: command, Payload: JSON.stringify(payload) })));
        if (!object(raw) || !Number.isInteger(raw.StatusCode) || raw.StatusCode < 200 || raw.StatusCode >= 300 || raw.IsSuccessStatusCode === false || raw.ServerError === true) fail('unavailable');
        const body = parse(raw.Body);
        if (!object(body) || body.error || typeof body.Result !== 'string') fail('unavailable');
        const result = parse(body.Result);
        if (!object(result) || (result.ok !== true && result.ok !== false)) fail('unavailable');
        if (result.ok === false) fail(object(result.error) ? result.error.code : 'unavailable');
        return result;
    }
    try {
        const user = Server.User;
        const actor = user && String(user.contactid || user.ContactId || user.Id || user.id || '').trim().replace(/^\{(.+)\}$/, '$1').toLowerCase();
        if (!object(user) || !guid(actor)) fail('unauthenticated');
        if (Server.Context.HttpMethod !== 'POST' || Object.keys(Server.Context.QueryParameters || {}).length || typeof Server.Context.Body !== 'string' || Server.Context.Body.length > 4000) fail('validation');
        let body;
        try { body = JSON.parse(Server.Context.Body); } catch (invalidBody) { fail('validation'); }
        keys(body, ['command', 'payload']);
        const p = body.payload;
        if (body.command === 'list') {
            keys(p, ['scope', 'page', 'module', 'action', 'from', 'to']);
            if (!Number.isInteger(p.page) || p.page < 1 || p.page > 2500) fail('validation');
            if (p.module !== null && (!Number.isInteger(p.module) || p.module < 866530000 || p.module > 866530007)) fail('validation');
            if (p.action !== null && (!Number.isInteger(p.action) || p.action < 866530000 || p.action > 866530017)) fail('validation');
            [p.from, p.to].forEach((v) => { if (v !== null && (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?(?:Z|[+-]\d\d:\d\d)$/.test(v) || !Number.isFinite(Date.parse(v)))) fail('validation'); });
            if (p.from !== null && p.to !== null && Date.parse(p.from) >= Date.parse(p.to)) fail('validation');
        } else if (body.command === 'detail') {
            keys(p, ['id', 'scope']);
            if (!guid(p.id)) fail('validation');
        } else fail('validation');
        if (['mine', 'all'].indexOf(p.scope) < 0) fail('validation');
        const result = invoke(body.command, p, actor);
        if (body.command === 'list') {
            result.totalCount = null;
            try {
                const count = invoke('count', p, actor);
                if (Number.isSafeInteger(count.totalCount) && count.totalCount >= 0) result.totalCount = count.totalCount;
            } catch (countError) { /* Independent count invocation cannot invalidate a successful list. */ }
        }
        return JSON.stringify(result);
    } catch (error) {
        const code = error && ['unauthenticated', 'forbidden', 'validation', 'not_found', 'unavailable'].indexOf(error.historyCode) >= 0 ? error.historyCode : 'unavailable';
        return JSON.stringify({ ok: false, error: { code: code } });
    }
}
