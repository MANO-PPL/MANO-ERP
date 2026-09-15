import React from 'react';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import MobilePermissionTree from './MobilePermissionTree';

export default function MobileEmployeeDetail({ employee, projects = [], open, onClose, canWrite, onEdit, onDelete }) {
    if (!employee) return null;
    const memberships = projects.filter((project) => employee.projectIds.includes(String(project.id)));
    return <MobileBottomSheet open={open} onClose={onClose} title={employee.name} description="Employee details and current access" footer={canWrite && <div className="flex gap-2"><button type="button" onClick={onDelete} className="min-h-11 flex-1 rounded-xl border border-red-300 px-3 text-sm font-bold text-red-700 dark:border-red-900 dark:text-red-300">Delete Employee</button><button type="button" onClick={onEdit} className="min-h-11 flex-1 rounded-xl bg-blue-600 px-3 text-sm font-bold text-white">Edit Access</button></div>}>
        <div className="space-y-5" data-mobile-employee-detail>
            <dl className="grid grid-cols-1 gap-3 rounded-2xl bg-gray-50 p-4 text-sm dark:bg-gh-hover">{[['Email', employee.email], ['Account type', employee.role], ['Department', employee.department || '—'], ['Phone', employee.phone || '—'], ['Joined', employee.joined ? new Date(employee.joined).toLocaleDateString() : '—']].map(([label, value]) => <div key={label}><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-0.5 break-words font-semibold capitalize">{value}</dd></div>)}</dl>
            <section><h3 className="mb-2 text-sm font-bold">System permissions</h3><MobilePermissionTree value={employee.systemPermissions} readOnly /></section>
            <section><h3 className="mb-2 text-sm font-bold">Project membership</h3>{memberships.length ? <ul className="space-y-2">{memberships.map((project) => <li key={project.id} className="rounded-xl border border-gray-200 p-3 text-sm font-semibold dark:border-gh-border">{project.name}</li>)}</ul> : <p className="text-sm text-gray-500">No project membership.</p>}</section>
        </div>
    </MobileBottomSheet>;
}
