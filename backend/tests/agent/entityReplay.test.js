import test from 'node:test';
import assert from 'node:assert/strict';
import { createPolicy } from '../../src/modules/agent/agentPolicy.js';
import { createReadService } from '../../src/modules/agent/agentReadService.js';
import { TOOLS } from '../../src/modules/agent/agentTools.js';
import { actor, answer, body, harness, intent, queryFixture } from './fixtures.js';

// Real Node policy, read adapter and orchestrator; mutable relational fixtures
// and the transactional memory model, not a claim of real MySQL validation.
function projectFixture(ids = [10]) {
    const tables = {
        iam_users: [{ user_id: 7, org_id: 2, user_type: 'employee' }],
        proj_projects: ids.map(id => ({ id, org_id: 2, name: `Tower ${id}` })),
        proj_members: ids.map(project_id => ({ project_id, user_id: 7, org_id: 2 }))
    };
    const authorize = createPolicy(queryFixture(tables));
    const seen = []; const replies = [];
    const projects = {
        async getProjects(orgId, userId, userType, options) {
            assert.equal(options.agentRead, true);
            // Mirrors the actual agentRead org + correlated membership filter.
            return tables.proj_projects.filter(p => p.org_id === orgId
                && (userType === 'admin' || tables.proj_members.some(m => m.project_id === p.id && m.org_id === orgId && m.user_id === userId))
                && (!options.query || p.name.includes(options.query)))
                .sort((a, b) => a.id - b.id).slice(options.offset, options.offset + options.limit)
                .map(({ id, name }) => ({ id, name }));
        }
    };
    const read = createReadService({ projects, authorize });
    const h = harness({ authorize, read, reason: async request => { seen.push(structuredClone(request)); return replies.shift() || answer; } });
    return { ...h, tables, authorize, seen,
        revoke(id) { tables.proj_members = tables.proj_members.filter(m => m.project_id !== id); },
        async search(query = 'Tower', message = 'List the Tower projects') {
            replies.push(intent('projects.search', { query, limit: 50 }), { ...answer, text: 'The authorized Tower project results are shown.' });
            return h.submit(body(message));
        }
    };
}
const refs = (f, id) => f.store.state.requests.get(id).context_json.authorizationRefs;
const projectIds = (f, id) => refs(f, id).filter(r => r.tool === 'projects.get').map(r => r.arguments.projectId).sort((a, b) => a - b);
async function denyWithoutEvents(f, requestId) {
    let eventReads = 0;
    const events = f.store.events.bind(f.store);
    f.store.events = (...args) => { eventReads++; return events(...args); };
    await assert.rejects(f.service.replay(actor, requestId), { code: 'authorization_denied' });
    assert.equal(eventReads, 0, 'No stale event payload may leave the store');
}

test('entity A: revoked project membership denies replay while generic search stays authorized', async () => {
    const f = projectFixture(); const result = await f.search();
    assert.deepEqual(projectIds(f, result.requestId), [10]);
    assert.ok(result.events.some(e => e.type === 'tool_completed'));
    f.revoke(10);
    await f.authorize(actor, TOOLS['projects.search'], { query: 'Tower' });
    await denyWithoutEvents(f, result.requestId);
});

test('entity B: unchanged membership permits the identical durable replay', async () => {
    const f = projectFixture(); const result = await f.search();
    assert.deepEqual(await f.service.replay(actor, result.requestId), result.events);
});

test('entity C: losing one of multiple returned projects denies the entire replay', async () => {
    const f = projectFixture([10, 20]); const result = await f.search();
    assert.deepEqual(projectIds(f, result.requestId), [10, 20]);
    f.revoke(20);
    await f.authorize(actor, TOOLS['projects.get'], { projectId: 10 });
    await f.authorize(actor, TOOLS['projects.search'], {});
    await denyWithoutEvents(f, result.requestId);
});

test('entity D: revoked historical request text never reaches later reasoning', async () => {
    const f = projectFixture(); await f.search('Tower', 'PRIVATE_PROJECT_10_QUESTION');
    f.revoke(10); await f.submit(body('A new unrelated question'));
    const request = f.seen.at(-1);
    assert.deepEqual(request.history, []);
    assert.doesNotMatch(JSON.stringify(request), /PRIVATE_PROJECT_10_QUESTION|authorized Tower project results/);
});

test('entity E: history-derived answer inherits project references and loses replay access', async () => {
    const f = projectFixture(); const a = await f.search();
    const b = await f.submit(body('Explain those results'));
    assert.equal(f.seen.at(-1).history.length, 2);
    assert.deepEqual(projectIds(f, a.requestId), [10]);
    assert.deepEqual(projectIds(f, b.requestId), [10]);
    f.revoke(10);
    await f.authorize(actor, TOOLS['projects.search'], {});
    await denyWithoutEvents(f, b.requestId);
});

for (const boundary of ['before-reference-write', 'after-reference-write']) {
    test(`entity F: result and authorization refs roll back together (${boundary})`, async () => {
        const f = projectFixture(); const transaction = f.store.transaction.bind(f.store);
        let injected = false;
        f.store.transaction = (id, who, callback) => transaction(id, who, async session => {
            const update = session.updateRequest.bind(session);
            session.updateRequest = async values => {
                if (!injected && values.context_json?.authorizationRefs?.some(r => r.tool === 'projects.get')) {
                    injected = true;
                    assert.ok(session.trx.state.events.get(id).some(e => e.type === 'tool_completed'));
                    assert.ok(!f.store.state.events.get(id).some(e => e.type === 'tool_completed'));
                    if (boundary === 'after-reference-write') await update(values);
                    throw Error('Injected reference persistence failure');
                }
                return update(values);
            };
            return callback(session);
        });
        const result = await f.search();
        assert.equal(injected, true);
        assert.equal(f.store.state.requests.get(result.requestId).status, 'FAILED');
        assert.equal(f.store.state.executions.size, 0);
        assert.ok(!result.events.some(e => e.type === 'tool_completed' || e.type === 'text_completed'));
        assert.ok(!f.store.state.events.get(result.requestId).some(e => e.type === 'tool_completed'));
        assert.deepEqual(projectIds(f, result.requestId), []);
    });
}

test('entity G: scoped results plus inherited refs cannot exceed 256', async () => {
    const f = projectFixture(Array.from({ length: 300 }, (_, i) => i + 1));
    f.tables.proj_projects.forEach((p, i) => { p.name = `Batch-${Math.floor(i / 50)} Tower ${p.id}`; });
    for (let i = 0; i < 5; i++) {
        const result = await f.search(`Batch-${i}`, `Read group ${i}`);
        assert.equal(refs(f, result.requestId).length, (i + 1) * 51);
    }
    const executionsBefore = f.store.state.executions.size;
    const result = await f.search('Batch-5', 'Read the next group');
    assert.equal(f.store.state.requests.get(result.requestId).status, 'FAILED');
    assert.equal(f.store.state.executions.size, executionsBefore);
    assert.equal(refs(f, result.requestId).length, 255);
    assert.ok(result.events.some(e => e.type === 'agent_error' && e.error.code === 'request_rejected'));
    assert.ok(!result.events.some(e => e.type === 'tool_completed' || e.type === 'text_completed'));
    assert.doesNotMatch(JSON.stringify(result.events), /Batch-5 Tower/);
});

test('entity refs: admin search results still require current entity policy after demotion', async () => {
    const f = projectFixture(); f.tables.iam_users[0].user_type = 'admin'; f.revoke(10);
    const result = await f.search(); assert.deepEqual(projectIds(f, result.requestId), [10]);
    f.tables.iam_users[0].user_type = 'employee';
    await denyWithoutEvents(f, result.requestId);
});

test('entity refs: invalid returned project identity cannot become a replayable result', async () => {
    const f = projectFixture(['10']); const result = await f.search();
    assert.equal(f.store.state.requests.get(result.requestId).status, 'FAILED');
    assert.equal(f.store.state.executions.size, 0);
    assert.ok(!result.events.some(e => e.type === 'tool_completed'));
});
