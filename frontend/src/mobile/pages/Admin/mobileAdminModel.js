export const SYSTEM_PERMISSION_TREE = Object.freeze([
    { id: 'projects', label: 'Projects' },
    { id: 'vendors', label: 'Vendors' },
    { id: 'clients', label: 'Clients' },
    { id: 'resources', label: 'Resources' },
    { id: 'spreadsheets', label: 'Spreadsheets' },
    { id: 'units', label: 'Units' },
    { id: 'collaboration', label: 'Collaboration', children: [
        { id: 'collaboration.chat', label: 'Chat' },
        { id: 'collaboration.calendar', label: 'Calendar' },
    ] },
    { id: 'admin', label: 'Admin' },
]);

export const SYSTEM_PERMISSION_KEYS = Object.freeze(SYSTEM_PERMISSION_TREE.flatMap((item) => [item.id, ...(item.children || []).map((child) => child.id)]));
export const PERMISSION_LEVELS = Object.freeze([
    { value: 0, label: 'None' }, { value: 1, label: 'Read' }, { value: 2, label: 'Write' },
]);

export const isBackendAdmin = (user) => String(user?.user_type || '').toLowerCase() === 'admin';
export const userId = (user) => user?.user_id ?? user?.id;

export function parsePermissionMap(value) {
    if (typeof value !== 'string') return value || {};
    try { return JSON.parse(value) || {}; } catch { return {}; }
}

export function normalizePermissionLevel(value) {
    if (typeof value === 'number') return Math.max(0, Math.min(2, value));
    return ({ none: 0, view: 1, read: 1, edit: 2, write: 2 }[String(value).toLowerCase()] ?? 0);
}

export function defaultSystemPermissions(source = {}) {
    const parsed = parsePermissionMap(source);
    return Object.fromEntries(SYSTEM_PERMISSION_KEYS.map((key) => [key, normalizePermissionLevel(parsed[key])]));
}

export function serializeSystemPermissions(source = {}) {
    const normalized = defaultSystemPermissions(source);
    return Object.fromEntries(SYSTEM_PERMISSION_KEYS.map((key) => [key, ['none', 'view', 'edit'][normalized[key]]]));
}

export function normalizeAdminUser(user = {}) {
    const id = userId(user);
    const name = user.user_name || user.name || user.email || `User ${id ?? ''}`.trim();
    return {
        ...user,
        id,
        name,
        email: user.email || user.email_id || '',
        phone: user.phone_no || user.phone || '',
        department: user.department_name || user.department || user.dept_name || '',
        departmentId: user.dept_id ?? '',
        designationId: user.desg_id ?? '',
        role: String(user.user_type || user.role || 'employee').toLowerCase(),
        joined: user.created_at || user.joined_at || '',
        systemPermissions: defaultSystemPermissions(user.system_permissions),
        projectIds: (user.project_ids || user.projects || []).map((item) => String(item?.project_id ?? item?.id ?? item)),
        raw: user,
    };
}

export const normalizeUsersResponse = (response) => (Array.isArray(response) ? response : response?.users || response?.data || []).map(normalizeAdminUser);
export const normalizeProjectsResponse = (response) => (Array.isArray(response) ? response : response?.projects || response?.data || []).map((project) => ({ id: project.id ?? project.project_id, name: project.name || project.project_name || `Project ${project.id ?? project.project_id}` }));
export const normalizeTemplatesResponse = (response) => (Array.isArray(response) ? response : response?.templates || response?.data || []).filter((template) => template.type !== 'project');

export function createEmployeePayload(form = {}) {
    return {
        name: String(form.name || '').trim(),
        email: String(form.email || '').trim(),
        phone_no: String(form.phone_no || '').trim() || undefined,
        dept_id: form.dept_id || undefined,
        desg_id: form.desg_id || undefined,
        user_type: form.user_type === 'admin' ? 'admin' : 'employee',
        password: form.password || undefined,
        system_permissions: serializeSystemPermissions(form.system_permissions),
        project_ids: (form.project_ids || []).map(Number).filter(Number.isFinite),
        project_permissions: {},
    };
}

export function updateEmployeePayload(form = {}) {
    const payload = createEmployeePayload(form);
    delete payload.password;
    if (form.password) payload.user_password = form.password;
    return payload;
}

export function permissionStats(template = {}) {
    const values = Object.values(parsePermissionMap(template.permissions || template.system_permissions));
    let write = 0; let read = 0; let none = 0;
    values.forEach((value) => {
        const normalized = normalizePermissionLevel(value);
        if (normalized === 2) write += 1;
        else if (normalized === 1) read += 1;
        else none += 1;
    });
    return { write, read, none, total: values.length };
}

export function templatePayload(form = {}) {
    return { name: String(form.name || '').trim(), type: 'system', permissions: serializeSystemPermissions(form.permissions) };
}

export function validateAdminImportFile(file) {
    if (!file) return 'Choose a CSV or XLSX file.';
    return /\.(csv|xlsx)$/i.test(file.name || '') ? '' : 'Only CSV and XLSX files are supported.';
}

export function normalizeImportResult(result = {}) {
    return {
        total: Number(result.total_processed ?? result.total ?? 0),
        succeeded: Number(result.success_count ?? result.succeeded ?? 0),
        failed: Number(result.failure_count ?? result.failed ?? 0),
        errors: Array.isArray(result.errors) ? result.errors : [],
    };
}

export function classifyReconciledCreate({ form, users = [] }) {
    const found = users.find((user) => String(user.email || '').toLowerCase() === String(form?.email || '').toLowerCase());
    if (!found) return { partial: false, message: 'Employee creation failed.' };
    const expected = new Set((form.project_ids || []).map(String));
    const actual = new Set((found.projectIds || []).map(String));
    const membershipComplete = [...expected].every((id) => actual.has(id));
    return membershipComplete
        ? { partial: true, message: 'The account exists, but the request reported a failure. Server state was reconciled.' }
        : { partial: true, message: 'Account created, but project access is incomplete.' };
}

export function createOwnershipSlots(names = []) {
    const generations = new Map(names.map((name) => [name, 0]));
    return {
        begin(name) { const generation = (generations.get(name) || 0) + 1; generations.set(name, generation); return { name, generation }; },
        isCurrent(token) { return token?.generation === generations.get(token?.name); },
        invalidate(name) { generations.set(name, (generations.get(name) || 0) + 1); },
        invalidateAll() { [...generations.keys()].forEach((name) => this.invalidate(name)); },
    };
}
