import { useCallback, useEffect, useState } from 'react';
import { createPartyApi } from '../../services/partyApi.js';
import api from '../../services/api.js';
import { createRequestLoader } from '../utils/createRequestLoader.js';

const clientApi = createPartyApi('client');
export const loadMobileClients = createRequestLoader(() => clientApi.list({ limit: 50000 }));
export const loadClientMetadata = createRequestLoader(() => Promise.all([
    api.get('/admin/job-natures'), api.get('/admin/sectors'),
]).then(([jobs, sectors]) => ({
    job_natures: jobs.data?.job_natures || [], sectors: sectors.data?.sectors || [],
})));

export default function useMobileClients({ loadClients = loadMobileClients, loadMetadata = loadClientMetadata } = {}) {
    const [state, setState] = useState({ clients: [], jobNatures: [], sectors: [], loading: true, error: null });
    const refresh = useCallback(async () => {
        setState((current) => ({ ...current, loading: true, error: null }));
        try {
            const [clientsResult, metadataResult] = await Promise.all([loadClients(), loadMetadata()]);
            const next = {
                clients: Array.isArray(clientsResult?.clients) ? clientsResult.clients : [],
                jobNatures: Array.isArray(metadataResult?.job_natures) ? metadataResult.job_natures : [],
                sectors: Array.isArray(metadataResult?.sectors) ? metadataResult.sectors : [],
                loading: false, error: null,
            };
            setState(next);
            return next;
        } catch (error) {
            setState((current) => ({ ...current, loading: false, error }));
            return null;
        }
    }, [loadClients, loadMetadata]);

    useEffect(() => { refresh(); }, [refresh]);
    return { ...state, refresh };
}
