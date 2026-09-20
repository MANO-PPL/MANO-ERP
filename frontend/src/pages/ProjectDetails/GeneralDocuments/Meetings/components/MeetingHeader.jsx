// ─────────────────────────────────────────────────────────────────────────────
// Meetings / components / MeetingHeader.jsx
// Edit mode: single unified grid row (Subject, Date, Time, Status, Venue).
// Read mode: prominent Subject h2 + 4-col metadata grid (Date/Time/Status/Venue).
// Print mode: includes project name eyebrow + document title.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import CustomDatePicker from '../../../../../components/CustomDatePicker';
import CustomSelect     from '../../../../../components/CustomSelect';
import { STATUS_OPTIONS } from '../constants';

/**
 * @param {{
 *   isEditing: boolean,
 *   editSection: string,
 *   activeTab: string,
 *   details: object,
 *   onChange: (patch: object) => void,
 *   formattedDate: string,
 *   projectName: string,
 * }}
 */
const MeetingHeader = ({ isEditing, editSection, activeTab, details, onChange, formattedDate, projectName }) => {
    const inputCls = 'w-full h-7 px-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded text-[10.5px] font-medium text-gray-900 dark:text-white focus:outline-none';

    return (
        <div className="pb-1.5">
            {/* Print-only: project name eyebrow + document title */}
            <div className="hidden print:block">
                <span className="doc-eyebrow text-[9px] font-semibold tracking-wider text-blue-600 dark:text-blue-400 uppercase">
                    {projectName ? projectName.toUpperCase() : 'PROJECT MANAGEMENT'}
                </span>
                <h1 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white tracking-tight uppercase leading-snug">
                    {isEditing
                        ? (editSection === 'agenda' ? 'Meeting Agenda Notice' : 'Minutes of Meeting (MoM)')
                        : activeTab === 'agenda'
                            ? 'Meeting Agenda Notice'
                            : activeTab === 'mom'
                                ? 'Minutes of Meeting (MoM)'
                                : 'Project Meeting Record & MoM'}
                </h1>
            </div>

            {/* Edit mode: single-row grid */}
            {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 mt-0.5 items-end">
                    {/* Subject */}
                    <div className="lg:col-span-4">
                        <label className="block text-[8.5px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
                            Meeting Subject <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Foundation Pour Coordination & MEP Review"
                            value={details.subject}
                            onChange={e => onChange({ subject: e.target.value })}
                            className={`${inputCls} text-xs font-semibold focus:ring-1 focus:ring-blue-500`}
                        />
                    </div>
                    {/* Date */}
                    <div className="lg:col-span-2">
                        <span className="block text-[8.5px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Date</span>
                        <CustomDatePicker
                            value={details.date}
                            onChange={e => onChange({ date: e.target.value })}
                            buttonClassName="w-full h-7 px-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded text-[10.5px] font-medium text-gray-900 dark:text-white flex items-center justify-between gap-1 cursor-pointer"
                        />
                    </div>
                    {/* Time */}
                    <div className="lg:col-span-1">
                        <span className="block text-[8.5px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Time</span>
                        <input
                            type="text"
                            placeholder="10:30 AM"
                            value={details.time}
                            onChange={e => onChange({ time: e.target.value })}
                            className={inputCls}
                        />
                    </div>
                    {/* Status */}
                    <div className="lg:col-span-2">
                        <span className="block text-[8.5px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Status</span>
                        <CustomSelect
                            options={STATUS_OPTIONS}
                            value={details.status}
                            onChange={e => onChange({ status: e.target.value })}
                            buttonClassName="w-full h-7 px-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded text-[10.5px] font-medium text-gray-900 dark:text-white flex items-center justify-between capitalize cursor-pointer"
                        />
                    </div>
                    {/* Venue */}
                    <div className="lg:col-span-3">
                        <span className="block text-[8.5px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Venue</span>
                        <input
                            type="text"
                            placeholder="Site Office / Teams"
                            value={details.venue}
                            onChange={e => onChange({ venue: e.target.value })}
                            className={inputCls}
                        />
                    </div>
                </div>
            ) : (
                <>
                    {/* Read mode: Subject */}
                    <div className="mt-0 print:mt-1">
                        <span className="text-[8.5px] font-semibold uppercase tracking-wider text-gray-400">Subject</span>
                        <h2 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white leading-tight">
                            {details.subject || 'Untitled Meeting'}
                        </h2>
                    </div>
                    {/* Read mode: 4-col metadata grid */}
                    <div className="metadata-row grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5 pt-0.5">
                        {[
                            { label: 'Date',   value: formattedDate            },
                            { label: 'Time',   value: details.time  || '-'    },
                            { label: 'Status', value: details.status || 'Scheduled', extraCls: 'capitalize' },
                            { label: 'Venue',  value: details.venue || '-',   extraCls: 'truncate' }
                        ].map(({ label, value, extraCls = '' }) => (
                            <div key={label}>
                                <span className="block text-[8.5px] font-medium text-gray-400 uppercase tracking-wider">{label}</span>
                                <p className={`text-[10.5px] font-semibold text-gray-800 dark:text-gray-200 mt-0.5 ${extraCls}`}>{value}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default MeetingHeader;
