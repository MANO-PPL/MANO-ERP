// ─────────────────────────────────────────────────────────────────────────────
// Meetings / components / MeetingActionBar.jsx
// Top action bar: view tab switcher, edit section switcher,
// and Print / Edit / Save / Cancel action buttons.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * @param {{
 *   isEditing: boolean,
 *   editSection: 'agenda'|'mom',
 *   activeTab: 'agenda'|'mom'|'full',
 *   validAgendaCount: number,
 *   validMomCount: number,
 *   saving: boolean,
 *   isNew: boolean,
 *   canWrite: boolean,
 *   onTabChange: (tab: string) => void,
 *   onEditSectionChange: (section: string) => void,
 *   onPrint: () => void,
 *   onEdit: () => void,
 *   onSave: () => void,
 *   onCancel: () => void,
 * }}
 */
const MeetingActionBar = ({
    isEditing, editSection, activeTab,
    validAgendaCount, validMomCount,
    saving, isNew, canWrite,
    onTabChange, onEditSectionChange,
    onPrint, onEdit, onSave, onCancel
}) => {
    return (
        <div className="print:hidden flex items-center justify-end px-4 py-2 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] z-20 gap-2">
            {/* View Switcher / Edit Section Switcher */}
            {!isEditing ? (
                <div className="inline-flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-lg border border-gray-200/80 dark:border-white/10 gap-1 select-none">
                    {[
                        { id: 'agenda', label: `Agenda (${validAgendaCount})`,        active: 'text-blue-600 dark:text-blue-400'     },
                        { id: 'mom',    label: `Minutes (MoM) (${validMomCount})`,     active: 'text-emerald-600 dark:text-emerald-400' },
                        { id: 'full',   label: 'Full Record',                           active: 'text-gray-900 dark:text-white'        }
                    ].map(({ id, label, active }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => onTabChange(id)}
                            className={`inline-flex items-center justify-center h-7.5 px-3.5 rounded-md text-xs font-semibold transition-all cursor-pointer leading-none ${
                                activeTab === id
                                    ? `bg-white dark:bg-[#161b22] ${active} shadow-xs border border-gray-200/80 dark:border-white/10`
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
                            }`}
                        >
                            <span className="flex items-center justify-center">{label}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="inline-flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-lg border border-gray-200/80 dark:border-white/10 gap-1 select-none">
                    <button
                        type="button"
                        onClick={() => onEditSectionChange('agenda')}
                        className={`inline-flex items-center justify-center h-7.5 px-3.5 rounded-md text-xs font-semibold transition-all cursor-pointer leading-none ${
                            editSection === 'agenda'
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'text-gray-600 dark:text-gray-300 hover:text-blue-600'
                        }`}
                    >
                        <span className="flex items-center justify-center">1. Agenda &amp; Schedule</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onEditSectionChange('mom')}
                        className={`inline-flex items-center justify-center h-7.5 px-3.5 rounded-md text-xs font-semibold transition-all cursor-pointer leading-none ${
                            editSection === 'mom'
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'text-gray-600 dark:text-gray-300 hover:text-emerald-600'
                        }`}
                    >
                        <span className="flex items-center justify-center">2. MoM &amp; Attendance {validMomCount > 0 ? `(${validMomCount})` : ''}</span>
                    </button>
                </div>
            )}

            {/* Right Actions */}
            <div className="flex items-center gap-2">
                {!isEditing && (
                    <button
                        type="button"
                        onClick={onPrint}
                        className="inline-flex items-center justify-center h-8 px-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs leading-none"
                        title="Print or Save as PDF"
                    >
                        <span className="flex items-center justify-center">Print</span>
                    </button>
                )}

                {canWrite && (
                    <>
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    className="inline-flex items-center justify-center h-8 px-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs leading-none"
                                >
                                    <span className="flex items-center justify-center">Cancel</span>
                                </button>
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={onSave}
                                    className="inline-flex items-center justify-center gap-1.5 h-8 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer leading-none"
                                >
                                    {saving && <Loader2 size={13} className="animate-spin" />}
                                    <span className="flex items-center justify-center">{isNew ? 'Save' : 'Save Changes'}</span>
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={onEdit}
                                className="inline-flex items-center justify-center h-8 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-lg text-xs font-bold transition-all shadow-xs hover:shadow-sm cursor-pointer leading-none"
                            >
                                <span className="flex items-center justify-center">Edit</span>
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default MeetingActionBar;
