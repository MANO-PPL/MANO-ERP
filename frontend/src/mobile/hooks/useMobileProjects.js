import { useCallback, useEffect, useState } from 'react';
import { projectApi } from '../../services/projectApi.js';
import { createRequestLoader } from '../utils/createRequestLoader.js';

export const createProjectRequestLoader = (request = projectApi.listProjects) => createRequestLoader(request);

// This coalesces concurrent consumers only. It deliberately does not cache
// completed responses or change M1's useRecentProjects lifecycle.
export const loadMobileProjects = createProjectRequestLoader();

export default function useMobileProjects({ loadProjects = loadMobileProjects } = {}) {
    const [state, setState] = useState({ projects: [], loading: true, error: null });

    const refresh = useCallback(async () => {
        setState((current) => ({ ...current, loading: true, error: null }));
        try {
            const response = await loadProjects();
            const projects = response?.success && Array.isArray(response.projects) ? response.projects : [];
            setState({ projects, loading: false, error: null });
            return response;
        } catch (error) {
            setState({ projects: [], loading: false, error });
            return null;
        }
    }, [loadProjects]);

    useEffect(() => {
        let active = true;
        setState((current) => ({ ...current, loading: true, error: null }));
        loadProjects()
            .then((response) => {
                if (!active) return;
                const projects = response?.success && Array.isArray(response.projects) ? response.projects : [];
                setState({ projects, loading: false, error: null });
            })
            .catch((error) => {
                if (active) setState({ projects: [], loading: false, error });
            });
        return () => { active = false; };
    }, [loadProjects]);

    return { ...state, refresh };
}
