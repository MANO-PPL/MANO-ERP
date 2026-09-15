import test from 'node:test';
import assert from 'node:assert/strict';
import { CAL_EVENTS, CHANNELS, CHANNEL_MESSAGES, DAYS, DMS } from '../../src/pages/Collaboration/constants.js';
import { calendarGrid, canonicalCollaborationHash, collaborationHashUrl, conversationMessages, eventsForDay, resolveCollaborationView, shouldNormalizeCollaborationHash, upcomingEvents } from '../../src/mobile/pages/Collaboration/mobileCollaborationModel.js';

test('collaboration hash contract preserves canonical views and normalizes invalid values once', () => {
    assert.equal(resolveCollaborationView('#chat'), 'chat');
    assert.equal(resolveCollaborationView('#calendar'), 'calendar');
    assert.equal(canonicalCollaborationHash(''), '#chat');
    assert.equal(canonicalCollaborationHash('#invalid'), '#chat');
    assert.equal(shouldNormalizeCollaborationHash('#chat'), false);
    assert.equal(shouldNormalizeCollaborationHash('#calendar'), false);
    assert.equal(shouldNormalizeCollaborationHash('#invalid'), true);
});

test('collaboration hash URL preserves query parameters', () => {
    assert.equal(collaborationHashUrl({ pathname: '/collaboration', search: '?foo=preserved' }, 'calendar'), '/collaboration?foo=preserved#calendar');
});

test('mobile chat derives exact source-backed channel and DM messages without persistence', () => {
    assert.equal(CHANNELS[0].name, 'general');
    assert.equal(DMS[0].name, 'Madhavan');
    assert.deepEqual(conversationMessages({ kind: 'channel', id: 3 }, CHANNEL_MESSAGES), CHANNEL_MESSAGES[3]);
    assert.deepEqual(conversationMessages({ kind: 'dm', id: 4 }, CHANNEL_MESSAGES), CHANNEL_MESSAGES[1]);
});

test('calendar helpers remain Sunday-first and map exact day-keyed static events', () => {
    assert.equal(DAYS[0], 'Sun');
    assert.equal(calendarGrid(2026, 8).filter(Boolean).length, 30);
    assert.deepEqual(eventsForDay(CAL_EVENTS, 18), CAL_EVENTS[18]);
    assert.equal(upcomingEvents(CAL_EVENTS)[0].day, 3);
});
