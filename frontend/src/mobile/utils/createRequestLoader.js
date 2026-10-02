export function createRequestLoader(request) {
    let inFlight = null;

    return () => {
        if (!inFlight) {
            inFlight = Promise.resolve()
                .then(() => request())
                .finally(() => {
                    inFlight = null;
                });
        }
        return inFlight;
    };
}
