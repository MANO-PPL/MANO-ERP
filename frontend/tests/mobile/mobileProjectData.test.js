import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestLoader } from '../../src/mobile/utils/createRequestLoader.js';

test('concurrent mobile project consumers share only the in-flight request', async () => {
    let calls = 0;
    let resolveRequest;
    const request = () => {
        calls += 1;
        if (calls === 1) return new Promise((resolve) => { resolveRequest = resolve; });
        return Promise.resolve({ success: true, projects: [] });
    };
    const load = createRequestLoader(request);
    const first = load();
    const second = load();
    assert.equal(first, second);
    assert.equal(calls, 0, 'request begins in the next microtask');
    await Promise.resolve();
    assert.equal(calls, 1);
    resolveRequest({ success: true, projects: [] });
    await Promise.all([first, second]);
    await load();
    assert.equal(calls, 2, 'completed responses are not cached');
});

test('a failed in-flight request can be retried', async () => {
    let calls = 0;
    const load = createRequestLoader(async () => {
        calls += 1;
        if (calls === 1) throw new Error('synthetic failure');
        return { success: true, projects: [] };
    });
    await assert.rejects(load(), /synthetic failure/);
    assert.deepEqual(await load(), { success: true, projects: [] });
    assert.equal(calls, 2);
});
