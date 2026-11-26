import React from 'react';
import { Plus, Star, Trash2 } from 'lucide-react';

export const buildInitialContactPersons = (initialData) => {
    if (Array.isArray(initialData?.contact_persons) && initialData.contact_persons.length > 0) {
        return initialData.contact_persons.map((cp) => ({
            id: cp.id,
            name: cp.name || '',
            designation: cp.designation || '',
            telephone_no: cp.telephone_no || '',
            mobile: cp.mobile || '',
            email: cp.email || '',
            is_primary: Boolean(cp.is_primary)
        }));
    }
    if (initialData && (initialData.contact_person || initialData.contact_no || initialData.telephone_no || initialData.mobile || initialData.email)) {
        return [{
            name: initialData.contact_person || initialData.name || '',
            designation: initialData.designation || '',
            telephone_no: initialData.contact_no || initialData.telephone_no || '',
            mobile: initialData.mobile || '',
            email: initialData.email || '',
            is_primary: true
        }];
    }
    return [{ name: '', designation: '', telephone_no: '', mobile: '', email: '', is_primary: true }];
};

export default function PartyContactsRepeater({ contacts = [], onChange, inputClasses }) {
    const updateAt = (idx, field, value) => {
        onChange(contacts.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
    };

    const setPrimaryAt = (idx) => {
        onChange(contacts.map((c, i) => ({ ...c, is_primary: i === idx })));
    };

    const addRow = () => {
        onChange([
            ...contacts,
            { name: '', designation: '', telephone_no: '', mobile: '', email: '', is_primary: contacts.length === 0 }
        ]);
    };

    const removeAt = (idx) => {
        const next = contacts.filter((_, i) => i !== idx);
        if (next.length > 0 && !next.some((c) => c.is_primary)) {
            next[0] = { ...next[0], is_primary: true };
        }
        onChange(next.length > 0 ? next : [{ name: '', designation: '', telephone_no: '', mobile: '', email: '', is_primary: true }]);
    };

    return (
        <div className="md:col-span-2 pt-2 border-t border-gray-100 dark:border-white/5 space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Contact Persons ({contacts.length})
                </span>
                <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                >
                    <Plus size={13} /> Add Contact Person
                </button>
            </div>
            <div className="space-y-2">
                {contacts.map((cp, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] space-y-2">
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setPrimaryAt(idx)}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                    cp.is_primary
                                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                                        : 'text-gray-500 border-gray-200 dark:border-white/10 hover:text-amber-600'
                                }`}
                            >
                                <Star size={11} className={cp.is_primary ? 'fill-current' : ''} />
                                {cp.is_primary ? 'Primary POC' : 'Set Primary'}
                            </button>
                            {contacts.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeAt(idx)}
                                    className="p-1 rounded text-gray-400 hover:text-rose-500"
                                    title="Remove contact person"
                                >
                                    <Trash2 size={13} />
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input
                                type="text"
                                placeholder="Contact Name"
                                value={cp.name}
                                onChange={(e) => updateAt(idx, 'name', e.target.value)}
                                className={inputClasses}
                            />
                            <input
                                type="text"
                                placeholder="Designation"
                                value={cp.designation}
                                onChange={(e) => updateAt(idx, 'designation', e.target.value)}
                                className={inputClasses}
                            />
                            <input
                                type="text"
                                placeholder="Phone / Telephone"
                                value={cp.telephone_no}
                                onChange={(e) => updateAt(idx, 'telephone_no', e.target.value)}
                                className={inputClasses}
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                value={cp.email}
                                onChange={(e) => updateAt(idx, 'email', e.target.value)}
                                className={inputClasses}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
