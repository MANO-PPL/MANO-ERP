import React, { useState, useMemo } from 'react';
import { Edit3, Plus, Search, Trash2 } from 'lucide-react';
import CustomSelect from '../../components/CustomSelect';
import { ExcelExportButton } from '../../components/common/ExcelExportButton';

export default function EmployeeDirectory({ users, loading, canWrite, onOpen, onDelete, onCreate, onBulk, onManage }) {
    const [query, setQuery] = useState('');
    const [department, setDepartment] = useState('');
    const [designation, setDesignation] = useState('');
    const options = key => [...new Set(users.map(user => user[key]).filter(value => value && value !== '-'))].sort();
    const term = query.trim().toLowerCase();
    const rows = users.filter(user =>
        (!department || user.department === department) &&
        (!designation || user.desg_name === designation) &&
        [user.name, user.email, user.phone_no, user.user_code].some(value => String(value ?? '').toLowerCase().includes(term))
    );
    const control = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-gh-border dark:bg-gh-subtle';
    const filterSelectButton = 'h-[38px] w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gh-subtle border border-slate-200 dark:border-gh-border rounded-lg text-sm text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 text-left';

    const departmentOptions = useMemo(() => [
        { value: '', label: 'All Departments' },
        ...options('department').map(value => ({ value, label: value }))
    ], [users]);

    const designationOptions = useMemo(() => [
        { value: '', label: 'All Designations' },
        ...options('desg_name').map(value => ({ value, label: value }))
    ], [users]);

    return <section className="flex-1 overflow-auto bg-slate-50 p-4 dark:bg-gh-bg">
        <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className={control + ' flex items-center gap-2'}>
                <Search size={16} className="text-slate-400" />
                <input aria-label="Search employees" placeholder="Search employees..." value={query} onChange={e => setQuery(e.target.value)} className="w-44 bg-transparent outline-none" />
            </label>
            <div className="w-48 sm:w-52">
                <CustomSelect
                    value={department}
                    placeholder="All Departments"
                    options={departmentOptions}
                    onChange={e => setDepartment(e.target.value)}
                    buttonClassName={filterSelectButton}
                />
            </div>
            <div className="w-48 sm:w-52">
                <CustomSelect
                    value={designation}
                    placeholder="All Designations"
                    options={designationOptions}
                    onChange={e => setDesignation(e.target.value)}
                    buttonClassName={filterSelectButton}
                />
            </div>
            <div className="ml-auto flex items-center gap-2">
                <ExcelExportButton
                    data={rows}
                    columns={[
                        { key: 'name', label: 'Employee Name' },
                        { key: 'email', label: 'Email Address' },
                        { key: 'department', label: 'Department' },
                        { key: 'desg_name', label: 'Designation / Role' },
                        { key: 'phone_no', label: 'Phone Number' },
                        { key: 'user_type', label: 'Account Type' }
                    ]}
                    entityName="Employees"
                    theme="navy"
                />
                {canWrite && <>
                    <button className={control} onClick={onManage}>Departments &amp; Designations</button>
                    <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700" onClick={onCreate}><Plus size={16} /> Add Employee</button>
                </>}
            </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-gh-border dark:bg-gh-subtle">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-gh-input"><tr>
                    {['Employee', 'Email Address', 'Role & Department', 'Phone', 'Account type', 'Actions'].map(label => <th className="px-5 py-4" key={label}>{label}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gh-border">
                    {loading || !rows.length ? <tr><td colSpan={6} className="p-10 text-center text-slate-500">{loading ? 'Loading employees…' : 'No employees match these filters.'}</td></tr> : rows.map(user => <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-gh-hover cursor-pointer" onClick={() => onOpen(user)}>
                        <td className="px-5 py-3"><div className="flex items-center gap-3 text-left group">
                            {user.profile_image_url ? (
                                <img
                                    src={user.profile_image_url}
                                    alt={user.name}
                                    onError={(e) => { e.currentTarget.style.display = 'none'; if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'grid'; }}
                                    className="h-9 w-9 rounded-full object-cover border border-slate-200 dark:border-gh-border shadow-2xs shrink-0"
                                />
                            ) : null}
                            <span
                                style={{ display: user.profile_image_url ? 'none' : 'grid' }}
                                className="h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-50 dark:bg-indigo-950/40 font-semibold text-indigo-700 dark:text-indigo-300 text-xs"
                            >
                                {user.name?.trim().split(/\s+/).slice(0,2).map(part => part[0]).join('')}
                            </span>
                            <strong className="block font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{user.name}</strong>
                        </div></td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{user.email || '—'}</td>
                        <td className="px-5 py-3">{user.desg_name || '—'}<span className="block text-xs text-slate-500 dark:text-slate-400">{user.department}</span></td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{user.phone_no || '—'}</td>
                        <td className="px-5 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                user.user_type?.toLowerCase() === 'admin'
                                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300'
                            }`}>
                                {user.user_type}
                            </span>
                        </td>
                        <td className="px-5 py-3" onClick={e => e.stopPropagation()}><div className="flex gap-3">
                            {canWrite && <><button className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer" aria-label={'Edit ' + user.name} onClick={(e) => { e.stopPropagation(); onOpen(user, true); }}><Edit3 size={16} /></button>
                            <button className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer" aria-label={'Delete ' + user.name} onClick={(e) => { e.stopPropagation(); onDelete(user); }}><Trash2 size={16} /></button></>}
                        </div></td>
                    </tr>)}
                </tbody>
            </table>
        </div>
    </section>;
}
