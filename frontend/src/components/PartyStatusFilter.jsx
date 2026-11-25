import React from 'react';

const OPTIONS = [
    { id: 'active', label: 'Active' },
    { id: 'archived', label: 'Archived' },
    { id: 'all', label: 'All' }
];

export default function PartyStatusFilter({ value, onChange }) {
    return (
        <div className="inline-flex items-center bg-gray-100 dark:bg-white/5 p-0.5 rounded-lg border border-gray-200 dark:border-white/10 text-[11px] font-semibold">
            {OPTIONS.map((opt) => (
                <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChange(opt.id)}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        value === opt.id
                            ? 'bg-white dark:bg-[#161b22] text-blue-600 dark:text-blue-400 shadow-xs'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}
