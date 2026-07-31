import React, { useState, useEffect } from 'react';
import { X, Trash2, CheckCircle2, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DuplicateResolverModal = ({
    isOpen,
    onClose,
    title = 'Remove Duplicates',
    gridData = [],
    getKey = (row) => (row.name || '').trim().toLowerCase(),
    getLabel = (row) => row.name || 'Unnamed Item',
    getSubLabel = (row) => row.code || row.email || row.telephone_no || row.job_name || '',
    onDeleteDuplicates
}) => {
    const [duplicateGroups, setDuplicateGroups] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (onClose) onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;

        // Group rows by key
        const groupsMap = new Map();
        gridData.forEach(row => {
            const key = getKey(row);
            if (!key) return; // Ignore completely blank keys

            if (!groupsMap.has(key)) {
                groupsMap.set(key, []);
            }
            groupsMap.get(key).push(row);
        });

        // Filter groups with > 1 row (duplicates)
        const dupGroups = [];
        const initialSelected = new Set();

        groupsMap.forEach((rows, key) => {
            if (rows.length > 1) {
                dupGroups.push({
                    key,
                    original: rows[0],
                    duplicates: rows.slice(1),
                    allRows: rows
                });
                // By default, select all secondary duplicate rows for deletion
                rows.slice(1).forEach(r => initialSelected.add(r.id));
            }
        });

        setDuplicateGroups(dupGroups);
        setSelectedIds(initialSelected);
    }, [isOpen, gridData]);

    const totalDuplicateRows = duplicateGroups.reduce((acc, g) => acc + g.duplicates.length, 0);

    const toggleSelectId = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleSelectGroup = (group) => {
        const dupIds = group.duplicates.map(r => r.id);
        const allSelected = dupIds.every(id => selectedIds.has(id));

        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allSelected) {
                dupIds.forEach(id => next.delete(id));
            } else {
                dupIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        const allDupIds = new Set();
        duplicateGroups.forEach(g => {
            g.duplicates.forEach(r => allDupIds.add(r.id));
        });
        setSelectedIds(allDupIds);
    };

    const handleDeselectAll = () => {
        setSelectedIds(new Set());
    };

    const handleConfirmDelete = () => {
        if (selectedIds.size === 0) return;
        onDeleteDuplicates(Array.from(selectedIds));
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {/* Backdrop Overlay */}
            <div
                className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm z-[7000] flex justify-end"
                onClick={(e) => {
                    if (e.target === e.currentTarget) onClose();
                }}
            >
                {/* Right Sidebar Drawer Popup Panel */}
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                    className="bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-white/10 shadow-2xl w-full max-w-md sm:max-w-lg lg:max-w-xl h-full flex flex-col overflow-hidden"
                >
                    {/* Drawer Header */}
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02] shrink-0">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                <Layers size={18} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                    {duplicateGroups.length > 0
                                        ? `Found ${duplicateGroups.length} duplicate group(s) (${totalDuplicateRows} copy/copies).`
                                        : 'All rows in your spreadsheet grid are unique.'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Drawer Scrollable Content Body */}
                    <div
                        className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar [&::-webkit-scrollbar]:hidden"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {duplicateGroups.length === 0 ? (
                            <div className="py-20 text-center flex flex-col items-center justify-center">
                                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 shadow-inner">
                                    <CheckCircle2 size={28} />
                                </div>
                                <h4 className="text-base font-bold text-gray-900 dark:text-white">No Duplicates Found!</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs font-medium">
                                    Every row in your table has a unique identifier. No duplicate entries detected.
                                </p>
                            </div>
                        ) : (
                            duplicateGroups.map((group, groupIdx) => {
                                const dupIds = group.duplicates.map(r => r.id);
                                const isGroupAllSelected = dupIds.every(id => selectedIds.has(id));

                                return (
                                    <div
                                        key={groupIdx}
                                        className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-white/[0.01]"
                                    >
                                        {/* Duplicate Group Header */}
                                        <div className="px-4 py-2.5 bg-gray-100/80 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between select-none">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                                    {getLabel(group.original)}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                                                    {group.allRows.length} Copies
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => toggleSelectGroup(group)}
                                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                                            >
                                                {isGroupAllSelected ? 'Deselect Group' : 'Select Duplicates'}
                                            </button>
                                        </div>

                                        {/* Rows List in Group */}
                                        <div className="divide-y divide-gray-100 dark:divide-white/5">
                                            {/* Original Row (Keep) */}
                                            <div className="px-4 py-2.5 flex items-center justify-between bg-emerald-50/30 dark:bg-emerald-950/10">
                                                <div className="flex items-center gap-3">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                                                        Original (Keep)
                                                    </span>
                                                    <div>
                                                        <p className="text-xs font-semibold text-gray-900 dark:text-white">
                                                            {getLabel(group.original)}
                                                        </p>
                                                        {getSubLabel(group.original) && (
                                                            <p className="text-[11px] text-gray-400 font-mono">
                                                                {getSubLabel(group.original)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="text-[11px] text-gray-400 font-medium italic">Preserved</span>
                                            </div>

                                            {/* Secondary Duplicate Rows */}
                                            {group.duplicates.map((dupRow, dIdx) => {
                                                const isChecked = selectedIds.has(dupRow.id);
                                                return (
                                                    <div
                                                        key={dupRow.id}
                                                        onClick={() => toggleSelectId(dupRow.id)}
                                                        className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition select-none ${isChecked
                                                            ? 'bg-amber-500/10 dark:bg-amber-500/10'
                                                            : 'hover:bg-gray-100 dark:hover:bg-white/5'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => { }} // Handled by container onClick
                                                                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                            />
                                                            <div>
                                                                <p className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                                                    <span>{getLabel(dupRow)}</span>
                                                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                                                                        Copy #{dIdx + 2}
                                                                    </span>
                                                                </p>
                                                                {getSubLabel(dupRow) && (
                                                                    <p className="text-[11px] text-gray-400 font-mono">
                                                                        {getSubLabel(dupRow)}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <span className={`text-[11px] font-semibold ${isChecked ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400'}`}>
                                                            {isChecked ? 'Marked for deletion' : 'Keep copy'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Drawer Footer Actions */}
                    {duplicateGroups.length > 0 && (
                        <div className="px-6 py-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02] shrink-0">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={selectedIds.size === totalDuplicateRows ? handleDeselectAll : handleSelectAll}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold"
                                >
                                    {selectedIds.size === totalDuplicateRows ? 'Deselect All' : 'Select All Duplicates'}
                                </button>
                                <span className="text-xs text-gray-400">|</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                                    <strong className="text-gray-900 dark:text-white">{selectedIds.size}</strong> selected
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    disabled={selectedIds.size === 0}
                                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition shadow-sm ${selectedIds.size > 0
                                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                                        : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-50'
                                        }`}
                                >
                                    <Trash2 size={13} />
                                    <span>Delete Selected ({selectedIds.size})</span>
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default DuplicateResolverModal;
