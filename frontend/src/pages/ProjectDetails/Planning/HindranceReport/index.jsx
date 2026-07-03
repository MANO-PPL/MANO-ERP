import React, { useState, useEffect } from 'react';
import {
    Plus, Pencil, Trash2, ChevronUp, ChevronDown,
    Check, X, Eye, GripVertical, AlertOctagon
} from 'lucide-react';
import { motion, Reorder } from 'framer-motion';
import CustomDatePicker from '../../../../components/CustomDatePicker';

const HindranceReport = ({ setExtraBreadcrumbs, onBack }) => {
    const [rows, setRows] = useState([
        {
            id: 1,
            description: 'Mobilisation of Excavator',
            plannedStart: '2025-12-03',
            plannedFinish: '2025-12-04',
            plannedDays: 2,
            actualStart: '2025-12-04',
            actualFinish: '2025-12-06',
            actualDays: 3,
            responsibleStart: 'Vira Buildtech',
            remarksStart: 'Niceeeeeeeeeeeee',
            responsibleFinish: 'Vira Buildtech',
            remarksEnd: 'Personal Issue'
        },
        {
            id: 2,
            description: 'Testing',
            plannedStart: '2025-12-11',
            plannedFinish: '2025-12-12',
            plannedDays: 2,
            actualStart: '2025-12-14',
            actualFinish: '2025-12-17',
            actualDays: 4,
            responsibleStart: 'Mano',
            remarksStart: 'bike',
            responsibleFinish: 'Mano',
            remarksEnd: 'No API given'
        },
        {
            id: 3,
            description: 'Mano',
            plannedStart: '2025-12-12',
            plannedFinish: '2025-12-15',
            plannedDays: 4,
            actualStart: '2025-12-13',
            actualFinish: '',
            actualDays: 0,
            responsibleStart: 'Mano',
            remarksStart: '',
            responsibleFinish: 'Mano',
            remarksEnd: 'No database created'
        }
    ]);

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'Planning', onClick: onBack },
            { label: 'Hindrance Report' }
        ]);
    }, [setExtraBreadcrumbs, onBack]);

    const calculateDays = (start, end) => {
        if (!start || !end) return 0;
        const s = new Date(start);
        const e = new Date(end);
        const diffTime = Math.abs(e - s);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    };

    const calculateDelay = (planned, actual) => {
        if (!planned || !actual) return 0;
        const p = new Date(planned);
        const a = new Date(actual);
        const diffTime = a - p;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const handleAddRow = () => {
        const newRow = {
            id: Date.now(),
            description: 'New Hindrance',
            plannedStart: '',
            plannedFinish: '',
            plannedDays: 0,
            actualStart: '',
            actualFinish: '',
            actualDays: 0,
            responsibleStart: '',
            remarksStart: '',
            responsibleFinish: '',
            remarksEnd: ''
        };
        setRows([...rows, newRow]);
        handleEditClick(newRow);
    };

    const handleDeleteRow = (id) => {
        setRows(rows.filter(row => row.id !== id));
    };

    const handleMoveRow = (index, direction) => {
        const newRows = [...rows];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= newRows.length) return;
        [newRows[index], newRows[targetIndex]] = [newRows[targetIndex], newRows[index]];
        setRows(newRows);
    };

    const handleEditClick = (row) => {
        setEditingId(row.id);
        setEditForm({ ...row });
    };

    const handleSaveEdit = () => {
        setRows(rows.map(row => row.id === editingId ? { ...editForm } : row));
        setEditingId(null);
        setEditForm(null);
        setActiveDropdown(null);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditForm(null);
        setActiveDropdown(null);
    };

    const updateEditForm = (field, value) => {
        const updated = { ...editForm, [field]: value };
        if (field === 'plannedStart' || field === 'plannedFinish') {
            updated.plannedDays = calculateDays(updated.plannedStart, updated.plannedFinish);
        }
        if (field === 'actualStart' || field === 'actualFinish') {
            updated.actualDays = calculateDays(updated.actualStart, updated.actualFinish);
        }
        setEditForm(updated);
    };

    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-[#0d1117] text-gray-900 dark:text-white overflow-hidden relative transition-colors duration-300 font-sans">
            {/* Backdrop */}
            {previewOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]" onClick={() => setPreviewOpen(false)} />}

            {/* Preview Drawer */}
            <div className={`fixed top-0 right-0 h-full w-[90%] md:w-[80%] lg:w-[1000px] bg-white dark:bg-[#161b22] shadow-2xl z-[201] border-l border-gray-200 dark:border-white/10 transition-transform duration-300 ease-in-out flex flex-col ${previewOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50 dark:bg-[#0d1117]">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-600/10 dark:bg-cyan-600/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                            <Eye size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Print Preview</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Hindrance Report Tabular View</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button className="flex items-center space-x-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-all">
                            <span>Print Now</span>
                        </button>
                        <button onClick={() => setPreviewOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-all">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-8 bg-gray-100 dark:bg-[#0d1117]/50 custom-scrollbar">
                    {/* Paper Mockup */}
                    <div className="bg-white dark:bg-[#0d1117] shadow-xl mx-auto p-8 min-h-full w-full max-w-[950px] border border-gray-200 dark:border-white/10 text-[10px] text-gray-900 dark:text-white">
                        <div className="text-center mb-8">
                            <h2 className="text-xl font-bold uppercase mb-1">Hindrance Report</h2>
                            <p className="text-gray-500 dark:text-gray-400 uppercase tracking-widest text-[9px]">Mano Projects Private Limited</p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-gray-800 dark:border-gray-700">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-[#161b22] text-gray-700 dark:text-gray-300">
                                        <th rowSpan={2} className="p-2 border border-gray-800 dark:border-gray-700 w-8">S. N.</th>
                                        <th rowSpan={2} className="p-2 border border-gray-800 dark:border-gray-700 text-left min-w-[150px]">DESCRIPTION OF ITEMS</th>
                                        <th colSpan={3} className="p-2 border border-gray-800 dark:border-gray-700 text-center uppercase">Planned Dates</th>
                                        <th colSpan={3} className="p-2 border border-gray-800 dark:border-gray-700 text-center uppercase">Actual Dates</th>
                                        <th rowSpan={2} className="p-2 border border-gray-800 dark:border-gray-700 w-16 uppercase">Days Delayed (Start)</th>
                                        <th rowSpan={2} className="p-2 border border-gray-800 dark:border-gray-700 w-20 uppercase">Responsible (S)</th>
                                        <th rowSpan={2} className="p-2 border border-gray-800 dark:border-gray-700 w-24 uppercase">Remarks (Start)</th>
                                        <th rowSpan={2} className="p-2 border border-gray-800 dark:border-gray-700 w-16 uppercase">Days Delayed (Finish)</th>
                                        <th rowSpan={2} className="p-2 border border-gray-800 dark:border-gray-700 w-20 uppercase">Responsible (F)</th>
                                        <th rowSpan={2} className="p-2 border border-gray-800 dark:border-gray-700 w-24 uppercase">Remarks (End)</th>
                                    </tr>
                                    <tr className="bg-gray-50 dark:bg-[#161b22] text-gray-600 dark:text-gray-400">
                                        <th className="p-1 border border-gray-800 dark:border-gray-700 w-16 uppercase">Start</th>
                                        <th className="p-1 border border-gray-800 dark:border-gray-700 w-16 uppercase">Finish</th>
                                        <th className="p-1 border border-gray-800 dark:border-gray-700 w-6">Day</th>
                                        <th className="p-1 border border-gray-800 dark:border-gray-700 w-16 uppercase">Start</th>
                                        <th className="p-1 border border-gray-800 dark:border-gray-700 w-16 uppercase">Finish</th>
                                        <th className="p-1 border border-gray-800 dark:border-gray-700 w-6">Day</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, idx) => (
                                        <tr key={row.id}>
                                            <td className="p-1.5 border border-gray-800 dark:border-gray-700 text-center">{idx + 1}</td>
                                            <td className="p-1.5 border border-gray-800 dark:border-gray-700">{row.description}</td>
                                            <td className="p-1.5 border border-gray-800 dark:border-gray-700 text-center">{row.plannedStart}</td>
                                            <td className="p-1.5 border border-gray-800 dark:border-gray-700 text-center">{row.plannedFinish}</td>
                                            <td className="p-1.5 border border-gray-800 dark:border-gray-700 text-center">{row.plannedDays}</td>
                                            <td className="p-1.5 border border-gray-800 dark:border-gray-700 text-center">{row.actualStart}</td>
                                            <td className="p-1.5 border border-gray-800 dark:border-gray-700 text-center">{row.actualFinish}</td>
                                            <td className="p-1.5 border border-gray-800 dark:border-gray-700 text-center">{row.actualDays}</td>
                                            <td className={`p-1.5 border border-gray-800 dark:border-gray-700 text-center font-bold ${calculateDelay(row.plannedStart, row.actualStart) > 0 ? 'text-red-600' : 'text-green-600'}`}>{calculateDelay(row.plannedStart, row.actualStart)}</td>
                                            <td className="p-1.5 border border-gray-800 dark:border-gray-700">{row.responsibleStart}</td>
                                            <td className="p-1.5 border border-gray-800 dark:border-gray-700 italic opacity-80">{row.remarksStart}</td>
                                            <td className={`p-1.5 border border-gray-800 dark:border-gray-700 text-center font-bold ${calculateDelay(row.plannedFinish, row.actualFinish) > 0 ? 'text-red-600' : 'text-green-600'}`}>{calculateDelay(row.plannedFinish, row.actualFinish)}</td>
                                            <td className="p-1.5 border border-gray-800 dark:border-gray-700">{row.responsibleFinish}</td>
                                            <td className="p-1.5 border border-gray-800 dark:border-gray-700 italic opacity-80">{row.remarksEnd}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-12 flex justify-between px-4 pb-8">
                            <div className="text-center">
                                <div className="w-32 border-t border-gray-800 dark:border-gray-700 pt-1">Prepared By</div>
                            </div>
                            <div className="text-center">
                                <div className="w-32 border-t border-gray-800 dark:border-gray-700 pt-1">Checked By</div>
                            </div>
                            <div className="text-center">
                                <div className="w-32 border-t border-gray-800 dark:border-gray-700 pt-1">Approved By</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar - Tasks Styled */}
            <div className="flex justify-between items-center px-5 py-2 border-b border-gray-200 dark:border-gh-border bg-white dark:bg-[#0d1117]">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <h1 className="text-sm font-bold dark:text-white uppercase tracking-tight">Hindrance Report</h1>
                        <span className="text-[10px] bg-gray-100 dark:bg-gh-bg-secondary px-1.5 py-0.5 rounded text-gray-500 font-mono tracking-tighter">{rows.length} Items</span>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => setPreviewOpen(true)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 border border-gray-300 dark:border-gh-border rounded-md text-[11px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm"
                    >
                        <Eye size={14} className="text-blue-500" />
                        <span>Preview & Print</span>
                    </button>
                    <button
                        onClick={handleAddRow}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-[11px] font-bold transition flex items-center shadow-lg shadow-blue-500/20 transform active:scale-95"
                    >
                        <Plus size={14} className="mr-1" /> Add Row
                    </button>
                </div>
            </div>

            {/* Table View - Full Wide Columns with Tasks interaction */}
            <div className="flex-1 overflow-auto custom-scrollbar bg-[#f6f8fa] dark:bg-[#0d1117]">
                <table className="w-full text-left whitespace-nowrap text-[11px] border-collapse min-w-max tracking-tight">
                    <thead className="bg-[#f6f8fa] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-[20] border-b border-gray-200 dark:border-gh-border">
                        <tr className="divide-x divide-gray-200 dark:divide-gray-800">
                            <th rowSpan={2} className="px-2 py-2 w-8 bg-[#f6f8fa] dark:bg-[#161b22]"></th>
                            <th rowSpan={2} className="px-3 py-2 font-bold uppercase text-[9px] w-12 text-center">S. NO.</th>
                            <th rowSpan={2} className="px-4 py-2 font-bold uppercase text-[9px] min-w-[220px]">DESCRIPTION OF ITEMS</th>
                            <th colSpan={3} className="px-4 py-2 font-bold uppercase text-[9px] text-center border-b border-gray-200 dark:border-gray-800 bg-blue-50/50 dark:bg-blue-900/10 text-blue-600">Planned Dates</th>
                            <th colSpan={3} className="px-4 py-2 font-bold uppercase text-[9px] text-center border-b border-gray-200 dark:border-gray-800 bg-green-50/50 dark:bg-green-900/10 text-green-600">Actual Dates</th>
                            <th rowSpan={2} className="px-3 py-2 font-bold uppercase text-[9px] text-center w-24 leading-tight">Days Delayed (Start)</th>
                            <th rowSpan={2} className="px-3 py-2 font-bold uppercase text-[9px] w-28">Responsible (S)</th>
                            <th rowSpan={2} className="px-3 py-2 font-bold uppercase text-[9px] w-36 leading-tight">Remarks (Start)</th>
                            <th rowSpan={2} className="px-3 py-2 font-bold uppercase text-[9px] text-center w-24 leading-tight">Days Delayed (Finish)</th>
                            <th rowSpan={2} className="px-3 py-2 font-bold uppercase text-[9px] w-28">Responsible (F)</th>
                            <th rowSpan={2} className="px-3 py-2 font-bold uppercase text-[9px] w-36 leading-tight">Remarks (End)</th>
                            <th rowSpan={2} className="px-2 py-2 w-20 text-center font-bold uppercase text-[9px] bg-gray-50 dark:bg-[#161b22]">Actions</th>
                        </tr>
                        <tr className="divide-x divide-gray-200 dark:divide-gray-800">
                            <th className="px-2 py-1.5 font-bold uppercase text-[8px] text-center bg-blue-50/30 dark:bg-blue-900/5">Start</th>
                            <th className="px-2 py-1.5 font-bold uppercase text-[8px] text-center bg-blue-50/30 dark:bg-blue-900/5">Finish</th>
                            <th className="px-2 py-1.5 font-bold uppercase text-[8px] text-center bg-blue-50/30 dark:bg-blue-900/5">Day</th>
                            <th className="px-2 py-1.5 font-bold uppercase text-[8px] text-center bg-green-50/30 dark:bg-green-900/5">Start</th>
                            <th className="px-2 py-1.5 font-bold uppercase text-[8px] text-center bg-green-50/30 dark:bg-green-900/5">Finish</th>
                            <th className="px-2 py-1.5 font-bold uppercase text-[8px] text-center bg-green-50/30 dark:bg-green-900/5">Day</th>
                        </tr>
                    </thead>
                    <Reorder.Group axis="y" values={rows} onReorder={setRows} as="tbody" className="divide-y divide-gray-100 dark:divide-gh-border bg-white dark:bg-[#0d1117]">
                        {rows.map((row, index) => {
                            const isEditing = editingId === row.id;
                            const startDelay = calculateDelay(row.plannedStart, row.actualStart);
                            const finishDelay = calculateDelay(row.plannedFinish, row.actualFinish);

                            return (
                                <Reorder.Item
                                    key={row.id}
                                    value={row}
                                    as="tr"
                                    dragListener={!isEditing}
                                    className={`hover:bg-gray-50 dark:hover:bg-white/[0.02] group transition-colors divide-x divide-gray-100 dark:divide-gray-800 ${isEditing ? 'bg-blue-50/20 dark:bg-blue-500/5' : ''}`}
                                >
                                    <td className="px-2 py-2 text-center relative w-8 min-w-[32px] bg-[#fdfdfe] dark:bg-[#0d1117] cursor-grab active:cursor-grabbing">
                                        <GripVertical size={12} className="text-gray-300 dark:text-gray-700 mx-auto" />
                                    </td>
                                    <td className="px-3 py-2 text-center text-gray-500 font-mono text-[10px] w-12">{index + 1}</td>
                                    <td className="px-4 py-2 opacity-100">
                                        {isEditing ? (
                                            <input
                                                autoFocus
                                                value={editForm.description}
                                                onChange={(e) => updateEditForm('description', e.target.value)}
                                                className="w-full bg-white dark:bg-[#161b22] border border-blue-500 rounded px-2 py-1 text-[11px] outline-none shadow-sm"
                                            />
                                        ) : (
                                            <span className="font-semibold text-gray-700 dark:text-gray-200 tracking-tight">{row.description}</span>
                                        )}
                                    </td>

                                    {/* Planned Start */}
                                    <td className="px-2 py-2 text-center relative min-w-[90px]">
                                        {isEditing ? (
                                            <div className="relative" onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'plannedStart' ? null : 'plannedStart'); }}>
                                                <span className="text-[10px] text-blue-500 cursor-pointer font-bold border-b border-blue-500/30 whitespace-nowrap">{editForm.plannedStart || 'Select'}</span>
                                                {activeDropdown === 'plannedStart' && (
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[100] shadow-2xl">
                                                        <CustomDatePicker value={editForm.plannedStart} onChange={(d) => { updateEditForm('plannedStart', d.target.value); setActiveDropdown(null); }} onClose={() => setActiveDropdown(null)} />
                                                    </div>
                                                )}
                                            </div>
                                        ) : <span className="text-gray-600 dark:text-gray-400 font-medium text-[10px]">{row.plannedStart || '-'}</span>}
                                    </td>

                                    {/* Planned Finish */}
                                    <td className="px-2 py-2 text-center relative min-w-[90px]">
                                        {isEditing ? (
                                            <div className="relative" onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'plannedFinish' ? null : 'plannedFinish'); }}>
                                                <span className="text-[10px] text-blue-500 cursor-pointer font-bold border-b border-blue-500/30 whitespace-nowrap">{editForm.plannedFinish || 'Select'}</span>
                                                {activeDropdown === 'plannedFinish' && (
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[100] shadow-2xl">
                                                        <CustomDatePicker value={editForm.plannedFinish} onChange={(d) => { updateEditForm('plannedFinish', d.target.value); setActiveDropdown(null); }} onClose={() => setActiveDropdown(null)} />
                                                    </div>
                                                )}
                                            </div>
                                        ) : <span className="text-gray-600 dark:text-gray-400 font-medium text-[10px]">{row.plannedFinish || '-'}</span>}
                                    </td>

                                    {/* Planned Day */}
                                    <td className="px-2 py-2 text-center font-bold text-gray-400 text-[10px] w-10">
                                        {isEditing ? editForm.plannedDays : row.plannedDays}
                                    </td>

                                    {/* Actual Start */}
                                    <td className="px-2 py-2 text-center relative min-w-[90px]">
                                        {isEditing ? (
                                            <div className="relative" onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'actualStart' ? null : 'actualStart'); }}>
                                                <span className="text-[10px] text-blue-500 cursor-pointer font-bold border-b border-blue-500/30 whitespace-nowrap">{editForm.actualStart || 'Select'}</span>
                                                {activeDropdown === 'actualStart' && (
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[100] shadow-2xl">
                                                        <CustomDatePicker value={editForm.actualStart} onChange={(d) => { updateEditForm('actualStart', d.target.value); setActiveDropdown(null); }} onClose={() => setActiveDropdown(null)} />
                                                    </div>
                                                )}
                                            </div>
                                        ) : <span className="text-gray-600 dark:text-gray-400 font-medium text-[10px]">{row.actualStart || '-'}</span>}
                                    </td>

                                    {/* Actual Finish */}
                                    <td className="px-2 py-2 text-center relative min-w-[90px]">
                                        {isEditing ? (
                                            <div className="relative" onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'actualFinish' ? null : 'actualFinish'); }}>
                                                <span className="text-[10px] text-blue-500 cursor-pointer font-bold border-b border-blue-500/30 whitespace-nowrap">{editForm.actualFinish || 'Select'}</span>
                                                {activeDropdown === 'actualFinish' && (
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[100] shadow-2xl">
                                                        <CustomDatePicker value={editForm.actualFinish} onChange={(d) => { updateEditForm('actualFinish', d.target.value); setActiveDropdown(null); }} onClose={() => setActiveDropdown(null)} />
                                                    </div>
                                                )}
                                            </div>
                                        ) : <span className="text-gray-600 dark:text-gray-400 font-medium text-[10px]">{row.actualFinish || '-'}</span>}
                                    </td>

                                    {/* Actual Day */}
                                    <td className="px-2 py-2 text-center font-bold text-gray-400 text-[10px] w-10">
                                        {isEditing ? editForm.actualDays : row.actualDays}
                                    </td>

                                    {/* Delay Start */}
                                    <td className={`px-2 py-2 text-center font-bold text-[10px] ${startDelay > 0 ? 'bg-red-50/50 dark:bg-red-900/10 text-red-600' : 'text-green-600'}`}>
                                        {startDelay}
                                    </td>

                                    {/* Responsible Start */}
                                    <td className="px-3 py-2">
                                        {isEditing ? (
                                            <input
                                                value={editForm.responsibleStart}
                                                onChange={(e) => updateEditForm('responsibleStart', e.target.value)}
                                                className="w-full bg-white dark:bg-[#161b22] border border-gray-300 dark:border-gh-border rounded px-2 py-1 text-[10px] outline-none focus:border-blue-500/50"
                                            />
                                        ) : <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium truncate block max-w-[120px]">{row.responsibleStart}</span>}
                                    </td>

                                    {/* Remarks Start */}
                                    <td className="px-3 py-2">
                                        {isEditing ? (
                                            <input
                                                value={editForm.remarksStart}
                                                onChange={(e) => updateEditForm('remarksStart', e.target.value)}
                                                className="w-full bg-white dark:bg-[#161b22] border border-gray-300 dark:border-gh-border rounded px-2 py-1 text-[10px] outline-none focus:border-blue-500/50"
                                            />
                                        ) : <span className="text-[10px] text-gray-500 italic truncate block max-w-[150px]">{row.remarksStart}</span>}
                                    </td>

                                    {/* Delay Finish */}
                                    <td className={`px-2 py-2 text-center font-bold text-[10px] ${finishDelay > 0 ? 'bg-red-50/50 dark:bg-red-900/10 text-red-600' : 'text-green-600'}`}>
                                        {finishDelay}
                                    </td>

                                    {/* Responsible Finish */}
                                    <td className="px-3 py-2">
                                        {isEditing ? (
                                            <input
                                                value={editForm.responsibleFinish}
                                                onChange={(e) => updateEditForm('responsibleFinish', e.target.value)}
                                                className="w-full bg-white dark:bg-[#161b22] border border-gray-300 dark:border-gh-border rounded px-2 py-1 text-[10px] outline-none focus:border-blue-500/50"
                                            />
                                        ) : <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium truncate block max-w-[120px]">{row.responsibleFinish}</span>}
                                    </td>

                                    {/* Remarks Finish */}
                                    <td className="px-3 py-2">
                                        {isEditing ? (
                                            <input
                                                value={editForm.remarksEnd}
                                                onChange={(e) => updateEditForm('remarksEnd', e.target.value)}
                                                className="w-full bg-white dark:bg-[#161b22] border border-gray-300 dark:border-gh-border rounded px-2 py-1 text-[10px] outline-none focus:border-blue-500/50"
                                            />
                                        ) : <span className="text-[10px] text-gray-500 italic truncate block max-w-[150px]">{row.remarksEnd}</span>}
                                    </td>

                                    {/* Actions */}
                                    <td className="px-2 py-2 text-center w-20 min-w-[80px] bg-[#fdfdfe] dark:bg-[#0d1117]/80">
                                        {isEditing ? (
                                            <div className="flex items-center justify-center space-x-1.5 animate-in fade-in slide-in-from-right-1 duration-200">
                                                <button onClick={handleSaveEdit} className="px-2 py-1 bg-blue-600 text-white rounded text-[9px] font-bold hover:bg-blue-700 shadow-sm transition-all uppercase tracking-tighter">Save</button>
                                                <button onClick={handleCancelEdit} className="px-2 py-1 bg-gray-100 dark:bg-gh-bg-secondary text-gray-600 rounded text-[9px] font-bold hover:bg-gray-200 transition-all uppercase tracking-tighter">Esc</button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center space-x-0.5 transition-all">
                                                <button onClick={() => handleEditClick(row)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-md transition-all" title="Edit Row"><Pencil size={12} /></button>
                                                <button onClick={() => handleDeleteRow(row.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-all" title="Delete Row"><Trash2 size={12} /></button>
                                            </div>
                                        )}
                                    </td>
                                </Reorder.Item>
                            );
                        })}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={15} className="p-16 text-center text-gray-400 italic bg-gray-50/10 dark:bg-transparent tracking-normal">
                                    <div className="flex flex-col items-center space-y-3">
                                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-300 dark:text-gray-700">
                                            <AlertOctagon size={24} />
                                        </div>
                                        <p className="text-[12px] font-medium text-gray-500">No hindrances recorded yet.</p>
                                        <button onClick={handleAddRow} className="text-[11px] text-blue-500 hover:underline font-bold">Add your first hindrance row</button>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </Reorder.Group>
                </table>
            </div>
        </div>
    );
};

export default HindranceReport;
