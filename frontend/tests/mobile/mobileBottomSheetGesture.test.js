import test from 'node:test';
import assert from 'node:assert/strict';
import { BOTTOM_SHEET_DEFAULT, BOTTOM_SHEET_EXPANDED, bottomSheetDragOffset, resolveBottomSheetGesture } from '../../src/mobile/components/mobileBottomSheetGesture.js';

test('distance and velocity upward drags expand the default sheet', () => {
    assert.deepEqual(resolveBottomSheetGesture({ deltaY: -80 }), { action: 'expand', state: BOTTOM_SHEET_EXPANDED });
    assert.deepEqual(resolveBottomSheetGesture({ deltaY: -10, velocityY: -0.7 }), { action: 'expand', state: BOTTOM_SHEET_EXPANDED });
});

test('velocity commits only when it matches the gesture direction', () => {
    assert.deepEqual(resolveBottomSheetGesture({ deltaY: -10, velocityY: 0.7 }), { action: 'snap', state: BOTTOM_SHEET_DEFAULT });
    assert.deepEqual(resolveBottomSheetGesture({ deltaY: 10, velocityY: -0.7, canClose: true }), { action: 'snap', state: BOTTOM_SHEET_DEFAULT });
    assert.deepEqual(resolveBottomSheetGesture({ deltaY: -10, velocityY: -0.7 }), { action: 'expand', state: BOTTOM_SHEET_EXPANDED });
    assert.deepEqual(resolveBottomSheetGesture({ origin: BOTTOM_SHEET_EXPANDED, deltaY: 10, velocityY: 0.7 }), { action: 'collapse', state: BOTTOM_SHEET_DEFAULT });
    assert.deepEqual(resolveBottomSheetGesture({ deltaY: 10, velocityY: 0.7, canClose: true }), { action: 'dismiss', state: BOTTOM_SHEET_DEFAULT });
});

test('expanded sheet collapses on committed downward drag', () => {
    assert.deepEqual(resolveBottomSheetGesture({ origin: BOTTOM_SHEET_EXPANDED, deltaY: 80 }), { action: 'collapse', state: BOTTOM_SHEET_DEFAULT });
});

test('default sheet dismisses only when it is closeable', () => {
    assert.deepEqual(resolveBottomSheetGesture({ deltaY: 80, canClose: true }), { action: 'dismiss', state: BOTTOM_SHEET_DEFAULT });
    assert.deepEqual(resolveBottomSheetGesture({ deltaY: 80, canClose: false }), { action: 'snap', state: BOTTOM_SHEET_DEFAULT });
});

test('short and cancelled drags snap back to the origin', () => {
    assert.deepEqual(resolveBottomSheetGesture({ origin: BOTTOM_SHEET_EXPANDED, deltaY: 20 }), { action: 'snap', state: BOTTOM_SHEET_EXPANDED });
    assert.deepEqual(resolveBottomSheetGesture({ origin: BOTTOM_SHEET_DEFAULT, deltaY: -200, cancelled: true }), { action: 'snap', state: BOTTOM_SHEET_DEFAULT });
});

test('horizontal-dominant movement is rejected and never produces horizontal offset', () => {
    assert.deepEqual(resolveBottomSheetGesture({ deltaX: 90, deltaY: 20, canClose: true }), { action: 'snap', state: BOTTOM_SHEET_DEFAULT });
    assert.equal(bottomSheetDragOffset({ deltaX: 90, deltaY: 20 }), 0);
});
