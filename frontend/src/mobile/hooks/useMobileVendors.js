import { useCallback, useEffect, useState } from 'react';
import vendorApi from '../../services/vendorApi.js';
import api from '../../services/api.js';
import { createRequestLoader } from '../utils/createRequestLoader.js';

export const loadMobileVendors = createRequestLoader(() => vendorApi.getVendors({ limit: 50000 }));
export const loadVendorJobNatures = createRequestLoader(() => api.get('/admin/job-natures').then(({ data }) => data));

export default function useMobileVendors({ loadVendors = loadMobileVendors, loadJobNatures = loadVendorJobNatures } = {}) {
    const [state, setState] = useState({ vendors: [], jobNatures: [], loading: true, error: null });
    const refresh = useCallback(async () => {
        setState((current) => ({ ...current, loading: true, error: null }));
        try {
            const [vendorsResult, metadataResult] = await Promise.all([loadVendors(), loadJobNatures()]);
            const next = {
                vendors: Array.isArray(vendorsResult?.vendors) ? vendorsResult.vendors : [],
                jobNatures: Array.isArray(metadataResult?.job_natures) ? metadataResult.job_natures : [],
                loading: false, error: null,
            };
            setState(next);
            return next;
        } catch (error) {
            setState((current) => ({ ...current, loading: false, error }));
            return null;
        }
    }, [loadJobNatures, loadVendors]);

    useEffect(() => { refresh(); }, [refresh]);
    return { ...state, refresh };
}
