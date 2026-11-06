
/**
 * Stable error codes defined by Module 1: Location Spec.
 * Callers can programmatically switch on these error codes.
 */

export const LocationErrorCodes = {
    LOC_NOT_FOUND: 'LOC_NOT_FOUND',
    LOC_CYCLE: 'LOC_CYCLE',
    LOC_DUPLICATE_NAME: 'LOC_DUPLICATE_NAME',
    LOC_CROSS_PROJECT: 'LOC_CROSS_PROJECT',
    LOC_PARENT_ARCHIVED: 'LOC_PARENT_ARCHIVED',
    LOC_HAS_CHILDREN: 'LOC_HAS_CHILDREN',
    LOC_IN_USE: 'LOC_IN_USE',
    LOC_MAX_DEPTH: 'LOC_MAX_DEPTH',
    LOC_TYPE_IN_USE: 'LOC_TYPE_IN_USE',
    LOC_TYPE_ORG_MISMATCH: 'LOC_TYPE_ORG_MISMATCH',
};

export class LocationError extends Error {
    constructor(code, message, details = {}) {
        super(message || code);
        this.name = 'LocationError';
        this.code = code;
        this.details = details;
        this.statusCode = LocationError.getStatusCode(code);
    }

    static getStatusCode(code) {
        switch (code) {
            case LocationErrorCodes.LOC_NOT_FOUND:
                return 404;
            case LocationErrorCodes.LOC_DUPLICATE_NAME:
                return 409;
            case LocationErrorCodes.LOC_CYCLE:
            case LocationErrorCodes.LOC_CROSS_PROJECT:
            case LocationErrorCodes.LOC_PARENT_ARCHIVED:
            case LocationErrorCodes.LOC_HAS_CHILDREN:
            case LocationErrorCodes.LOC_IN_USE:
            case LocationErrorCodes.LOC_MAX_DEPTH:
            case LocationErrorCodes.LOC_TYPE_IN_USE:
            case LocationErrorCodes.LOC_TYPE_ORG_MISMATCH:
                return 400;
            default:
                return 500;
        }
    }
}
