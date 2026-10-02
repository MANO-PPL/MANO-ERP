import test from 'node:test';
import assert from 'node:assert/strict';
import { cadFilename, createCadLifecycleGuard, readCadSearch, runCadCommand } from '../../src/mobile/pages/ProjectDetails/CAD/mobileCadModel.js';

test('M11 CAD query and filename preserve real DWG/DXF extensions', () => {
    assert.deepEqual(readCadSearch('?url=https%3A%2F%2Ffiles%2Fplan.dxf%3Fx%3D1&name=Plan'), { url: 'https://files/plan.dxf?x=1', name: 'Plan' });
    assert.equal(cadFilename('Plan', 'https://files/plan.dxf?token=1'), 'Plan.dxf');
    assert.equal(cadFilename('Plan.DWG', 'https://files/plan.dwg'), 'Plan.DWG');
});

test('M11 CAD commands delegate to the existing engine without a second renderer', () => {
    const commands = [];
    const viewer = { curView: { mode: null }, sendStringToExecute: (command) => commands.push(command) };
    assert.equal(runCadCommand(viewer, 'pan'), true); assert.equal(viewer.curView.mode, 1);
    assert.equal(runCadCommand(viewer, 'select'), true); assert.equal(viewer.curView.mode, 0);
    assert.equal(runCadCommand(viewer, 'measure'), true); assert.equal(runCadCommand(viewer, 'clear'), true); assert.equal(runCadCommand(viewer, 'fit'), true);
    assert.deepEqual(commands, ['dist', 'regen', 'zoom e']);
    assert.equal(runCadCommand(viewer, 'invented'), false);
});

test('M11 CAD lifecycle rejects stale viewer initialization', () => {
    const guard = createCadLifecycleGuard(); const a = guard.begin('a.dwg'); const b = guard.begin('b.dwg');
    assert.equal(guard.isCurrent(a, 'a.dwg'), false); assert.equal(guard.isCurrent(b, 'b.dwg'), true); guard.invalidate(); assert.equal(guard.isCurrent(b, 'b.dwg'), false);
});
