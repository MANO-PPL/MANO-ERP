import React, { useState } from 'react';
import {
    Upload,
    FileText,
    CheckCircle2,
    AlertCircle,
    Download,
    X,
    FileCode,
    Users
} from 'lucide-react';

const BulkImport = () => {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
        else setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Left: Upload Zone */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-3xl p-8 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Import Users in Bulk</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Upload a CSV or Excel file containing user details to quickly populate your team database.</p>

                        <div
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            className={`relative border-2 border-dashed rounded-2xl p-12 transition-all flex flex-col items-center justify-center group ${isDragging
                                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                                : 'border-gray-200 dark:border-white/10 hover:border-blue-400 bg-gray-50/50 dark:bg-[#0d1117]/50'
                                }`}
                        >
                            {!file ? (
                                <>
                                    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#161b22] shadow-sm border border-gray-100 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                                        <Upload size={28} />
                                    </div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">Drag & drop your file here</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Maximum file size: 10MB (CSV, XLSX)</p>

                                    <label className="mt-8 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer">
                                        Browse Files
                                        <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
                                    </label>
                                </>
                            ) : (
                                <div className="w-full space-y-4 anim-fade-in">
                                    <div className="flex items-center justify-between p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-500/30 rounded-xl">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-lg bg-white dark:bg-[#161b22] flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-900/50">
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate max-w-[200px]">{file.name}</p>
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400">{(file.size / 1024).toFixed(1)} KB • Ready to process</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setFile(null)} className="p-1.5 hover:bg-white dark:hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-red-500">
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95">
                                        Start Import
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Instructions */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                            <FileCode size={16} className="text-blue-500" />
                            <span>Import Guidelines</span>
                        </h4>

                        <div className="mt-6 space-y-4">
                            <div className="flex items-start space-x-3">
                                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">Columns should include: <strong>Full Name, Email, Password, Department, Role</strong>.</p>
                            </div>
                            <div className="flex items-start space-x-3">
                                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">Ensure all emails are unique and use the <strong>@mano.co.in</strong> domain.</p>
                            </div>
                            <div className="flex items-start space-x-3">
                                <AlertCircle size={16} className="text-yellow-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">Bulk import will bypass email verification for speed.</p>
                            </div>
                        </div>

                        <div className="mt-10 pt-6 border-t border-gray-100 dark:border-white/10">
                            <h5 className="text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-widest mb-3">Download Template</h5>
                            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all w-full justify-center">
                                <Download size={14} />
                                <span>CSV Template</span>
                            </button>
                        </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/20">
                        <Users size={32} strokeWidth={1.5} className="mb-4 text-indigo-200" />
                        <h4 className="text-sm font-bold">Import Summary</h4>
                        <p className="text-[11px] text-indigo-100 mt-1 lines-relaxed">Last import: Feb 24, 2026. Successfully added 12 new users to the Engineering team.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkImport;
