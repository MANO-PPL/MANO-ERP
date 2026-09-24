// ─────────────────────────────────────────────────────────────────────────────
// Meetings / components / ParticipantsTable.jsx
// Participants section: header with attendance summary + All Present/Absent,
// + Add Participant button + dropdown panel, and the participants data table.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Trash2, Search } from 'lucide-react';
import { ATTENDANCE_PILL, ATTENDANCE_BADGE, SOURCE_BADGE } from '../constants';

/**
 * @param {{
 *   isEditing: boolean,
 *   editSection: string,
 *   activeTab: string,
 *   participants: Array,
 *   attendanceStats: { total: number, present: number, absent: number },
 *   isAddParticipantOpen: boolean,
 *   setIsAddParticipantOpen: Function,
 *   participantSearch: string,
 *   setParticipantSearch: Function,
 *   participantSourceTab: string,
 *   setParticipantSourceTab: Function,
 *   addingParticipantId: string|null,
 *   availableParticipantsToAdd: Array,
 *   onToggleAttendance: Function,
 *   onMarkAll: Function,
 *   onAddParticipant: Function,
 *   onRemoveParticipant: Function,
 * }}
 */
const ParticipantsTable = ({
    isEditing, editSection, activeTab,
    participants, attendanceStats,
    isAddParticipantOpen, setIsAddParticipantOpen,
    participantSearch, setParticipantSearch,
    participantSourceTab, setParticipantSourceTab,
    addingParticipantId,
    availableParticipantsToAdd,
    onToggleAttendance, onMarkAll,
    onAddParticipant, onRemoveParticipant
}) => {
    const showAttendanceCol = isEditing || activeTab !== 'agenda';
    const sectionTitle = (activeTab === 'agenda' && !isEditing)
        ? `Invited Participants (${participants.length})`
        : `Attendees & Attendance (${participants.length})`;

    const SOURCE_TABS = [
        { id: 'all',       label: 'All'          },
        { id: 'directory', label: 'Directory'    },
        { id: 'project',   label: 'Project Team' },
        { id: 'erp',       label: 'ERP Users'    }
    ];

    return (
        <div className="pb-2">
            {/* Section header */}
            <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <div className="flex items-center gap-1.5">
                    <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                        {sectionTitle}
                    </h3>
                    {activeTab !== 'agenda' && attendanceStats.total > 0 && (
                        <span className="text-[9.5px] text-gray-500 dark:text-gray-400 font-medium">
                            (<span className="text-emerald-600 dark:text-emerald-400 font-semibold">{attendanceStats.present} Present</span>,{' '}
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">{attendanceStats.absent} Absent</span>)
                        </span>
                    )}
                </div>

                {isEditing && (
                    <div className="flex items-center gap-1 flex-wrap">
                        {/* All Present / All Absent (shown only in mom edit section) */}
                        {editSection === 'mom' && participants.length > 0 && (
                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-0.5 rounded-md border border-gray-200 dark:border-white/10 text-[10px]">
                                <button
                                    type="button"
                                    onClick={() => onMarkAll(true)}
                                    className="inline-flex items-center justify-center h-6 px-2.5 font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors cursor-pointer leading-none"
                                >
                                    All Present
                                </button>
                                <span className="text-gray-300 dark:text-gray-600">|</span>
                                <button
                                    type="button"
                                    onClick={() => onMarkAll(false)}
                                    className="inline-flex items-center justify-center h-6 px-2.5 font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer leading-none"
                                >
                                    All Absent
                                </button>
                            </div>
                        )}

                        {/* Add Participant button + dropdown */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsAddParticipantOpen(!isAddParticipantOpen)}
                                className="inline-flex items-center justify-center gap-1.5 h-7 px-3.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 rounded-md text-[11px] font-semibold transition-all cursor-pointer leading-none active:scale-95 shadow-2xs"
                            >
                                + Add Participant
                            </button>

                            {isAddParticipantOpen && (
                                <div className="absolute right-0 mt-1 w-80 sm:w-96 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-2xl z-50 p-2 space-y-2">
                                    {/* Header */}
                                    <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-white/5">
                                        <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">Add Participant</span>
                                        <button
                                            type="button"
                                            onClick={() => setIsAddParticipantOpen(false)}
                                            className="inline-flex items-center justify-center w-5 h-5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 text-xs transition-colors cursor-pointer"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    {/* Source tabs */}
                                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#0d1117] p-0.5 rounded text-[10px] font-medium">
                                        {SOURCE_TABS.map(tab => (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => setParticipantSourceTab(tab.id)}
                                                className={`flex-1 inline-flex items-center justify-center h-6 px-1.5 rounded transition-all text-center cursor-pointer leading-none ${
                                                    participantSourceTab === tab.id
                                                        ? 'bg-white dark:bg-[#1f242c] text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                                                        : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'
                                                }`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Search */}
                                    <div className="relative">
                                        <Search size={12} className="absolute left-2 top-2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by name, role, organization..."
                                            value={participantSearch}
                                            onChange={e => setParticipantSearch(e.target.value)}
                                            className="w-full pl-6 pr-2 py-1 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded text-xs font-normal text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            autoFocus
                                        />
                                    </div>

                                    {/* Contact list */}
                                    <div className="max-h-52 overflow-y-auto space-y-0.5 custom-scrollbar">
                                        {availableParticipantsToAdd.length === 0 ? (
                                            <p className="text-center text-[10px] text-gray-400 py-3">No available contacts found.</p>
                                        ) : (
                                            availableParticipantsToAdd.map(item => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    disabled={addingParticipantId === item.id}
                                                    onClick={() => onAddParticipant(item)}
                                                    className="w-full text-left px-2 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center justify-between group cursor-pointer"
                                                >
                                                    <div className="flex flex-col min-w-0 pr-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">{item.name}</span>
                                                            <span className={`text-[8.5px] px-1 py-0.5 rounded font-medium ${SOURCE_BADGE[item.source] || SOURCE_BADGE.directory}`}>
                                                                {item.sourceLabel}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                            {item.designation} • {item.organization}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10.5px] text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium shrink-0">
                                                        + Add
                                                    </span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Participants table */}
            {participants.length === 0 ? (
                <p className="text-xs text-gray-400 py-2 italic text-center border border-dashed border-gray-200 dark:border-white/10 rounded">
                    No participants added.
                </p>
            ) : (
                <div className="border border-gray-200 dark:border-white/10 rounded overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-gray-50 dark:bg-white/[0.03] border-b border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 text-[8.5px] uppercase font-semibold tracking-wider">
                            <tr>
                                <th className="py-1 px-1.5 w-7 text-center">#</th>
                                <th className="py-1 px-1.5">Contact Person</th>
                                <th className="py-1 px-1.5">Designation</th>
                                <th className="py-1 px-1.5">Organization</th>
                                {showAttendanceCol && <th className="py-1 px-1.5 text-center w-20">Attendance</th>}
                                {isEditing && <th className="py-1 px-1.5 text-right w-8">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-normal">
                            {participants.map((p, idx) => (
                                <tr key={p.pd_id || idx} className="hover:bg-gray-50/40 dark:hover:bg-white/[0.01]">
                                    <td className="py-1 px-1.5 text-center text-gray-400 font-medium text-[10.5px]">{idx + 1}</td>
                                    <td className="py-1 px-1.5 font-semibold text-gray-900 dark:text-white text-xs">{p.contact_person || '-'}</td>
                                    <td className="py-1 px-1.5 text-gray-600 dark:text-gray-300 text-[10.5px]">{p.designation || '-'}</td>
                                    <td className="py-1 px-1.5 text-gray-600 dark:text-gray-300 text-[10.5px]">{p.company_name || p.organization || '-'}</td>

                                    {showAttendanceCol && (
                                        <td className="py-1 px-1.5 text-center">
                                            {isEditing ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onToggleAttendance(p.pd_id)}
                                                    className={`inline-flex items-center justify-center h-5 px-2.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer border leading-none ${
                                                        p.attended ? ATTENDANCE_PILL.present : ATTENDANCE_PILL.absent
                                                    }`}
                                                >
                                                    {p.attended ? 'Present' : 'Absent'}
                                                </button>
                                            ) : (
                                                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-semibold leading-none ${
                                                    p.attended ? ATTENDANCE_BADGE.present : ATTENDANCE_BADGE.absent
                                                }`}>
                                                    {p.attended ? 'Present' : 'Absent'}
                                                </span>
                                            )}
                                        </td>
                                    )}

                                    {isEditing && (
                                        <td className="py-1 px-1.5 text-right">
                                            <button
                                                type="button"
                                                onClick={() => onRemoveParticipant(p.pd_id)}
                                                className="inline-flex items-center justify-center w-6 h-6 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                                title="Remove participant"
                                            >
                                                <Trash2 size={11} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ParticipantsTable;
