import React, { useEffect, useMemo, useState } from 'react';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import MobileSearchBar from '../../components/MobileSearchBar';
import MobileSelect from '../../components/MobileSelect';

export default function MobileTemplateAssignments({ open, onClose, template, users = [], onApply, pending }) {
    const [selected, setSelected] = useState([]); const [search, setSearch] = useState(''); const [department, setDepartment] = useState('');
    useEffect(() => { if (open) { setSelected([]); setSearch(''); setDepartment(''); } }, [open, template]);
    const departments = [...new Set(users.map((user) => user.department).filter(Boolean))];
    const filtered = useMemo(() => users.filter((user) => (!search || `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase())) && (!department || user.department === department)), [department, search, users]);
    const apply = async () => { const result = await onApply?.(template, selected); if (result && !result.stale) onClose?.(); };
    return <MobileBottomSheet open={open} onClose={onClose} closeDisabled={pending} title="Apply permissions" description={template ? `${template.name} · sequential employee updates` : ''} footer={<div className="flex gap-2"><button type="button" disabled={pending} onClick={onClose} className="min-h-9 flex-1 rounded-lg border border-gray-200 text-xs font-semibold dark:border-gh-border">Cancel</button><button type="button" disabled={pending || selected.length === 0} onClick={apply} className="min-h-9 flex-1 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50">Apply Permissions ({selected.length})</button></div>}>
        <div className="space-y-2.5" data-mobile-template-assignments><p className="rounded-lg bg-amber-50 p-2.5 text-xs font-normal leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Updates run one employee at a time and may partially succeed. This does not create a permanent template assignment.</p><MobileSearchBar value={search} onChange={setSearch} placeholder="Search employees" /><MobileSelect label="Department" value={department} onChange={(event) => setDepartment(event.target.value)} options={[{ value: '', label: 'All departments' }, ...departments.map((value) => ({ value, label: value }))]} />{filtered.map((user) => <label key={user.id} className="flex min-h-10 items-center gap-2.5 rounded-lg border border-gray-200 px-2.5 text-xs dark:border-gh-border"><input type="checkbox" checked={selected.includes(user.id)} onChange={() => setSelected((state) => state.includes(user.id) ? state.filter((id) => id !== user.id) : [...state, user.id])} /><span className="min-w-0"><span className="block truncate text-xs font-semibold text-gray-900 dark:text-gh-text">{user.name}</span><span className="block truncate text-[11px] font-normal text-gray-500">{user.email}</span></span></label>)}</div>
    </MobileBottomSheet>;
}
