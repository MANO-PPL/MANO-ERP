/**
 * Stable error codes for the Party Registry Module.
 * Kernel and API callers programmatically inspect these codes.
 */
export const PartyRegistryErrorCodes = {
    PARTY_NOT_FOUND: 'PARTY_NOT_FOUND',
    PARTY_NOT_IN_PROJECT: 'PARTY_NOT_IN_PROJECT',
    PARTY_INVALID_VALUE: 'PARTY_INVALID_VALUE',
};

export function mapPartyErrorCodeToHttpStatus(code) {
    switch (code) {
        case PartyRegistryErrorCodes.PARTY_NOT_FOUND:
            return 404;
        case PartyRegistryErrorCodes.PARTY_NOT_IN_PROJECT:
            return 400;
        case PartyRegistryErrorCodes.PARTY_INVALID_VALUE:
            return 400;
        default:
            return 500;
    }
}

export class PartyRegistryError extends Error {
    constructor(code, message, details = {}) {
        super(message || code);
        this.name = 'PartyRegistryError';
        this.code = code;
        this.details = details;
        this.statusCode = mapPartyErrorCodeToHttpStatus(code);
    }
}
