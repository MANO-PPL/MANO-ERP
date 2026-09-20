import React, { useState, useRef, useEffect } from 'react';
import {
    Users,
    Building2,
    Plus,
    Trash2,
    ChevronUp,
    Check,
    Save,
    UserCheck,
    AlertCircle,
    Copy,
    CornerDownRight
} from 'lucide-react';
import { toast } from 'react-toastify';

export const CompanyPersonnelSubGrid = ({
    companyRow,
    onUpdatePersonnel,
    onDeletePerson,
    onSavePersonnel,
    canWrite = true,
    onCollapse
}) => {
    const companyName = companyRow?.name || 'Company / Contractor';
    const personnel = companyRow?.personnel || [];
    const lastAddedInputRef = useRef(null);
    const [justAddedIndex, setJustAddedIndex] = useState(null);
    const isEditingRef = useRef(false);

    // Auto-focus the newly added person's name input
    useEffect(() => {
        if (justAddedIndex !== null && lastAddedInputRef.current) {
            lastAddedInputRef.current.focus();
            setJustAddedIndex(null);
        }
    }, [justAddedIndex, personnel.length]);

    // Handle updating a specific field for a person
    const handleFieldChange = (index, field, value) => {
        const nextPersonnel = [...personnel];
        nextPersonnel[index] = {
            ...nextPersonnel[index],
            [field]: value
        };
        const isFirstKeystroke = !isEditingRef.current;
        if (isFirstKeystroke) {
            isEditingRef.current = true;
        }
        onUpdatePersonnel(companyRow.id, nextPersonnel, isFirstKeystroke);
    };

    // Add a new empty person row
    const handleAddPerson = () => {
        const rand = Math.random().toString(36).substring(2, 9);
        const newPerson = {
            id: `temp_person_${Date.now()}_${rand}_${personnel.length}`,
            party_id: companyRow.party_id || null,
            contact_person: '',
            designation: '',
            responsibilities: '',
            telephone_no: '',
            email: '',
            address: companyRow.address || ''
        };
        const nextPersonnel = [...personnel, newPerson];
        setJustAddedIndex(nextPersonnel.length - 1);
        onUpdatePersonnel(companyRow.id, nextPersonnel, true);
    };

    // Duplicate an existing person row
    const handleDuplicatePerson = (index) => {
        const source = personnel[index];
        const rand = Math.random().toString(36).substring(2, 9);
        const duplicated = {
            ...source,
            id: `temp_person_${Date.now()}_${rand}_${personnel.length}`,
            contact_person: source.contact_person ? `${source.contact_person} (Copy)` : ''
        };
        const nextPersonnel = [...personnel];
        nextPersonnel.splice(index + 1, 0, duplicated);
        onUpdatePersonnel(companyRow.id, nextPersonnel, true);
        toast.info('Personnel row duplicated');
    };

    // Remove a person row
    const handleRemovePerson = (index) => {
        const target = personnel[index];
        const personName = target?.contact_person || `Person #${index + 1}`;
        const nextPersonnel = personnel.filter((_, i) => i !== index);

        onUpdatePersonnel(companyRow.id, nextPersonnel, true);

        if (target?.id && !String(target.id).startsWith('temp_') && onDeletePerson) {
            onDeletePerson(target.id);
        }

        toast.info(`Removed ${personName}`);
    };

    return (
        <div className="py-2.5 pr-4 pl-10 bg-slate-50/70 dark:bg-[#0c1017] border-y border-blue-200/60 dark:border-blue-900/40 text-slate-800 dark:text-slate-200 transition-all">
            <div className="w-fit max-w-full space-y-2">
                {/* Header info */}
                <div className="flex items-center justify-between gap-3 pb-0.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center justify-center w-5 h-5 rounded bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                            <Users size={12} className="stroke-[2.5]" />
                        </div>
                        <span>
                            Personnel & Team for <span className="font-bold text-slate-900 dark:text-white">{companyName}</span>
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-400 font-mono">
                            {personnel.length}
                        </span>
                    </div>
                    {onCollapse && (
                        <button
                            type="button"
                            onClick={onCollapse}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                            title="Collapse personnel"
                        >
                            <ChevronUp size={12} />
                            <span>Collapse</span>
                        </button>
                    )}
                </div>

                {/* ─── Excel Spreadsheet Table ─── */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#161b22] shadow-xs">
                    <table className="w-full border-collapse text-left text-xs table-fixed">
                        {/* Header Row */}
                        <thead className="bg-slate-100/90 dark:bg-[#1a202c] border-b border-slate-200 dark:border-white/10 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider select-none">
                            <tr>
                                <th className="px-2 py-2 w-14 min-w-14 max-w-14 text-center border-r border-slate-200/80 dark:border-white/5 font-mono text-[10px]">
                                    #
                                </th>
                                <th className="px-3 py-2 w-[180px] min-w-[170px] border-r border-slate-200/80 dark:border-white/5">
                                    <div className="flex items-center gap-1">
                                        <span className="font-mono text-[9px] text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1 rounded font-bold">A</span>
                                        <span>Person Name</span>
                                        <span className="text-red-500">*</span>
                                    </div>
                                </th>
                                <th className="px-3 py-2 w-[190px] min-w-[170px] border-r border-slate-200/80 dark:border-white/5">
                                    <div className="flex items-center gap-1">
                                        <span className="font-mono text-[9px] text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1 rounded font-bold">B</span>
                                        <span>Role / Designation</span>
                                        <span className="text-red-500">*</span>
                                    </div>
                                </th>
                                <th className="px-3 py-2 w-[280px] min-w-[240px] border-r border-slate-200/80 dark:border-white/5">
                                    <div className="flex items-center gap-1">
                                        <span className="font-mono text-[9px] text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1 rounded font-bold">C</span>
                                        <span>Responsibilities (Org Chart)</span>
                                    </div>
                                </th>
                                <th className="px-3 py-2 w-[140px] min-w-[130px] border-r border-slate-200/80 dark:border-white/5">
                                    <div className="flex items-center gap-1">
                                        <span className="font-mono text-[9px] text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1 rounded font-bold">D</span>
                                        <span>Mobile / Phone</span>
                                    </div>
                                </th>
                                <th className="px-3 py-2 w-[190px] min-w-[170px] border-r border-slate-200/80 dark:border-white/5">
                                    <div className="flex items-center gap-1">
                                        <span className="font-mono text-[9px] text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1 rounded font-bold">E</span>
                                        <span>Email Address</span>
                                    </div>
                                </th>
                                {canWrite && (
                                    <th className="px-2.5 py-2 w-16 min-w-16 max-w-16 text-center">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>

                        {/* Body Rows */}
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {personnel.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={canWrite ? 7 : 6}
                                        className="py-6 px-4 text-left text-slate-400 dark:text-slate-500 text-xs"
                                    >
                                        <div className="flex flex-col items-start gap-2">
                                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                                <Users size={16} className="opacity-60" />
                                                <span className="font-medium">
                                                    No personnel added yet for {companyName}.
                                                </span>
                                            </div>
                                            {canWrite && (
                                                <button
                                                    type="button"
                                                    onClick={handleAddPerson}
                                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                                >
                                                    <Plus size={12} className="stroke-[3]" />
                                                    <span>Add Person</span>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                personnel.map((person, idx) => {
                                    const isPrimary = idx === 0;
                                    const isNewlyAdded = justAddedIndex === idx;

                                    return (
                                        <tr
                                            key={person.id || idx}
                                            className="hover:bg-blue-50/30 dark:hover:bg-white/[0.02] transition-colors group/subrow"
                                        >
                                            {/* Sub Row Number */}
                                            <td className="px-2 py-1.5 w-14 min-w-14 max-w-14 text-center font-mono text-[10px] text-slate-400 border-r border-slate-100 dark:border-white/5 select-none bg-slate-50/40 dark:bg-white/[0.01]">
                                                <span>{idx + 1}</span>
                                            </td>

                                            {/* Person Name Cell */}
                                            <td className="p-1 border-r border-slate-100 dark:border-white/5">
                                                <input
                                                    ref={isNewlyAdded ? lastAddedInputRef : null}
                                                    type="text"
                                                    value={person.contact_person || ''}
                                                    onFocus={(e) => { e.target.dataset.initialValue = e.target.value; }}
                                                    onBlur={() => { isEditingRef.current = false; }}
                                                    onChange={(e) => handleFieldChange(idx, 'contact_person', e.target.value)}
                                                    placeholder="Enter person name *"
                                                    disabled={!canWrite}
                                                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 dark:hover:bg-white/5 focus:bg-white dark:focus:bg-[#0d1117] border border-transparent focus:border-blue-500 rounded text-xs font-medium text-slate-900 dark:text-white outline-none transition"
                                                />
                                            </td>

                                            {/* Role / Designation Cell */}
                                            <td className="p-1 border-r border-slate-100 dark:border-white/5">
                                                <input
                                                    type="text"
                                                    value={person.designation || ''}
                                                    onFocus={(e) => { e.target.dataset.initialValue = e.target.value; }}
                                                    onBlur={() => { isEditingRef.current = false; }}
                                                    onChange={(e) => handleFieldChange(idx, 'designation', e.target.value)}
                                                    placeholder="e.g. Project Manager *"
                                                    disabled={!canWrite}
                                                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 dark:hover:bg-white/5 focus:bg-white dark:focus:bg-[#0d1117] border border-transparent focus:border-blue-500 rounded text-xs text-slate-900 dark:text-white outline-none transition"
                                                />
                                            </td>

                                            {/* Responsibilities (Org Chart) Cell */}
                                            <td className="p-1 border-r border-slate-100 dark:border-white/5">
                                                <input
                                                    type="text"
                                                    value={person.responsibilities || ''}
                                                    onFocus={(e) => { e.target.dataset.initialValue = e.target.value; }}
                                                    onBlur={() => { isEditingRef.current = false; }}
                                                    onChange={(e) => handleFieldChange(idx, 'responsibilities', e.target.value)}
                                                    placeholder="e.g. Site execution, quality assurance"
                                                    disabled={!canWrite}
                                                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 dark:hover:bg-white/5 focus:bg-white dark:focus:bg-[#0d1117] border border-transparent focus:border-blue-500 rounded text-xs text-slate-700 dark:text-slate-300 outline-none transition"
                                                />
                                            </td>

                                            {/* Mobile / Phone Cell */}
                                            <td className="p-1 border-r border-slate-100 dark:border-white/5">
                                                <input
                                                    type="text"
                                                    value={person.telephone_no || ''}
                                                    onFocus={(e) => { e.target.dataset.initialValue = e.target.value; }}
                                                    onBlur={() => { isEditingRef.current = false; }}
                                                    onChange={(e) => handleFieldChange(idx, 'telephone_no', e.target.value)}
                                                    placeholder="e.g. +91 98765 43210"
                                                    disabled={!canWrite}
                                                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 dark:hover:bg-white/5 focus:bg-white dark:focus:bg-[#0d1117] border border-transparent focus:border-blue-500 rounded text-xs text-slate-700 dark:text-slate-300 outline-none transition"
                                                />
                                            </td>

                                            {/* Email Address Cell */}
                                            <td className="p-1 border-r border-slate-100 dark:border-white/5">
                                                <input
                                                    type="email"
                                                    value={person.email || ''}
                                                    onFocus={(e) => { e.target.dataset.initialValue = e.target.value; }}
                                                    onBlur={() => { isEditingRef.current = false; }}
                                                    onChange={(e) => handleFieldChange(idx, 'email', e.target.value)}
                                                    placeholder="e.g. name@company.com"
                                                    disabled={!canWrite}
                                                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 dark:hover:bg-white/5 focus:bg-white dark:focus:bg-[#0d1117] border border-transparent focus:border-blue-500 rounded text-xs text-slate-700 dark:text-slate-300 outline-none transition"
                                                />
                                            </td>

                                            {/* Actions */}
                                            {canWrite && (
                                                <td className="px-2 py-1 text-center select-none">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDuplicatePerson(idx)}
                                                            className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded transition cursor-pointer"
                                                            title="Duplicate person row"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemovePerson(idx)}
                                                            className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                                                            title="Remove person"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>

                    {/* Quick "+ Add Person" button row at bottom of subgrid */}
                    {canWrite && personnel.length > 0 && (
                        <div className="px-3 py-2 bg-slate-50/50 dark:bg-white/[0.01] border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={handleAddPerson}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-white/5 rounded-md transition cursor-pointer"
                            >
                                <Plus size={12} className="stroke-[3]" />
                                <span>Add Person</span>
                            </button>

                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                Tip: Tab through cells to quickly input team members.
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CompanyPersonnelSubGrid;
