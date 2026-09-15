import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { adminApi as defaultAdminApi } from '../../../services/adminApi';
import { projectApi as defaultProjectApi } from '../../../services/projectApi';
import {
    classifyReconciledCreate, createEmployeePayload, createOwnershipSlots, isBackendAdmin,
    normalizeImportResult, normalizeProjectsResponse, normalizeTemplatesResponse, normalizeUsersResponse,
    templatePayload, updateEmployeePayload, userId,
} from './mobileAdminModel';

const SLOT_NAMES = ['users', 'templates', 'projects', 'createUser', 'updateUser', 'deleteUser', 'bulkImport', 'templateCreate', 'templateUpdate', 'templateDelete', 'templateApply'];
const MUTATION_SLOTS = SLOT_NAMES.filter((name) => !['users', 'templates', 'projects'].includes(name));
const messageOf = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

export default function useMobileAdmin({ services = {}, authOverride } = {}) {
    const context = useAuth();
    const auth = authOverride || context;
    const admin = services.admin || defaultAdminApi;
    const project = services.project || defaultProjectApi;
    const roleRef = useRef(auth.user);
    roleRef.current = auth.user;
    const mountedRef = useRef(true);
    const slotsRef = useRef(createOwnershipSlots(SLOT_NAMES));
    const [users, setUsers] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState({ users: true, templates: true, projects: true });
    const [errors, setErrors] = useState({ users: '', templates: '', projects: '' });
    const [pending, setPending] = useState({});
    const [notice, setNotice] = useState(null);
    const current = useCallback((token) => mountedRef.current && slotsRef.current.isCurrent(token), []);
    const setBusy = useCallback((name, value, token) => { if (current(token)) setPending((state) => ({ ...state, [name]: value })); }, [current]);

    const loadUsers = useCallback(async () => {
        const token = slotsRef.current.begin('users'); setLoading((state) => ({ ...state, users: true })); setErrors((state) => ({ ...state, users: '' }));
        try { const response = await admin.getUsers(); if (current(token)) setUsers(normalizeUsersResponse(response)); return normalizeUsersResponse(response); }
        catch (error) { if (current(token)) setErrors((state) => ({ ...state, users: messageOf(error, 'Employees could not be loaded.') })); throw error; }
        finally { if (current(token)) setLoading((state) => ({ ...state, users: false })); }
    }, [admin, current]);
    const loadTemplates = useCallback(async () => {
        const token = slotsRef.current.begin('templates'); setLoading((state) => ({ ...state, templates: true })); setErrors((state) => ({ ...state, templates: '' }));
        try { const response = await admin.getPermissionTemplates('system'); if (current(token)) setTemplates(normalizeTemplatesResponse(response)); return normalizeTemplatesResponse(response); }
        catch (error) { if (current(token)) setErrors((state) => ({ ...state, templates: messageOf(error, 'Permission templates could not be loaded.') })); throw error; }
        finally { if (current(token)) setLoading((state) => ({ ...state, templates: false })); }
    }, [admin, current]);
    const loadProjects = useCallback(async () => {
        const token = slotsRef.current.begin('projects'); setLoading((state) => ({ ...state, projects: true })); setErrors((state) => ({ ...state, projects: '' }));
        try { const response = await project.listProjects(); if (current(token)) setProjects(normalizeProjectsResponse(response)); return normalizeProjectsResponse(response); }
        catch (error) { if (current(token)) setErrors((state) => ({ ...state, projects: messageOf(error, 'Projects could not be loaded.') })); throw error; }
        finally { if (current(token)) setLoading((state) => ({ ...state, projects: false })); }
    }, [project, current]);

    useEffect(() => {
        mountedRef.current = true;
        Promise.allSettled([loadUsers(), loadTemplates(), loadProjects()]);
        return () => { mountedRef.current = false; slotsRef.current.invalidateAll(); };
    }, [loadProjects, loadTemplates, loadUsers]);

    const allowed = useCallback(() => isBackendAdmin(roleRef.current), []);
    const mutationCurrent = useCallback((token) => current(token) && allowed(), [allowed, current]);
    const denied = useCallback(() => { setNotice({ tone: 'error', text: 'Your current account is read-only for Admin changes.' }); return { success: false, denied: true }; }, []);
    const reconcileUsers = useCallback(async () => { try { return await loadUsers(); } catch { return null; } }, [loadUsers]);

    useEffect(() => {
        if (!allowed()) MUTATION_SLOTS.forEach((name) => slotsRef.current.invalidate(name));
    }, [allowed, auth.user]);

    const createUser = useCallback(async (form) => {
        const token = slotsRef.current.begin('createUser'); if (!allowed()) return denied(); setBusy('createUser', true, token);
        try { if (!allowed()) return denied(); const response = await admin.createUser(createEmployeePayload(form)); if (!mutationCurrent(token)) return { success: false, stale: true }; await loadUsers(); if (!mutationCurrent(token)) return { success: false, stale: true }; setNotice({ tone: 'success', text: `Employee “${form.name}” created.` }); return { success: true, response }; }
        catch (error) { if (!mutationCurrent(token)) return { success: false, stale: true }; const fresh = await reconcileUsers(); if (!mutationCurrent(token)) return { success: false, stale: true }; const classified = fresh ? classifyReconciledCreate({ form, users: fresh }) : null; setNotice({ tone: classified?.partial ? 'warning' : 'error', text: classified?.partial ? classified.message : messageOf(error, 'Employee creation failed.') }); return { success: false, error, partial: Boolean(classified?.partial) }; }
        finally { setBusy('createUser', false, token); }
    }, [admin, allowed, denied, loadUsers, mutationCurrent, reconcileUsers, setBusy]);
    const updateUser = useCallback(async (form) => {
        const token = slotsRef.current.begin('updateUser'); if (!allowed()) return denied(); setBusy('updateUser', true, token);
        try { if (!allowed()) return denied(); const response = await admin.updateUser(form.id, updateEmployeePayload(form)); if (!mutationCurrent(token)) return { success: false, stale: true }; await loadUsers(); if (!mutationCurrent(token)) return { success: false, stale: true }; setNotice({ tone: 'success', text: `Employee “${form.name}” updated.` }); return { success: true, response }; }
        catch (error) { if (!mutationCurrent(token)) return { success: false, stale: true }; await reconcileUsers(); if (mutationCurrent(token)) setNotice({ tone: 'error', text: messageOf(error, 'Employee update failed. Current server state was refreshed where available.') }); return { success: false, error }; }
        finally { setBusy('updateUser', false, token); }
    }, [admin, allowed, denied, loadUsers, mutationCurrent, reconcileUsers, setBusy]);
    const deleteUser = useCallback(async (record) => {
        const token = slotsRef.current.begin('deleteUser'); if (!allowed()) return denied(); setBusy('deleteUser', true, token);
        try { if (!allowed()) return denied(); const response = await admin.deleteUser(userId(record)); if (!mutationCurrent(token)) return { success: false, stale: true }; await loadUsers(); if (!mutationCurrent(token)) return { success: false, stale: true }; setNotice({ tone: 'success', text: `Employee “${record.name}” deleted.` }); return { success: true, response }; }
        catch (error) { if (mutationCurrent(token)) setNotice({ tone: 'error', text: messageOf(error, 'Employee deletion failed.') }); return { success: false, error }; }
        finally { setBusy('deleteUser', false, token); }
    }, [admin, allowed, denied, loadUsers, mutationCurrent, setBusy]);
    const saveTemplate = useCallback(async (form) => {
        const name = form.id ? 'templateUpdate' : 'templateCreate'; const token = slotsRef.current.begin(name); if (!allowed()) return denied(); setBusy(name, true, token);
        try { if (!allowed()) return denied(); const payload = templatePayload(form); const response = form.id ? await admin.updatePermissionTemplate(form.id, payload) : await admin.createPermissionTemplate(payload); if (!mutationCurrent(token)) return { success: false, stale: true }; await loadTemplates(); if (!mutationCurrent(token)) return { success: false, stale: true }; setNotice({ tone: 'success', text: `Permission template “${form.name}” saved.` }); return { success: true, response }; }
        catch (error) { if (mutationCurrent(token)) setNotice({ tone: 'error', text: messageOf(error, 'Permission template could not be saved.') }); return { success: false, error }; }
        finally { setBusy(name, false, token); }
    }, [admin, allowed, denied, loadTemplates, mutationCurrent, setBusy]);
    const deleteTemplate = useCallback(async (record) => {
        const token = slotsRef.current.begin('templateDelete'); if (!allowed()) return denied(); setBusy('templateDelete', true, token);
        try { if (!allowed()) return denied(); const response = await admin.deletePermissionTemplate(record.id); if (!mutationCurrent(token)) return { success: false, stale: true }; await loadTemplates(); if (!mutationCurrent(token)) return { success: false, stale: true }; setNotice({ tone: 'success', text: `Template “${record.name}” deleted.` }); return { success: true, response }; }
        catch (error) { if (mutationCurrent(token)) setNotice({ tone: 'error', text: messageOf(error, 'Permission template could not be deleted.') }); return { success: false, error }; }
        finally { setBusy('templateDelete', false, token); }
    }, [admin, allowed, denied, loadTemplates, mutationCurrent, setBusy]);
    const applyTemplate = useCallback(async (template, ids) => {
        const token = slotsRef.current.begin('templateApply'); if (!allowed()) return denied(); setBusy('templateApply', true, token); let succeeded = 0; let failed = 0;
        for (const id of ids) { if (!mutationCurrent(token)) return { success: false, stale: true, attempted: succeeded + failed, succeeded, failed }; if (!allowed()) return denied(); const record = users.find((user) => String(user.id) === String(id)); try { await admin.updateUser(id, updateEmployeePayload({ ...record, system_permissions: template.permissions || template.system_permissions })); if (!mutationCurrent(token)) return { success: false, stale: true, attempted: succeeded + failed + 1, succeeded, failed }; succeeded += 1; } catch { failed += 1; } }
        if (mutationCurrent(token)) { await loadUsers(); if (!mutationCurrent(token)) return { success: false, stale: true, attempted: ids.length, succeeded, failed }; setNotice({ tone: failed ? 'warning' : 'success', text: `Permissions applied: ${succeeded} succeeded, ${failed} failed.` }); }
        setBusy('templateApply', false, token); return { success: failed === 0, attempted: ids.length, succeeded, failed };
    }, [admin, allowed, denied, loadUsers, mutationCurrent, setBusy, users]);
    const bulkImport = useCallback(async (file) => {
        const token = slotsRef.current.begin('bulkImport'); if (!allowed()) return denied(); setBusy('bulkImport', true, token);
        try { if (!allowed()) return denied(); const response = await admin.bulkUpload(file); const report = normalizeImportResult(response); if (!mutationCurrent(token)) return { success: false, stale: true }; await loadUsers(); if (!mutationCurrent(token)) return { success: false, stale: true }; setNotice({ tone: report.failed ? 'warning' : 'success', text: `Import complete: ${report.succeeded} succeeded, ${report.failed} failed.` }); return { success: true, report, response }; }
        catch (error) { if (mutationCurrent(token)) setNotice({ tone: 'error', text: messageOf(error, 'Employee import failed.') }); return { success: false, error }; }
        finally { setBusy('bulkImport', false, token); }
    }, [admin, allowed, denied, loadUsers, mutationCurrent, setBusy]);

    return { user: auth.user, canWrite: allowed(), users, templates, projects, loading, errors, pending, notice, setNotice, loadUsers, loadTemplates, loadProjects, createUser, updateUser, deleteUser, saveTemplate, deleteTemplate, applyTemplate, bulkImport };
}
