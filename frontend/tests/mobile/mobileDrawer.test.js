import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createDrawerMarkerState,
    drawerReducer,
    hasDrawerMarker,
    MOBILE_DRAWER_HISTORY_KEY,
    removeDrawerMarkerState,
} from '../../src/mobile/hooks/useMobileDrawer.js';

test('drawer state transitions are idempotent and explicit', () => {
    assert.equal(drawerReducer(false, 'open'), true);
    assert.equal(drawerReducer(true, 'open'), true);
    assert.equal(drawerReducer(true, 'close'), false);
    assert.equal(drawerReducer(false, 'toggle'), true);
    assert.equal(drawerReducer(true, 'toggle'), false);
    assert.equal(drawerReducer(true, 'unknown'), true);
});

test('history markers are namespaced and preserve router state', () => {
    const original = { key: 'router-key', usr: { source: 'fixture' } };
    const marked = createDrawerMarkerState(original, 'drawer-1');

    assert.deepEqual(original, { key: 'router-key', usr: { source: 'fixture' } });
    assert.equal(hasDrawerMarker(marked, 'drawer-1'), true);
    assert.equal(hasDrawerMarker(marked, 'drawer-2'), false);
    assert.deepEqual(marked[MOBILE_DRAWER_HISTORY_KEY], { token: 'drawer-1' });
    assert.deepEqual(removeDrawerMarkerState(marked), original);
});

test('removing a lone marker leaves a clean null history state', () => {
    const marked = createDrawerMarkerState(null, 'drawer-1');
    assert.equal(removeDrawerMarkerState(marked), null);
    assert.equal(removeDrawerMarkerState(null), null);
});
