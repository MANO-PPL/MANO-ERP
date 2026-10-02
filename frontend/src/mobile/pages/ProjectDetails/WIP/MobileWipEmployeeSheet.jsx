import React from 'react';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import MobileSearchBar from '../../../components/MobileSearchBar';

export default function MobileWipEmployeeSheet({ open, onClose, members, value, onChange }) {
    const [query, setQuery] = React.useState(''); const visible = members.filter((member) => member.name.toLowerCase().includes(query.toLowerCase()));
    return <MobileBottomSheet open={open} onClose={onClose} title="Select employee"><div className="space-y-2"><MobileSearchBar value={query} onChange={setQuery} placeholder="Search employees" /><div className="space-y-1">{visible.map((member) => <button key={member.id} type="button" role="option" aria-selected={String(member.id) === String(value)} onClick={() => { onChange(member.id); onClose(); }} className="min-h-10 w-full rounded-lg px-2.5 text-left text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gh-hover flex items-center justify-between"><span>{member.name}</span><span className="text-[11px] font-normal text-gray-500">{member.user_type || member.role || 'Employee'}</span></button>)}</div></div></MobileBottomSheet>;
}

