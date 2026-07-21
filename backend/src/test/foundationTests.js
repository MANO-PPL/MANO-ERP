import assert from 'assert';
import '../config/config.js';
import { db } from '../config/database.js';
import { publishEvent, subscribeToEvent } from '../services/eventBus.js';
import { registerApprovalHook, triggerApprovalHooks, clearHooks } from '../services/hookRegistry.js';

console.log("=== STARTING PHASE 0 FOUNDATION TESTS ===");

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`[PASS] ${name}`);
        passed++;
    } catch (err) {
        console.error(`[FAIL] ${name}`);
        console.error(err);
        failed++;
    }
}

async function runAll() {
    // ─── 1. Foundation Database Schema Test ────────────────────────────────────
    await test("Foundation Schema Verification", async () => {
        const hasLinesTable = await db.schema.hasTable('wf_document_lines');
        const hasAttachmentsTable = await db.schema.hasTable('wf_document_attachments');
        
        assert.strictEqual(hasLinesTable, true, "wf_document_lines table should exist");
        assert.strictEqual(hasAttachmentsTable, true, "wf_document_attachments table should exist");
    });

    // ─── 2. Event Bus Versioning Test ─────────────────────────────────────────
    await test("Event Bus Versioned Payload Format", async () => {
        let receivedEvent = null;
        subscribeToEvent("test.event_triggered", (event) => {
            receivedEvent = event;
        });

        const published = await publishEvent("test.event_triggered", { sample: "data" });
        
        assert.strictEqual(published.event_type, "test.event_triggered");
        assert.strictEqual(published.event_version, 1);
        assert.ok(published.occurred_at, "occurred_at timestamp should exist");
        assert.strictEqual(published.payload.sample, "data");
        
        assert.ok(receivedEvent, "Subscriber should have received the event");
        assert.strictEqual(receivedEvent.event_type, "test.event_triggered");
    });

    // ─── 3. Pluggable Hook Registry Test ──────────────────────────────────────
    await test("Hook Registry Action Triggers", async () => {
        clearHooks();
        let hookExecuted = false;
        let receivedActionParams = null;

        registerApprovalHook("inventory_incoming", async (params) => {
            hookExecuted = true;
            receivedActionParams = params;
        });

        const mockParams = {
            cycle: { cycle_id: 99 },
            document: { document_id: 1 },
            approvedLines: [{ line_id: 101, line_type: "material" }]
        };

        await triggerApprovalHooks("inventory_incoming", mockParams);

        assert.strictEqual(hookExecuted, true, "Registered hook should execute on trigger");
        assert.strictEqual(receivedActionParams.cycle.cycle_id, 99);
        assert.strictEqual(receivedActionParams.approvedLines.length, 1);
    });

    // ─── Summary ──────────────────────────────────────────────────────────────
    console.log(`\n=== PHASE 0 FOUNDATION TESTS COMPLETED ===`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runAll();
