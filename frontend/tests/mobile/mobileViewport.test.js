import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isMobileViewport,
    MOBILE_MAX_WIDTH,
    MOBILE_MEDIA_QUERY,
} from '../../src/mobile/hooks/useMobileViewport.js';

test('the mobile breakpoint ends at exactly 1023 pixels', () => {
    assert.equal(MOBILE_MAX_WIDTH, 1023);
    assert.equal(MOBILE_MEDIA_QUERY, '(max-width: 1023px)');
    assert.equal(isMobileViewport(0), true);
    assert.equal(isMobileViewport(390), true);
    assert.equal(isMobileViewport(1023), true);
});

test('desktop begins at exactly 1024 pixels', () => {
    assert.equal(isMobileViewport(1024), false);
    assert.equal(isMobileViewport(1440), false);
});

test('invalid values never accidentally select the mobile presentation', () => {
    for (const value of [-1, NaN, Infinity, '1023', null, undefined]) {
        assert.equal(isMobileViewport(value), false);
    }
});
