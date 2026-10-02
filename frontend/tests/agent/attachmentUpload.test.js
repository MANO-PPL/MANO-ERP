import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnectedTransport } from '../../src/services/agentTransport.js';

test('CSV upload uses multipart and refreshes an expired token once', async () => {
    let calls = 0; let refreshes = 0;
    const transport = createConnectedTransport({ refreshAuth: async () => { refreshes++; return 'refreshed'; },
        fetchImpl: async (url, options) => {
            assert.equal(url, '/api/agent/upload');
            assert.equal(options.headers['Content-Type'], undefined);
            assert.equal(options.body.get('file').name, 'fixture.csv');
            return ++calls === 1 ? new Response('{}', { status: 401 })
                : Response.json({ uploadId: 'fixture', filename: 'fixture.csv', totalRows: 1 });
        } });
    assert.equal((await transport.uploadFile(new File(['name\nAttachment QA'], 'fixture.csv'))).totalRows, 1);
    assert.equal(calls, 2); assert.equal(refreshes, 1);
});

test('denied and oversized uploads return safe actionable errors without retry', async () => {
    for (const [status, message] of [[403, 'authorization_denied'], [413, 'file_size_exceeded']]) {
        let refreshes = 0;
        const transport = createConnectedTransport({ refreshAuth: async () => { refreshes++; },
            fetchImpl: async () => new Response('{}', { status }) });
        await assert.rejects(transport.uploadFile(new File(['name\nQA'], 'fixture.csv')), { message });
        assert.equal(refreshes, 0);
    }
});
