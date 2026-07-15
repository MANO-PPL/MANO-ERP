import assert from 'assert';
import { convertToBase, convert } from '../services/unitRegistry.js';
import { resolveComponents } from '../services/compositionResolver.js';

console.log("=== STARTING UNIT TESTS ===");

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`[PASS] ${name}`);
        passed++;
    } catch (err) {
        console.error(`[FAIL] ${name}`);
        console.error(err);
        failed++;
    }
}

// ─── Unit Registry Tests ─────────────────────────────────────────────────────

test("convertToBase - kilograms (base)", () => {
    const qty = convertToBase('kg', 5);
    assert.strictEqual(qty, 5.0);
});

test("convertToBase - metric tons (1000x)", () => {
    const qty = convertToBase('MT', 2.5);
    assert.strictEqual(qty, 2500.0);
});

test("convertToBase - grams (0.001x)", () => {
    const qty = convertToBase('g', 1500);
    assert.strictEqual(qty, 1.5);
});

test("convert - feet to inches (same length type)", () => {
    // 1 ft = 0.3048 m, 1 in = 0.0254 m. 5 ft = 60 in.
    const qty = convert('ft', 'in', 5);
    assert.ok(Math.abs(qty - 60.0) < 1e-9);
});

test("convert - metric tons to grams (same weight type)", () => {
    // 1 MT = 1,000,000 g.
    const qty = convert('MT', 'g', 0.5);
    assert.strictEqual(qty, 500000.0);
});

test("convert - mismatched unit types should throw", () => {
    assert.throws(() => {
        convert('kg', 'L', 10); // weight to volume
    }, /Incompatible unit types/);
});

// ─── Composition Resolver Tests (with Database Mock) ───────────────────────

const mockResources = [
    { id: 1, name: 'Cement', type: 'material', base_unit_code: 'kg' },
    { id: 2, name: 'Sand', type: 'material', base_unit_code: 'cum' },
    { id: 3, name: 'Water', type: 'material', base_unit_code: 'L' },
    { id: 4, name: 'Cement Paste', type: 'item', base_unit_code: 'Nos' },
    { id: 5, name: 'Concrete Mix', type: 'item', base_unit_code: 'Nos' },
    { id: 6, name: 'Loop Item A', type: 'item', base_unit_code: 'Nos' },
    { id: 7, name: 'Loop Item B', type: 'item', base_unit_code: 'Nos' }
];

const mockCompositions = [
    // Cement Paste (Resource 4) consists of: 10 kg Cement, 2 L Water
    { parent_resource_id: 4, component_resource_id: 1, quantity: 10.0, unit_code: 'kg' },
    { parent_resource_id: 4, component_resource_id: 3, quantity: 2.0, unit_code: 'L' },

    // Concrete Mix (Resource 5) consists of: 3 units Cement Paste, 8 cum Sand
    { parent_resource_id: 5, component_resource_id: 4, quantity: 3.0, unit_code: 'Nos' },
    { parent_resource_id: 5, component_resource_id: 2, quantity: 8.0, unit_code: 'cum' },

    // Circular Loop: Loop A contains Loop B, Loop B contains Loop A
    { parent_resource_id: 6, component_resource_id: 7, quantity: 1.0, unit_code: 'Nos' },
    { parent_resource_id: 7, component_resource_id: 6, quantity: 1.0, unit_code: 'Nos' }
];

// Helper mock DB client emulator
function createMockDb() {
    return function(table) {
        return {
            where(col, val) {
                let filtered = [];
                if (table === 'res_resources') {
                    const targetId = typeof col === 'object' ? col.id : val;
                    filtered = mockResources.filter(r => r.id === targetId);
                } else if (table === 'res_compositions') {
                    filtered = mockCompositions.filter(c => c.parent_resource_id === val);
                }
                
                return {
                    async first() {
                        return filtered[0] || null;
                    },
                    async select() {
                        // Map properties to emulate Knex select aliases
                        if (table === 'res_compositions') {
                            return filtered.map(f => ({
                                component_resource_id: f.component_resource_id,
                                quantity: f.quantity,
                                unit_code: f.unit_code
                            }));
                        }
                        return filtered;
                    }
                };
            }
        };
    };
}

const mockDb = createMockDb();

test("resolveComponents - material (returns itself)", async () => {
    const res = await resolveComponents(1, mockDb); // Cement
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].resourceId, 1);
    assert.strictEqual(res[0].quantity, 1.0);
    assert.strictEqual(res[0].unitCode, 'kg');
});

test("resolveComponents - simple item composition", async () => {
    const res = await resolveComponents(4, mockDb); // Cement Paste
    assert.strictEqual(res.length, 2);
    assert.strictEqual(res[0].resourceId, 1);
    assert.strictEqual(res[0].quantity, 10.0);
    assert.strictEqual(res[0].unitCode, 'kg');
    assert.strictEqual(res[1].resourceId, 3);
    assert.strictEqual(res[1].quantity, 2.0);
    assert.strictEqual(res[1].unitCode, 'L');
});

test("resolveComponents - nested item composition", async () => {
    const res = await resolveComponents(5, mockDb); // Concrete Mix
    assert.strictEqual(res.length, 2);
    assert.strictEqual(res[0].resourceId, 4);
    assert.strictEqual(res[0].quantity, 3.0);
    assert.strictEqual(res[0].unitCode, 'Nos');
    assert.strictEqual(res[1].resourceId, 2);
    assert.strictEqual(res[1].quantity, 8.0);
    assert.strictEqual(res[1].unitCode, 'cum');
});

test("resolveComponents - circular loop detector throws error", async () => {
    try {
        await resolveComponents(6, mockDb); // Loop A
        assert.fail("Should have thrown a circular reference error!");
    } catch (err) {
        assert.ok(err.message.includes("Circular reference detected"));
    }
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n=== UNIT TESTS COMPLETED ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
