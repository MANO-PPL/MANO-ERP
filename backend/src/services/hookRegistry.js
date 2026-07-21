/**
 * Pluggable Approval Hook Registry
 * 
 * Acts like a socket/plug architecture. When a document cycle is approved in cycleService,
 * it triggers the registered business action (e.g. 'inventory_incoming', 'expense_recorded').
 * 
 * Business modules register their own hooks here, keeping cycleService decoupled and clean.
 */

const registry = {};

/**
 * Register a hook handler function for a specific business action.
 * @param {string} actionName (e.g. 'inventory_incoming', 'inventory_outgoing')
 * @param {Function} hookFn async ({ trx, cycle, document, userId, versionId, approvedLines }) => {}
 */
export function registerApprovalHook(actionName, hookFn) {
    if (typeof hookFn !== 'function') {
        throw new Error(`Hook for action '${actionName}' must be a function`);
    }
    if (!registry[actionName]) {
        registry[actionName] = [];
    }
    registry[actionName].push(hookFn);
    console.log(`[HookRegistry] Registered hook for action: ${actionName}`);
}

/**
 * Trigger all registered approval hooks for a given action name within a database transaction.
 * @param {string} actionName 
 * @param {object} params { trx, cycle, document, userId, versionId, approvedLines }
 */
export async function triggerApprovalHooks(actionName, params) {
    const hooks = registry[actionName] || [];
    console.log(`[HookRegistry] Triggering ${hooks.length} hook(s) for action: ${actionName}`);
    
    for (const hook of hooks) {
        await hook(params);
    }
}

/**
 * Clear registered hooks (primarily for unit test cleanups).
 */
export function clearHooks() {
    for (const key of Object.keys(registry)) {
        delete registry[key];
    }
}

export default {
    registerApprovalHook,
    triggerApprovalHooks,
    clearHooks
};
