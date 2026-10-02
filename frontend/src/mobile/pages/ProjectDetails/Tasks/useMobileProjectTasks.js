import { useCallback, useEffect, useRef, useState } from 'react';
import { projectApi } from '../../../../services/projectApi';
import { tasksApi } from '../../../../services/tasksApi';
import { createProjectRequestGuard } from '../mobileProjectModules';
import { normalizeMember } from './mobileTaskModel';

const serviceIds = new WeakMap();
const sharedRequests = new Map();
let nextServiceId = 1;

function serviceId(service) {
    if (!serviceIds.has(service)) serviceIds.set(service, nextServiceId++);
    return serviceIds.get(service);
}

function requestKey(projectId, taskService, projectService) {
    return `${String(projectId)}:${serviceId(taskService)}:${serviceId(projectService)}`;
}

function projectWorkspaceRequest(projectId, taskService, projectService, force) {
    const key = requestKey(projectId, taskService, projectService);
    if (!force && sharedRequests.has(key)) return sharedRequests.get(key);
    const request = Promise.allSettled([taskService.getTasks(projectId), projectService.getProjectMembers(projectId)]);
    sharedRequests.set(key, request);
    request.finally(() => setTimeout(() => { if (sharedRequests.get(key) === request) sharedRequests.delete(key); }, 250));
    return request;
}

export default function useMobileProjectTasks({ projectId, taskService = tasksApi, projectService = projectApi } = {}) {
    const [state, setState] = useState({ categories: [], members: [], loading: true, error: null, membersError: null });
    const pending = useRef(null);
    const guard = useRef(null);
    if (!guard.current) guard.current = createProjectRequestGuard();

    const load = useCallback((force = false) => {
        const sameRequest = pending.current
            && String(pending.current.projectId) === String(projectId)
            && pending.current.taskService === taskService
            && pending.current.projectService === projectService;
        if (sameRequest && !force) return pending.current.promise;
        const token = guard.current.begin(projectId);
        setState({ categories: [], members: [], loading: true, error: null, membersError: null });
        const request = projectWorkspaceRequest(projectId, taskService, projectService, force);
        const handled = request.then(([tasksResult, membersResult]) => {
            if (!guard.current.isCurrent(token)) return;
            const taskError = tasksResult.status === 'rejected' ? tasksResult.reason : null;
            const memberError = membersResult.status === 'rejected' ? membersResult.reason : null;
            setState({
                categories: taskError ? [] : tasksResult.value?.categories || [],
                members: memberError ? [] : (membersResult.value?.members || []).map(normalizeMember),
                loading: false,
                error: taskError,
                membersError: memberError,
            });
        });
        pending.current = { projectId, taskService, projectService, promise: handled };
        return handled;
    }, [projectId, projectService, taskService]);

    useEffect(() => { load(); }, [load]);
    return { ...state, setCategories: (updater) => setState((current) => ({ ...current, categories: typeof updater === 'function' ? updater(current.categories) : updater })), load, taskService };
}
