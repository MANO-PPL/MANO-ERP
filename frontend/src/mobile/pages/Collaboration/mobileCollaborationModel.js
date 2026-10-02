export const COLLABORATION_VIEWS = Object.freeze(['chat', 'calendar']);

export function resolveCollaborationView(hash = '') {
    const value = String(hash).replace(/^#/, '').toLowerCase();
    return COLLABORATION_VIEWS.includes(value) ? value : 'chat';
}

export function canonicalCollaborationHash(hash = '') {
    return `#${resolveCollaborationView(hash)}`;
}

export function shouldNormalizeCollaborationHash(hash = '') {
    return String(hash) !== canonicalCollaborationHash(hash);
}

export function collaborationHashUrl(locationLike, view) {
    const pathname = locationLike?.pathname || '/collaboration';
    const search = locationLike?.search || '';
    return `${pathname}${search}#${resolveCollaborationView(view)}`;
}

export function conversationMessages(conversation, messagesByChannel) {
    if (!conversation) return [];
    // Desktop source displays channel 1 for every direct-message preview.
    const key = conversation.kind === 'dm' ? 1 : conversation.id;
    return messagesByChannel?.[key] || [];
}

export function calendarGrid(year, month) {
    const leading = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    return [...Array(leading).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
}

export function eventsForDay(events, day) {
    return events?.[Number(day)] || [];
}

export function upcomingEvents(events) {
    return Object.entries(events || {})
        .sort(([left], [right]) => Number(left) - Number(right))
        .flatMap(([day, rows]) => (rows || []).map((event) => ({ ...event, day: Number(day) })));
}
