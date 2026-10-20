// The three HTTP entry points share one request-scoped implementation. Only these
// supported entry points are declared at file scope; helpers remain private.
function get() {
    try {
        Server.Logger.Log('press-coverage GET');
        return post();
    } catch (error) {
        Server.Logger.Error('press-coverage GET failed');
        return JSON.stringify({ ok: false, error: { code: 'unavailable', message: 'Coverage is temporarily unavailable.' } });
    }
}

function patch() {
    try {
        Server.Logger.Log('press-coverage PATCH');
        return post();
    } catch (error) {
        Server.Logger.Error('press-coverage PATCH failed');
        return JSON.stringify({ ok: false, error: { code: 'unavailable', message: 'Coverage is temporarily unavailable.' } });
    }
}

function post() {
    const table = 'mss_presscoverages';
    const dateFields = ['mss_datepublishedaired', 'mss_publicationdate'];
    const pressFields = ['mss_headlinetitle', 'mss_mediaoutlet', 'mss_datepublishedaired', 'mss_oiaceventcampaign', 'mss_personinterviewedquoted', 'mss_reporterjournalist', 'mss_programsection', 'mss_articlevideourl', 'mss_summary', 'mss_keyquotes', 'mss_coveragetype', 'mss_coveragelevel', 'mss_tone', 'mss_keytopic', 'mss_oiacmentioned', 'mss_followupneeded', 'mss_relatedcontact'];
    const featuredFields = ['mss_publication', 'mss_headline', 'mss_shortsummary', 'mss_publicationdate', 'mss_originalarticlelink'];
    const selectFields = pressFields.filter((field) => { return field !== 'mss_relatedcontact'; }).concat(featuredFields, ['mss_presscoverageid', 'mss_isfeatured', '_mss_relatedcontact_value', '_mss_submittedby_value', 'mss_coveragefile', 'mss_coveragefile_name']);
    const choices = { mss_coveragetype: 5, mss_coveragelevel: 3, mss_tone: 4, mss_keytopic: 5 };
    const sdk = Server.Connector.Dataverse;
    const conversions = {};
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    function fail(code, message) { throw { coverageCode: code, coverageMessage: message }; }
    function invalid() { fail('validation', 'Check the coverage fields and try again.'); }
    function unavailable() { fail('unavailable', 'Coverage is temporarily unavailable.'); }
    function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
    function guid(value) {
        if (typeof value !== 'string') return null;
        const normalized = value.trim().replace(/^\{(.+)\}$/, '$1').toLowerCase();
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized) && normalized !== '00000000-0000-0000-0000-000000000000' ? normalized : null;
    }
    function requiredId(value) { const id = guid(value); if (!id) invalid(); return id; }
    function parse(value) { return typeof value === 'string' ? JSON.parse(value) : value; }

    // Every connector call checks transport status before reading the body. Never
    // propagate Dataverse error details or continuation tokens to the browser.
    function response(raw) {
        const result = parse(raw);
        if (!object(result) || !Number.isInteger(result.StatusCode)) unavailable();
        if (result.StatusCode === 401 || result.StatusCode === 403) fail('forbidden', 'You do not have permission to change this coverage.');
        if (result.StatusCode < 200 || result.StatusCode >= 300 || result.IsSuccessStatusCode === false || result.ServerError === true) unavailable();
        if (result.Body === '' || result.Body === null || result.Body === undefined) return {};
        const data = parse(result.Body);
        if (!object(data) || data.error) unavailable();
        return data;
    }
    function action(name, payload) { return response(sdk.InvokeCustomApi('post', name, JSON.stringify(payload))); }
    function target(id) { return { '@odata.type': 'Microsoft.Dynamics.CRM.mss_presscoverage', mss_presscoverageid: id }; }
    function selectOptions() { return '$select=' + selectFields.join(',') + '&$expand=mss_RelatedContact($select=contactid,fullname)'; }
    function retrieve(id) {
        const record = response(sdk.RetrieveRecord(table, id, selectOptions(), true));
        if (guid(record.mss_presscoverageid) !== id) unavailable();
        return record;
    }
    function canonicalDate(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const date = new Date(value + 'T12:00:00Z');
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '1753-01-01';
    }
    function localWallTime(utc) {
        if (typeof utc !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(utc) || Number.isNaN(new Date(utc).getTime())) unavailable();
        const key = 'local:' + utc;
        if (!Object.hasOwn(conversions, key)) {
            // The hosted connector supports Custom APIs, excluding built-in functions.
            const converted = action('mss_CoverageLocalTime', { UtcTime: utc });
            if (typeof converted.LocalTime !== 'string' || !canonicalDate(converted.LocalTime.slice(0, 10))) unavailable();
            const wallTime = new Date(converted.LocalTime).getTime();
            if (Number.isNaN(wallTime)) unavailable();
            conversions[key] = wallTime;
        }
        return conversions[key];
    }
    function localDate(utc) { return new Date(localWallTime(utc)).toISOString().slice(0, 10); }
    function utcDate(local) {
        const key = 'utc:' + local;
        if (!Object.hasOwn(conversions, key)) {
            // UtcTimeFromLocalTime is not exposed by this environment's Web API.
            // Invert the supported function using its actual historical rules.
            // Local noon represents the DateOnly value and avoids DST gaps at
            // midnight. Verify the precise wall time before persisting anything.
            const desired = new Date(local + 'T12:00:00Z').getTime();
            let candidate = desired;
            for (let attempt = 0; attempt < 3; attempt++) {
                const utc = new Date(candidate).toISOString();
                const actual = localWallTime(utc);
                if (actual === desired) { conversions[key] = utc; break; }
                candidate += desired - actual;
            }
            if (!Object.hasOwn(conversions, key)) unavailable();
        }
        return conversions[key];
    }
    function normalize(record) {
        if (!object(record) || !guid(record.mss_presscoverageid)) unavailable();
        const result = {};
        selectFields.forEach((field) => {
            if (Object.hasOwn(record, field)) result[field] = record[field];
            const formatted = field + '@OData.Community.Display.V1.FormattedValue';
            if (typeof record[formatted] === 'string') result[formatted] = record[formatted];
        });
        dateFields.forEach((field) => { if (result[field]) result[field] = localDate(result[field]); });
        if (object(record.mss_RelatedContact) && typeof record.mss_RelatedContact.fullname === 'string') {
            result['_mss_relatedcontact_value@OData.Community.Display.V1.FormattedValue'] = record.mss_RelatedContact.fullname;
        }
        return result;
    }
    function fileType(name) {
        if (typeof name !== 'string' || name.length < 1 || name.length > 128 || name !== name.trim() || /[\x00-\x1f\x7f<>:"/\\|?*]/.test(name) || name.slice(-1) === '.') invalid();
        const extension = name.split('.').pop().toLowerCase();
        const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };
        if (!Object.hasOwn(types, extension)) invalid();
        return types[extension];
    }
    function base64Size(data, maximum) {
        // Avoid a repeated-group regexp on a multi-megabyte input (stack overflow
        // in some JavaScript engines). Inspect only the alphabet and final padding.
        if (typeof data !== 'string' || !data.length || data.length > Math.ceil(maximum / 3) * 4 || data.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(data)) invalid();
        const padding = data.slice(-2) === '==' ? 2 : data.slice(-1) === '=' ? 1 : 0;
        if (data.indexOf('=') !== (padding ? data.length - padding : -1)) invalid();
        const size = data.length / 4 * 3 - padding;
        if (size < 1 || size > maximum) invalid();
        if (padding && (alphabet.indexOf(data[data.length - padding - 1]) & (padding === 2 ? 15 : 3)) !== 0) invalid();
        return size;
    }
    function signature(data, mime) {
        const bytes = [];
        for (let offset = 0; offset < Math.min(data.length, 16); offset += 4) {
            const a = alphabet.indexOf(data[offset]);
            const b = alphabet.indexOf(data[offset + 1]);
            const c = alphabet.indexOf(data[offset + 2]);
            const d = alphabet.indexOf(data[offset + 3]);
            bytes.push((a << 2) | (b >> 4));
            if (c >= 0) bytes.push(((b & 15) << 4) | (c >> 2));
            if (d >= 0) bytes.push(((c & 3) << 6) | d);
        }
        function starts(values, offset) { return values.every((value, index) => { return bytes[index + (offset || 0)] === value; }); }
        if (mime === 'image/png' && starts([137, 80, 78, 71, 13, 10, 26, 10])) return;
        if (mime === 'image/jpeg' && starts([255, 216, 255])) return;
        if (mime === 'application/pdf' && starts([37, 80, 68, 70, 45])) return;
        if (mime === 'image/webp' && starts([82, 73, 70, 70]) && starts([87, 69, 66, 80], 8)) return;
        invalid();
    }
    function token(result) { if (typeof result.FileContinuationToken !== 'string' || !result.FileContinuationToken.length) unavailable(); return result.FileContinuationToken; }
    function download(id) {
        retrieve(id); // Read authorization is required before issuing file actions.
        const initialized = action('InitializeFileBlocksDownload', { Target: target(id), FileAttributeName: 'mss_coveragefile' });
        const fileName = initialized.FileName;
        const mimeType = fileType(fileName);
        const size = initialized.FileSizeInBytes;
        if (!Number.isInteger(size) || size < 1 || size > 10 * 1024 * 1024) unavailable();
        const continuation = token(initialized);
        // Three MB is divisible by three. Every nonfinal block has no base64
        // padding, so joining its encoded data preserves the original bytes.
        const blockSize = initialized.IsChunkingSupported === false ? size : 3 * 1024 * 1024;
        const blocks = [];
        for (let offset = 0; offset < size; offset += blockSize) {
            const length = Math.min(blockSize, size - offset);
            const block = action('DownloadBlock', { Offset: offset, BlockLength: length, FileContinuationToken: continuation });
            if (base64Size(block.Data, length) !== length) unavailable();
            blocks.push(block.Data);
        }
        const data = blocks.join('');
        if (base64Size(data, 10 * 1024 * 1024) !== size) unavailable();
        signature(data, mimeType);
        return { ok: true, fileName: fileName, mimeType: mimeType, data: data };
    }
    function read() {
        const query = Server.Context.QueryParameters || {};
        if (Object.keys(query).some((key) => { return ['id', 'page', 'operation'].indexOf(key) < 0; })) invalid();
        if (query.operation !== undefined) {
            if (query.operation !== 'file' || query.page !== undefined) invalid();
            return download(requiredId(query.id));
        }
        if (query.id !== undefined) {
            if (query.page !== undefined) invalid();
            return { ok: true, record: normalize(retrieve(requiredId(query.id))) };
        }
        const pageString = query.page === undefined ? '1' : query.page;
        if (typeof pageString !== 'string' || !/^[1-9]\d*$/.test(pageString)) invalid();
        const page = Number(pageString);
        // Dataverse simple paging is limited to 50,000 rows; pages are fixed at 15.
        if (!Number.isInteger(page) || page > 3333) invalid();
        const attributes = selectFields.map((field) => { return '<attribute name="' + (field === '_mss_relatedcontact_value' ? 'mss_relatedcontact' : field === '_mss_submittedby_value' ? 'mss_submittedby' : field) + '" />'; }).join('');
        const fetch = '<fetch count="15" page="' + page + '"><entity name="mss_presscoverage">' + attributes + '<order attribute="mss_isfeatured" descending="true" /><order attribute="createdon" descending="true" /><order attribute="mss_presscoverageid" descending="false" /><link-entity name="contact" from="contactid" to="mss_relatedcontact" link-type="outer" alias="related"><attribute name="fullname" alias="related_contact_name" /></link-entity></entity></fetch>';
        const result = response(sdk.RetrieveMultipleRecords(table, 'fetchXml=' + encodeURIComponent(fetch), true));
        if (!Array.isArray(result.value) || result.value.length > 15) unavailable();
        const records = result.value.map((record) => {
            if (typeof record.related_contact_name === 'string') record.mss_RelatedContact = { fullname: record.related_contact_name };
            return normalize(record);
        });
        return { ok: true, records: records, nextLink: records.length === 15 && page < 3333 ? '/_api/serverlogics/press-coverage?page=' + (page + 1) : null };
    }
    function variant(record, requested) {
        if (requested !== 'press' && requested !== 'featured') invalid();
        if (record && (record.mss_isfeatured === true) !== (requested === 'featured')) invalid();
    }
    function validateFields(fields, requested, previous) {
        if (!object(fields)) invalid();
        const allowed = requested === 'press' ? pressFields : featuredFields;
        const changes = {};
        Object.keys(fields).forEach((field) => {
            if (allowed.indexOf(field) < 0) invalid();
            let value = fields[field];
            if (value !== null) {
                if (Object.hasOwn(choices, field)) {
                    if (!Number.isInteger(value) || value < 866530000 || value >= 866530000 + choices[field]) invalid();
                } else if (field === 'mss_oiacmentioned' || field === 'mss_followupneeded') {
                    if (typeof value !== 'boolean') invalid();
                } else if (field === 'mss_relatedcontact') {
                    value = requiredId(value);
                } else {
                    if (typeof value !== 'string') invalid();
                    value = value.trim();
                    if (dateFields.indexOf(field) >= 0) {
                        if (!canonicalDate(value)) invalid();
                    } else if (value.length > (field === 'mss_headlinetitle' ? 850 : 100)) invalid();
                    if ((field === 'mss_articlevideourl' || field === 'mss_originalarticlelink') && value && (!/^https?:\/\/[^\s\x00-\x1f\x7f/?#]+(?:[/?#][^\s\x00-\x1f\x7f]*)?$/i.test(value) || /[\\<>]/.test(value))) invalid();
                    if (value === '') value = null;
                }
            }
            changes[field] = value;
        });
        // Existing unedited fields may contain imported data. Validate required
        // values after merging, while applying type/length rules to changed data.
        const merged = Object.assign({}, previous || {}, changes);
        const required = requested === 'press' ? ['mss_headlinetitle', 'mss_mediaoutlet', 'mss_datepublishedaired'] : featuredFields;
        required.forEach((field) => { if (typeof merged[field] !== 'string' || !merged[field].trim()) invalid(); });
        const payload = {};
        Object.keys(changes).forEach((field) => {
            if (field === 'mss_relatedcontact') {
                // An unselected optional lookup needs no relationship on create.
                // Disassociate existing rows with the unannotated navigation property.
                if (changes[field] !== null) payload['mss_RelatedContact@odata.bind'] = '/contacts(' + changes[field] + ')';
                else if (previous) payload.mss_RelatedContact = null;
            }
            else payload[field] = dateFields.indexOf(field) >= 0 && changes[field] !== null ? utcDate(changes[field]) : changes[field];
        });
        return payload;
    }
    function upload(body) {
        const id = requiredId(body.id);
        const existing = retrieve(id);
        variant(existing, body.variant);
        const mimeType = fileType(body.fileName);
        if (body.mimeType !== mimeType || body.variant === 'featured' && mimeType === 'application/pdf') invalid();
        base64Size(body.data, (body.variant === 'featured' ? 2 : 10) * 1024 * 1024);
        signature(body.data, mimeType);
        // Invoke UpdateRecord even if the content fields are unchanged. It is the
        // authoritative portal table-permission write check before file actions.
        const check = existing.mss_isfeatured === true ? { mss_headline: existing.mss_headline || null } : { mss_headlinetitle: existing.mss_headlinetitle || null };
        response(sdk.UpdateRecord(table, id, JSON.stringify(check)));
        const initialized = action('InitializeFileBlocksUpload', { Target: target(id), FileAttributeName: 'mss_coveragefile', FileName: body.fileName });
        const continuation = token(initialized);
        const blocks = [];
        // Four MB of base64 represents three MB of bytes, below the 4MB SDK
        // block limit. Fixed-length ASCII IDs are base64 encoded without APIs.
        for (let offset = 0, index = 0; offset < body.data.length; offset += 4 * 1024 * 1024, index++) {
            // At most four blocks fit the 10MB limit. These are the base64
            // representations of equal-length IDs 00000000 through 00000003.
            const blockId = ['MDAwMDAwMDA=', 'MDAwMDAwMDE=', 'MDAwMDAwMDI=', 'MDAwMDAwMDM='][index];
            blocks.push(blockId);
            action('UploadBlock', { BlockId: blockId, BlockData: body.data.slice(offset, offset + 4 * 1024 * 1024), FileContinuationToken: continuation });
        }
        action('CommitFileBlocksUpload', { BlockList: blocks, FileContinuationToken: continuation, FileName: body.fileName, MimeType: mimeType });
        return { ok: true, id: id };
    }

    function fileCommand(body, contactId) {
        if (Object.keys(body).some((key) => { return ['operation', 'command', 'payload'].indexOf(key) < 0; }) || !object(body.payload)) invalid();
        const keys = {
            begin: ['id', 'variant', 'fileName', 'mimeType', 'size', 'sessionId'],
            chunk: ['id', 'sessionId', 'index', 'data'],
            commit: ['id', 'sessionId'],
            info: ['id'],
            read: ['id', 'fileId', 'offset', 'length']
        };
        if (typeof body.command !== 'string' || !Object.hasOwn(keys, body.command)) invalid();
        const payload = body.payload;
        const allowed = keys[body.command];
        if (Object.keys(payload).length !== allowed.length || Object.keys(payload).some((key) => { return allowed.indexOf(key) < 0; })) invalid();
        const id = requiredId(payload.id);
        if (body.command === 'begin' || body.command === 'chunk' || body.command === 'commit') requiredId(payload.sessionId);
        if (body.command === 'begin') {
            variant(null, payload.variant);
            const mime = fileType(payload.fileName);
            if (mime !== payload.mimeType || payload.variant === 'featured' && mime === 'application/pdf'
                || !Number.isInteger(payload.size) || payload.size < 1 || payload.size > (payload.variant === 'featured' ? 2 : 10) * 1024 * 1024) invalid();
        }
        if (body.command === 'chunk') {
            if (!Number.isInteger(payload.index) || payload.index < 0 || payload.index >= 40) invalid();
            base64Size(payload.data, 256 * 1024);
        }
        if (body.command === 'read') {
            requiredId(payload.fileId);
            if (!Number.isInteger(payload.offset) || payload.offset < 0 || payload.offset >= 10 * 1024 * 1024
                || !Number.isInteger(payload.length) || payload.length < 1 || payload.length > 256 * 1024
                || payload.offset + payload.length > 10 * 1024 * 1024) invalid();
        }
        const existing = retrieve(id); // Existing portal Read permission is authoritative.
        if (body.command === 'begin') variant(existing, payload.variant);
        if (body.command !== 'info' && body.command !== 'read') {
            // Check portal Write permission without copying any business field:
            // a concurrent editor's headline must never be overwritten by chunks.
            response(sdk.UpdateRecord(table, id, '{}'));
        }
        const native = action('mss_CoverageFileCommand', { ActorContactId: contactId, Command: body.command, Payload: JSON.stringify(payload) });
        const result = parse(native.Result);
        if (!object(result) || typeof result.ok !== 'boolean') unavailable();
        return result;
    }

    try {
        const method = Server.Context.HttpMethod;
        Server.Logger.Log('press-coverage request ' + method);
        const user = Server.User;
        const contactId = user && guid(String(user.contactid || user.ContactId || user.Id || user.id || ''));
        if (!contactId) fail('unauthenticated', 'Sign in to access press coverage.');
        if (method === 'GET') {
            const result = read();
            Server.Logger.Log('press-coverage read complete');
            return JSON.stringify(result);
        }
        const body = parse(Server.Context.Body);
        if (!object(body)) invalid();
        if (method === 'POST' && body.operation === 'file') {
            if (typeof Server.Context.Body === 'string' && Server.Context.Body.length > 400000) invalid();
            return JSON.stringify(fileCommand(body, contactId));
        }
        variant(null, body.variant);
        const uploadOperation = method === 'POST' && body.operation === 'upload';
        const createOperation = method === 'POST' && body.operation === 'create';
        const updateOperation = method === 'PATCH' && body.operation === 'update';
        if (!uploadOperation && !createOperation && !updateOperation) invalid();
        const allowedKeys = uploadOperation ? ['operation', 'id', 'variant', 'fileName', 'mimeType', 'data'] : createOperation ? ['operation', 'variant', 'fields'] : ['operation', 'id', 'variant', 'fields'];
        if (Object.keys(body).some((key) => { return allowedKeys.indexOf(key) < 0; })) invalid();
        if (uploadOperation) {
            const result = upload(body);
            Server.Logger.Log('press-coverage upload complete');
            return JSON.stringify(result);
        }
        const id = createOperation ? requiredId(Server.Context.ActivityId) : requiredId(body.id);
        const existing = updateOperation ? retrieve(id) : null;
        variant(existing, body.variant);
        const payload = validateFields(body.fields, body.variant, existing);
        if (createOperation) {
            payload.mss_presscoverageid = id;
            payload.mss_isfeatured = body.variant === 'featured';
            payload['mss_SubmittedBy@odata.bind'] = '/contacts(' + contactId + ')';
            response(sdk.CreateRecord(table, JSON.stringify(payload)));
        } else {
            response(sdk.UpdateRecord(table, id, JSON.stringify(payload)));
        }
        Server.Logger.Log('press-coverage save complete');
        return JSON.stringify({ ok: true, id: id });
    } catch (error) {
        Server.Logger.Error('press-coverage request rejected');
        const known = error && ['validation', 'unauthenticated', 'forbidden', 'unavailable'].indexOf(error.coverageCode) >= 0;
        return JSON.stringify({ ok: false, error: { code: known ? error.coverageCode : 'unavailable', message: known ? error.coverageMessage : 'Coverage is temporarily unavailable.' } });
    }
}
