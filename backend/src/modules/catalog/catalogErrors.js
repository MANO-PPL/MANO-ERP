/**
 * Stable error codes defined by Module 2: Catalog Spec.
 * Callers can programmatically switch on these error codes.
 */

export const CatalogErrorCodes = {
    CAT_NOT_FOUND: 'CAT_NOT_FOUND',
    CAT_DUPLICATE_CODE: 'CAT_DUPLICATE_CODE',
    CAT_KIND_MISMATCH: 'CAT_KIND_MISMATCH',
    CAT_SCOPE_MISMATCH: 'CAT_SCOPE_MISMATCH',
    CAT_UNIT_INCOMPATIBLE: 'CAT_UNIT_INCOMPATIBLE',
    CAT_NO_CONVERSION: 'CAT_NO_CONVERSION',
    CAT_RATE_OVERLAP: 'CAT_RATE_OVERLAP',
    CAT_NORM_OVERLAP: 'CAT_NORM_OVERLAP',
    CAT_IN_USE: 'CAT_IN_USE',
    CAT_ARCHIVED: 'CAT_ARCHIVED',
    CAT_NOT_MASTER: 'CAT_NOT_MASTER',
    CAT_INVALID_VALUE: 'CAT_INVALID_VALUE',
};

export class CatalogError extends Error {
    constructor(code, message, details = {}) {
        super(message || code);
        this.name = 'CatalogError';
        this.code = code;
        this.details = details;
        this.statusCode = CatalogError.getStatusCode(code);
    }

    static getStatusCode(code) {
        switch (code) {
            case CatalogErrorCodes.CAT_NOT_FOUND:
                return 404;
            case CatalogErrorCodes.CAT_DUPLICATE_CODE:
                return 409;
            case CatalogErrorCodes.CAT_KIND_MISMATCH:
            case CatalogErrorCodes.CAT_SCOPE_MISMATCH:
            case CatalogErrorCodes.CAT_UNIT_INCOMPATIBLE:
            case CatalogErrorCodes.CAT_NO_CONVERSION:
            case CatalogErrorCodes.CAT_RATE_OVERLAP:
            case CatalogErrorCodes.CAT_NORM_OVERLAP:
            case CatalogErrorCodes.CAT_IN_USE:
            case CatalogErrorCodes.CAT_ARCHIVED:
            case CatalogErrorCodes.CAT_NOT_MASTER:
            case CatalogErrorCodes.CAT_INVALID_VALUE:
                return 400;
            default:
                return 500;
        }
    }
}

