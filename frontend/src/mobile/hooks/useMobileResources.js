import { useCallback, useEffect, useState } from 'react';
import { resourceApi } from '../../services/resourceApi.js';
import { createRequestLoader } from '../utils/createRequestLoader.js';
import { isAccessDenied } from '../pages/Resources/resourceModel.js';

export const loadMobileResources = createRequestLoader(() => resourceApi.getResources({ limit: 50000 }));

export default function useMobileResources({ loadResources = loadMobileResources } = {}) {
    const [state, setState] = useState({ resources: [], loading: true, error: null, accessDenied: false });
    const refresh = useCallback(async () => {
        setState((current) => ({ ...current, loading: true, error: null, accessDenied: false }));
        try {
            const result = await loadResources();
            const next = {
                resources: Array.isArray(result?.resources) ? result.resources : Array.isArray(result?.data) ? result.data : [],
                loading: false, error: null, accessDenied: false,
            };
            setState(next);
            return next;
        } catch (error) {
            setState({ resources: [], loading: false, error, accessDenied: isAccessDenied(error) });
            return null;
        }
    }, [loadResources]);

    useEffect(() => { refresh(); }, [refresh]);
    return { ...state, refresh };
}
