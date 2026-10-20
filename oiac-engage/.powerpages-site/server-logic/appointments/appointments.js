// Only supported entry points are declared at file scope; helpers are private.
function get() { return post(); }
function post() {
    function fail(code) { throw { appointmentCode: code }; }
    function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
    function keys(value, allowed) { if (!object(value) || Object.keys(value).some((key) => { return allowed.indexOf(key) < 0; })) fail('validation'); }
    function guid(value) { return typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) && value !== '00000000-0000-0000-0000-000000000000'; }
    function parse(value) { return typeof value === 'string' ? JSON.parse(value) : value; }
    function message(code) { return code === 'validation' ? 'Check the appointment fields and try again.' : code === 'unauthenticated' ? 'Sign in to continue.' : code === 'forbidden' ? 'You do not have permission to perform this action.' : code === 'conflict' ? 'This appointment changed. Refresh it and try again.' : 'Appointments are temporarily unavailable.'; }
    function result(raw, command, payload) {
        const transport = parse(raw);
        if (!object(transport) || !Number.isInteger(transport.StatusCode)) fail('unavailable');
        if (transport.StatusCode === 401 || transport.StatusCode === 403) fail('forbidden');
        if (transport.StatusCode < 200 || transport.StatusCode >= 300 || transport.IsSuccessStatusCode === false || transport.ServerError === true) fail('unavailable');
        const body = parse(transport.Body);
        if (!object(body) || body.error || typeof body.Result !== 'string') fail('unavailable');
        const output = parse(body.Result);
        if (!object(output)) fail('unavailable');
        if (output.ok === false) {
            const code = object(output.error) && ['validation', 'unauthenticated', 'forbidden', 'conflict', 'unavailable'].indexOf(output.error.code) >= 0 ? output.error.code : 'unavailable';
            fail(code);
        }
        if (output.ok !== true) fail('unavailable');
        if (['create', 'accept', 'reschedule'].indexOf(command) >= 0) {
            if (!guid(output.id)) fail('unavailable');
            return { ok: true, id: output.id };
        }
        if (command === 'contacts') {
            if (!Array.isArray(output.contacts) || output.contacts.length > 15) fail('unavailable');
            return { ok: true, contacts: output.contacts.map((person) => {
                if (!object(person) || !guid(person.id) || typeof person.name !== 'string') fail('unavailable');
                return { id: person.id, name: person.name };
            }) };
        }
        if (!Array.isArray(output.appointments) || output.appointments.length > 15 || !Number.isInteger(output.awaitingCount) || output.awaitingCount < 0) fail('unavailable');
        if (output.nextLink !== null && (typeof output.nextLink !== 'string' || !/^\/_api\/serverlogics\/appointments\?view=(incoming|outgoing|all|calendar)&page=[1-9]\d{0,3}(&month=\d{4}-(0[1-9]|1[0-2]))?$/.test(output.nextLink))) fail('unavailable');
        if (output.nextLink !== null) {
            const expected = '/_api/serverlogics/appointments?view=' + command + '&page=';
            const match = output.nextLink.match(/&page=([1-9]\d*)/);
            if (output.nextLink.indexOf(expected) !== 0 || !match || Number(match[1]) <= payload.page || Number(match[1]) > 3333
                || output.nextLink !== expected + match[1] + (command === 'calendar' ? '&month=' + payload.month : '')) fail('unavailable');
        }
        const fields = ['id', 'title', 'status', 'statusLabel', 'meetingFormat', 'meetingFormatLabel', 'preferredDateTime', 'suggestedDateTime', 'agenda', 'meetingLink', 'reschedulingReason', 'requester', 'recipient', 'rowVersion'];
        return { ok: true, appointments: output.appointments.map((row) => {
            if (!object(row) || !guid(row.id)) fail('unavailable');
            const clean = {};
            fields.forEach((field) => { clean[field] = row[field]; });
            ['requester', 'recipient'].forEach((field) => {
                const person = row[field];
                if (person === null) clean[field] = null;
                else {
                    if (!object(person) || !guid(person.id) || typeof person.name !== 'string') fail('unavailable');
                    clean[field] = { id: person.id, name: person.name };
                }
            });
            return clean;
        }), nextLink: output.nextLink, awaitingCount: output.awaitingCount };
    }
    try {
        const user = Server.User;
        const actorContactId = user && String(user.contactid || user.ContactId || user.Id || user.id || '').trim().replace(/^\{(.+)\}$/, '$1').toLowerCase();
        if (!object(user) || !guid(actorContactId)) fail('unauthenticated');
        const query = Server.Context.QueryParameters || {};
        const method = Server.Context.HttpMethod;
        let command, payload;
        if (method === 'GET') {
            const view = query.view;
            if (['incoming', 'outgoing', 'all', 'calendar', 'contacts'].indexOf(view) < 0) fail('validation');
            command = view;
            if (view === 'contacts') {
                keys(query, ['view', 'q']);
                if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 100)) fail('validation');
                payload = { q: query.q || '' };
            } else {
                keys(query, view === 'calendar' ? ['view', 'page', 'month'] : ['view', 'page']);
                const page = query.page === undefined ? '1' : query.page;
                if (typeof page !== 'string' || !/^[1-9]\d*$/.test(page) || Number(page) > 3333) fail('validation');
                payload = { page: Number(page) };
                if (view === 'calendar') {
                    if (typeof query.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(query.month)) fail('validation');
                    payload.month = query.month;
                }
            }
        } else if (method === 'POST') {
            keys(query, []);
            if (typeof Server.Context.Body !== 'string' || Server.Context.Body.length > 16384) fail('validation');
            let body;
            try { body = JSON.parse(Server.Context.Body); } catch (invalidBody) { fail('validation'); }
            if (!object(body) || ['create', 'accept', 'reschedule'].indexOf(body.operation) < 0) fail('validation');
            command = body.operation;
            keys(body, command === 'create' ? ['operation', 'payload'] : ['operation', 'id', 'expectedRowVersion', 'payload']);
            keys(body.payload, command === 'create' ? ['title', 'recipientId', 'meetingFormat', 'preferredDate', 'preferredTime', 'preferredOffsetMinutes', 'agenda'] : command === 'accept' ? ['meetingLink'] : ['reason', 'suggestedDate', 'suggestedTime', 'suggestedOffsetMinutes']);
            if (command === 'create') {
                if (!guid(Server.Context.ActivityId)) fail('unavailable');
                payload = Object.assign({}, body.payload, { id: Server.Context.ActivityId });
            } else {
                if (!guid(body.id) || typeof body.expectedRowVersion !== 'string' || !/^[1-9]\d{0,29}$/.test(body.expectedRowVersion)) fail('validation');
                payload = { id: body.id, expectedRowVersion: body.expectedRowVersion, payload: body.payload };
            }
        } else fail('validation');
        // The browser cannot choose actor, API path, verb, or a freeform command.
        const raw = Server.Connector.Dataverse.InvokeCustomApi('post', 'mss_AppointmentCommand', JSON.stringify({ ActorContactId: actorContactId, Command: command, Payload: JSON.stringify(payload) }));
        return JSON.stringify(result(raw, command, payload));
    } catch (error) {
        const code = error && ['validation', 'unauthenticated', 'forbidden', 'conflict', 'unavailable'].indexOf(error.appointmentCode) >= 0 ? error.appointmentCode : 'unavailable';
        return JSON.stringify({ ok: false, error: { code: code, message: message(code) } });
    }
}
