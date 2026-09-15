import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectApi } from '../../../services/projectApi.js';
import { createProjectRequestGuard, normalizeProjectPermissions } from './mobileProjectModules.js';

export default function useMobileProjectContext({ projectId, projectService = projectApi }) {
    const navigate = useNavigate();
    const [state, setState] = useState({ project: null, permissions: null, loading: true, error: null });
    const requestRef = useRef({ key: null, promise: null });
    const guardRef = useRef(null);
    if (!guardRef.current) guardRef.current = createProjectRequestGuard();

    const load = useCallback(async () => {
        const requestKey = `${projectId}:${projectService}`;
        if (requestRef.current.key === requestKey && requestRef.current.promise) return requestRef.current.promise;
        const token = guardRef.current.begin(projectId);
        setState({ project: null, permissions: null, loading: true, error: null });
        const promise = (async () => {
            try {
                const response = await projectService.getProject(projectId);
                if (!response?.success) throw new Error(response?.message || 'Project could not be loaded');
                if (!guardRef.current.isCurrent(token)) return;
                const project = response.project;
                setState({ project, permissions: normalizeProjectPermissions(response.projectPermissions || {}), loading: false, error: null });
                try {
                    sessionStorage.setItem(`active_project_info_${projectId}`, JSON.stringify({ name: project?.name, project_code: project?.project_code }));
                    window.dispatchEvent(new CustomEvent('active-project-updated', { detail: { id: projectId, name: project?.name, project_code: project?.project_code } }));
                } catch (storageError) { }
            } catch (error) {
                if (!guardRef.current.isCurrent(token)) return;
                if (error?.response?.status === 401 || error?.response?.status === 403) {
                    navigate('/projects', { replace: true });
                    return;
                }
                setState({ project: null, permissions: null, loading: false, error });
            }
        })();
        requestRef.current = { key: requestKey, promise };
        promise.then(
            () => { if (requestRef.current.promise === promise) requestRef.current = { key: null, promise: null }; },
            () => { if (requestRef.current.promise === promise) requestRef.current = { key: null, promise: null }; },
        );
        return promise;
    }, [navigate, projectId, projectService]);

    useEffect(() => {
        load();
    }, [load]);

    return { ...state, refresh: load };
}