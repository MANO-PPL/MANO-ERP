import React, { useEffect, useState } from 'react';
import { Plus, GripVertical, ChevronDown, Check, X, ExternalLink, Info, Edit2, Trash2, Clock, User, FileText, CheckCircle2, History } from 'lucide-react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';

const DrawingCategoryDetail = ({ category, onBack, setExtraBreadcrumbs, canWrite }) => {
    const [activeTab, setActiveTab] = useState('management'); // 'management' or 'planned'
    const [editingDrawing, setEditingDrawing] = useState(null);
    const [editingTarget, setEditingTarget] = useState(null); // { id }
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [hoveredRow, setHoveredRow] = useState(null);

    // Version Control Drawer States
    const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);
    const [selectedDrawingVersion, setSelectedDrawingVersion] = useState(null);
    const [activeLogIndex, setActiveLogIndex] = useState(0);

    // Filter states
    const [statusFilter, setStatusFilter] = useState('All');
    const [activeToolbarDropdown, setActiveToolbarDropdown] = useState(null);

    const statusOptions = ['In Review', 'Completed'];

    const getStatusColors = (status) => {
        const colors = {
            'Completed': 'bg-blue-400 text-black',
            'In Review': 'bg-purple-400 text-black',
        };
        return colors[status] || 'bg-gray-400 text-black';
    };

    const getPriorityColors = (priority) => {
        const colors = {
            'High': 'text-red-500',
            'Medium': 'text-orange-500',
            'Low': 'text-green-500',
            'None': 'text-gray-500'
        };
        return colors[priority] || 'text-gray-500';
    };

    // State for Section 1: Drawing Management
    const [managementDrawings, setManagementDrawings] = useState([
        { id: 'm1', number: 'A1234u', date: '25/12/2025', title: 'Noa', rev: 'R1', status: 'In Review', remarks: 'mo', files: true, priority: 'High' },
        { id: 'm2', number: 'A1234u', date: '03/01/2026', title: 'mk', rev: 'R6', status: 'Completed', remarks: 'mom', files: true, priority: 'Low' },
        { id: 'm3', number: '1234', date: '02/02/2026', title: 'Congo Boy', rev: 'R0', status: 'In Review', remarks: 'nothing', files: true, priority: 'Medium' },
        { id: 'm4', number: '-', date: '07/02/2026', title: 'MFP', rev: 'R1', status: 'In Review', remarks: 'Hello', files: true, priority: 'None' },
    ]);

    // State for Section 2: Drawing Planned vs Achieved
    const [plannedDrawings, setPlannedDrawings] = useState([
        { id: 'p1', name: 'NEW', plannedDate: '26/01/2026', receivedDate: '27/01/2026', status: 'In Review', remarks: 'Name', priority: 'High' },
        { id: 'p2', name: 'Name', plannedDate: '23/12/2025', receivedDate: '23/12/2025', status: 'Completed', remarks: 'name', priority: 'Low' },
        { id: 'p3', name: 'tets', plannedDate: '01/01/2028', receivedDate: '09/01/2026', status: 'In Review', remarks: 'ndkdn', priority: 'High' },
        { id: 'p4', name: 'test', plannedDate: '24/12/2025', receivedDate: '31/12/2025', status: 'In Review', remarks: 'test', priority: 'Medium' },
    ]);

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'Drawings', onClick: onBack },
            { label: category.name }
        ]);
    }, [category, onBack, setExtraBreadcrumbs]);

    const handleEditClick = (drawing, field) => {
        if (!canWrite) return;
        setEditingDrawing({ ...drawing });
        setEditingTarget(drawing.id);
        setActiveDropdown(field);
    };

    const handleUpdateDrawing = () => {
        if (!editingTarget) return;
        const setter = activeTab === 'management' ? setManagementDrawings : setPlannedDrawings;
        const currentList = activeTab === 'management' ? managementDrawings : plannedDrawings;
        setter(currentList.map(d => d.id === editingTarget ? editingDrawing : d));
        setEditingDrawing(null);
        setEditingTarget(null);
        setActiveDropdown(null);
    };

    const cancelEdit = () => {
        setEditingDrawing(null);
        setEditingTarget(null);
        setActiveDropdown(null);
    };

    const StatusPill = ({ status, isEditing, isHovered, onEditClick }) => (
        <div className="relative group/cell">
            <div
                className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${isEditing || isHovered ? 'bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-sm' : 'border border-transparent hover:bg-gray-50 dark:hover:bg-[#161b22] hover:border-gray-200 dark:border-white/10 w-fit'}`}
                onClick={(e) => { e.stopPropagation(); onEditClick && onEditClick('status'); }}
            >
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold min-w-[90px] inline-block text-center shadow-sm ${getStatusColors(status)} uppercase`}>
                    {status}
                </span>
            </div>
            {isEditing && activeDropdown === 'status' && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md shadow-2xl py-1 z-50 anim-fade-in flex flex-col overflow-hidden divide-y divide-white/5">
                    {statusOptions.map(opt => (
                        <div
                            key={opt}
                            className={`px-3 py-2 text-[12px] font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:bg-white/5 cursor-pointer flex items-center justify-between transition-colors uppercase`}
                            onClick={(e) => { e.stopPropagation(); setEditingDrawing({ ...editingDrawing, status: opt }); setActiveDropdown(null); }}
                        >
                            <span>{opt}</span>
                            {editingDrawing.status === opt && <Check size={12} className="text-blue-500" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const PriorityPill = ({ priority, isEditing, onEditClick }) => (
        <div className="relative">
            <div
                className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-all cursor-pointer ${isEditing ? 'bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-sm' : 'border border-transparent hover:bg-gray-50 dark:hover:bg-[#161b22] hover:border-gray-200 dark:border-white/10 w-fit'}`}
                onClick={(e) => { e.stopPropagation(); onEditClick && onEditClick('priority'); }}
            >
                <span className={`font-semibold text-[12px] ${getPriorityColors(priority)} flex items-center`}>
                    {priority !== 'None' && <span className="font-bold mr-1">!</span>}
                    {priority}
                </span>
            </div>
            {isEditing && activeDropdown === 'priority' && (
                <div className="absolute top-full right-0 mt-1 w-32 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md shadow-2xl py-1 z-50 anim-fade-in flex flex-col overflow-hidden divide-y divide-white/5">
                    {['High', 'Medium', 'Low', 'None'].map(opt => (
                        <div
                            key={opt}
                            className={`px-3 py-2 text-[12px] font-semibold ${getPriorityColors(opt)} hover:bg-gray-100 dark:bg-white/5 cursor-pointer flex items-center justify-between transition-colors`}
                            onClick={(e) => { e.stopPropagation(); setEditingDrawing({ ...editingDrawing, priority: opt }); setActiveDropdown(null); }}
                        >
                            <span>{opt}</span>
                            {editingDrawing.priority === opt && <Check size={12} className="text-blue-500" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const EditableTextCell = ({ value, field, isEditing, isHovered, onEditClick, className = '' }) => (
        <div className="relative group/cell w-full">
            {isEditing && activeDropdown === field ? (
                <div className="inline-grid w-fit max-w-full items-center align-middle relative">
                    <span className={`invisible col-start-1 row-start-1 px-2 py-1 text-sm whitespace-pre pointer-events-none min-w-[50px] min-h-[26px] flex items-center ${className}`}>
                        {editingDrawing[field] || ' '}
                    </span>
                    <input
                        type="text"
                        autoFocus
                        className={`absolute inset-0 w-full h-full bg-gray-50 dark:bg-[#161b22] border border-blue-500 ring-1 ring-blue-500/20 rounded-md px-2 py-1 text-sm outline-none shadow-sm text-gray-900 dark:text-white transition-all ${className}`}
                        value={editingDrawing[field]}
                        onChange={(e) => setEditingDrawing({ ...editingDrawing, [field]: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateDrawing()}
                        onBlur={() => { }} // Could auto-save or just leave active
                    />
                </div>
            ) : (
                <div
                    className={`px-2 py-1.5 rounded-md transition-all cursor-pointer truncate max-w-[400px] border border-transparent ${isHovered ? 'bg-gray-50 dark:bg-[#161b22] border-gray-200 dark:border-white/10' : ''} ${className}`}
                    onClick={() => onEditClick(field)}
                >
                    {value}
                </div>
            )}
        </div>
    );

    const renderManagementTable = () => (
        <table className="w-full text-[12px] text-left">
            <thead className="text-[10px] font-bold text-gray-500 uppercase bg-gray-50 dark:bg-[#161b22] border-y border-gray-200 dark:border-white/5 sticky top-0 z-10 transition-colors">
                <tr>
                    <th className="px-4 py-2 w-10 text-center"></th>
                    <th className="px-4 py-2 w-20">SR</th>
                    <th className="px-4 py-2 w-48">NUMBER</th>
                    <th className="px-4 py-2 w-32">DATE</th>
                    <th className="px-4 py-2 w-130">TITLE</th>
                    <th className="px-4 py-2 w-24 text-center">REV</th>
                    <th className="px-4 py-2 w-36">STATUS</th>
                    <th className="px-4 py-2 w-60 text-center">FILES</th>
                    <th className="px-4 py-2 flex-1">REMARKS</th>
                    <th className="px-4 py-2 w-32 text-center">ACTIONS</th>
                </tr>
            </thead>
            <Reorder.Group as="tbody" axis="y" values={managementDrawings} onReorder={setManagementDrawings}>
                {managementDrawings.map((drawing, idx) => {
                    const isEditing = editingTarget === drawing.id;
                    const isHovered = hoveredRow === drawing.id;

                    if (isEditing) {
                        return (
                            <tr key={drawing.id} className="bg-blue-500/5 border-b border-gray-200 dark:border-white/10 relative h-[42px] transition-colors shadow-[inset_2px_0_0_0_#3b82f6]">
                                <td className="px-3 py-2 text-center text-blue-500"><GripVertical size={14} className="mx-auto" /></td>
                                <td className="px-4 py-2 font-mono text-gray-600 dark:text-gray-400">{String(idx + 1).padStart(2, '0')}</td>
                                <td className="px-2 py-1 text-gray-900 dark:text-gray-200 font-medium">
                                    <EditableTextCell value={editingDrawing.number} field="number" isEditing={true} />
                                </td>
                                <td className="px-2 py-1 text-gray-900 dark:text-gray-200">
                                    <EditableTextCell value={editingDrawing.date} field="date" isEditing={true} />
                                </td>
                                <td className="px-2 py-1 text-gray-900 dark:text-gray-200 w-64">
                                    <EditableTextCell value={editingDrawing.title} field="title" isEditing={true} />
                                </td>
                                <td className="px-2 py-1 text-center text-gray-900 dark:text-gray-200">
                                    <EditableTextCell value={editingDrawing.rev} field="rev" isEditing={true} className="text-center" />
                                </td>
                                <td className="px-4 py-2">
                                    <StatusPill status={editingDrawing.status} isEditing={true} onEditClick={() => setActiveDropdown('status')} />
                                </td>
                                <td className="px-4 py-2 flex justify-center">
                                    <button className="flex items-center space-x-1.5 text-blue-400 hover:text-blue-300 font-bold transition-colors">
                                        <ExternalLink size={12} /><span>View</span>
                                    </button>
                                </td>
                                <td className="px-2 py-1 text-gray-900 dark:text-gray-200 flex-1">
                                    <EditableTextCell value={editingDrawing.remarks} field="remarks" isEditing={true} />
                                </td>
                                <td className="px-4 py-2 text-center bg-gray-100 dark:bg-white/5">
                                    <div className="flex items-center justify-center space-x-2">
                                        <button onClick={handleUpdateDrawing} className="p-1 px-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded shadow-sm transition-all flex items-center space-x-1" title="Save">
                                            <Check size={14} /><span>Save</span>
                                        </button>
                                        <button onClick={cancelEdit} className="p-1 px-2 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-bold rounded hover:bg-white/20 transition-all flex items-center space-x-1" title="Cancel">
                                            <X size={14} /><span>Cancel</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    }

                    return (
                        <Reorder.Item
                            as="tr"
                            key={drawing.id}
                            value={drawing}
                            id={drawing.id}
                            className="hover:bg-gray-50 dark:hover:bg-[#161b22] transition-colors group/row border-b border-gray-200 dark:border-white/[0.04] relative h-[42px]"
                            onMouseEnter={() => setHoveredRow(drawing.id)}
                            onMouseLeave={() => setHoveredRow(null)}
                        >
                            <td className="px-3 py-2 text-center" onClick={() => !isEditing && handleEditClick(drawing, 'number')}>
                                <GripVertical size={14} className="text-gray-500 group-hover/row:text-blue-500 transition-colors mx-auto cursor-grab active:cursor-grabbing" />
                            </td>
                            <td className="px-4 py-2 font-mono text-gray-500" onClick={() => !isEditing && handleEditClick(drawing, 'number')}>{String(idx + 1).padStart(2, '0')}</td>
                            <td className="px-2 py-1 text-gray-900 dark:text-gray-200 font-medium" onClick={() => !isEditing && handleEditClick(drawing, 'number')}>
                                <EditableTextCell value={drawing.number} field="number" isEditing={false} isHovered={isHovered} onEditClick={(f) => handleEditClick(drawing, f)} />
                            </td>
                            <td className="px-2 py-1 text-gray-600 dark:text-gray-400" onClick={() => !isEditing && handleEditClick(drawing, 'date')}>
                                <EditableTextCell value={drawing.date} field="date" isEditing={false} isHovered={isHovered} onEditClick={(f) => handleEditClick(drawing, f)} />
                            </td>
                            <td className="px-2 py-1 text-gray-900 dark:text-gray-200 w-64 truncate" onClick={() => !isEditing && handleEditClick(drawing, 'title')}>
                                <EditableTextCell value={drawing.title} field="title" isEditing={false} isHovered={isHovered} onEditClick={(f) => handleEditClick(drawing, f)} className="truncate" />
                            </td>
                            <td className="px-2 py-1 text-gray-600 dark:text-gray-400 text-center" onClick={() => !isEditing && handleEditClick(drawing, 'rev')}>
                                <EditableTextCell value={drawing.rev} field="rev" isEditing={false} isHovered={isHovered} onEditClick={(f) => handleEditClick(drawing, f)} className="text-center" />
                            </td>
                            <td className="px-4 py-2" onClick={() => !isEditing && handleEditClick(drawing, 'status')}>
                                <StatusPill status={drawing.status} isEditing={false} isHovered={isHovered} onEditClick={() => handleEditClick(drawing, 'status')} />
                            </td>
                            <td className="px-4 py-2 flex justify-center" onClick={(e) => { e.stopPropagation(); console.log('View Clicked') }}>
                                <button className="flex items-center space-x-1.5 text-blue-400 hover:text-blue-300 font-bold transition-colors">
                                    <ExternalLink size={12} /><span>View</span>
                                </button>
                            </td>
                            <td className="px-2 py-1 text-gray-600 dark:text-gray-400 flex-1 truncate" onClick={() => !isEditing && handleEditClick(drawing, 'remarks')}>
                                <EditableTextCell value={drawing.remarks} field="remarks" isEditing={false} isHovered={isHovered} onEditClick={(f) => handleEditClick(drawing, f)} className="truncate" />
                            </td>
                            <td className="px-4 py-2 text-center min-w-[120px]">
                                {isEditing ? (
                                    <div className="flex items-center justify-center space-x-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleUpdateDrawing(); }}
                                            className="px-2.5 py-1 bg-blue-600 text-white rounded text-[11px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                                            className="px-2.5 py-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded text-[11px] font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center space-x-3">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedDrawingVersion(drawing); setActiveLogIndex(0); setInfoDrawerOpen(true); }}
                                            className="text-gray-600 dark:text-gray-400 hover:text-blue-500 transition-colors p-1"
                                            title="Info"
                                        >
                                            <Info size={14} />
                                        </button>
                                        {canWrite && (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleEditClick(drawing, 'title'); }}
                                                    className="text-gray-600 dark:text-gray-400 hover:text-blue-500 transition-colors p-1"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    className="text-gray-600 dark:text-gray-400 hover:text-red-500 transition-colors p-1"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </td>
                        </Reorder.Item>
                    );
                })}
            </Reorder.Group>
        </table>
    );

    const renderPlannedTable = () => (
        <table className="w-full text-[12px] text-left">
            <thead className="text-[10px] font-bold text-gray-500 uppercase bg-gray-50 dark:bg-[#161b22] border-y border-gray-200 dark:border-white/5 sticky top-0 z-10 transition-colors">
                <tr>
                    <th className="px-4 py-2 w-10 text-center"></th>
                    <th className="px-4 py-2 w-16">SR</th>
                    <th className="px-4 py-2 w-160">DRAWING NAME</th>
                    <th className="px-4 py-2 w-50">PLANNED DATE</th>
                    <th className="px-4 py-2 w-50">RECEIVED DATE</th>
                    <th className="px-4 py-2 w-70">STATUS</th>
                    <th className="px-4 py-2">REMARKS</th>
                    <th className="px-4 py-2 w-32 text-center">ACTIONS</th>
                </tr>
            </thead>
            <Reorder.Group as="tbody" axis="y" values={plannedDrawings} onReorder={setPlannedDrawings}>
                {plannedDrawings.map((drawing, idx) => {
                    const isEditing = editingTarget === drawing.id;
                    const isHovered = hoveredRow === drawing.id;

                    if (isEditing) {
                        return (
                            <tr key={drawing.id} className="bg-blue-500/5 border-b border-gray-200 dark:border-white/10 relative h-[42px] transition-colors shadow-[inset_2px_0_0_0_#3b82f6]">
                                <td className="px-3 py-2 text-center text-blue-500"><GripVertical size={14} className="mx-auto" /></td>
                                <td className="px-4 py-2 font-mono text-gray-600 dark:text-gray-400">{String(idx + 1).padStart(2, '0')}</td>
                                <td className="px-2 py-1 text-gray-900 dark:text-gray-200 font-medium">
                                    <EditableTextCell value={editingDrawing.name} field="name" isEditing={true} />
                                </td>
                                <td className="px-2 py-1 text-gray-900 dark:text-gray-200">
                                    <EditableTextCell value={editingDrawing.plannedDate} field="plannedDate" isEditing={true} />
                                </td>
                                <td className="px-2 py-1 text-gray-900 dark:text-gray-200">
                                    <EditableTextCell value={editingDrawing.receivedDate} field="receivedDate" isEditing={true} />
                                </td>
                                <td className="px-4 py-2">
                                    <StatusPill status={editingDrawing.status} isEditing={true} onEditClick={() => setActiveDropdown('status')} />
                                </td>
                                <td className="px-2 py-1 text-gray-900 dark:text-gray-200">
                                    <EditableTextCell value={editingDrawing.remarks} field="remarks" isEditing={true} />
                                </td>
                                <td className="px-4 py-2 text-center bg-gray-100 dark:bg-white/5">
                                    <div className="flex items-center justify-center space-x-2">
                                        <button onClick={handleUpdateDrawing} className="p-1 px-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded shadow-sm transition-all flex items-center space-x-1" title="Save">
                                            <Check size={14} /><span>Save</span>
                                        </button>
                                        <button onClick={cancelEdit} className="p-1 px-2 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-bold rounded hover:bg-white/20 transition-all flex items-center space-x-1" title="Cancel">
                                            <X size={14} /><span>Cancel</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    }

                    return (
                        <Reorder.Item
                            as="tr"
                            key={drawing.id}
                            value={drawing}
                            id={drawing.id}
                            className="hover:bg-gray-50 dark:hover:bg-[#161b22] transition-colors group/row border-b border-gray-200 dark:border-white/[0.04] relative h-[42px]"
                            onMouseEnter={() => setHoveredRow(drawing.id)}
                            onMouseLeave={() => setHoveredRow(null)}
                        >
                            <td className="px-3 py-2 text-center" onClick={() => !isEditing && handleEditClick(drawing, 'name')}>
                                <GripVertical size={14} className="text-gray-500 group-hover/row:text-blue-500 transition-colors mx-auto cursor-grab active:cursor-grabbing" />
                            </td>
                            <td className="px-4 py-2 font-mono text-gray-500" onClick={() => !isEditing && handleEditClick(drawing, 'name')}>{String(idx + 1).padStart(2, '0')}</td>
                            <td className="px-2 py-1 text-gray-900 dark:text-gray-200 font-medium" onClick={() => !isEditing && handleEditClick(drawing, 'name')}>
                                <EditableTextCell value={drawing.name} field="name" isEditing={false} isHovered={isHovered} onEditClick={(f) => handleEditClick(drawing, f)} />
                            </td>
                            <td className="px-2 py-1 text-gray-600 dark:text-gray-400" onClick={() => !isEditing && handleEditClick(drawing, 'plannedDate')}>
                                <EditableTextCell value={drawing.plannedDate} field="plannedDate" isEditing={false} isHovered={isHovered} onEditClick={(f) => handleEditClick(drawing, f)} />
                            </td>
                            <td className="px-2 py-1 text-gray-600 dark:text-gray-400" onClick={() => !isEditing && handleEditClick(drawing, 'receivedDate')}>
                                <EditableTextCell value={drawing.receivedDate} field="receivedDate" isEditing={false} isHovered={isHovered} onEditClick={(f) => handleEditClick(drawing, f)} />
                            </td>
                            <td className="px-4 py-2" onClick={() => !isEditing && handleEditClick(drawing, 'status')}>
                                <StatusPill status={drawing.status} isEditing={false} isHovered={isHovered} onEditClick={() => handleEditClick(drawing, 'status')} />
                            </td>
                            <td className="px-2 py-1 text-gray-600 dark:text-gray-400" onClick={() => !isEditing && handleEditClick(drawing, 'remarks')}>
                                <EditableTextCell value={drawing.remarks} field="remarks" isEditing={false} isHovered={isHovered} onEditClick={(f) => handleEditClick(drawing, f)} />
                            </td>
                            <td className="px-4 py-2 text-center min-w-[120px]">
                                {isEditing ? (
                                    <div className="flex items-center justify-center space-x-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleUpdateDrawing(); }}
                                            className="px-2.5 py-1 bg-blue-600 text-white rounded text-[11px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                                            className="px-2.5 py-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded text-[11px] font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center space-x-3">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedDrawingVersion(drawing); setActiveLogIndex(0); setInfoDrawerOpen(true); }}
                                            className="text-gray-600 dark:text-gray-400 hover:text-blue-500 transition-colors p-1"
                                            title="Info"
                                        >
                                            <Info size={14} />
                                        </button>
                                        {canWrite && (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleEditClick(drawing, 'name'); }}
                                                    className="text-gray-600 dark:text-gray-400 hover:text-blue-500 transition-colors p-1"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    className="text-gray-600 dark:text-gray-400 hover:text-red-500 transition-colors p-1"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </td>
                        </Reorder.Item>
                    );
                })}
            </Reorder.Group>
        </table>
    );

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors Poppins select-none">
            {/* Local Tab Switcher & Global Filters */}
            <div className="flex flex-col bg-white dark:bg-[#0d1117] border-b border-gray-200 dark:border-white/5 z-20">
                <div className="px-5 mx-1 py-3">
                    <div className="inline-flex p-0.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
                        {[
                            { id: 'management', label: 'Drawing Management', count: managementDrawings.length },
                            { id: 'planned', label: 'Drawing Planned vs Achieved', count: plannedDrawings.length }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center space-x-1.5 px-4 py-1 text-xs font-semibold rounded-md transition-all duration-200 ${activeTab === tab.id
                                    ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                            >
                                <span>{tab.label}</span>
                                {tab.count > 0 && (
                                    <span className={`flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full ml-1 ${activeTab === tab.id
                                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                        : 'bg-red-500 text-white'
                                        }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-center px-5 py-2 bg-white dark:bg-[#0d1117] border-t border-gray-200 dark:border-white/5">
                    <div className="flex items-center space-x-4">
                        {/* Status Filter */}
                        <div className="relative">
                            <div
                                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md border ${activeToolbarDropdown === 'status' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-white/10'} bg-gray-50 dark:bg-[#161b22] text-[12px] font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:border-white/20 transition-all`}
                                onClick={() => setActiveToolbarDropdown(activeToolbarDropdown === 'status' ? null : 'status')}
                            >
                                <span className="text-gray-500">Status:</span>
                                <span className="text-blue-500 capitalize">{statusFilter}</span>
                                <ChevronDown size={14} className={`text-gray-500 transition-transform ${activeToolbarDropdown === 'status' ? 'rotate-180 text-blue-500' : ''}`} />
                            </div>
                            {activeToolbarDropdown === 'status' && (
                                <div className="absolute top-full left-0 mt-1 w-40 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md shadow-2xl py-1 z-[110] anim-fade-in flex flex-col overflow-hidden divide-y divide-white/5">
                                    <div className={`px-3 py-2 text-[12px] font-semibold cursor-pointer transition-colors ${statusFilter === 'All' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:bg-white/5 hover:text-white'}`} onClick={() => { setStatusFilter('All'); setActiveToolbarDropdown(null); }}>All</div>
                                    {statusOptions.map(opt => (
                                        <div key={opt} className={`px-3 py-2 text-[12px] font-semibold cursor-pointer transition-colors ${statusFilter === opt ? 'bg-blue-600/20 text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:bg-white/5 hover:text-white'}`} onClick={() => { setStatusFilter(opt); setActiveToolbarDropdown(null); }}>
                                            {opt}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    {canWrite && (
                        <div className="flex items-center space-x-3">
                            <button className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-md text-[12px] font-normal transition-all active:scale-95" title="Edit Mode">
                                <Edit2 size={14} />
                                <span>Edit</span>
                            </button>
                            <button className="flex items-center space-x-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-[12px] font-normal transition-all shadow-lg shadow-blue-500/10 active:scale-95">
                                <Plus size={14} />
                                <span>Add Record</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'management' ? renderManagementTable() : renderPlannedTable()}
            </div>

            {/* Info / Version Control Drawer */}
            <AnimatePresence>
                {infoDrawerOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setInfoDrawerOpen(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[150]"
                        />
                        {/* Drawer Content */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="absolute right-0 top-0 bottom-0 w-[400px] bg-white dark:bg-[#0d1117] border-l border-gray-200 dark:border-white/10 shadow-2xl z-[160] flex flex-col overflow-hidden"
                        >
                            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-[#161b22]">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                        <History size={20} />
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Version Control Log</h2>
                                </div>
                                <button onClick={() => setInfoDrawerOpen(false)} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                                {(() => {
                                    const drawerLogs = selectedDrawingVersion ? [
                                        { rev: selectedDrawingVersion.rev || 'R3', date: selectedDrawingVersion.receivedDate || selectedDrawingVersion.date || '2 Days Ago', change: selectedDrawingVersion.remarks || 'Final architectural nuances updated. Floor plan finalized.', approvedBy: 'Lead Architect', type: 'Current', status: selectedDrawingVersion.status || 'Active' },
                                        { rev: 'R2', date: 'Last Week', change: 'Structural adjustments based on client feedback. Moved load bearing walls.', approvedBy: 'Project Manager', type: 'Archived', status: 'Completed' },
                                        { rev: 'R1', date: '2 Weeks Ago', change: 'Initial drawing submission. Base plan setup.', approvedBy: 'Draftsman', type: 'Archived', status: 'Completed' },
                                    ] : [];
                                    const activeLog = drawerLogs[activeLogIndex] || drawerLogs[0];

                                    return (
                                        <>
                                            {/* Current Version Section */}
                                            <section>
                                                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] block mb-4">Viewing Revision: {activeLog?.rev}</label>
                                                <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl p-4 space-y-4 shadow-inner transition-all duration-300">
                                                    <div className="flex flex-col space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-bold text-gray-900 dark:text-white truncate" title={selectedDrawingVersion?.name || selectedDrawingVersion?.title || 'Drawing Document'}>{selectedDrawingVersion?.name || selectedDrawingVersion?.title || 'Drawing Document'}</span>
                                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded border tracking-wider shrink-0 ml-2 ${activeLog?.type === 'Current' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30' : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-white/20'}`}>
                                                                {activeLog?.rev ? `${activeLog.rev} FINAL` : 'R1 FINAL'}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs text-gray-500">Ref: {selectedDrawingVersion?.number || 'EXT-DOC-001'}</span>
                                                    </div>

                                                    <div className="border-t border-gray-200 dark:border-white/10 pt-4 space-y-2">
                                                        <div className="flex items-center space-x-3 text-sm text-gray-700 dark:text-gray-300">
                                                            <Clock size={16} className="text-gray-500 shrink-0" />
                                                            <span>Modified: {activeLog?.date || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex items-center space-x-3 text-sm text-gray-700 dark:text-gray-300">
                                                            <CheckCircle2 size={16} className={`${activeLog?.status === 'Completed' ? 'text-green-500' : 'text-purple-500'} shrink-0`} />
                                                            <span>Status: {activeLog?.status || 'Active'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </section>

                                            {/* Revision Log */}
                                            <section>
                                                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] block mb-4">Revision History</label>
                                                <div className="space-y-4 relative">
                                                    {drawerLogs.map((log, i) => (
                                                        <div
                                                            key={i}
                                                            onClick={(e) => { e.stopPropagation(); setActiveLogIndex(i); }}
                                                            className="flex relative pl-6 group cursor-pointer"
                                                        >
                                                            {/* Timeline Line */}
                                                            <div className="absolute left-1.5 top-2.5 bottom-[-24px] w-[2px] bg-gray-200 dark:bg-white/10 group-last:hidden" />
                                                            {/* Timeline Dot */}
                                                            <div className={`absolute left-[-2px] top-1.5 w-[16px] h-[16px] rounded-full border-[3px] border-white dark:border-[#0d1117] shadow-sm transition-all duration-300 z-10 ${activeLogIndex === i ? 'bg-blue-500 scale-110' : (log.type === 'Current' ? 'bg-blue-400' : 'bg-gray-400 dark:bg-gray-600')}`} />

                                                            <div className={`flex-1 pb-6 transition-all duration-300 ${activeLogIndex === i ? 'scale-[1.01] origin-left opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className={`text-xs font-bold ${log.type === 'Current' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-300'}`}>{log.rev} {log.type === 'Current' && '(Latest)'}</span>
                                                                    <span className={`text-[10px] ${activeLogIndex === i ? 'text-blue-500 font-semibold' : 'text-gray-500'}`}>{log.date}</span>
                                                                </div>
                                                                <p className={`text-xs leading-relaxed mb-3 ${activeLogIndex === i ? 'text-gray-900 dark:text-gray-200 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                                                                    {log.change}
                                                                </p>
                                                                <div className="flex items-center space-x-1.5 text-[10px] text-gray-500">
                                                                    <User size={12} className={activeLogIndex === i ? 'text-blue-500' : 'text-gray-400'} />
                                                                    <span className="uppercase tracking-wider font-semibold">Auth: {log.approvedBy}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>

                                            {/* Approvals & Remarks */}
                                            <section>
                                                <div className={`border rounded-xl p-4 transition-colors ${activeLog?.type === 'Current' ? 'bg-blue-50/50 dark:bg-blue-500/5 border-blue-100 dark:border-blue-500/20' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10'}`}>
                                                    <div className={`flex items-center space-x-2 mb-2 font-semibold text-[11px] tracking-widest uppercase ${activeLog?.type === 'Current' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                                        <FileText size={14} />
                                                        <span>{activeLog?.type === 'Current' ? 'Latest Attached Remarks' : `Attached Remarks for ${activeLog?.rev}`}</span>
                                                    </div>
                                                    <p className={`text-xs italic leading-relaxed ${activeLog?.type === 'Current' ? 'text-blue-800 dark:text-blue-200/70' : 'text-gray-600 dark:text-gray-400'}`}>
                                                        "{activeLog?.change || 'No active remarks attached to this version.'}"
                                                    </p>
                                                </div>
                                            </section>
                                        </>
                                    );
                                })()}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DrawingCategoryDetail;
