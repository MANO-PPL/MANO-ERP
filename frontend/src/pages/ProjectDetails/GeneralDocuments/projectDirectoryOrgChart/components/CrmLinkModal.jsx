import React, { useState, useMemo } from 'react';
import {
    UserPlus,
    Search,
    X,
    Check
} from 'lucide-react';
import { CATEGORY_OPTIONS, CATEGORY_BADGE_STYLES } from '../constants';

const CrmLinkModal = ({
    isOpen,
    onClose,
    availableContacts = [],
    onLinkContacts,
    isLinking = false
}) => {
    const [selectedContactIdsToLink, setSelectedContactIdsToLink] = useState(new Set());
    const [crmSearchQuery, setCrmSearchQuery] = useState('');
    const [crmCategoryFilter, setCrmCategoryFilter] = useState('All');

    // Filter available CRM contacts
    const filteredCrmContacts = useMemo(() => {
        return availableContacts.filter((c) => {
            const matchesCategory =
                crmCategoryFilter === 'All' ||
                (c.category || '').toLowerCase() === crmCategoryFilter.toLowerCase();
            const q = crmSearchQuery.trim().toLowerCase();
            const matchesSearch =
                !q ||
                (c.name || '').toLowerCase().includes(q) ||
                (c.contact_person || '').toLowerCase().includes(q) ||
                (c.email || '').toLowerCase().includes(q) ||
                (c.telephone_no || '').toLowerCase().includes(q);
            return matchesCategory && matchesSearch;
        });
    }, [availableContacts, crmCategoryFilter, crmSearchQuery]);

    // Toggle Select All
    const handleToggleSelectAll = () => {
        if (selectedContactIdsToLink.size === filteredCrmContacts.length) {
            setSelectedContactIdsToLink(new Set());
        } else {
            setSelectedContactIdsToLink(new Set(filteredCrmContacts.map((c) => c.id)));
        }
    };

    const handleCommit = () => {
        if (selectedContactIdsToLink.size === 0) return;
        onLinkContacts(Array.from(selectedContactIdsToLink));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white dark:bg-[#161b22] h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-300 text-left">
                {/* Drawer Header */}
                <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <UserPlus size={16} className="text-blue-500" />
                            <span>Import Parties from CRM</span>
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Select CRM contacts to add as project parties & directory entries.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Search & Category Filter Bar */}
                <div className="p-3 border-b border-gray-200 dark:border-white/10 space-y-2 bg-gray-50/50 dark:bg-white/[0.02]">
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search CRM contacts by name or POC..."
                            value={crmSearchQuery}
                            onChange={(e) => setCrmSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                        />
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar py-0.5">
                        {['All', ...CATEGORY_OPTIONS].slice(0, 6).map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setCrmCategoryFilter(cat)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-tight whitespace-nowrap transition cursor-pointer border ${
                                    crmCategoryFilter === cat
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Contacts List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                    {filteredCrmContacts.length === 0 ? (
                        <div className="text-center py-12 text-xs text-gray-400">
                            No available CRM contacts found to link.
                        </div>
                    ) : (
                        filteredCrmContacts.map((contact) => {
                            const isSelected = selectedContactIdsToLink.has(contact.id);
                            return (
                                <div
                                    key={contact.id}
                                    onClick={() => {
                                        const next = new Set(selectedContactIdsToLink);
                                        if (next.has(contact.id)) next.delete(contact.id);
                                        else next.add(contact.id);
                                        setSelectedContactIdsToLink(next);
                                    }}
                                    className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start justify-between gap-2.5 ${
                                        isSelected
                                            ? 'bg-blue-50/80 dark:bg-blue-900/20 border-blue-300 dark:border-blue-500/40'
                                            : 'bg-white dark:bg-[#1f242c] border-gray-200/80 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/20'
                                    }`}
                                >
                                    <div className="truncate flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                {contact.name}
                                            </span>
                                            {contact.category && (
                                                <span
                                                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border shrink-0 ${
                                                        CATEGORY_BADGE_STYLES[contact.category] ||
                                                        'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400'
                                                    }`}
                                                >
                                                    {contact.category}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                                            {contact.contact_person && (
                                                <p className="truncate">
                                                    <span className="font-semibold text-gray-700 dark:text-gray-300">POC:</span>{' '}
                                                    {contact.contact_person}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 text-[10px] text-gray-400 truncate">
                                                {contact.telephone_no && <span>{contact.telephone_no}</span>}
                                                {contact.email && <span>• {contact.email}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div
                                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                                            isSelected
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'border-gray-300 dark:border-white/20 hover:border-blue-500'
                                        }`}
                                    >
                                        {isSelected && <Check size={12} className="stroke-[3]" />}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Sticky Drawer Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
                    >
                        {selectedContactIdsToLink.size === filteredCrmContacts.length &&
                        filteredCrmContacts.length > 0
                            ? 'Deselect All'
                            : `Select All (${filteredCrmContacts.length})`}
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={selectedContactIdsToLink.size === 0 || isLinking}
                            onClick={handleCommit}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
                        >
                            <UserPlus size={13} />
                            <span>
                                {isLinking
                                    ? 'Linking...'
                                    : `Import (${selectedContactIdsToLink.size})`}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CrmLinkModal;
