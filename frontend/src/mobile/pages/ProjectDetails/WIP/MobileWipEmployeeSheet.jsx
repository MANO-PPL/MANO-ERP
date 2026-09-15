import React from 'react';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import MobileSearchBar from '../../../components/MobileSearchBar';

export default function MobileWipEmployeeSheet({ open, onClose, members, value, onChange }) {
    const [query, setQuery] = React.useState(''); const visible = members.filter((member) => member.name.toLowerCase().includes(query.toLowerCase()));
    return <MobileBottomSheet open={open} onClose={onClose} title="Select employee"><div className="space-y-3"><MobileSearchBar value={query} onChange={setQuery} placeholder="Search employees" />{visible.map((member) => <button key={member.id} type="button" role="option" aria-selected={String(member.id) === String(value)} onClick={() => { onChange(member.id); onClose(); }} className="min-h-12 w-full rounded-xl px-3 text-left text-sm font-semibold hover:bg-gray-100 dark:hover:bg-gh-hover">{member.name}<span className="ml-2 text-xs text-gray-500">{member.user_type || member.role || 'Employee'}</span></button>)}</div></MobileBottomSheet>;
}

