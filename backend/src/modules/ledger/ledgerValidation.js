import AppError from '../../utils/AppError.js';

export const TXN_TYPES = {
    SUPPLY_ASSIGN:   'SUPPLY_ASSIGN',
    TRANSFER_PARTY:  'TRANSFER_PARTY',
    // CONSUME_ACTIVITY and ADJUSTMENT are disabled — pending activity module integration
};

export const TXN_STATUS = {
    DRAFT:     'DRAFT',
    CONFIRMED: 'CONFIRMED',
    CANCELLED: 'CANCELLED',
};

export const ROLES = {
    OWNER:    'OWNER',
    EXECUTOR: 'EXECUTOR',
    SUPPLIER: 'SUPPLIER',
};

/**
 * Validates transaction header and lines for confirmation/saving.
 *
 * Rules:
 * 1. Minimum 2 lines.
 * 2. Every line must have party_id (INT, pdoc_parties.pv_id), project_resource_id, and valid signed_qty.
 * 3. SUM(signed_qty) grouped per project_resource_id must be zero (double-entry integrity).
 * 4. Type-specific rules for SUPPLY_ASSIGN and TRANSFER_PARTY.
 */
export function validateTransaction(header, lines) {
    if (!header || typeof header !== 'object') {
        throw new AppError('Transaction header is required', 400);
    }

    if (!Object.values(TXN_TYPES).includes(header.txn_type)) {
        throw new AppError(`Invalid txn_type: ${header.txn_type}. Allowed: ${Object.values(TXN_TYPES).join(', ')}`, 400);
    }

    if (!Array.isArray(lines) || lines.length < 2) {
        throw new AppError('Transaction must have at least two lines', 400);
    }

    // Per-project-resource balance check & individual line validation
    const projectResourceSums = {};

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const partyId = Number(line.party_id);
        if (!partyId || isNaN(partyId) || partyId <= 0) {
            throw new AppError(`Line at index ${i} has invalid party_id "${line.party_id}". Must be a positive integer (pdoc_parties.pv_id)`, 400);
        }

        if (!line.project_resource_id) {
            throw new AppError(`Line at index ${i} is missing project_resource_id`, 400);
        }

        const signedQty = Number(line.signed_qty);
        if (isNaN(signedQty)) {
            throw new AppError(`Line at index ${i} has invalid signed_qty`, 400);
        }

        const projectResourceId = String(line.project_resource_id);
        projectResourceSums[projectResourceId] = (projectResourceSums[projectResourceId] || 0) + signedQty;
    }

    // Verify zero-sum per resource (double-entry integrity)
    for (const [projectResourceId, sum] of Object.entries(projectResourceSums)) {
        if (Math.abs(sum) > 1e-6) {
            throw new AppError(`Zero-sum validation failed for project resource '${projectResourceId}': SUM(signed_qty) = ${sum}, must be 0`, 400);
        }
    }

    // Type-specific validation
    switch (header.txn_type) {
        case TXN_TYPES.SUPPLY_ASSIGN: {
            const hasFrom = lines.some((l) => Number(l.signed_qty) < 0);
            const hasTo   = lines.some((l) => Number(l.signed_qty) > 0);
            if (!hasFrom || !hasTo) {
                throw new AppError('SUPPLY_ASSIGN must have at least one source line (negative) and one target line (positive)', 400);
            }
            break;
        }

        case TXN_TYPES.TRANSFER_PARTY: {
            const hasFrom = lines.some((l) => Number(l.signed_qty) < 0);
            const hasTo   = lines.some((l) => Number(l.signed_qty) > 0);
            if (!hasFrom || !hasTo) {
                throw new AppError('TRANSFER_PARTY must have at least one source line (negative) and one target line (positive)', 400);
            }
            break;
        }

        default:
            break;
    }

    return true;
}
