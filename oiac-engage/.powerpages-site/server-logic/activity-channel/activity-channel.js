function post() {
    function fail(code) { throw { activityCode: code }; }
    function object(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
    function keys(v, allowed) { if (!object(v) || Object.keys(v).length !== allowed.length || Object.keys(v).some((key) => { return allowed.indexOf(key) < 0; })) fail('validation'); }
    function guid(v) { return typeof v === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v) && v !== '00000000-0000-0000-0000-000000000000'; }
    function parse(v) { return typeof v === 'string' ? JSON.parse(v) : v; }
    function invoke(command, payload, actor) {
        const raw = parse(Server.Connector.Dataverse.InvokeCustomApi('post', 'mss_ActivityChannelCommand', JSON.stringify({ ActorContactId: actor, Command: command, Payload: JSON.stringify(payload) })));
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
        if (Server.Context.HttpMethod !== 'POST' || Object.keys(Server.Context.QueryParameters || {}).length || typeof Server.Context.Body !== 'string' || Server.Context.Body.length > 65536) fail('validation');
        let body;
        try { body = JSON.parse(Server.Context.Body); } catch (invalidBody) { fail('validation'); }
        keys(body, ['command', 'payload']);
        const command = body.command;
        const p = body.payload;
        if (command === 'feed') {
            keys(p, ['phase', 'page']);
            if (['pinned', 'regular'].indexOf(p.phase) < 0 || !Number.isInteger(p.page) || p.page < 1 || p.page > 2500) fail('validation');
        } else if (command === 'comments') {
            keys(p, ['postIds', 'page']);
            if (!Array.isArray(p.postIds) || !p.postIds.length || p.postIds.length > 40 || p.postIds.some((id, index) => { return !guid(id) || p.postIds.indexOf(id) !== index; }) || !Number.isInteger(p.page) || p.page < 1 || p.page > 2500) fail('validation');
        } else if (['post', 'comment', 'reply'].indexOf(command) >= 0) {
            keys(p, command === 'post' ? ['requestId', 'content'] : command === 'comment' ? ['requestId', 'postId', 'content'] : ['requestId', 'postId', 'parentId', 'content']);
            if (!guid(p.requestId) || typeof p.content !== 'string' || !p.content.trim() || p.content.length > 8000 || (command !== 'post' && !guid(p.postId)) || (command === 'reply' && !guid(p.parentId))) fail('validation');
        } else if (['pin', 'unpin', 'remove'].indexOf(command) >= 0) {
            keys(p, ['id', 'expectedRowVersion']);
            if (!guid(p.id) || typeof p.expectedRowVersion !== 'string' || !/^[1-9]\d{0,29}$/.test(p.expectedRowVersion)) fail('validation');
        } else fail('validation');
        const result = invoke(command, p, actor);
        if (command === 'feed') {
            result.totalCount = null;
            result.countUnavailable = true;
            try {
                const count = invoke('count', {}, actor);
                if (Number.isSafeInteger(count.totalCount) && count.totalCount >= 0) { result.totalCount = count.totalCount; result.countUnavailable = false; }
            } catch (countError) { /* Independent aggregate failure must preserve a usable feed. */ }
        }
        return JSON.stringify(result);
    } catch (error) {
        const code = error && ['unauthenticated', 'forbidden', 'validation', 'not_found', 'conflict', 'unavailable'].indexOf(error.activityCode) >= 0 ? error.activityCode : 'unavailable';
        const messages = { unauthenticated: 'Sign in to continue.', forbidden: 'You do not have permission to perform this action.', validation: 'Check the activity fields and try again.', not_found: 'This activity is no longer available.', conflict: 'This activity changed. Refresh it and try again.', unavailable: 'Activity Channel is temporarily unavailable.' };
        return JSON.stringify({ ok: false, error: { code: code, message: messages[code] } });
    }
}
