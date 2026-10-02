import { useEffect, useMemo, useState } from 'react';
import { projectApi } from '../../services/projectApi.js';
import { normalizeRecentProjects } from '../layout/mobileNavigation.js';

export default function useRecentProjects({ enabled = true, limit = 5, loadProjects = projectApi.listProjects } = {}) {
    const [response, setResponse] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const loaded = response !== null;

    useEffect(() => {
        if (!enabled || loaded) return undefined;
        let active = true;
        setLoading(true);
        setError(null);

        Promise.resolve()
            .then(() => loadProjects())
            .then((result) => {
                if (active) setResponse(result || { success: false, projects: [] });
            })
            .catch((loadError) => {
                if (!active) return;
                setError(loadError);
                setResponse({ success: false, projects: [] });
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => { active = false; };
    }, [enabled, loadProjects, loaded]);

    const projects = useMemo(() => normalizeRecentProjects(response, limit), [limit, response]);
    return { projects, loading, error };
}
