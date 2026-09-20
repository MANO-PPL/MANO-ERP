// ─────────────────────────────────────────────────────────────────────────────
// Meetings / components / AgendaTable.jsx
// Agenda points section: header with "+ Add Point" button, and a table of
// agenda rows with inline text inputs in edit mode.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Trash2 } from 'lucide-react';

/**
 * @param {{
 *   agendaPoints: Array<{ id: string, sl_no: number, point: string }>,
 *   isEditing: boolean,
 *   onAdd: () => void,
 *   onRemove: (id: string) => void,
 *   onChange: (id: string, value: string) => void,
 * }}
 */
const AgendaTable = ({ agendaPoints, isEditing, onAdd, onRemove, onChange }) => (
    <div className="pb-2">
        <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                Agenda Points
            </h3>
            {isEditing && (
                <button
                    type="button"
                    onClick={onAdd}
                    className="inline-flex items-center justify-center gap-1.5 h-7 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-semibold transition-all cursor-pointer shadow-xs leading-none active:scale-95"
                >
                    + Add Point
                </button>
            )}
        </div>

        <div className="border border-gray-200 dark:border-white/10 rounded overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 dark:bg-white/[0.03] border-b border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 text-[8.5px] uppercase font-semibold tracking-wider">
                    <tr>
                        <th className="py-1 px-1.5 w-8 text-center">#</th>
                        <th className="py-1 px-1.5">Topic / Description</th>
                        {isEditing && <th className="py-1 px-1.5 w-8 text-right">Action</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-normal">
                    {agendaPoints.length === 0 ? (
                        <tr>
                            <td colSpan={isEditing ? 3 : 2} className="py-2.5 text-center text-gray-400 italic text-xs">
                                No agenda points added.
                            </td>
                        </tr>
                    ) : (
                        agendaPoints.map(ag => (
                            <tr key={ag.id} className="hover:bg-gray-50/40 dark:hover:bg-white/[0.01]">
                                <td className="py-0.5 px-1.5 text-center text-gray-400 font-medium text-[10.5px]">
                                    {ag.sl_no}
                                </td>
                                <td className="py-0.5 px-1.5 text-gray-900 dark:text-white">
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            placeholder={`Agenda point #${ag.sl_no}...`}
                                            value={ag.point}
                                            onChange={e => onChange(ag.id, e.target.value)}
                                            className="w-full px-1.5 py-0.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    ) : (
                                        <span className="leading-snug text-xs">
                                            {ag.point || <span className="text-gray-400 italic">No topic</span>}
                                        </span>
                                    )}
                                </td>
                                {isEditing && (
                                    <td className="py-0.5 px-1.5 text-right">
                                        <button
                                            type="button"
                                            onClick={() => onRemove(ag.id)}
                                            className="inline-flex items-center justify-center w-6 h-6 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                            title="Delete point"
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

export default AgendaTable;
