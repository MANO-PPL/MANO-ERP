import React, { useEffect, useState } from 'react';
import { 
    Plus, GripVertical, ChevronDown, Check, X, Info, Edit2, Trash2, 
    Clock, User, FileText, History, Loader2, Download, Eye, Upload, Search
} from 'lucide-react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-toastify';

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

    // Toolbar Filters
    const [searchQuery, setSearchQuery] = useState('');

    // Planned vs Achieved State
    const [plannedDrawings, setPlannedDrawings] = useState([
        { id: 'p1', name: 'Architectural Layout Blueprint', plannedDate: '2026-01-26', receivedDate: '2026-01-27', status: 'In Review', remarks: 'Under engineer validation', priority: 'High' },
        { id: 'p2', name: 'Plumbing & Drainage Schematics', plannedDate: '2025-12-23', receivedDate: '2025-12-23', status: 'Completed', remarks: 'Approved by PM', priority: 'Low' },
        { id: 'p3', name: 'HVAC Duct & Ventilation Plan', plannedDate: '2026-02-01', receivedDate: '2026-02-09', status: 'In Review', remarks: 'Awaiting MEP team signoff', priority: 'High' },
        { id: 'p4', name: 'Fire Exit & Safety Blueprint', plannedDate: '2025-12-24', receivedDate: '2025-12-31', status: 'In Review', remarks: 'Pending safety clearance', priority: 'Medium' }
    ]);

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
                toast.success('Title updated');
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
                toast.success('Remarks updated');
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

    // Delete Drawing
    const handleDeleteDrawing = async (drawingGroupId) => {
        const proceed = window.confirm(
            "Permanently delete this drawing? All historical revisions and attached files will be deleted."
        );
        if (!proceed) return;

        try {
            const response = await fetch(`/api/projects/${projectId}/drawings/categories/${category.id}/drawings/${drawingGroupId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                toast.success('Drawing deleted');
                fetchDrawings();
                if (selectedDrawing && selectedDrawing.id === drawingGroupId) {
                    setInfoDrawerOpen(false);
                }
            } else {
                toast.error(data.message || 'Failed to delete drawing');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error deleting drawing');
        }
    };

    const handlePreviewDwg = (url, name) => {
        const targetUrl = `/drawing-viewer?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
        window.open(targetUrl, '_blank');
    };

    const filteredDrawings = drawings.filter(d => 
        (d.title || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderManagementTable = () => (
        <div className="overflow-x-auto w-full">
            <table className="w-full text-xs text-left border-collapse bg-white dark:bg-[#0d1117] min-w-[750px]">
                <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-gh-border font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                        <th className="px-2.5 py-2 w-8 text-center"></th>
                        <th className="px-3 py-2 w-14">SR</th>
                        <th className="px-3 py-2 w-20">CODE</th>
                        <th className="px-3 py-2 w-24">DATE</th>
                        <th className="px-3 py-2 min-w-[220px]">DRAWING TITLE</th>
                        <th className="px-3 py-2 w-16 text-center">REV</th>
                        <th className="px-3 py-2 w-44 text-center">FILES</th>
                        <th className="px-3 py-2 min-w-[180px]">REMARKS</th>
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
                                className="group/row hover:bg-blue-50/20 dark:hover:bg-gh-hover/60 transition-colors border-b border-gray-100 dark:border-gh-border/30 h-[40px]"
                            >
                                <td className="px-2.5 py-1.5 text-center text-gray-300 dark:text-gray-600 group-hover/row:text-blue-500 cursor-grab active:cursor-grabbing">
                                    <GripVertical size={14} className="mx-auto" />
                                </td>
                                <td className="px-3 py-1.5 font-mono text-[11px] text-gray-500">
                                    {String(idx + 1).padStart(2, '0')}
                                </td>
                                <td className="px-3 py-1.5 font-mono font-bold text-gray-900 dark:text-white">
                                    {drawingNum}
                                </td>
                                <td className="px-3 py-1.5 text-gray-500 text-[11px]">
                                    {dateStr}
                                </td>

                                {/* DRAWING TITLE CELL (Click for Popup, Double-click for inline edit) */}
                                <td className="px-3 py-1.5 text-gray-900 dark:text-gray-200 font-medium">
                                    {isEditingThisTitle ? (
                                        <div className="flex items-center gap-1.5 w-full max-w-sm">
                                            <input
                                                type="text"
                                                autoFocus
                                                value={editingTitle}
                                                onChange={e => setEditingTitle(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleSaveTitle(drawing.id);
                                                    if (e.key === 'Escape') setEditingTargetId(null);
                                                }}
                                                className="bg-white dark:bg-[#161b22] border border-blue-500 rounded px-2 py-0.5 text-xs text-gray-900 dark:text-white outline-none w-full shadow-xs"
                                            />
                                            <button 
                                                onClick={() => handleSaveTitle(drawing.id)}
                                                className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0 cursor-pointer"
                                            >
                                                <Check size={13} />
                                            </button>
                                            <button 
                                                onClick={() => setEditingTargetId(null)}
                                                className="p-1 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors shrink-0 cursor-pointer"
                                            >
                                                <X size={13} />
                                            </button>
                                        </div>
                                    ) : (
                                        <span 
                                            className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate block font-semibold transition-colors"
                                            title="Click to view Popup Drawer • Double-click to edit Title"
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
                                <td className="px-3 py-1.5 text-center font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                                    R{drawing.latestRevision}
                                </td>

                                {/* FILES */}
                                <td className="px-3 py-1.5 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        {drawing.latestDwgUrl && (
                                            <div className="flex items-center bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded text-[10px] font-bold text-blue-600 dark:text-blue-300 space-x-1">
                                                <span>DWG</span>
                                                <button
                                                    onClick={() => handlePreviewDwg(drawing.latestDwgUrl, drawing.title)}
                                                    className="p-0.5 hover:text-blue-800 dark:hover:text-white rounded"
                                                    title="View DWG File"
                                                >
                                                    <Eye size={12} />
                                                </button>
                                                <a 
                                                    href={drawing.latestDwgUrl} 
                                                    download 
                                                    className="p-0.5 hover:text-blue-800 dark:hover:text-white rounded"
                                                    title="Download DWG"
                                                >
                                                    <Download size={12} />
                                                </a>
                                            </div>
                                        )}

                                        {drawing.latestPdfUrl && (
                                            <div className="flex items-center bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded text-[10px] font-bold text-purple-600 dark:text-purple-300 space-x-1">
                                                <span>PDF</span>
                                                <a 
                                                    href={drawing.latestPdfUrl} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="p-0.5 hover:text-purple-800 dark:hover:text-white rounded"
                                                    title="Open PDF"
                                                >
                                                    <Eye size={12} />
                                                </a>
                                                <a 
                                                    href={drawing.latestPdfUrl} 
                                                    download 
                                                    className="p-0.5 hover:text-purple-800 dark:hover:text-white rounded"
                                                    title="Download PDF"
                                                >
                                                    <Download size={12} />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </td>

                                {/* REMARKS CELL (Double-click inline editing) */}
                                <td className="px-3 py-1.5 text-gray-500 text-[11px]">
                                    {isEditingThisDesc ? (
                                        <div className="flex items-center gap-1.5 w-full max-w-sm">
                                            <input
                                                type="text"
                                                autoFocus
                                                value={editingDescription}
                                                onChange={e => setEditingDescription(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleSaveDescription(drawing.id);
                                                    if (e.key === 'Escape') setEditingTargetId(null);
                                                }}
                                                className="bg-white dark:bg-[#161b22] border border-blue-500 rounded px-2 py-0.5 text-xs text-gray-900 dark:text-white outline-none w-full shadow-xs"
                                            />
                                            <button 
                                                onClick={() => handleSaveDescription(drawing.id)}
                                                className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0 cursor-pointer"
                                            >
                                                <Check size={13} />
                                            </button>
                                            <button 
                                                onClick={() => setEditingTargetId(null)}
                                                className="p-1 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors shrink-0 cursor-pointer"
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
                        <th className="px-3 py-2 w-14">SR</th>
                        <th className="px-3 py-2 min-w-[220px]">DRAWING NAME</th>
                        <th className="px-3 py-2 w-32">PLANNED DATE</th>
                        <th className="px-3 py-2 w-32">RECEIVED DATE</th>
                        <th className="px-3 py-2 w-32">STATUS</th>
                        <th className="px-3 py-2 min-w-[180px]">REMARKS</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gh-border/50">
                    {plannedDrawings.map((drawing, idx) => (
                        <tr key={drawing.id} className="hover:bg-blue-50/20 dark:hover:bg-gh-hover/60 border-b border-gray-100 dark:border-gh-border/30 h-[40px] transition-colors">
                            <td className="px-3 py-2 font-mono text-gray-500">{String(idx + 1).padStart(2, '0')}</td>
                            <td className="px-3 py-2 text-gray-900 dark:text-gray-200 font-semibold">{drawing.name}</td>
                            <td className="px-3 py-2 text-gray-500">{drawing.plannedDate}</td>
                            <td className="px-3 py-2 text-gray-500">{drawing.receivedDate}</td>
                            <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${drawing.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'}`}>
                                    {drawing.status}
                                </span>
                            </td>
                            <td className="px-3 py-2 text-gray-500 text-[11px]">{drawing.remarks}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] transition-colors font-sans text-left relative overflow-hidden">
            
            {/* Category Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gh-border bg-[#f9fafb] dark:bg-gh-bg shrink-0">
                <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">{category.name}</h2>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{drawings.length} Drawings in Archive</p>
                </div>
            </div>

            {/* Tab Switcher & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gh-border bg-white dark:bg-[#0d1117] gap-3 shrink-0">
                
                {/* Tabs */}
                <div className="flex items-center bg-gray-100 dark:bg-[#161b22] p-0.5 rounded-lg border border-gray-200 dark:border-gh-border">
                    <button
                        onClick={() => setActiveTab('management')}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'management' ? 'bg-white dark:bg-[#21262d] text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        <span>Drawing Management</span>
                        <span className="bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                            {drawings.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('planned')}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'planned' ? 'bg-white dark:bg-[#21262d] text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        <span>Planned vs Achieved</span>
                        <span className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                            {plannedDrawings.length}
                        </span>
                    </button>
                </div>

                {/* Search & Actions */}
                <div className="flex items-center gap-3">
                    {activeTab === 'management' && (
                        <div className="relative min-w-[200px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search by title..."
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
                                setSelectedDrawingForRevision(null);
                                setAddDrawerOpen(true);
                                setFileType('dwg');
                                setDwgFile(null);
                                setPdfFile(null);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center shadow-xs cursor-pointer"
                        >
                            <Plus size={14} className="mr-1" />
                            <span>Add Record</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-[#f9fafb] dark:bg-gh-bg">
                {activeTab === 'management' ? (
                    drawings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-gray-200 dark:border-gh-border rounded-xl m-6 p-8 bg-white dark:bg-[#0d1117]">
                            <FileText className="text-gray-300 dark:text-gray-600 mb-3" size={44} />
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 text-xs">No drawings uploaded yet</h4>
                            <p className="text-[11px] text-gray-400 mt-1">Click 'Add Record' to upload DWG or PDF blueprints.</p>
                        </div>
                    ) : renderManagementTable()
                ) : renderPlannedTable()}
            </div>

            {/* ADD RECORD & REVISION UPLOAD DRAWER */}
            {addDrawerOpen && (
                <div className="fixed inset-0 z-[150] overflow-hidden">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity anim-fade-in" onClick={() => setAddDrawerOpen(false)}></div>

                    <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
                        <div className="w-screen max-w-md bg-white dark:bg-[#161b22] shadow-2xl border-l border-gray-200 dark:border-gh-border flex flex-col text-left">
                            
                            <div className="px-5 py-4 border-b border-gray-200 dark:border-gh-border flex items-center justify-between bg-gray-50 dark:bg-[#0d1117]">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                        {selectedDrawingForRevision ? `Upload Revision: ${selectedDrawingForRevision.title}` : 'Add New Drawing'}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {selectedDrawingForRevision ? 'Increments version and stores historical DWG/PDF' : 'Create drawing record with R1 revision'}
                                    </p>
                                </div>
                                <button onClick={() => setAddDrawerOpen(false)} className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                    <X size={16} />
                                </button>
                            </div>

                            <form onSubmit={handleUploadSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">Drawing Title *</label>
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
                                        <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">Revision Code</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={selectedDrawingForRevision ? `R${selectedDrawingForRevision.latestRevision + 1}` : 'R1'}
                                            className="w-full bg-gray-100 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs text-blue-600 font-mono font-bold cursor-not-allowed outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">Upload Date</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={new Date().toLocaleDateString('en-GB')}
                                            className="w-full bg-gray-100 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs text-gray-400 cursor-not-allowed outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">File Type *</label>
                                    <div className="flex gap-2 p-0.5 bg-gray-100 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg">
                                        <button
                                            type="button"
                                            onClick={() => { setFileType('dwg'); setPdfFile(null); }}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${fileType === 'dwg'
                                                ? 'bg-white dark:bg-[#21262d] text-blue-600 dark:text-blue-400 shadow-xs'
                                                : 'text-gray-600 dark:text-gray-400'
                                            }`}
                                        >
                                            DWG CAD File
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setFileType('pdf'); setDwgFile(null); }}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${fileType === 'pdf'
                                                ? 'bg-white dark:bg-[#21262d] text-blue-600 dark:text-blue-400 shadow-xs'
                                                : 'text-gray-600 dark:text-gray-400'
                                            }`}
                                        >
                                            PDF File
                                        </button>
                                    </div>
                                </div>

                                {fileType === 'dwg' ? (
                                    <div>
                                        <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">DWG File (.dwg, .dxf) *</label>
                                        <div className="relative border-2 border-dashed border-gray-200 dark:border-gh-border rounded-lg p-4 bg-gray-50 dark:bg-[#0d1117] flex flex-col items-center justify-center text-center cursor-pointer">
                                            <input
                                                type="file"
                                                required={!selectedDrawingForRevision || fileType === 'dwg'}
                                                accept=".dwg,.dxf"
                                                onChange={e => setDwgFile(e.target.files[0] || null)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <Upload size={20} className="text-gray-400 mb-1" />
                                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                                                {dwgFile ? dwgFile.name : 'Select DWG/DXF file'}
                                            </span>
                                            <span className="text-[10px] text-gray-400 mt-0.5">Max size: 25MB</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">PDF File (.pdf) *</label>
                                        <div className="relative border-2 border-dashed border-gray-200 dark:border-gh-border rounded-lg p-4 bg-gray-50 dark:bg-[#0d1117] flex flex-col items-center justify-center text-center cursor-pointer">
                                            <input
                                                type="file"
                                                required={!selectedDrawingForRevision || fileType === 'pdf'}
                                                accept=".pdf"
                                                onChange={e => setPdfFile(e.target.files[0] || null)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <Upload size={20} className="text-gray-400 mb-1" />
                                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                                                {pdfFile ? pdfFile.name : 'Select PDF file'}
                                            </span>
                                            <span className="text-[10px] text-gray-400 mt-0.5">Max size: 25MB</span>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">Notes / Change Summary</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Enter details about this revision..."
                                        rows={3}
                                        className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500 resize-none"
                                    />
                                </div>

                                <div className="pt-3 border-t border-gray-200 dark:border-gh-border flex justify-end space-x-2">
                                    <button
                                        type="button"
                                        onClick={() => setAddDrawerOpen(false)}
                                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-1"
                                    >
                                        {submitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                        <span>{selectedDrawingForRevision ? 'Upload Revision' : 'Create Record'}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* VERSION CONTROL & ACTIONS POPUP DRAWER */}
            {infoDrawerOpen && selectedDrawing && (
                <div className="fixed inset-0 z-[150] overflow-hidden">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity anim-fade-in" onClick={() => setInfoDrawerOpen(false)}></div>

                    <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
                        <div className="w-screen max-w-md bg-white dark:bg-[#161b22] shadow-2xl border-l border-gray-200 dark:border-gh-border flex flex-col text-left">
                            
                            <div className="px-5 py-4 border-b border-gray-200 dark:border-gh-border flex items-center justify-between bg-gray-50 dark:bg-[#0d1117]">
                                <div className="flex items-center space-x-2">
                                    <History size={16} className="text-blue-500" />
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Drawing Details & Revisions</h3>
                                </div>
                                <button onClick={() => setInfoDrawerOpen(false)} className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                                {(() => {
                                    const revisions = selectedDrawing.revisions || [];
                                    const activeLog = revisions[activeLogIndex] || revisions[0];
                                    if (!activeLog) return null;

                                    return (
                                        <>
                                            {/* Action Bar Inside Popup Drawer */}
                                            {canWrite && (
                                                <div className="p-3 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg flex items-center justify-between gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setInfoDrawerOpen(false);
                                                            setSelectedDrawingForRevision(selectedDrawing);
                                                            setAddDrawerOpen(true);
                                                        }}
                                                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1 cursor-pointer"
                                                    >
                                                        <Upload size={13} />
                                                        <span>Upload Revision</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const newTitle = prompt('Rename Drawing Title:', selectedDrawing.title);
                                                            if (newTitle && newTitle.trim()) {
                                                                handleSaveTitle(selectedDrawing.id, newTitle.trim());
                                                                setSelectedDrawing(prev => ({ ...prev, title: newTitle.trim() }));
                                                            }
                                                        }}
                                                        className="py-1.5 px-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                                                    >
                                                        <Edit2 size={13} />
                                                        <span>Rename</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteDrawing(selectedDrawing.id)}
                                                        className="py-1.5 px-3 bg-red-100 dark:bg-red-950/60 hover:bg-red-200 dark:hover:bg-red-900 text-red-600 dark:text-red-300 rounded-md text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                                                    >
                                                        <Trash2 size={13} />
                                                        <span>Delete</span>
                                                    </button>
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">
                                                    Viewing Revision {activeLog.rev}
                                                </label>
                                                <div className="p-4 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-gray-900 dark:text-white text-sm truncate">
                                                            {selectedDrawing.title}
                                                        </span>
                                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-mono font-bold rounded text-[10px]">
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
                                                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                                                            >
                                                                <Eye size={12} />
                                                                <span>View DWG</span>
                                                            </button>
                                                        )}
                                                        {activeLog.pdfUrl && (
                                                            <a
                                                                href={activeLog.pdfUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                                                            >
                                                                <Eye size={12} />
                                                                <span>View PDF</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-2 uppercase text-[10px]">
                                                    Revision History Timeline
                                                </label>
                                                <div className="space-y-3">
                                                    {revisions.map((log, i) => (
                                                        <div
                                                            key={log.id || i}
                                                            onClick={() => setActiveLogIndex(i)}
                                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${activeLogIndex === i ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gh-border bg-white dark:bg-[#0d1117] hover:border-gray-300'}`}
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

                            <div className="p-4 border-t border-gray-200 dark:border-gh-border bg-gray-50 dark:bg-[#0d1117] flex justify-end">
                                <button
                                    onClick={() => setInfoDrawerOpen(false)}
                                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                                >
                                    Done
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default DrawingCategoryDetail;
