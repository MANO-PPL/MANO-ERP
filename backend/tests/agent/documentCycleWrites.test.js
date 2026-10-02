import test from 'node:test';
import assert from 'node:assert/strict';
import { createWriteService } from '../../src/modules/agent/agentWriteService.js';
import { TOOLS } from '../../src/modules/agent/agentTools.js';

test('document-cycle actions delegate through the confirmation transaction', async () => {
    const calls = [];
    const cycles = Object.fromEntries([
        ['documents.requestRevision', 'requestRevision'],
        ['documents.cancelCycle', 'cancelCycle'],
        ['documents.claimRevision', 'claimRevision'],
    ].map(([tool, method]) => [method, async (...args) => {
        calls.push({ tool, method, args });
        return { status: 'accepted' };
    }]));
    const writes = createWriteService({ cycles });
    const trx = Object.assign(() => { throw new Error('unexpected direct database access'); }, { isTransaction: true });
    const scope = { orgId: 2, userId: 7 };
    const values = [
        ['documents.requestRevision', { projectId: 4, cycleId: 12, comments: 'Please revise quantities' }, 'requestRevision'],
        ['documents.cancelCycle', { projectId: 4, cycleId: 13 }, 'cancelCycle'],
        ['documents.claimRevision', { projectId: 4, cycleId: 14 }, 'claimRevision'],
    ];

    for (const [name, args, method] of values) {
        const result = await writes.execute(TOOLS[name], args, scope, trx);
        assert.deepEqual(result, { id: args.cycleId, status: 'accepted' });
        const call = calls.at(-1);
        assert.equal(call.tool, name);
        assert.equal(call.method, method);
        assert.equal(call.args.at(-1).transaction, trx);
        assert.equal(call.args[0], scope.orgId);
        assert.equal(call.args[1], args.cycleId);
        assert.equal(call.args[2], scope.userId);
    }

    await assert.rejects(writes.execute(TOOLS['documents.cancelCycle'], values[1][1], scope), /caller_transaction_required/);
});
