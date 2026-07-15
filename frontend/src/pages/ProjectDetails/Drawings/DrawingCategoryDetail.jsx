import React, { useEffect, useState } from 'react';
import { 
    Plus, GripVertical, ChevronDown, Check, X, Info, Edit2, Trash2, 
    Clock, User, FileText, History, Loader2, Download, Eye, Upload 
} from 'lucide-react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';

const DrawingCategoryDetail = ({ category, projectId, onBack, setExtraBreadcrumbs, canWrite }) => {
    const [activeTab, setActiveTab] = useState('management'); // 'management' or 'planned'
    const [drawings, setDrawings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Editing states
    const [editingTargetId, setEditingTargetId] = useState(null); // ID of drawing being renamed inline
    const [editingTitle, setEditingTitle] = useState('');

    // Add Record Drawer States
    const [addDrawerOpen, setAddDrawerOpen] = useState(false);
    const [selectedDrawingForRevision, setSelectedDrawingForRevision] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [fileType, setFileType] = useState('dwg'); // 'dwg' or 'pdf'
    const [dwgFile, setDwgFile] = useState(null);
    const [pdfFile, setPdfFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Version Control Drawer States
    const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);
    const [selectedDrawing, setSelectedDrawing] = useState(null);
    const [activeLogIndex, setActiveLogIndex] = useState(0);

    // Toolbar Filters
    const [searchQuery, setSearchQuery] = useState('');

    // Mock State for Section 2: Drawing Planned vs Achieved
    const [plannedDrawings, setPlannedDrawings] = useState([
        { id: 'p1', name: 'NEW Architectural layout', plannedDate: '26/01/2026', receivedDate: '27/01/2026', status: 'In Review', remarks: 'Under validation', priority: 'High' },
        { id: 'p2', name: 'Plumbing schematics', plannedDate: '23/12/2025', receivedDate: '23/12/2025', status: 'Completed', remarks: 'Approved by PM', priority: 'Low' },
        { id: 'p3', name: 'HVAC Duct layout', plannedDate: '01/01/2028', receivedDate: '09/01/2026', status: 'In Review', remarks: 'Awaiting engineer remarks', priority: 'High' },
        { id: 'p4', name: 'Fire escape blueprint', plannedDate: '24/12/2025', receivedDate: '31/12/2025', status: 'In Review', remarks: 'Pending fire marshal review', priority: 'Medium' },
    ]);

    const categoryPrefix = category.name.trim().replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim().charAt(0).toUpperCase() || 'D';

    const fetchDrawings = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/projects/${projectId}/drawings/categories/${category.id}/drawings`);
            const data = await response.json();
            if (data.success) {
                setDrawings(data.drawings);
            } else {
                throw new Error(data.message || 'Failed to load drawings list');
            }
        } catch (e) {
            console.error(e);
            setError(e.message);
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
        // Optimistically update frontend state so serial numbers adjust instantly
        setDrawings(newOrderList);

        const payload = newOrderList.map((d, index) => ({
            id: d.id, // drawing group ID
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
                console.error('Failed to sync reorder on backend:', data.message);
                fetchDrawings(); // Revert on failure
            }
        } catch (e) {
            console.error('Error reordering drawings:', e);
            fetchDrawings();
        }
    };

    // Handle upload submit (create new or add revision)
    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;

        // Validation
        if (!selectedDrawingForRevision && !title.trim()) {
            alert('Drawing title is required.');
            return;
        }
        if (fileType === 'dwg' && !dwgFile) {
            alert('Please attach a DWG file.');
            return;
        }
        if (fileType === 'pdf' && !pdfFile) {
            alert('Please attach a PDF file.');
            return;
        }

        try {
            setSubmitting(true);
            const formData = new FormData();
            formData.append('categoryId', category.id);
            formData.append('description', description);

            if (selectedDrawingForRevision) {
                formData.append('drawingGroupId', selectedDrawingForRevision.id);
                formData.append('title', selectedDrawingForRevision.title); // Inherited
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
                // Reset form
                setTitle('');
                setDescription('');
                setDwgFile(null);
                setPdfFile(null);
                setAddDrawerOpen(false);
                fetchDrawings();
            } else {
                alert(data.message || 'Upload failed');
            }
        } catch (err) {
            console.error(err);
            alert('Error during upload: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Handle Inline rename save
    const handleSaveTitle = async (drawingGroupId) => {
        if (!editingTitle.trim()) return;
        try {
            const response = await fetch(`/api/projects/${projectId}/drawings/categories/${category.id}/drawings/${drawingGroupId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: editingTitle.trim() })
            });
            const data = await response.json();
            if (data.success) {
                setEditingTargetId(null);
                fetchDrawings();
            } else {
                alert(data.message || 'Failed to update title');
            }
        } catch (e) {
            console.error(e);
            alert('Error saving title: ' + e.message);
        }
    };

    // Handle Delete Drawing
    const handleDeleteDrawing = async (drawingGroupId) => {
        const proceed = window.confirm(
            "Are you sure you want to permanently delete this drawing? All historical revisions and attached files will be permanently lost."
        );
        if (!proceed) return;

        try {
            const response = await fetch(`/api/projects/${projectId}/drawings/categories/${category.id}/drawings/${drawingGroupId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                fetchDrawings();
                if (selectedDrawing && selectedDrawing.id === drawingGroupId) {
                    setInfoDrawerOpen(false);
                }
            } else {
                alert(data.message || 'Failed to delete drawing');
            }
        } catch (e) {
            console.error(e);
            alert('Error deleting drawing: ' + e.message);
        }
    };

    const handlePreviewDwg = (url, name) => {
        const targetUrl = `/drawing-viewer?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
        window.open(targetUrl, '_blank');
    };

    // Filter drawings list by search query
    const filteredDrawings = drawings.filter(d => 
        d.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderManagementTable = () => (
        <div className="overflow-x-auto w-full">
            <table className="w-full text-[12px] text-left table-fixed min-w-[800px]">
                <thead className="text-[10px] font-bold text-gray-500 uppercase bg-gray-50 dark:bg-[#161b22] border-y border-gray-200 dark:border-white/5 sticky top-0 z-10 transition-colors">
                    <tr>
                        <th className="px-4 py-2 w-10 text-center"></th>
                        <th className="px-4 py-2 w-16">SR</th>
                        <th className="px-4 py-2 w-20">NUMBER</th>
                        <th className="px-4 py-2 w-28">DATE</th>
                        <th className="px-4 py-2 w-1/3">TITLE</th>
                        <th className="px-4 py-2 w-20 text-center">REV</th>
                        <th className="px-4 py-2 w-48 text-center">FILES</th>
                        <th className="px-4 py-2 w-48">REMARKS</th>
                        <th className="px-4 py-2 w-28 text-center">ACTIONS</th>
                    </tr>
                </thead>
                <Reorder.Group as="tbody" axis="y" values={drawings} onReorder={handleReorderDrawings}>
                    {filteredDrawings.map((drawing, idx) => {
                        const drawingNum = `${categoryPrefix}${idx + 1}`;
                        const dateStr = drawing.latestUploadedAt 
                            ? new Date(drawing.latestUploadedAt).toLocaleDateString('en-GB') 
                            : 'N/A';
                        const isRenaming = editingTargetId === drawing.id;

                        return (
                            <Reorder.Item 
                                as="tr"
                                key={drawing.id} 
                                value={drawing}
                                className="group/row bg-white dark:bg-[#0d1117] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 relative h-[42px] transition-colors"
                            >
                                <td className="px-3 py-2 text-center text-gray-400 cursor-grab active:cursor-grabbing">
                                    <GripVertical size={14} className="mx-auto" />
                                </td>
                                <td className="px-4 py-2 font-mono text-gray-500">
                                    {String(idx + 1).padStart(2, '0')}
                                </td>
                                <td className="px-4 py-2 font-mono font-bold text-gray-700 dark:text-gray-300">
                                    {drawingNum}
                                </td>
                                <td className="px-4 py-2 text-gray-500">
                                    {dateStr}
                                </td>
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-200 font-medium">
                                    {isRenaming ? (
                                        <div className="flex items-center gap-1.5 w-full max-w-sm">
                                            <input
                                                type="text"
                                                autoFocus
                                                value={editingTitle}
                                                onChange={e => setEditingTitle(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleSaveTitle(drawing.id)}
                                                className="bg-gray-50 dark:bg-[#161b22] border border-blue-500 rounded px-2 py-1 text-xs text-gray-950 dark:text-white outline-none w-full"
                                            />
                                            <button 
                                                onClick={() => handleSaveTitle(drawing.id)}
                                                className="p-1 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors shrink-0"
                                            >
                                                <Check size={12} />
                                            </button>
                                            <button 
                                                onClick={() => setEditingTargetId(null)}
                                                className="p-1 rounded bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-300 transition-colors shrink-0"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="truncate block max-w-xs">{drawing.title}</span>
                                    )}
                                </td>
                                <td className="px-4 py-2 text-center font-mono text-blue-500 font-semibold">
                                    R{drawing.latestRevision}
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        {drawing.latestDwgUrl ? (
                                            <div className="flex items-center bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded px-1.5 py-0.5 select-none">
                                                <span className="font-mono text-[9px] text-gray-400 mr-2">DWG</span>
                                                <button
                                                    onClick={() => handlePreviewDwg(drawing.latestDwgUrl, drawing.title)}
                                                    className="p-0.5 text-blue-500 hover:bg-blue-500/10 rounded"
                                                    title="View DWG File in New Tab"
                                                >
                                                    <Eye size={12} />
                                                </button>
                                                <a 
                                                    href={drawing.latestDwgUrl} 
                                                    download 
                                                    className="p-0.5 text-gray-500 hover:text-gray-700 dark:hover:text-white rounded"
                                                    title="Download DWG"
                                                >
                                                    <Download size={12} />
                                                </a>
                                            </div>
                                        ) : null}

                                        {drawing.latestPdfUrl ? (
                                            <div className="flex items-center bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded px-1.5 py-0.5 select-none">
                                                <span className="font-mono text-[9px] text-gray-400 mr-2">PDF</span>
                                                <a 
                                                    href={drawing.latestPdfUrl} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="p-0.5 text-purple-500 hover:bg-purple-500/10 rounded"
                                                    title="Open PDF File in New Tab"
                                                >
                                                    <Eye size={12} />
                                                </a>
                                                <a 
                                                    href={drawing.latestPdfUrl} 
                                                    download 
                                                    className="p-0.5 text-gray-500 hover:text-gray-700 dark:hover:text-white rounded"
                                                    title="Download PDF"
                                                >
                                                    <Download size={12} />
                                                </a>
                                            </div>
                                        ) : null}
                                    </div>
                                </td>
                                <td className="px-4 py-2 text-gray-500 truncate max-w-[200px]" title={drawing.latestDescription}>
                                    {drawing.latestDescription || '-'}
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => {
                                                setSelectedDrawing(drawing);
                                                setActiveLogIndex(0);
                                                setInfoDrawerOpen(true);
                                            }}
                                            className="p-1 rounded bg-gray-50 dark:bg-[#161b22] hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-white/5 shadow-sm"
                                            title="Revision History / Log"
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
                                                    className="p-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20"
                                                    title="Upload Revision"
                                                >
                                                    <Upload size={13} />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setEditingTargetId(drawing.id);
                                                        setEditingTitle(drawing.title);
                                                    }}
                                                    className="p-1 rounded bg-gray-50 dark:bg-[#161b22] hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-white/5 shadow-sm"
                                                    title="Rename Title"
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteDrawing(drawing.id)}
                                                    className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
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
            <table className="w-full text-[12px] text-left table-fixed min-w-[800px]">
                <thead className="text-[10px] font-bold text-gray-500 uppercase bg-gray-50 dark:bg-[#161b22] border-y border-gray-200 dark:border-white/5 sticky top-0 z-10">
                    <tr>
                        <th className="px-4 py-2 w-16">SR</th>
                        <th className="px-4 py-2 w-1/3">DRAWING NAME</th>
                        <th className="px-4 py-2 w-32">PLANNED DATE</th>
                        <th className="px-4 py-2 w-32">RECEIVED DATE</th>
                        <th className="px-4 py-2 w-32">STATUS</th>
                        <th className="px-4 py-2 flex-1">REMARKS</th>
                    </tr>
                </thead>
                <tbody>
                    {plannedDrawings.map((drawing, idx) => (
                        <tr key={drawing.id} className="bg-white dark:bg-[#0d1117] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 h-[42px] transition-colors">
                            <td className="px-4 py-2 font-mono text-gray-500">{String(idx + 1).padStart(2, '0')}</td>
                            <td className="px-4 py-2 text-gray-900 dark:text-gray-200 font-medium truncate">{drawing.name}</td>
                            <td className="px-4 py-2 text-gray-500">{drawing.plannedDate}</td>
                            <td className="px-4 py-2 text-gray-500">{drawing.receivedDate}</td>
                            <td className="px-4 py-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${drawing.status === 'Completed' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                    {drawing.status}
                                </span>
                            </td>
                            <td className="px-4 py-2 text-gray-500 truncate">{drawing.remarks}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    if (loading && drawings.length === 0) {
        return (
            <div className="flex-grow flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    return (
        <div className="flex-grow flex flex-col h-full bg-white dark:bg-[#0d1117] transition-colors Poppins text-left select-none relative">
            {/* Back Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-200 dark:border-white/5 shrink-0 bg-gray-50/50 dark:bg-[#161b22]/20">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 transition-all active:scale-95"
                    >
                        ← Back to Categories
                    </button>
                    <span className="text-gray-300 dark:text-white/10">|</span>
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">{category.name}</h2>
                        <p className="text-[10px] text-gray-400 mt-0.5">{drawings.length} drawing records in archive</p>
                    </div>
                </div>
            </div>

            {/* Local Tab Switcher & Global Filters */}
            <div className="flex flex-col bg-white dark:bg-[#0d1117] border-b border-gray-200 dark:border-white/5 z-20 shrink-0">
                <div className="px-5 mx-1 py-3 flex justify-between items-center">
                    <div className="inline-flex p-0.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
                        {[
                            { id: 'management', label: 'Drawing Management', count: drawings.length },
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

                    <div className="flex items-center gap-3">
                        {activeTab === 'management' && (
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search by title..."
                                className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-850 dark:text-gray-200 outline-none w-48 focus:ring-1 focus:ring-blue-500"
                            />
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
                                className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-500/10 active:scale-95"
                            >
                                <Plus size={14} />
                                <span>Add Record</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* List Content */}
            <div className="flex-grow overflow-y-auto custom-scrollbar bg-gray-50/20 dark:bg-transparent">
                {activeTab === 'management' ? (
                    drawings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center min-h-[300px] p-8">
                            <FileText className="text-gray-300 dark:text-white/10 mb-4" size={48} />
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm">No drawings uploaded yet</h4>
                            <p className="text-xs text-gray-400 mt-1">Add drawings using the "Add Record" button.</p>
                        </div>
                    ) : renderManagementTable()
                ) : renderPlannedTable()}
            </div>

            {/* Add Record & Revision Upload Drawer */}
            <AnimatePresence>
                {addDrawerOpen && (
                    <>
                        {/* Backdrop */}
                        <div className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm" onClick={() => setAddDrawerOpen(false)} />
                        
                        {/* Drawer */}
                        <div className="fixed top-0 right-0 h-full w-[440px] z-[201] bg-white dark:bg-[#161b22] shadow-2xl flex flex-col transition-transform duration-300 ease-in-out">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-[#161b22]">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                        {selectedDrawingForRevision ? `Upload Revision on: ${selectedDrawingForRevision.title}` : 'Add New Drawing'}
                                    </h3>
                                    <p className="text-xs text-gray-400">
                                        {selectedDrawingForRevision ? 'Increments version and updates S3 archives' : 'Create drawing record with R1 revision'}
                                    </p>
                                </div>
                                <button onClick={() => setAddDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400">
                                    <X size={16} />
                                </button>
                            </div>

                            <form onSubmit={handleUploadSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar text-left">
                                {/* Title */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Drawing Title *</label>
                                    {selectedDrawingForRevision ? (
                                        <input
                                            type="text"
                                            disabled
                                            value={selectedDrawingForRevision.title}
                                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-405 cursor-not-allowed outline-none font-bold"
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            required
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            placeholder="e.g. Foundation layout plan..."
                                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                                        />
                                    )}
                                </div>

                                {/* Revisions Display */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Revision Code</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={selectedDrawingForRevision ? `R${selectedDrawingForRevision.latestRevision + 1}` : 'R1'}
                                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-blue-500 cursor-not-allowed outline-none font-mono font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Upload Date</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={new Date().toLocaleDateString('en-GB')}
                                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-400 cursor-not-allowed outline-none font-medium"
                                        />
                                    </div>
                                </div>

                                {/* Choose either DWG or PDF Option toggle */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Upload File Type *</label>
                                    <div className="flex gap-2 p-0.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
                                        <button
                                            type="button"
                                            onClick={() => { setFileType('dwg'); setPdfFile(null); }}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${fileType === 'dwg'
                                                ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                            }`}
                                        >
                                            DWG File
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setFileType('pdf'); setDwgFile(null); }}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${fileType === 'pdf'
                                                ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                            }`}
                                        >
                                            PDF File
                                        </button>
                                    </div>
                                </div>

                                {/* File Input Box based on Type */}
                                {fileType === 'dwg' ? (
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">DWG File (.dwg, .dxf) *</label>
                                        <div className="relative border border-dashed border-gray-200 dark:border-white/10 rounded-xl p-4 bg-gray-50/50 dark:bg-white/[0.01] hover:bg-gray-100/50 dark:hover:bg-white/[0.03] transition-colors flex flex-col items-center justify-center text-center cursor-pointer">
                                            <input
                                                type="file"
                                                required={!selectedDrawingForRevision || fileType === 'dwg'}
                                                accept=".dwg,.dxf"
                                                onChange={e => setDwgFile(e.target.files[0] || null)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <Upload size={18} className="text-gray-400 mb-1.5" />
                                            <span className="text-[10px] font-bold text-gray-750 dark:text-gray-300">
                                                {dwgFile ? dwgFile.name : 'Select or drop DWG/DXF file'}
                                            </span>
                                            <span className="text-[8px] text-gray-400 mt-0.5">Maximum size: 25MB</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">PDF File (.pdf) *</label>
                                        <div className="relative border border-dashed border-gray-200 dark:border-white/10 rounded-xl p-4 bg-gray-50/50 dark:bg-white/[0.01] hover:bg-gray-100/50 dark:hover:bg-white/[0.03] transition-colors flex flex-col items-center justify-center text-center cursor-pointer">
                                            <input
                                                type="file"
                                                required={!selectedDrawingForRevision || fileType === 'pdf'}
                                                accept=".pdf"
                                                onChange={e => setPdfFile(e.target.files[0] || null)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <Upload size={18} className="text-gray-400 mb-1.5" />
                                            <span className="text-[10px] font-bold text-gray-750 dark:text-gray-300">
                                                {pdfFile ? pdfFile.name : 'Select or drop PDF file'}
                                            </span>
                                            <span className="text-[8px] text-gray-400 mt-0.5">Maximum size: 25MB</span>
                                        </div>
                                    </div>
                                )}

                                {/* Notes/Remarks */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Notes / Remarks</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Add revision updates, change details, or notes..."
                                        rows={3}
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-500 transition-all resize-none"
                                    />
                                </div>

                                {/* Form Action Buttons */}
                                <div className="pt-4 flex gap-2 border-t border-gray-100 dark:border-white/10">
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="animate-spin" size={13} />
                                                <span>Uploading file...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Check size={13} />
                                                <span>{selectedDrawingForRevision ? 'Upload Revision' : 'Create Drawing'}</span>
                                            </>
                                        )}
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setAddDrawerOpen(false)}
                                        className="px-4 py-2 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* Info / Version Control Drawer */}
            <AnimatePresence>
                {infoDrawerOpen && selectedDrawing && (
                    <>
                        {/* Backdrop */}
                        <div 
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[150]"
                            onClick={() => setInfoDrawerOpen(false)}
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
                                <div className="flex items-center space-x-3 text-left">
                                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                        <History size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">Version Control Log</h2>
                                        <p className="text-[10px] text-gray-400">Complete revision timeline</p>
                                    </div>
                                </div>
                                <button onClick={() => setInfoDrawerOpen(false)} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-left">
                                {(() => {
                                    const activeLog = selectedDrawing.revisions[activeLogIndex] || selectedDrawing.revisions[0];
                                    if (!activeLog) return null;

                                    return (
                                        <>
                                            {/* Current/Selected Revision Box */}
                                            <section>
                                                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] block mb-2.5">
                                                    Viewing Revision: {activeLog.rev}
                                                </label>
                                                <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl p-4 space-y-3.5 shadow-inner transition-all duration-300">
                                                    <div className="flex flex-col space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold text-gray-900 dark:text-white truncate block max-w-[220px]">
                                                                {selectedDrawing.title}
                                                            </span>
                                                            <span className="px-2 py-0.5 text-[8px] font-bold rounded border tracking-wider shrink-0 bg-blue-500/10 text-blue-500 border-blue-500/20 font-mono">
                                                                {activeLog.rev} {activeLogIndex === 0 ? 'LATEST' : 'ARCHIVED'}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-gray-500 font-mono">
                                                            Group Ref ID: #{selectedDrawing.id}
                                                        </span>
                                                    </div>

                                                    <div className="border-t border-gray-200 dark:border-white/10 pt-3 space-y-2 text-xs">
                                                        <div className="flex items-center space-x-2.5 text-gray-700 dark:text-gray-300">
                                                            <Clock size={14} className="text-gray-500" />
                                                            <span>Uploaded: {new Date(activeLog.uploadedAt).toLocaleString('en-GB')}</span>
                                                        </div>
                                                        <div className="flex items-center space-x-2.5 text-gray-700 dark:text-gray-300">
                                                            <User size={14} className="text-gray-500" />
                                                            <span className="truncate">By: {activeLog.uploaderName}</span>
                                                        </div>
                                                    </div>

                                                    {/* Revision-specific Files */}
                                                    <div className="border-t border-gray-200 dark:border-white/10 pt-3 flex flex-wrap gap-2">
                                                        {activeLog.dwgUrl && (
                                                            <div className="flex items-center bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded px-2 py-1 select-none">
                                                                <span className="font-mono text-[9px] text-gray-400 mr-2">DWG</span>
                                                                <button
                                                                    onClick={() => handlePreviewDwg(activeLog.dwgUrl, selectedDrawing.title)}
                                                                    className="p-0.5 text-blue-500 hover:bg-blue-500/10 rounded mr-1"
                                                                    title="View DWG File in New Tab"
                                                                >
                                                                    <Eye size={12} />
                                                                </button>
                                                                <a 
                                                                    href={activeLog.dwgUrl} 
                                                                    download 
                                                                    className="p-0.5 text-gray-500 hover:text-white rounded"
                                                                    title="Download DWG"
                                                                >
                                                                    <Download size={12} />
                                                                </a>
                                                            </div>
                                                        )}
                                                        {activeLog.pdfUrl && (
                                                            <div className="flex items-center bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded px-2 py-1 select-none">
                                                                <span className="font-mono text-[9px] text-gray-400 mr-2">PDF</span>
                                                                <a 
                                                                    href={activeLog.pdfUrl} 
                                                                    target="_blank" 
                                                                    rel="noreferrer"
                                                                    className="p-0.5 text-purple-500 hover:bg-purple-500/10 rounded mr-1"
                                                                    title="Open PDF File in New Tab"
                                                                >
                                                                    <Eye size={12} />
                                                                </a>
                                                                <a 
                                                                    href={activeLog.pdfUrl} 
                                                                    download 
                                                                    className="p-0.5 text-gray-500 hover:text-white rounded"
                                                                    title="Download PDF"
                                                                >
                                                                    <Download size={12} />
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </section>

                                            {/* Revision Log History Timeline */}
                                            <section className="flex-1">
                                                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] block mb-3.5">
                                                    Revision History
                                                </label>
                                                <div className="space-y-4 relative">
                                                    {selectedDrawing.revisions.map((log, i) => (
                                                        <div
                                                            key={log.id}
                                                            onClick={() => setActiveLogIndex(i)}
                                                            className="flex relative pl-6 group cursor-pointer"
                                                        >
                                                            {/* Timeline Vertical Line */}
                                                            <div className="absolute left-1.5 top-2.5 bottom-[-24px] w-[2px] bg-gray-200 dark:bg-white/10 group-last:hidden" />
                                                            {/* Timeline Dot indicator */}
                                                            <div className={`absolute left-[-2px] top-1.5 w-[16px] h-[16px] rounded-full border-[3px] border-white dark:border-[#0d1117] shadow-sm transition-all duration-300 z-10 ${activeLogIndex === i ? 'bg-blue-500 scale-110' : (i === 0 ? 'bg-blue-400' : 'bg-gray-400 dark:bg-gray-600')}`} />

                                                            <div className={`flex-1 pb-5 transition-all duration-300 ${activeLogIndex === i ? 'scale-[1.01] origin-left opacity-100' : 'opacity-65 group-hover:opacity-100'}`}>
                                                                <div className="flex items-center justify-between mb-1 text-[11px]">
                                                                    <span className={`font-bold ${i === 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-300'}`}>
                                                                        {log.rev} {i === 0 && '(Latest)'}
                                                                    </span>
                                                                    <span className={`text-[9px] ${activeLogIndex === i ? 'text-blue-500 font-semibold' : 'text-gray-500'}`}>
                                                                        {new Date(log.uploadedAt).toLocaleDateString('en-GB')}
                                                                    </span>
                                                                </div>
                                                                <p className={`text-xs leading-relaxed mb-2.5 break-all ${activeLogIndex === i ? 'text-gray-900 dark:text-gray-200 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                                                                    {log.description || 'No changes or notes specified.'}
                                                                </p>
                                                                <div className="flex items-center space-x-1.5 text-[9px] text-gray-500">
                                                                    <User size={11} className={activeLogIndex === i ? 'text-blue-500' : 'text-gray-400'} />
                                                                    <span className="uppercase tracking-wider font-semibold truncate max-w-[200px]">Auth: {log.uploaderName}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>

                                            {/* Approvals & Remarks Section */}
                                            <section className="shrink-0 pt-3 border-t border-gray-100 dark:border-white/10">
                                                <div className={`border rounded-xl p-3 bg-gray-50 dark:bg-white/[0.02] ${activeLogIndex === 0 ? 'border-blue-500/10' : 'border-gray-200 dark:border-white/5'}`}>
                                                    <div className="flex items-center space-x-2 mb-1.5 font-bold text-[9px] tracking-wider uppercase text-gray-400">
                                                        <FileText size={12} />
                                                        <span>Remarks / Version Description</span>
                                                    </div>
                                                    <p className="text-xs italic leading-relaxed text-gray-700 dark:text-gray-300">
                                                        "{activeLog.description || 'No description remarks provided for this version.'}"
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
