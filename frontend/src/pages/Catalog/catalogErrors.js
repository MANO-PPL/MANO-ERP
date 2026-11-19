import { customToast } from '../../utils/toast';

/**
 * Stable Catalog Error Codes mapped to user-actionable descriptions.
 * Never outputs raw SQL, traces, or runtime stacks.
 */
export const CATALOG_ERROR_MESSAGES = {
    CAT_NOT_FOUND: 'The requested catalog item was not found. It may have been deleted.',
    CAT_DUPLICATE_CODE: 'This code is already in use within the selected scope. Please choose a unique code.',
    CAT_KIND_MISMATCH: 'Resource kind mismatch. Kind is immutable after creation and cannot be changed.',
    CAT_SCOPE_MISMATCH: 'Scope mismatch. The selected item belongs to a different project or scope.',
    CAT_UNIT_INCOMPATIBLE: 'Incompatible unit. The selected unit is in a different category or lacks a valid conversion link.',
    CAT_NO_CONVERSION: 'No packaging conversion defined between these units for this resource. Please add a packaging conversion rule first.',
    CAT_RATE_OVERLAP: 'A rate already exists for this resource covering that period. Choose a date after the existing rate or correct the existing rate.',
    CAT_NORM_OVERLAP: 'A norm line already exists for this resource in this date window. Choose a non-overlapping date or correct the existing norm.',
    CAT_IN_USE: 'Cannot delete this item because it is referenced by active norms, project copies, or downstream transactions. Archive it instead if no longer needed.',
    CAT_ARCHIVED: 'This item is archived. Restore it first before performing this action.',
    CAT_NOT_MASTER: 'Only master catalog items can be imported into a project.',
    CAT_INVALID_VALUE: 'One or more input values are invalid. Please check your entries and try again.',
};

/**
 * Extracts a safe, user-friendly message from a Catalog error response.
 */
export function getCatalogErrorMessage(err, fallback = 'Operation failed. Please try again.') {
    if (!err) return fallback;

    const data = err.response?.data;
    const code = data?.code || err.code;
    const message = data?.message || data?.error || err.message;

    // If backend provided a specific human-readable message, verify it is safe and prefer it
    if (typeof message === 'string' && message.trim()) {
        const lower = message.toLowerCase();
        const isRawInternal = (
            lower.includes('sql') ||
            lower.includes('select ') ||
            lower.includes('insert into') ||
            lower.includes('syntax error') ||
            lower.includes('knex') ||
            lower.includes('errno') ||
            lower.includes('stack') ||
            lower.includes('at ')
        );
        if (!isRawInternal) {
            return message.trim();
        }
    }

    if (code && CATALOG_ERROR_MESSAGES[code]) {
        return CATALOG_ERROR_MESSAGES[code];
    }

    return fallback;
}

/**
 * Triggers a user toast for a catalog error.
 */
export function showCatalogErrorToast(err, fallback = 'Operation failed') {
    const msg = getCatalogErrorMessage(err, fallback);
    customToast.error(msg, 'Catalog Error');
    return msg;
}

