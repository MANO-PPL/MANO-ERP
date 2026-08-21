import React, { useEffect, useState } from 'react';
import { 
    Plus, GripVertical, ChevronDown, Check, X, Info, Edit2, Trash2, 
    Clock, User, FileText, History, Loader2, Download, Eye, Upload, Search,
    ArrowLeft, Layers, Sparkles, Filter, AlertCircle, Folder
} from 'lucide-react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-toastify';
import CustomSelect from '../../../components/CustomSelect';
import ConfirmModal from '../../../components/ConfirmModal';

const DrawingCategoryDetail = ({ category, projectId, onBack, setExtraBreadcrumbs, canWrite }) => {
    const [activeTab, setActiveTab] = useState('management'); // 'management' or 'planned'
    const [drawings, setDrawings] = useState([]);
    const [loading, setLoading] = useState(true);

    // Inline Double-Click Editing states
    const [editingTargetId, setEditingTargetId] = useState(null);
    const [editingField, setEditingField] = useState('title'); // 'title' or 'description'
    const [editingTitle, setEditingTitle] = useState('');
    const [editingDescription, setEditingDescription] = useState('');

    // Add Record Drawer States
    const [addDrawerOpen, setAddDrawerOpen] = useState(false);
    const [selectedDrawingForRevision, setSelectedDrawingForRevision] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [fileType, setFileType] = useState('dwg'); // 'dwg' or 'pdf'
    const [dwgFile, setDwgFile] = useState(null);
    const [pdfFile, setPdfFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Version Control Popup Drawer States
    const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);
    const [selectedDrawing, setSelectedDrawing] = useState(null);
    const [activeLogIndex, setActiveLogIndex] = useState(0);
    const [isDrawerEditingTitle, setIsDrawerEditingTitle] = useState(false);
    // Confirmation Modal States
    const [drawingToDelete, setDrawingToDelete] = useState(null);
    const [plannedToDelete, setPlannedToDelete] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Toolbar Filters
    const [searchQuery, setSearchQuery] = useState('');

    // Planned vs Achieved State
    const [plannedDrawings, setPlannedDrawings] = useState([
        { id: 'p1', name: 'Architectural Layout Blueprint', plannedDate: '2026-01-26', receivedDate: '2026-01-27', status: 'In Review', remarks: 'Under engineer validation', priority: 'High' },
        { id: 'p2', name: 'Plumbing & Drainage Schematics', plannedDate: '2025-12-20', receivedDate: '2025-12-20', status: 'Completed', remarks: 'Approved by PM', priority: 'High' },
        { id: 'p3', name: 'HVAC Duct & Ventilation Plan', plannedDate: '2026-02-01', receivedDate: '2026-02-03', status: 'In Review', remarks: 'Awaiting MEP team signoff', priority: 'Medium' },
        { id: 'p4', name: 'Fire Exit & Safety Blueprint', plannedDate: '2025-12-24', receivedDate: '2025-12-31', status: 'Completed', remarks: 'Pending safety clearance', priority: 'Low' }
    ]);
    const [newPlannedDrawerOpen, setNewPlannedDrawerOpen] = useState(false);
    const [newPlannedName, setNewPlannedName] = useState('');
    const [newPlannedDate, setNewPlannedDate] = useState('');
    const [newPlannedStatus, setNewPlannedStatus] = useState('In Review');
    const [newPlannedRemarks, setNewPlannedRemarks] = useState('');

    // Delete Drawing Confirmation Handler
    const handleConfirmDeleteDrawing = async () => {
        if (!drawingToDelete) return;
        setDeleteLoading(true);
        try {
            const response = await fetch(`/api/projects/${projectId}/drawings/categories/${category.id}/drawings/${drawingToDelete.id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                toast.success(`Blueprint "${drawingToDelete.title}" and its revision history deleted`);
                setDrawingToDelete(null);
                if (selectedDrawing && selectedDrawing.id === drawingToDelete.id) {
                    setInfoDrawerOpen(false);
                }
                fetchDrawings();
            } else {
                toast.error(data.message || 'Failed to delete drawing');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error deleting drawing');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleConfirmDeletePlanned = () => {
        if (!plannedToDelete) return;
        setPlannedDrawings(prev => prev.filter(p => p.id !== plannedToDelete.id));
        toast.success(`Scheduled item "${plannedToDelete.name}" removed`);
        setPlannedToDelete(null);
    };

    const handlePreviewDwg = (url, name) => {
        toast.info(`Launching WebCAD Viewer for ${name}...`);
        const targetUrl = `/drawing-viewer?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
        window.open(targetUrl, '_blank');
    };

    const categoryPrefix = category.name.trim().replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim().charAt(0).toUpperCase() || 'D';

    const fetchDrawings = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/projects/${projectId}/drawings/categories/${category.id}/drawings`);
            const data = await response.json();
            if (data.success) {
                setDrawings(data.drawings || []);
            } else {
                toast.error(data.message || 'Failed to load drawings');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error loading drawings list');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDrawings();
    }, [category.id, projectId]);

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'Drawings', onClick: onBack },
            { label: category.name }
        ]);
    }, [category, onBack, setExtraBreadcrumbs]);

    // Handle re-ordering
    const handleReorderDrawings = async (newOrderList) => {
        setDrawings(newOrderList);

        const payload = newOrderList.map((d, index) => ({
            id: d.id,
            sort_order: index + 1
        }));

        try {
            const response = await fetch(`/api/projects/${projectId}/drawings/categories/${category.id}/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: payload })
            });
            const data = await response.json();
            if (!data.success) {
                toast.error('Failed to sync order');
                fetchDrawings();
            }
        } catch (e) {
            console.error('Error reordering drawings:', e);
            fetchDrawings();
        }
    };

    // Upload Submit Handler
    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;

        if (!selectedDrawingForRevision && !title.trim()) {
            return toast.error('Drawing title is required.');
        }
        if (fileType === 'dwg' && !dwgFile) {
            return toast.error('Please attach a DWG file.');
        }
        if (fileType === 'pdf' && !pdfFile) {
            return toast.error('Please attach a PDF file.');
        }

        try {
            setSubmitting(true);
            const formData = new FormData();
            formData.append('categoryId', category.id);
            formData.append('description', description);

            if (selectedDrawingForRevision) {
                formData.append('drawingGroupId', selectedDrawingForRevision.id);
                formData.append('title', selectedDrawingForRevision.title);
            } else {
                formData.append('title', title.trim());
            }

            if (fileType === 'dwg' && dwgFile) formData.append('dwgFile', dwgFile);
            if (fileType === 'pdf' && pdfFile) formData.append('pdfFile', pdfFile);

            const response = await fetch(`/api/projects/${projectId}/drawings/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (data.success) {
                toast.success(selectedDrawingForRevision ? 'Revision uploaded successfully' : 'Drawing created successfully');
                setTitle('');
                setDescription('');
                setDwgFile(null);
                setPdfFile(null);
                setAddDrawerOpen(false);
                fetchDrawings();
            } else {
                toast.error(data.message || 'Upload failed');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error uploading file');
        } finally {
            setSubmitting(false);
        }
    };

    // Title Save
    const handleSaveTitle = async (drawingGroupId, customTitle = editingTitle) => {
        if (!customTitle || !customTitle.trim()) return;
        try {
            const response = await fetch(`/api/projects/${projectId}/drawings/categories/${category.id}/drawings/${drawingGroupId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: customTitle.trim() })
            });
            const data = await response.json();
            if (data.success) {
                toast.success('Title updated successfully');
                setEditingTargetId(null);
                fetchDrawings();
            } else {
                toast.error(data.message || 'Failed to update title');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error saving title');
        }
    };

    // Remarks/Description Save
    const handleSaveDescription = async (drawingGroupId, customDesc = editingDescription) => {
        try {
            const response = await fetch(`/api/projects/${projectId}/drawings/categories/${category.id}/drawings/${drawingGroupId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: (customDesc || '').trim() })
            });
            const data = await response.json();
            if (data.success) {
                toast.success('Remarks updated successfully');
                setEditingTargetId(null);
                fetchDrawings();
            } else {
                toast.error(data.message || 'Failed to update remarks');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error saving remarks');
        }
    };

    const handleAddPlannedDrawing = (e) => {
        e.preventDefault();
        if (!newPlannedName.trim()) return;

        const newEntry = {
            id: `p_${Date.now()}`,
            name: newPlannedName.trim(),
            plannedDate: newPlannedDate || new Date().toISOString().split('T')[0],
            receivedDate: 'Pending',
            status: newPlannedStatus,
            remarks: newPlannedRemarks.trim() || 'Scheduled drawing item',
            priority: 'Medium'
        };

        setPlannedDrawings(prev => [newEntry, ...prev]);
        setNewPlannedName('');
        setNewPlannedDate('');
        setNewPlannedRemarks('');
        setNewPlannedDrawerOpen(false);
        toast.success('Planned drawing item added');
    };

    const filteredDrawings = drawings.filter(d => 
        (d.title || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const dwgCount = drawings.filter(d => d.latestDwgUrl).length;
    const pdfCount = drawings.filter(d => d.latestPdfUrl).length;

    const renderManagementTable = () => (
        <div className="overflow-x-auto w-full">
            <table className="w-full text-xs text-left border-collapse bg-white dark:bg-[#0d1117] min-w-[850px]">
                <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-gh-border font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                        <th className="px-2.5 py-2.5 w-8 text-center"></th>
                        <th className="px-3 py-2.5 w-14">SR</th>
                        <th className="px-3 py-2.5 w-24">CODE</th>
                        <th className="px-3 py-2.5 w-28">DATE</th>
                        <th className="px-3 py-2.5 min-w-[240px]">DRAWING TITLE</th>
                        <th className="px-3 py-2.5 w-16 text-center">REV</th>
                        <th className="px-3 py-2.5 w-44 text-center">FILES</th>
                        <th className="px-3 py-2.5 min-w-[200px]">REMARKS</th>
                        <th className="px-3 py-2.5 w-24 text-right">ACTIONS</th>
                    </tr>
                </thead>
                <Reorder.Group as="tbody" axis="y" values={drawings} onReorder={handleReorderDrawings} className="divide-y divide-gray-100 dark:divide-gh-border/50">
                    {filteredDrawings.map((drawing, idx) => {
                        const drawingNum = `${categoryPrefix}${idx + 1}`;
                        const dateStr = drawing.latestUploadedAt 
                            ? new Date(drawing.latestUploadedAt).toLocaleDateString('en-GB') 
                            : 'N/A';

                        const isEditingThisTitle = editingTargetId === drawing.id && editingField === 'title';
                        const isEditingThisDesc = editingTargetId === drawing.id && editingField === 'description';

                        return (
                            <Reorder.Item 
                                as="tr"
                                key={drawing.id} 
                                value={drawing}
                                className="group/row hover:bg-blue-50/30 dark:hover:bg-gh-hover/60 transition-colors border-b border-gray-100 dark:border-gh-border/30 h-[42px]"
                            >
                                <td className="px-2.5 py-2 text-center text-gray-300 dark:text-gray-600 group-hover/row:text-blue-500 cursor-grab active:cursor-grabbing">
                                    <GripVertical size={14} className="mx-auto" />
                                </td>
                                <td className="px-3 py-2 font-mono text-[11px] text-gray-400">
                                    {String(idx + 1).padStart(2, '0')}
                                </td>
                                <td className="px-3 py-2 font-mono font-bold text-gray-900 dark:text-white">
                                    {drawingNum}
                                </td>
                                <td className="px-3 py-2 text-gray-500 text-[11px]">
                                    {dateStr}
                                </td>

                                {/* DRAWING TITLE CELL (Click for Popup, Double-click for inline edit) */}
                                <td className="px-3 py-2 text-gray-900 dark:text-gray-200 font-medium">
                                    {isEditingThisTitle ? (
                                        <div className="flex items-center gap-1.5 w-full max-w-sm">
                                            <input
                                                type="text"
                                                autoFocus
                                                value={editingTitle}
                                                onChange={e => setEditingTitle(e.target.value)}
                                                onFocus={e => e.target.select()}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleSaveTitle(drawing.id);
                                                    if (e.key === 'Escape') setEditingTargetId(null);
                                                }}
                                                className="bg-white dark:bg-[#161b22] border border-blue-500 rounded-md px-2.5 py-1 text-xs text-gray-900 dark:text-white outline-none w-full shadow-xs"
                                            />
                                            <button 
                                                onClick={() => handleSaveTitle(drawing.id)}
                                                className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0 cursor-pointer"
                                            >
                                                <Check size={13} />
                                            </button>
                                            <button 
                                                onClick={() => setEditingTargetId(null)}
                                                className="p-1 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors shrink-0 cursor-pointer"
                                            >
                                                <X size={13} />
                                            </button>
                                        </div>
                                    ) : (
                                        <span 
                                            className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate block font-semibold transition-colors"
                                            title="Click to view details • Double-click to edit title"
                                            onClick={() => {
                                                setSelectedDrawing(drawing);
                                                setActiveLogIndex(0);
                                                setInfoDrawerOpen(true);
                                            }}
                                            onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                if (canWrite) {
                                                    setEditingTargetId(drawing.id);
                                                    setEditingField('title');
                                                    setEditingTitle(drawing.title);
                                                }
                                            }}
                                        >
                                            {drawing.title}
                                        </span>
                                    )}
                                </td>

                                {/* REVISION CODE */}
                                <td className="px-3 py-2 text-center">
                                    <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40">
                                        R{drawing.latestRevision}
                                    </span>
                                </td>

                                {/* FILES */}
                                <td className="px-3 py-2 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        {drawing.latestDwgUrl && (
                                            <div className="flex items-center bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 rounded-lg text-[10px] font-bold text-blue-600 dark:text-blue-300 space-x-1 shadow-2xs">
                                                <span>DWG</span>
                                                <button
                                                    onClick={() => handlePreviewDwg(drawing.latestDwgUrl, drawing.title)}
                                                    className="p-0.5 hover:text-blue-800 dark:hover:text-white rounded cursor-pointer transition-colors"
                                                    title="Open CAD Viewer"
                                                >
                                                    <Eye size={12} />
                                                </button>
                                                <a 
                                                    href={drawing.latestDwgUrl} 
                                                    download 
                                                    className="p-0.5 hover:text-blue-800 dark:hover:text-white rounded cursor-pointer transition-colors"
                                                    title="Download DWG"
                                                >
                                                    <Download size={12} />
                                                </a>
                                            </div>
                                        )}

                                        {drawing.latestPdfUrl && (
                                            <div className="flex items-center bg-purple-50/80 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60 px-2 py-0.5 rounded-lg text-[10px] font-bold text-purple-600 dark:text-purple-300 space-x-1 shadow-2xs">
                                                <span>PDF</span>
                                                <a 
                                                    href={drawing.latestPdfUrl} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="p-0.5 hover:text-purple-800 dark:hover:text-white rounded cursor-pointer transition-colors"
                                                    title="Open PDF"
                                                >
                                                    <Eye size={12} />
                                                </a>
                                                <a 
                                                    href={drawing.latestPdfUrl} 
                                                    download 
                                                    className="p-0.5 hover:text-purple-800 dark:hover:text-white rounded cursor-pointer transition-colors"
                                                    title="Download PDF"
                                                >
                                                    <Download size={12} />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </td>

                                {/* REMARKS CELL (Double-click inline editing) */}
                                <td className="px-3 py-2 text-gray-500 text-[11px]">
                                    {isEditingThisDesc ? (
                                        <div className="flex items-center gap-1.5 w-full max-w-sm">
                                            <input
                                                type="text"
                                                autoFocus
                                                value={editingDescription}
                                                onChange={e => setEditingDescription(e.target.value)}
                                                onFocus={e => e.target.select()}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleSaveDescription(drawing.id);
                                                    if (e.key === 'Escape') setEditingTargetId(null);
                                                }}
                                                className="bg-white dark:bg-[#161b22] border border-blue-500 rounded-md px-2.5 py-1 text-xs text-gray-900 dark:text-white outline-none w-full shadow-xs"
                                            />
                                            <button 
                                                onClick={() => handleSaveDescription(drawing.id)}
                                                className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0 cursor-pointer"
                                            >
                                                <Check size={13} />
                                            </button>
                                            <button 
                                                onClick={() => setEditingTargetId(null)}
                                                className="p-1 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors shrink-0 cursor-pointer"
                                            >
                                                <X size={13} />
                                            </button>
                                        </div>
                                    ) : (
                                        <span
                                            className={`truncate block ${canWrite ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
                                            title="Double-click to edit remarks"
                                            onDoubleClick={() => {
                                                if (canWrite) {
                                                    setEditingTargetId(drawing.id);
                                                    setEditingField('description');
                                                    setEditingDescription(drawing.latestDescription || '');
                                                }
                                            }}
                                        >
                                            {drawing.latestDescription || '-'}
                                        </span>
                                    )}
                                </td>

                                {/* ROW ACTIONS */}
                                <td className="px-3 py-2 text-right">
                                    <div className="flex items-center justify-end space-x-1">
                                        <button
                                            onClick={() => {
                                                setSelectedDrawing(drawing);
                                                setActiveLogIndex(0);
                                                setInfoDrawerOpen(true);
                                            }}
                                            className="p-1 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer"
                                            title="View Details & Revision History"
                                        >
                                            <Info size={13} />
                                        </button>
                                        {canWrite && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setSelectedDrawingForRevision(drawing);
                                                        setAddDrawerOpen(true);
                                                    }}
                                                    className="p-1 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer"
                                                    title="Upload New Revision"
                                                >
                                                    <Upload size={13} />
                                                </button>
                                                <button
                                                    onClick={() => setDrawingToDelete(drawing)}
                                                    className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
                                                    title="Delete Drawing"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </Reorder.Item>
                        );
                    })}
                </Reorder.Group>
            </table>
        </div>
    );

    const renderPlannedTable = () => (
        <div className="overflow-x-auto w-full">
            <table className="w-full text-xs text-left border-collapse bg-white dark:bg-[#0d1117] min-w-[800px]">
                <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-gh-border font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                        <th className="px-3 py-2.5 w-14">SR</th>
                        <th className="px-3 py-2.5 min-w-[240px]">PLANNED DRAWING ITEM</th>
                        <th className="px-3 py-2.5 w-32">TARGET DATE</th>
                        <th className="px-3 py-2.5 w-32">RECEIVED DATE</th>
                        <th className="px-3 py-2.5 w-32">STATUS</th>
                        <th className="px-3 py-2.5 min-w-[200px]">REMARKS</th>
                        {canWrite && <th className="px-3 py-2.5 w-16 text-right">ACTIONS</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gh-border/50">
                    {plannedDrawings.map((drawing, idx) => (
                        <tr key={drawing.id} className="hover:bg-blue-50/30 dark:hover:bg-gh-hover/60 border-b border-gray-100 dark:border-gh-border/30 h-[42px] transition-colors">
                            <td className="px-3 py-2 font-mono text-gray-400">{String(idx + 1).padStart(2, '0')}</td>
                            <td className="px-3 py-2 text-gray-900 dark:text-gray-200 font-semibold">{drawing.name}</td>
                            <td className="px-3 py-2 text-gray-500">{drawing.plannedDate}</td>
                            <td className="px-3 py-2 text-gray-500">{drawing.receivedDate}</td>
                            <td className="px-3 py-1.5">
                                <div className="w-32">
                                    <CustomSelect
                                        options={[
                                            { label: 'In Review', value: 'In Review' },
                                            { label: 'Completed', value: 'Completed' },
                                            { label: 'Pending', value: 'Pending' }
                                        ]}
                                        value={drawing.status}
                                        onChange={e => {
                                            const newStatus = e.target.value;
                                            setPlannedDrawings(prev => prev.map(p => p.id === drawing.id ? {
                                                ...p,
                                                status: newStatus,
                                                receivedDate: newStatus === 'Completed' ? new Date().toLocaleDateString('en-GB') : 'Pending'
                                            } : p));
                                            toast.success(`Status updated to ${newStatus}`);
                                        }}
                                    />
                                </div>
                            </td>
                            <td className="px-3 py-2 text-gray-500 text-[11px]">{drawing.remarks}</td>
                            {canWrite && (
                                <td className="px-3 py-2 text-right">
                                    <button
                                        onClick={() => setPlannedToDelete(drawing)}
                                        className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
                                        title="Delete Item"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] transition-colors font-sans text-left relative overflow-hidden">
            
            {/* Category Header & Metrics Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gh-border bg-[#f9fafb] dark:bg-gh-bg shrink-0">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack} 
                        className="p-1.5 rounded-lg border border-gray-200 dark:border-gh-border hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-all cursor-pointer"
                        title="Back to Categories"
                    >
                        <ArrowLeft size={15} />
                    </button>
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">{category.name}</h2>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Drawing Archive Section</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-2xs">
                        {drawings.length} Blueprints
                    </span>
                    <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800/40 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 shadow-2xs">
                        {dwgCount} DWG CAD
                    </span>
                    <span className="px-2.5 py-1 bg-purple-50 dark:bg-purple-950/60 border border-purple-200/50 dark:border-purple-800/40 rounded-lg text-xs font-semibold text-purple-600 dark:text-purple-400 shadow-2xs">
                        {pdfCount} PDF Docs
                    </span>
                </div>
            </div>

            {/* Tab Switcher & Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gh-border bg-white dark:bg-[#0d1117] gap-3 shrink-0">
                
                {/* Tabs */}
                <div className="flex items-center bg-gray-100 dark:bg-[#161b22] p-0.5 rounded-lg border border-gray-200 dark:border-gh-border">
                    <button
                        onClick={() => setActiveTab('management')}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${activeTab === 'management' ? 'bg-white dark:bg-[#21262d] text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        <span>Drawing Management</span>
                        <span className="bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded-md text-[10px] font-bold">
                            {drawings.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('planned')}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${activeTab === 'planned' ? 'bg-white dark:bg-[#21262d] text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        <span>Planned vs Achieved</span>
                        <span className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1.5 py-0.2 rounded-md text-[10px] font-bold">
                            {plannedDrawings.length}
                        </span>
                    </button>
                </div>

                {/* Search & Actions */}
                <div className="flex items-center gap-3">
                    {activeTab === 'management' && (
                        <div className="relative min-w-[220px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search by blueprint title..."
                                className="w-full pl-9 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-lg outline-none focus:border-blue-500 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    )}
                    {canWrite && (
                        <button 
                            onClick={() => {
                                if (activeTab === 'management') {
                                    setSelectedDrawingForRevision(null);
                                    setAddDrawerOpen(true);
                                    setFileType('dwg');
                                    setDwgFile(null);
                                    setPdfFile(null);
                                } else {
                                    setNewPlannedDrawerOpen(true);
                                }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center shadow-xs cursor-pointer active:scale-95"
                        >
                            <Plus size={14} className="mr-1" />
                            <span>{activeTab === 'management' ? 'Add Record' : 'Schedule Item'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-[#f9fafb] dark:bg-gh-bg">
                {loading ? (
                    <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-400">
                        <Loader2 className="animate-spin mb-2.5 text-blue-500" size={24} />
                        <span className="text-xs font-semibold">Loading drawings...</span>
                    </div>
                ) : activeTab === 'management' ? (
                    drawings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-gray-200 dark:border-gh-border rounded-lg m-6 p-8 bg-white dark:bg-[#0d1117]">
                            <FileText className="text-gray-300 dark:text-gray-600 mb-3" size={44} />
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 text-xs">No drawings uploaded yet</h4>
                            <p className="text-[11px] text-gray-400 mt-1">Click 'Add Record' to upload DWG or PDF blueprints.</p>
                        </div>
                    ) : renderManagementTable()
                ) : renderPlannedTable()}
            </div>

            {/* ADD RECORD & REVISION UPLOAD DRAWER */}
            <AnimatePresence>
                {addDrawerOpen && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-xs" 
                            onClick={() => setAddDrawerOpen(false)}
                        />
                        <motion.div 
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                            className="fixed top-0 right-0 h-full w-full max-w-[440px] z-[151] bg-white dark:bg-[#161b22] shadow-2xl border-l border-gray-200 dark:border-gh-border flex flex-col text-left"
                        >
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-gh-border flex items-center justify-between bg-gray-50/50 dark:bg-[#0d1117]">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                        <Upload size={16} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                            {selectedDrawingForRevision ? `Upload Revision: ${selectedDrawingForRevision.title}` : 'Add New Drawing'}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {selectedDrawingForRevision ? 'Increments version and stores historical files' : 'Create drawing record with R1 revision'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setAddDrawerOpen(false)} className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer">
                                    <X size={16} />
                                </button>
                            </div>

                            <form onSubmit={handleUploadSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-bold mb-1.5 uppercase text-[10px]">Drawing Title *</label>
                                    {selectedDrawingForRevision ? (
                                        <input
                                            type="text"
                                            disabled
                                            value={selectedDrawingForRevision.title}
                                            className="w-full bg-gray-100 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs font-bold text-gray-500 cursor-not-allowed outline-none"
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            required
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            placeholder="e.g. Structural Foundation Layout..."
                                            className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500"
                                        />
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-gray-500 dark:text-gray-400 font-bold mb-1.5 uppercase text-[10px]">Revision Code</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={selectedDrawingForRevision ? `R${selectedDrawingForRevision.latestRevision + 1}` : 'R1'}
                                            className="w-full bg-gray-100 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs text-blue-600 font-mono font-bold cursor-not-allowed outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-500 dark:text-gray-400 font-bold mb-1.5 uppercase text-[10px]">Upload Date</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={new Date().toLocaleDateString('en-GB')}
                                            className="w-full bg-gray-100 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs text-gray-400 cursor-not-allowed outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-bold mb-1.5 uppercase text-[10px]">File Type *</label>
                                    <div className="flex gap-2 p-1 bg-gray-100 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg">
                                        <button
                                            type="button"
                                            onClick={() => { setFileType('dwg'); setPdfFile(null); }}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${fileType === 'dwg'
                                                ? 'bg-white dark:bg-[#21262d] text-blue-600 dark:text-blue-400 shadow-xs'
                                                : 'text-gray-600 dark:text-gray-400'
                                            }`}
                                        >
                                            DWG CAD File
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setFileType('pdf'); setDwgFile(null); }}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${fileType === 'pdf'
                                                ? 'bg-white dark:bg-[#21262d] text-blue-600 dark:text-blue-400 shadow-xs'
                                                : 'text-gray-600 dark:text-gray-400'
                                            }`}
                                        >
                                            PDF Document
                                        </button>
                                    </div>
                                </div>

                                {fileType === 'dwg' ? (
                                    <div>
                                        <label className="block text-gray-500 dark:text-gray-400 font-bold mb-1.5 uppercase text-[10px]">DWG File (.dwg, .dxf) *</label>
                                        <div className="relative border-2 border-dashed border-gray-200 dark:border-gh-border rounded-lg p-5 bg-gray-50 dark:bg-[#0d1117] flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500/50 transition-colors">
                                            <input
                                                type="file"
                                                required={!selectedDrawingForRevision || fileType === 'dwg'}
                                                accept=".dwg,.dxf"
                                                onChange={e => setDwgFile(e.target.files[0] || null)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <Upload size={22} className="text-gray-400 mb-1" />
                                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                                                {dwgFile ? dwgFile.name : 'Select DWG/DXF file'}
                                            </span>
                                            <span className="text-[10px] text-gray-400 mt-0.5">Supports AutoCAD blueprints</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-gray-500 dark:text-gray-400 font-bold mb-1.5 uppercase text-[10px]">PDF File (.pdf) *</label>
                                        <div className="relative border-2 border-dashed border-gray-200 dark:border-gh-border rounded-lg p-5 bg-gray-50 dark:bg-[#0d1117] flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500/50 transition-colors">
                                            <input
                                                type="file"
                                                required={!selectedDrawingForRevision || fileType === 'pdf'}
                                                accept=".pdf"
                                                onChange={e => setPdfFile(e.target.files[0] || null)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <Upload size={22} className="text-gray-400 mb-1" />
                                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                                                {pdfFile ? pdfFile.name : 'Select PDF document'}
                                            </span>
                                            <span className="text-[10px] text-gray-400 mt-0.5">Supports high-res PDF blueprints</span>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-bold mb-1.5 uppercase text-[10px]">Notes / Change Summary</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Enter details about this revision..."
                                        rows={3}
                                        className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500 resize-none"
                                    />
                                </div>

                                <div className="pt-4 border-t border-gray-200 dark:border-gh-border flex justify-end space-x-2">
                                    <button
                                        type="button"
                                        onClick={() => setAddDrawerOpen(false)}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-1 cursor-pointer active:scale-95"
                                    >
                                        {submitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                        <span>{selectedDrawingForRevision ? 'Upload Revision' : 'Create Record'}</span>
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* NEW PLANNED ITEM DRAWER */}
            <AnimatePresence>
                {newPlannedDrawerOpen && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-xs" 
                            onClick={() => setNewPlannedDrawerOpen(false)}
                        />
                        <motion.div 
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                            className="fixed top-0 right-0 h-full w-full max-w-[420px] z-[151] bg-white dark:bg-[#161b22] shadow-2xl border-l border-gray-200 dark:border-gh-border flex flex-col text-left"
                        >
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-gh-border flex items-center justify-between bg-gray-50/50 dark:bg-[#0d1117]">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                        <Plus size={16} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Schedule Planned Drawing</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Track target delivery dates & milestone status</p>
                                    </div>
                                </div>
                                <button onClick={() => setNewPlannedDrawerOpen(false)} className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer">
                                    <X size={16} />
                                </button>
                            </div>

                            <form onSubmit={handleAddPlannedDrawing} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-bold mb-1.5 uppercase text-[10px]">Drawing Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={newPlannedName}
                                        onChange={e => setNewPlannedName(e.target.value)}
                                        placeholder="e.g. Electrical Main Substation Layout..."
                                        className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-bold mb-1.5 uppercase text-[10px]">Target Planned Date</label>
                                    <input
                                        type="date"
                                        value={newPlannedDate}
                                        onChange={e => setNewPlannedDate(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-bold mb-1.5 uppercase text-[10px]">Initial Status</label>
                                    <CustomSelect
                                        options={[
                                            { label: 'In Review', value: 'In Review' },
                                            { label: 'Completed', value: 'Completed' },
                                            { label: 'Pending', value: 'Pending' }
                                        ]}
                                        value={newPlannedStatus}
                                        onChange={e => setNewPlannedStatus(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-bold mb-1.5 uppercase text-[10px]">Remarks / Notes</label>
                                    <textarea
                                        value={newPlannedRemarks}
                                        onChange={e => setNewPlannedRemarks(e.target.value)}
                                        placeholder="Add any specific requirements..."
                                        rows={3}
                                        className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500 resize-none"
                                    />
                                </div>

                                <div className="pt-4 border-t border-gray-200 dark:border-gh-border flex justify-end space-x-2">
                                    <button
                                        type="button"
                                        onClick={() => setNewPlannedDrawerOpen(false)}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-1 cursor-pointer active:scale-95"
                                    >
                                        <Check size={13} />
                                        <span>Add Item</span>
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* VERSION CONTROL & ACTIONS POPUP DRAWER */}
            <AnimatePresence>
                {infoDrawerOpen && selectedDrawing && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-xs" 
                            onClick={() => setInfoDrawerOpen(false)}
                        />
                        <motion.div 
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                            className="fixed top-0 right-0 h-full w-full max-w-[450px] z-[151] bg-white dark:bg-[#161b22] shadow-2xl border-l border-gray-200 dark:border-gh-border flex flex-col text-left"
                        >
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-gh-border flex items-center justify-between bg-gray-50/50 dark:bg-[#0d1117]">
                                <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-500">
                                        <History size={16} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Drawing Details & Revisions</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Complete audit log & CAD archives</p>
                                    </div>
                                </div>
                                <button onClick={() => setInfoDrawerOpen(false)} className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                                {(() => {
                                    const revisions = selectedDrawing.revisions || [];
                                    const activeLog = revisions[activeLogIndex] || revisions[0];
                                    if (!activeLog) return null;

                                    return (
                                        <>
                                            {/* Action Bar Inside Popup Drawer */}
                                            {canWrite && (
                                                <div className="p-3 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg flex items-center justify-between gap-2 shadow-2xs">
                                                    <button
                                                        onClick={() => {
                                                            setInfoDrawerOpen(false);
                                                            setSelectedDrawingForRevision(selectedDrawing);
                                                            setAddDrawerOpen(true);
                                                        }}
                                                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1 cursor-pointer active:scale-95"
                                                    >
                                                        <Upload size={13} />
                                                        <span>Upload Revision</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setDrawerTitleInput(selectedDrawing.title);
                                                            setIsDrawerEditingTitle(true);
                                                        }}
                                                        className="py-1.5 px-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                                                    >
                                                        <Edit2 size={13} />
                                                        <span>Rename</span>
                                                    </button>
                                                    <button
                                                         onClick={() => setDrawingToDelete(selectedDrawing)}
                                                         className="py-1.5 px-3 bg-red-100 dark:bg-red-950/60 hover:bg-red-200 dark:hover:bg-red-900 text-red-600 dark:text-red-300 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                                                    >
                                                        <Trash2 size={13} />
                                                        <span>Delete</span>
                                                    </button>
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-gray-500 dark:text-gray-400 font-bold mb-1.5 uppercase text-[10px]">
                                                    Viewing Revision {activeLog.rev}
                                                </label>
                                                <div className="p-4 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg space-y-2 shadow-2xs">
                                                    <div className="flex items-center justify-between gap-2">
                                                        {isDrawerEditingTitle ? (
                                                            <div className="flex items-center gap-1.5 flex-1">
                                                                <input
                                                                    type="text"
                                                                    autoFocus
                                                                    value={drawerTitleInput}
                                                                    onChange={e => setDrawerTitleInput(e.target.value)}
                                                                    onFocus={e => e.target.select()}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') {
                                                                            if (drawerTitleInput.trim()) {
                                                                                handleSaveTitle(selectedDrawing.id, drawerTitleInput.trim());
                                                                                setSelectedDrawing(prev => ({ ...prev, title: drawerTitleInput.trim() }));
                                                                                setIsDrawerEditingTitle(false);
                                                                            }
                                                                        }
                                                                        if (e.key === 'Escape') setIsDrawerEditingTitle(false);
                                                                    }}
                                                                    className="bg-white dark:bg-[#161b22] border border-blue-500 rounded-md px-2.5 py-1 text-xs text-gray-900 dark:text-white outline-none w-full shadow-xs font-semibold"
                                                                />
                                                                <button 
                                                                    onClick={() => {
                                                                        if (drawerTitleInput.trim()) {
                                                                            handleSaveTitle(selectedDrawing.id, drawerTitleInput.trim());
                                                                            setSelectedDrawing(prev => ({ ...prev, title: drawerTitleInput.trim() }));
                                                                            setIsDrawerEditingTitle(false);
                                                                        }
                                                                    }}
                                                                    className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0 cursor-pointer"
                                                                    title="Save Title (Enter)"
                                                                >
                                                                    <Check size={13} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => setIsDrawerEditingTitle(false)}
                                                                    className="p-1 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors shrink-0 cursor-pointer"
                                                                    title="Cancel (Esc)"
                                                                >
                                                                    <X size={13} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span 
                                                                className="font-bold text-gray-900 dark:text-white text-sm truncate flex-1 cursor-pointer hover:text-blue-500"
                                                                title="Double-click to rename"
                                                                onDoubleClick={() => {
                                                                    if (canWrite) {
                                                                        setDrawerTitleInput(selectedDrawing.title);
                                                                        setIsDrawerEditingTitle(true);
                                                                    }
                                                                }}
                                                            >
                                                                {selectedDrawing.title}
                                                            </span>
                                                        )}
                                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-mono font-bold rounded-md text-[10px] shrink-0">
                                                            {activeLog.rev} {activeLogIndex === 0 ? '(Latest)' : '(Archived)'}
                                                        </span>
                                                    </div>

                                                    <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-1 pt-1">
                                                        <p>Uploaded: {new Date(activeLog.uploadedAt).toLocaleString('en-GB')}</p>
                                                        <p>Author: {activeLog.uploaderName || 'System User'}</p>
                                                        <p>Remarks: {activeLog.description || '-'}</p>
                                                    </div>

                                                    <div className="pt-2 flex gap-2">
                                                        {activeLog.dwgUrl && (
                                                            <button
                                                                onClick={() => handlePreviewDwg(activeLog.dwgUrl, selectedDrawing.title)}
                                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center space-x-1 cursor-pointer transition-colors active:scale-95 shadow-2xs"
                                                            >
                                                                <Eye size={13} />
                                                                <span>View DWG CAD</span>
                                                            </button>
                                                        )}
                                                        {activeLog.pdfUrl && (
                                                            <a
                                                                href={activeLog.pdfUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold flex items-center space-x-1 cursor-pointer transition-colors active:scale-95 shadow-2xs"
                                                            >
                                                                <Eye size={13} />
                                                                <span>View PDF</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-gray-500 dark:text-gray-400 font-bold mb-2 uppercase text-[10px]">
                                                    Revision History Timeline
                                                </label>
                                                <div className="space-y-3">
                                                    {revisions.map((log, i) => (
                                                        <div
                                                            key={log.id || i}
                                                            onClick={() => setActiveLogIndex(i)}
                                                            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${activeLogIndex === i ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-900/20 shadow-xs' : 'border-gray-200 dark:border-gh-border bg-white dark:bg-[#0d1117] hover:border-gray-300'}`}
                                                        >
                                                            <div className="flex items-center justify-between font-semibold text-xs mb-1">
                                                                <span className={i === 0 ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-900 dark:text-white'}>
                                                                    {log.rev} {i === 0 && '(Latest)'}
                                                                </span>
                                                                <span className="text-[10px] text-gray-400">
                                                                    {new Date(log.uploadedAt).toLocaleDateString('en-GB')}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-gray-600 dark:text-gray-400">{log.description || 'No notes specified.'}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            <div className="p-4 border-t border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-[#0d1117] flex justify-end">
                                <button
                                    onClick={() => setInfoDrawerOpen(false)}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer active:scale-95"
                                >
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Confirm Delete Drawing Modal */}
            <ConfirmModal
                isOpen={!!drawingToDelete}
                onClose={() => setDrawingToDelete(null)}
                onConfirm={handleConfirmDeleteDrawing}
                title="Delete Blueprint Record?"
                message={
                    <span>
                        Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{drawingToDelete?.title}</strong>? All revision history (R1, R2...) and uploaded CAD/PDF files will be permanently erased.
                    </span>
                }
                confirmText="Delete Blueprint"
                cancelText="Cancel"
                variant="danger"
                isLoading={deleteLoading}
            />

            {/* Confirm Delete Planned Item Modal */}
            <ConfirmModal
                isOpen={!!plannedToDelete}
                onClose={() => setPlannedToDelete(null)}
                onConfirm={handleConfirmDeletePlanned}
                title="Remove Scheduled Item?"
                message={
                    <span>
                        Are you sure you want to remove <strong className="text-gray-900 dark:text-white">{plannedToDelete?.name}</strong> from the planned schedule?
                    </span>
                }
                confirmText="Remove Item"
                cancelText="Cancel"
                variant="danger"
            />

        </div>
    );
};

export default DrawingCategoryDetail;
