import React, { useEffect, useMemo, useState } from 'react';
import { FileUp, Shield, Users } from 'lucide-react';
import MobilePageHeader from '../../components/MobilePageHeader';
import MobileTabs from '../../components/MobileTabs';
import MobileSearchBar from '../../components/MobileSearchBar';
import MobileSelect from '../../components/MobileSelect';
import { MobileCard, MobileEntityCard, MobileStatCard } from '../../components/MobileCard';
import MobileLoadingState from '../../components/MobileLoadingState';
import MobileEmptyState from '../../components/MobileEmptyState';
import MobileFAB from '../../components/MobileFAB';
import MobileConfirmModal from '../../components/MobileConfirmModal';
import MobileEmployeeDetail from './MobileEmployeeDetail';
import MobileEmployeeEditor from './MobileEmployeeEditor';
import MobilePermissionTemplateEditor from './MobilePermissionTemplateEditor';
import MobileTemplateAssignments from './MobileTemplateAssignments';
import MobileAdminBulkImport from './MobileAdminBulkImport';
import useMobileAdmin from './useMobileAdmin';
import { permissionStats } from './mobileAdminModel';

export default function MobileAdmin({ services, authOverride }) {
    const data = useMobileAdmin({ services, authOverride });
    const [tab, setTab] = useState('employees');
    const [search, setSearch] = useState('');
    const [role, setRole] = useState('');
    const [department, setDepartment] = useState('');
    const [selected, setSelected] = useState(null);
    const [editor, setEditor] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [templateEditor, setTemplateEditor] = useState(null);
    const [templateAssign, setTemplateAssign] = useState(null);
    const [templateDelete, setTemplateDelete] = useState(null);
    const [bulkOpen, setBulkOpen] = useState(false);
    const canWrite = data.canWrite;

    useEffect(() => {
        if (!canWrite) {
            setEditor(null); setDeleting(null); setTemplateEditor(null);
            setTemplateAssign(null); setTemplateDelete(null); setBulkOpen(false);
        }
    }, [canWrite]);

    const departments = [...new Set(data.users.map((user) => user.department).filter(Boolean))];
    const filteredUsers = useMemo(() => data.users.filter((user) =>
        (!search || `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase()))
        && (!role || user.role === role) && (!department || user.department === department)), [data.users, department, role, search]);
    const filteredTemplates = useMemo(() => data.templates.filter((template) => !search || template.name.toLowerCase().includes(search.toLowerCase())), [data.templates, search]);
    const noticeClass = data.notice?.tone === 'error'
        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
        : data.notice?.tone === 'warning'
            ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300';

    return <section className="min-w-0 pb-[calc(var(--mobile-agent-clearance,4.75rem)+1rem)]" data-mobile-admin data-admin-write={canWrite ? 'true' : 'false'}>
        <MobilePageHeader eyebrow="MANO ADMIN" title="Administration" subtitle={canWrite ? 'Employee access and permission templates' : 'Read-only employee and permission access'} actions={canWrite && <button type="button" aria-label="Bulk Import" onClick={() => setBulkOpen(true)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-gh-border dark:bg-gh-subtle"><FileUp size={19} /></button>} />
        <div className="space-y-4 px-4">
            <MobileTabs segmented label="Admin section" value={tab} onChange={(value) => { setTab(value); setSearch(''); }} items={[{ value: 'employees', label: 'Employees', count: data.users.length }, { value: 'templates', label: 'Permission Templates', count: data.templates.length }]} />
            {data.notice && <p role="status" className={`rounded-xl border p-3 text-xs font-semibold ${noticeClass}`}>{data.notice.text}</p>}
            {data.errors.projects && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">Project membership could not be loaded: {data.errors.projects}</p>}
            {tab === 'employees' ? <>
                <div className="grid grid-cols-3 gap-2"><MobileStatCard label="Employees" value={data.users.length} icon={Users} /><MobileStatCard label="Admins" value={data.users.filter((user) => user.role === 'admin').length} icon={Shield} tone="amber" /><MobileStatCard label="Departments" value={departments.length} tone="green" /></div>
                <MobileSearchBar value={search} onChange={setSearch} placeholder="Search name or email" />
                <div className="grid grid-cols-2 gap-2"><MobileSelect label="Account type" value={role} onChange={(event) => setRole(event.target.value)} options={[{ value: '', label: 'All accounts' }, { value: 'employee', label: 'Employee' }, { value: 'admin', label: 'Admin' }]} /><MobileSelect label="Department" value={department} onChange={(event) => setDepartment(event.target.value)} options={[{ value: '', label: 'All departments' }, ...departments.map((value) => ({ value, label: value }))]} /></div>
                {data.loading.users ? <MobileLoadingState label="Loading employees…" rows={3} /> : data.errors.users ? <ErrorState message={data.errors.users} retry={data.loadUsers} /> : filteredUsers.length ? <div className="space-y-2">{filteredUsers.map((employee) => <MobileEntityCard key={employee.id} title={employee.name} subtitle={employee.email} meta={`${employee.role} · ${employee.department || 'No department'}`} icon={Users} onClick={() => setSelected(employee)} />)}</div> : <MobileEmptyState title="No employees found" description="No successful employee result matches these filters." />}
            </> : <>
                <MobileSearchBar value={search} onChange={setSearch} placeholder="Search permission templates" />
                {data.loading.templates ? <MobileLoadingState label="Loading permission templates…" rows={3} /> : data.errors.templates ? <ErrorState message={data.errors.templates} retry={data.loadTemplates} /> : filteredTemplates.length ? <div className="space-y-3">{filteredTemplates.map((template) => { const stats = permissionStats(template); return <MobileCard key={template.id}><button type="button" onClick={() => canWrite && setTemplateEditor(template)} className="w-full text-left"><p className="text-base font-bold">{template.name}</p><p className="mt-1 text-xs text-gray-500">System Template · Write {stats.write} · Read {stats.read} · None {stats.none}</p></button>{canWrite && <div className="mt-3 grid grid-cols-3 gap-1"><button type="button" onClick={() => setTemplateAssign(template)} className="min-h-11 rounded-xl bg-blue-50 px-1 text-xs font-bold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">Apply Permissions</button><button type="button" onClick={() => setTemplateEditor(template)} className="min-h-11 rounded-xl bg-gray-100 text-xs font-bold dark:bg-gh-hover">Edit</button><button type="button" onClick={() => setTemplateDelete(template)} className="min-h-11 rounded-xl bg-red-50 text-xs font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300">Delete</button></div>}</MobileCard>; })}</div> : <MobileEmptyState title="No system templates" description="The successful response contained no system permission templates." />}
            </>}
        </div>
        {canWrite && <MobileFAB label={tab === 'employees' ? 'Add Employee' : 'Create Template'} extended onClick={() => tab === 'employees' ? setEditor({ mode: 'create' }) : setTemplateEditor({ mode: 'create' })} />}
        <MobileEmployeeDetail employee={selected} projects={data.projects} open={Boolean(selected)} onClose={() => setSelected(null)} canWrite={canWrite} onEdit={() => { setSelected(null); setEditor(selected); }} onDelete={() => { setSelected(null); setDeleting(selected); }} />
        <MobileEmployeeEditor open={Boolean(editor)} onClose={() => setEditor(null)} employee={editor?.mode === 'create' ? null : editor} projects={data.projects} templates={data.templates} pending={data.pending.createUser || data.pending.updateUser} onSave={(form) => editor?.mode === 'create' ? data.createUser(form) : data.updateUser({ ...form, id: editor.id })} />
        <MobileConfirmModal open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={async () => { const result = await data.deleteUser(deleting); if (result.success) setDeleting(null); }} title="Delete Employee?" message="This permanently deletes the employee account. This action cannot be undone." confirmLabel="Delete Employee" danger pending={data.pending.deleteUser} />
        <MobilePermissionTemplateEditor open={Boolean(templateEditor)} onClose={() => setTemplateEditor(null)} template={templateEditor?.mode === 'create' ? null : templateEditor} onSave={data.saveTemplate} pending={data.pending.templateCreate || data.pending.templateUpdate} />
        <MobileTemplateAssignments open={Boolean(templateAssign)} onClose={() => setTemplateAssign(null)} template={templateAssign} users={data.users} onApply={data.applyTemplate} pending={data.pending.templateApply} />
        <MobileConfirmModal open={Boolean(templateDelete)} onClose={() => setTemplateDelete(null)} onConfirm={async () => { const result = await data.deleteTemplate(templateDelete); if (result.success) setTemplateDelete(null); }} title="Delete permission template?" message="This deletes the template record. Existing employee permissions are not described as rolled back." confirmLabel="Delete Template" danger pending={data.pending.templateDelete} />
        <MobileAdminBulkImport open={bulkOpen} onClose={() => setBulkOpen(false)} onImport={data.bulkImport} pending={data.pending.bulkImport} />
    </section>;
}

function ErrorState({ message, retry }) {
    return <MobileCard className="text-center"><p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{message}</p><button type="button" onClick={() => retry().catch(() => {})} className="mt-3 min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">Try again</button></MobileCard>;
}
