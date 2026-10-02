import React from 'react';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import MobilePermissionTree from './MobilePermissionTree';

export default function MobileEmployeeDetail({ employee, projects = [], open, onClose, canWrite, onEdit, onDelete }) {
    if (!employee) return null;
    const memberships = projects.filter((project) => employee.projectIds.includes(String(project.id)));
    return <MobileBottomSheet open={open} onClose={onClose} title={employee.name} description="Employee details and current access" footer={canWrite && <div className="flex gap-2"><button type="button" onClick={onDelete} className="min-h-9 flex-1 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-700 dark:border-red-900 dark:text-red-300">Delete Employee</button><button type="button" onClick={onEdit} className="min-h-9 flex-1 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white">Edit Access</button></div>}>
        <div className="space-y-3" data-mobile-employee-detail>
            <dl className="grid grid-cols-1 gap-2 rounded-lg bg-gray-50 p-2.5 text-xs dark:bg-gh-hover">{[['Email', employee.email], ['Account type', employee.role], ['Department', employee.department || '—'], ['Phone', employee.phone || '—'], ['Joined', employee.joined ? new Date(employee.joined).toLocaleDateString() : '—']].map(([label, value]) => <div key={label}><dt className="text-[11px] font-normal text-gray-500">{label}</dt><dd className="mt-0.5 break-words font-medium text-gray-900 dark:text-gh-text capitalize">{value}</dd></div>)}</dl>
            <section><h3 className="mb-1.5 text-xs font-semibold text-gray-900 dark:text-gh-text">System permissions</h3><MobilePermissionTree value={employee.systemPermissions} readOnly /></section>
            <section><h3 className="mb-1.5 text-xs font-semibold text-gray-900 dark:text-gh-text">Project membership</h3>{memberships.length ? <ul className="space-y-1.5">{memberships.map((project) => <li key={project.id} className="rounded-lg border border-gray-200 p-2 text-xs font-normal text-gray-900 dark:border-gh-border dark:text-gh-text">{project.name}</li>)}</ul> : <p className="text-xs font-normal text-gray-500">No project membership.</p>}</section>
        </div>
    </MobileBottomSheet>;
}
