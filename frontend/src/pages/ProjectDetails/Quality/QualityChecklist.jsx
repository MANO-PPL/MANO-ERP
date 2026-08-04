import React, { useState, useEffect, useRef } from 'react';
import {
    ArrowRight, Plus, Search, X, ListChecks, FileText, Upload, Eye, Download, Trash2, Check
} from 'lucide-react';
import { toast } from 'react-toastify';
import qualityApi from '../../../services/qualityApi';
import CustomInput from '../../../components/CustomInput';

const QualityChecklist = ({ onBack, canWrite, project }) => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef(null);

    const loadChecklists = async () => {
        setLoading(true);
        try {
            const res = await qualityApi.getChecklists(project.id);
            if (res.success) {
                setDocs(res.checklists || []);
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to load checklist & snaglist documents');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (project?.id) {
            loadChecklists();
        }
    }, [project?.id]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (['heic', 'heif'].includes(ext)) {
                toast.error('HEIC/HEIF files are not allowed. Please convert to JPG/PNG before uploading.');
                if (e.target) e.target.value = '';
                setSelectedFile(null);
                return;
            }
            setSelectedFile(file);
            if (!title) {
                const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                setTitle(nameWithoutExt);
            }
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error('Please enter a document title');
            return;
        }
        if (!selectedFile) {
            toast.error('Please select a file to upload');
            return;
        }

        setIsSaving(true);
        try {
            const formData = new FormData();
            formData.append('title', title.trim());
            formData.append('file', selectedFile);

            const res = await qualityApi.uploadChecklist(project.id, formData);
            if (res.success) {
                toast.success('Document uploaded successfully');
                setTitle('');
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                setDrawerOpen(false);
                loadChecklists();
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Failed to upload document');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (docId) => {
        if (window.confirm('Are you sure you want to delete this document?')) {
            try {
                await qualityApi.deleteChecklist(project.id, docId);
                toast.success('Document deleted successfully');
                loadChecklists();
            } catch (err) {
                console.error(err);
                toast.error('Failed to delete document');
            }
        }
    };

    const handlePreview = (doc) => {
        const type = doc.file_type?.toLowerCase() || '';
        const url = doc.file_url;

        if (['heic', 'heif'].includes(type)) {
            toast.info('No preview available for .HEIC files. Downloading instead.');
            const link = document.createElement('a');
            link.href = url;
            link.download = doc.title;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }

        if (['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type)) {
            window.open(url, '_blank');
        } else if (['docx', 'doc', 'xlsx', 'xls'].includes(type)) {
            const embedUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
            window.open(embedUrl, '_blank');
        } else if (['pptx', 'ppt'].includes(type)) {
            const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}`;
            window.open(googleViewerUrl, '_blank');
        } else {
            toast.info(`No preview available for .${type.toUpperCase()} files. Downloading instead.`);
            window.open(url, '_blank');
        }
    };

    const formatBytes = (bytes, decimals = 2) => {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const filteredDocs = docs.filter(doc => 
        doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.file_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.uploaded_by_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden font-sans text-left">
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar p-3 md:p-4 space-y-3">
                
                {/* Top Action Bar (Search Bar beside Upload Document) */}
                <div className="flex items-center justify-end gap-2.5 pb-1">
                    <div className="relative w-64 md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search checklist document name, format..."
                            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-md text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer">
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {canWrite && (
                        <button
                            onClick={() => setDrawerOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-md text-xs font-semibold transition-all shadow-sm shrink-0 cursor-pointer"
                        >
                            <Plus size={15} />
                            <span>Upload Document</span>
                        </button>
                    )}
                </div>

                {/* Excel Spreadsheet-Themed Grid Table */}
                {loading ? (
                    <div className="flex items-center justify-center py-16 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-2" />
                    </div>
                ) : filteredDocs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md text-center p-6 space-y-3">
                        <ListChecks size={36} className="text-gray-300 dark:text-gray-600" />
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                {searchQuery ? 'No matching checklist files found' : 'No checklist files uploaded yet'}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {searchQuery ? 'Try clearing your search query.' : 'Upload standard checklists, punch lists, inspectability logs, or snag records.'}
                            </p>
                        </div>
                        {canWrite && !searchQuery && (
                            <button
                                onClick={() => setDrawerOpen(true)}
                                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                <Plus size={14} />
                                <span>Upload First Checklist</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md overflow-hidden shadow-sm">
                        <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-100/80 dark:bg-[#1f242d] text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-white/10 font-bold uppercase tracking-wider text-[10px]">
                                        <th className="px-4 py-2.5 border-r border-gray-200/60 dark:border-white/5 w-12 text-center">#</th>
                                        <th className="px-4 py-2.5 border-r border-gray-200/60 dark:border-white/5">Document Title</th>
                                        <th className="px-3 py-2.5 border-r border-gray-200/60 dark:border-white/5 w-24 text-center">Format</th>
                                        <th className="px-4 py-2.5 border-r border-gray-200/60 dark:border-white/5 w-28 text-right">Size</th>
                                        <th className="px-4 py-2.5 border-r border-gray-200/60 dark:border-white/5 w-40">Uploaded By</th>
                                        <th className="px-4 py-2.5 border-r border-gray-200/60 dark:border-white/5 w-36">Upload Date</th>
                                        <th className="px-4 py-2.5 w-28 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200/60 dark:divide-white/5 font-medium">
                                    {filteredDocs.map((doc, idx) => (
                                        <tr
                                            key={doc.id || idx}
                                            className="hover:bg-blue-50/30 dark:hover:bg-white/[0.02] transition-colors text-gray-800 dark:text-gray-200"
                                        >
                                            <td className="px-4 py-2.5 text-center font-bold text-gray-400 border-r border-gray-100 dark:border-white/5 text-[11px]">
                                                {String(idx + 1).padStart(2, '0')}
                                            </td>
                                            <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white border-r border-gray-100 dark:border-white/5 truncate max-w-sm">
                                                {doc.title}
                                            </td>
                                            <td className="px-3 py-2.5 text-center border-r border-gray-100 dark:border-white/5">
                                                <span className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded ${
                                                    doc.file_type === 'PDF' 
                                                        ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-800/40' 
                                                        : ['DOCX', 'DOC'].includes(doc.file_type) 
                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40' 
                                                        : ['XLSX', 'XLS'].includes(doc.file_type)
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400 border border-green-200 dark:border-green-800/40'
                                                        : 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40'
                                                }`}>
                                                    {doc.file_type || 'File'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-mono text-[11px] text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-white/5">
                                                {formatBytes(doc.file_size)}
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 border-r border-gray-100 dark:border-white/5">
                                                {doc.uploaded_by_name || 'System'}
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-white/5 text-[11px]">
                                                {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                            </td>
                                            <td className="px-4 py-2.5 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => handlePreview(doc)}
                                                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors cursor-pointer"
                                                        title="Preview File"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <a
                                                        href={doc.file_url}
                                                        download
                                                        className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 rounded transition-colors cursor-pointer"
                                                        title="Download File"
                                                    >
                                                        <Download size={14} />
                                                    </a>
                                                    {canWrite && (
                                                        <button
                                                            onClick={() => handleDelete(doc.id)}
                                                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                                                            title="Delete File"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Table Footer with Entries Counter */}
                        <div className="px-4 py-2.5 border-t border-gray-200 dark:border-white/10 text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center justify-end bg-gray-50/50 dark:bg-[#161b22]">
                            Showing {filteredDocs.length} of {docs.length} entries
                        </div>
                    </div>
                )}
            </div>

            {/* SIDEBAR POPUP (RIGHT DRAWER PANEL) */}
            {drawerOpen && (
                <div className="fixed inset-0 z-[4000] flex justify-end bg-black/50 backdrop-blur-xs">
                    <div className="absolute inset-0" onClick={() => setDrawerOpen(false)} />
                    <div className="relative w-full max-w-md bg-white dark:bg-[#161b22] h-full shadow-2xl z-[4001] flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-300">
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <ListChecks className="text-purple-500" size={18} />
                                Upload Checklist Document
                            </h3>
                            <button
                                onClick={() => setDrawerOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleUpload} className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar p-4 space-y-4 text-left">
                            <div className="space-y-1.5">
                                <CustomInput
                                    label="Document Title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Masonry Snag Checklist"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300">
                                    Select File Attachment
                                </label>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/png,image/jpeg,image/gif,image/webp"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="checklist-file-upload"
                                />

                                {selectedFile ? (
                                    <div className="rounded-md p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5 truncate">
                                            <div className="p-2 bg-blue-500/10 text-blue-500 rounded">
                                                <FileText size={18} />
                                            </div>
                                            <div className="truncate">
                                                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{selectedFile.name}</p>
                                                <p className="text-[10px] text-gray-400 font-semibold">{formatBytes(selectedFile.size)}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                            className="p-1 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 rounded transition-colors cursor-pointer"
                                        >
                                            <X size={15} />
                                        </button>
                                    </div>
                                ) : (
                                    <label
                                        htmlFor="checklist-file-upload"
                                        className="border-2 border-dashed border-gray-200 dark:border-white/10 rounded-md p-6 flex flex-col items-center justify-center gap-2 bg-gray-50/50 dark:bg-white/[0.01] hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all cursor-pointer group"
                                    >
                                        <div className="w-10 h-10 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                                            <Upload size={20} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                                Click to browse file
                                            </p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">
                                                Supports PDF, DOCX, XLSX, PPTX, PNG, JPG (Max 50MB)
                                            </p>
                                        </div>
                                    </label>
                                )}
                            </div>
                        </form>

                        {/* Drawer Footer Actions */}
                        <div className="p-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-end gap-2 bg-gray-50/50 dark:bg-[#161b22]">
                            <button
                                type="button"
                                onClick={() => setDrawerOpen(false)}
                                className="px-3.5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={isSaving}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                                {isSaving ? (
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                                ) : (
                                    <Check size={14} />
                                )}
                                <span>Upload Document</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QualityChecklist;
