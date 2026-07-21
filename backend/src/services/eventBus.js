/**
 * Versioned Event Bus
 * Publishes events across the ERP in a standard format:
 * {
 *   event_type: string,
 *   event_version: 1,
 *   occurred_at: string (ISO timestamp),
 *   payload: object
 * }
 */

const listeners = {};

/**
 * Subscribe a handler function to a specific event type.
 * @param {string} eventType 
 * @param {Function} handler 
 */
export function subscribeToEvent(eventType, handler) {
    if (!listeners[eventType]) {
        listeners[eventType] = [];
    }
    listeners[eventType].push(handler);
}

/**
 * Publish a versioned event to all subscribed listeners.
 * @param {string} eventType 
 * @param {object} payload 
 */
export async function publishEvent(eventType, payload = {}) {
    const event = {
        event_type: eventType,
        event_version: 1,
        occurred_at: new Date().toISOString(),
        payload
    };

    console.log(`[EventBus] Published: ${eventType}`, JSON.stringify(event));

    const eventListeners = listeners[eventType] || [];
    for (const handler of eventListeners) {
        try {
            await handler(event);
        } catch (err) {
            console.error(`[EventBus] Error in listener for ${eventType}:`, err);
        }
    }

    return event;
}

export default {
    subscribeToEvent,
    publishEvent
};
