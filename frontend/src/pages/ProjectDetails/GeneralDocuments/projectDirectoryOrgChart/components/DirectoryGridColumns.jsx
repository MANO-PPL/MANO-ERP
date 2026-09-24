import React from 'react';
import { Users, CornerDownRight, Plus } from 'lucide-react';
import CustomSelect from '../../../../../components/CustomSelect';
import CrmPartyAutoSuggestEditor from './CrmPartyAutoSuggestEditor';
import {
    CATEGORY_OPTIONS,
    DEFAULT_JOB_NATURES,
    COLUMN_ALIASES
} from '../constants';

export const getDirectoryColumns = ({
    allJobNatures = [],
    availableContacts = [],
    partyMemberCounts = {},
    getParentCompanyName,
    handleQuickAddPersonToRow,
    canWrite = true,
    setExpandedRowIds
}) => {
    const fetchedJobNatures = allJobNatures
        .map((j) => (typeof j === 'object' ? (j.job_name || j.name || '') : String(j)))
        .filter(Boolean);
    const jobOptions = Array.from(new Set([...fetchedJobNatures, ...DEFAULT_JOB_NATURES]));

    return [
        {
            key: 'name',
            label: 'Company / Party Name',
            width: '240px',
            minWidth: '210px',
            aliases: COLUMN_ALIASES.name,
            renderCell: (val, row, column, onChange, rowIndex, onStartEdit) => {
                const trimmed = (val || '').trim();
                const isNewRow = row?._status === 'new' || String(row?.id || '').startsWith('temp_');
                // Do not auto-inherit parent company on newly added rows
                const inheritedCompany = !trimmed && !isNewRow ? getParentCompanyName?.(rowIndex) : null;
                const count = trimmed ? partyMemberCounts[trimmed] : null;

                return (
                    <div className="flex items-center justify-between gap-1 w-full group/namecell">
                        <div className="flex items-center gap-1.5 truncate">
                            {trimmed ? (
                                <>
                                    <span className="truncate font-semibold text-gray-900 dark:text-white">
                                        {trimmed}
                                    </span>
                                    {count > 1 && (
                                        <span
                                            className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-700/40 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition inline-flex items-center gap-1"
                                            title={`${count} members under this company - click to expand`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setExpandedRowIds?.((prev) => {
                                                    const next = new Set(prev);
                                                    if (next.has(row.id)) next.delete(row.id);
                                                    else next.add(row.id);
                                                    return next;
                                                });
                                            }}
                                        >
                                            <Users size={10} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
                                            <span>{count}</span>
                                        </span>
                                    )}
                                </>
                            ) : inheritedCompany ? (
                                <span
                                    className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 italic truncate"
                                    title={`Inherited from ${inheritedCompany} above`}
                                >
                                    <CornerDownRight size={12} className="shrink-0 text-blue-500 opacity-75" />
                                    <span className="truncate">↳ {inheritedCompany}</span>
                                </span>
                            ) : (
                                <span
                                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 italic text-xs font-semibold hover:underline cursor-pointer py-0.5"
                                    onClick={(e) => {
                                        if (canWrite && onStartEdit) {
                                            e.stopPropagation();
                                            onStartEdit();
                                        }
                                    }}
                                    title="Click to enter company name"
                                >
                                    <Plus size={11} className="stroke-[2.5]" />
                                    <span>Enter company name...</span>
                                </span>
                            )}
                        </div>

                        {canWrite && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickAddPersonToRow?.(rowIndex);
                                }}
                                className="opacity-0 group-hover/namecell:opacity-100 transition-opacity p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded shrink-0 cursor-pointer"
                                title="Add another team member under this company"
                            >
                                <Plus size={11} className="stroke-[3]" />
                            </button>
                        )}
                    </div>
                );
            },
            renderEditor: (value, row, column, onChange, onBlur, rowIndex, onChangeValue) => (
                <CrmPartyAutoSuggestEditor
                    value={value}
                    row={row}
                    onChange={onChange}
                    onBlur={onBlur}
                    rowIndex={rowIndex}
                    onChangeValue={onChangeValue}
                    crmSuggestions={availableContacts}
                />
            )
        },
        {
            key: 'category',
            label: 'Category',
            type: 'select',
            options: CATEGORY_OPTIONS,
            placeholder: '-- Select Category --',
            width: '160px',
            minWidth: '150px',
            aliases: COLUMN_ALIASES.category,
            renderCell: (val, row, column, onChange) => {
                return (
                    <div
                        className="w-full"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <CustomSelect
                            value={val || ''}
                            options={CATEGORY_OPTIONS}
                            placeholder="-- Select Category --"
                            disabled={!canWrite}
                            onChange={(e) => {
                                const selectedVal = typeof e === 'object' && e?.target ? e.target.value : e;
                                onChange(selectedVal);
                            }}
                            className="w-full"
                            buttonClassName="w-full flex items-center justify-between px-2.5 py-1 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 hover:border-blue-500/50 rounded-md text-xs font-semibold text-slate-800 dark:text-slate-200 transition cursor-pointer text-left h-7"
                        />
                    </div>
                );
            },
            renderEditor: (value, row, column, onChange, onBlur) => {
                return (
                    <div
                        className="w-full"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <CustomSelect
                            value={value || ''}
                            options={CATEGORY_OPTIONS}
                            placeholder="-- Select Category --"
                            disabled={!canWrite}
                            onChange={(e) => {
                                const selectedVal = typeof e === 'object' && e?.target ? e.target.value : e;
                                onChange(selectedVal);
                                if (onBlur) onBlur(selectedVal);
                            }}
                            className="w-full"
                            buttonClassName="w-full flex items-center justify-between px-2.5 py-1 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 hover:border-blue-500/50 rounded-md text-xs font-semibold text-slate-800 dark:text-slate-200 transition cursor-pointer text-left h-7"
                        />
                    </div>
                );
            }
        },
        {
            key: 'job_name',
            label: 'Nature of Job / Trade',
            type: 'select',
            options: jobOptions,
            placeholder: '-- Select Trade --',
            width: '230px',
            minWidth: '200px',
            aliases: COLUMN_ALIASES.job_name,
            renderCell: (val, row, column, onChange) => {
                return (
                    <div
                        className="w-full"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <CustomSelect
                            value={val || ''}
                            options={jobOptions}
                            placeholder="-- Select Trade --"
                            disabled={!canWrite}
                            onChange={(e) => {
                                const selectedVal = typeof e === 'object' && e?.target ? e.target.value : e;
                                onChange(selectedVal);
                            }}
                            className="w-full"
                            buttonClassName="w-full flex items-center justify-between px-2.5 py-1 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 hover:border-blue-500/50 rounded-md text-xs font-medium text-slate-800 dark:text-slate-200 transition cursor-pointer text-left h-7"
                        />
                    </div>
                );
            },
            renderEditor: (value, row, column, onChange, onBlur) => {
                return (
                    <div
                        className="w-full"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <CustomSelect
                            value={value || ''}
                            options={jobOptions}
                            placeholder="-- Select Trade --"
                            disabled={!canWrite}
                            onChange={(e) => {
                                const selectedVal = typeof e === 'object' && e?.target ? e.target.value : e;
                                onChange(selectedVal);
                                if (onBlur) onBlur(selectedVal);
                            }}
                            className="w-full"
                            buttonClassName="w-full flex items-center justify-between px-2.5 py-1 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 hover:border-blue-500/50 rounded-md text-xs font-medium text-slate-800 dark:text-slate-200 transition cursor-pointer text-left h-7"
                        />
                    </div>
                );
            }
        },
        {
            key: 'contact_person',
            label: 'Person Name',
            width: '170px',
            minWidth: '150px',
            aliases: COLUMN_ALIASES.contact_person
        },
        {
            key: 'designation',
            label: 'Role / Designation',
            width: '170px',
            minWidth: '150px',
            aliases: COLUMN_ALIASES.designation
        },
        {
            key: 'responsibilities',
            label: 'Responsibilities (Org Chart)',
            width: '260px',
            minWidth: '220px',
            aliases: COLUMN_ALIASES.responsibilities
        },
        {
            key: 'telephone_no',
            label: 'Mobile / Phone',
            width: '140px',
            minWidth: '130px',
            aliases: COLUMN_ALIASES.telephone_no
        },
        {
            key: 'email',
            label: 'Email Address',
            width: '190px',
            minWidth: '170px',
            aliases: COLUMN_ALIASES.email
        },
        {
            key: 'address',
            label: 'Address / Location',
            width: '230px',
            minWidth: '200px',
            aliases: COLUMN_ALIASES.address
        }
    ];
};

export default getDirectoryColumns;
