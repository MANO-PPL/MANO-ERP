// ─────────────────────────────────────────────────────────────────────────────
// Meetings / components / MomTable.jsx
// Minutes of Meeting section: header with "Copy from Agenda" + "+ Add MoM"
// buttons, and a table of MoM rows with inline text inputs in edit mode.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Trash2 } from 'lucide-react';

/**
 * @param {{
 *   momPoints: Array<{ id: string, sl_no: number, point: string }>,
 *   isEditing: boolean,
 *   onAdd: () => void,
 *   onRemove: (id: string) => void,
 *   onChange: (id: string, value: string) => void,
 *   onCopyFromAgenda: () => void,
 * }}
 */
const MomTable = ({ momPoints, isEditing, onAdd, onRemove, onChange, onCopyFromAgenda }) => (
    <div className="pb-1">
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                Minutes of Meeting (MoM)
            </h3>
            {isEditing && (
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onCopyFromAgenda}
                        title="Copy discussion topics from agenda points"
                        className="inline-flex items-center justify-center gap-1.5 h-7 px-3.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-md text-[11px] font-medium transition-all cursor-pointer leading-none active:scale-95 shadow-2xs"
                    >
                        Copy from Agenda
                    </button>
                    <button
                        type="button"
                        onClick={onAdd}
                        className="inline-flex items-center justify-center gap-1.5 h-7 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold transition-all shadow-xs cursor-pointer leading-none active:scale-95"
                    >
                        + Add MoM
                    </button>
                </div>
            )}
        </div>

        <div className="border border-gray-200 dark:border-white/10 rounded overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 dark:bg-white/[0.03] border-b border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 text-[8.5px] uppercase font-semibold tracking-wider">
                    <tr>
                        <th className="py-1 px-1.5 w-8 text-center">#</th>
                        <th className="py-1 px-1.5">Discussion &amp; Resolutions</th>
                        {isEditing && <th className="py-1 px-1.5 w-8 text-right">Action</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-normal">
                    {momPoints.length === 0 ? (
                        <tr>
                            <td colSpan={isEditing ? 3 : 2} className="py-2.5 text-center text-gray-400 italic text-xs">
                                No MoM points recorded yet.
                            </td>
                        </tr>
                    ) : (
                        momPoints.map(mom => (
                            <tr key={mom.id} className="hover:bg-gray-50/40 dark:hover:bg-white/[0.01]">
                                <td className="py-0.5 px-1.5 text-center text-gray-400 font-medium text-[10.5px]">
                                    {mom.sl_no}
                                </td>
                                <td className="py-0.5 px-1.5 text-gray-900 dark:text-white">
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            placeholder={`MoM point #${mom.sl_no}...`}
                                            value={mom.point}
                                            onChange={e => onChange(mom.id, e.target.value)}
                                            className="w-full px-1.5 py-0.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    ) : (
                                        <span className="leading-snug text-xs">
                                            {mom.point || <span className="text-gray-400 italic">No text</span>}
                                        </span>
                                    )}
                                </td>
                                {isEditing && (
                                    <td className="py-0.5 px-1.5 text-right">
                                        <button
                                            type="button"
                                            onClick={() => onRemove(mom.id)}
                                            className="inline-flex items-center justify-center w-6 h-6 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                            title="Delete MoM Point"
                                        >
                                            <Trash2 size={11} />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

export default MomTable;
