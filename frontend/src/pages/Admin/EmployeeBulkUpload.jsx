import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    UploadCloud,
    FileText,
    CheckCircle,
    AlertCircle,
    X,
    ChevronRight,
    Download,
    ArrowLeft,
    Users,
    FileSpreadsheet,
    Loader2,
    Edit2,
    Check,
    Trash2,
    Plus,
    Filter
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import { adminApi } from '../../services/adminApi';
import { downloadEmployeeTemplate } from '../../utils/employeeTemplate';

export default function EmployeeBulkUpload({ onNavigateBack, isEmbedded = false, onComplete }) {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Upload, 2: Preview & Verify, 3: Complete
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadReport, setUploadReport] = useState(null);
    const [validationReport, setValidationReport] = useState(null);

    // In-place row editing states
    const [editingIdx, setEditingIdx] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', desg: '', dept: '', password: '' });
    const [filterTab, setFilterTab] = useState('all'); // 'all' | 'valid' | 'error'

    const isSupportedFile = (fileObj) => {
        if (!fileObj) return false;
        const name = fileObj.name.toLowerCase();
        return name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls') ||
            fileObj.type === 'text/csv' ||
            fileObj.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            fileObj.type === 'application/vnd.ms-excel';
    };

    const handleFileDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile && isSupportedFile(droppedFile)) {
            setFile(droppedFile);
            parseFile(droppedFile);
        } else {
            toast.error("Please upload a valid CSV or Excel file (.csv, .xlsx, .xls)");
        }
    };

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!isSupportedFile(selectedFile)) {
                toast.error("Please upload a valid CSV or Excel file (.csv, .xlsx, .xls)");
                return;
            }
            setFile(selectedFile);
            parseFile(selectedFile);
        }
    };

    // Core validation engine that evaluates all rows client-side and incorporates server duplicate flags
    const validateDataset = (rows, serverReport = null) => {
        const duplicatesList = serverReport?.validation?.duplicates || serverReport?.duplicates || (Array.isArray(serverReport) ? serverReport : []);

        const dupByRow = new Map();
        const dupByEmail = new Map();
        const dupByPhone = new Map();

        duplicatesList.forEach(d => {
            const detail = d.phone ? `${d.reason} (${d.phone})` : d.email ? `${d.reason} (${d.email})` : d.reason;
            if (d.row != null) dupByRow.set(Number(d.row), detail);
            if (d.email) dupByEmail.set(d.email.toString().toLowerCase().trim(), detail);
            if (d.phone) dupByPhone.set(d.phone.toString().trim(), detail);
        });

        const seenEmails = new Set();
        const seenPhones = new Set();

        return rows.map((row, idx) => {
            const rowNum = idx + 1;
            const name = (row.name ?? row['Name'] ?? row['name'] ?? row['user_name'] ?? '').toString().trim();
            const email = (row.email ?? row['Email'] ?? row['email'] ?? '').toString().trim();
            const phoneRaw = row.phone ?? row['Phone'] ?? row['phone'] ?? row['phone_no'] ?? row['contact_no'] ?? '';
            const phone = phoneRaw ? phoneRaw.toString().trim() : '';
            const dept = (row.dept ?? row['Department'] ?? row['department'] ?? row['dept'] ?? '').toString().trim();
            const desg = (row.desg ?? row['Designation'] ?? row['designation'] ?? row['role'] ?? row['Role'] ?? '').toString().trim();
            const password = (row.password ?? row['Password'] ?? row['password'] ?? '').toString().trim();

            let status = 'Valid';
            let errorMsg = '';

            if (!name) {
                status = 'Error';
                errorMsg = 'Missing Name';
            } else if (!email && !phone) {
                status = 'Error';
                errorMsg = 'Missing Contact (Email or Phone)';
            } else if (email && seenEmails.has(email.toLowerCase())) {
                status = 'Error';
                errorMsg = `Duplicate Email in file (${email})`;
            } else if (phone && seenPhones.has(phone)) {
                status = 'Error';
                errorMsg = `Duplicate Phone in file (${phone})`;
            } else if (dupByRow.has(rowNum)) {
                status = 'Error';
                errorMsg = dupByRow.get(rowNum);
            } else if (email && dupByEmail.has(email.toLowerCase())) {
                status = 'Error';
                errorMsg = dupByEmail.get(email.toLowerCase());
            } else if (phone && dupByPhone.has(phone)) {
                status = 'Error';
                errorMsg = dupByPhone.get(phone);
            }

            if (email) seenEmails.add(email.toLowerCase());
            if (phone) seenPhones.add(phone);

            return {
                ...row,
                rowNum,
                name,
                email,
                phone,
                dept: dept || '—',
                desg: desg || '—',
                password,
                status,
                errorMsg
            };
        });
    };

    const processParsedData = async (rawRows) => {
        try {
            let serverReport = null;
            try {
                const res = await adminApi.bulkValidate(rawRows);
                serverReport = res?.validation || res;
                setValidationReport(serverReport);
            } catch (err) {
                console.warn('Backend validate skipped or encountered error:', err.message);
            }

            const processed = validateDataset(rawRows, serverReport);
            setPreviewData(processed);
            setStep(2);
        } catch (error) {
            console.error('Data processing error:', error);
            toast.error("Failed to process file rows");
        }
    };

    const parseFile = (fileObj) => {
        const fileName = fileObj.name.toLowerCase();
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
                    if (!jsonRows || jsonRows.length === 0) {
                        toast.error("The uploaded Excel file contains no data rows.");
                        return;
                    }
                    processParsedData(jsonRows);
                } catch (err) {
                    console.error(err);
                    toast.error("Failed to parse Excel file");
                }
            };
            reader.readAsArrayBuffer(fileObj);
        } else {
            Papa.parse(fileObj, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (!results.data || results.data.length === 0) {
                        toast.error("The uploaded CSV file contains no data rows.");
                        return;
                    }
                    processParsedData(results.data);
                },
                error: (error) => {
                    console.error(error);
                    toast.error("Failed to parse CSV file");
                }
            });
        }
    };

    // ─── Inline Row Editing Handlers ──────────────────────────────────────────
    const handleStartEdit = (idx, row) => {
        setEditingIdx(idx);
        setEditForm({
            name: row.name === '—' ? '' : row.name,
            email: row.email === '—' ? '' : row.email,
            phone: row.phone === '—' ? '' : row.phone,
            desg: row.desg === '—' ? '' : row.desg,
            dept: row.dept === '—' ? '' : row.dept,
            password: row.password || ''
        });
    };

    const handleCancelEdit = () => {
        setEditingIdx(null);
        setEditForm({ name: '', email: '', phone: '', desg: '', dept: '', password: '' });
    };

    const handleSaveEdit = async (idx) => {
        if (!editForm.name.trim()) {
            toast.error('Employee Name is required');
            return;
        }

        const updatedRows = [...previewData];
        updatedRows[idx] = {
            ...updatedRows[idx],
            name: editForm.name.trim(),
            email: editForm.email.trim(),
            phone: editForm.phone.trim(),
            desg: editForm.desg.trim() || '—',
            dept: editForm.dept.trim() || '—',
            password: editForm.password.trim()
        };

        // Re-validate against database duplicates if email/phone changed
        let serverReport = validationReport;
        try {
            const res = await adminApi.bulkValidate(updatedRows);
            serverReport = res?.validation || res;
            setValidationReport(serverReport);
        } catch (err) {
            console.warn('Re-validation warning:', err.message);
        }

        const revalidated = validateDataset(updatedRows, serverReport);
        setPreviewData(revalidated);
        setEditingIdx(null);
        toast.success(`Row #${idx + 1} updated!`);
    };

    const handleDeleteRow = async (idx) => {
        const remaining = previewData.filter((_, i) => i !== idx);
        let serverReport = validationReport;
        try {
            const res = await adminApi.bulkValidate(remaining);
            serverReport = res?.validation || res;
            setValidationReport(serverReport);
        } catch (err) {
            console.warn('Re-validation warning:', err.message);
        }

        const revalidated = validateDataset(remaining, serverReport);
        setPreviewData(revalidated);
        if (editingIdx === idx) handleCancelEdit();
        toast.info(`Row removed from import queue.`);
    };

    const handleAddRow = () => {
        const newRow = {
            name: '',
            email: '',
            phone: '',
            dept: '',
            desg: '',
            password: ''
        };
        const updated = [...previewData, newRow];
        const revalidated = validateDataset(updated, validationReport);
        setPreviewData(revalidated);
        const newIndex = revalidated.length - 1;
        setEditingIdx(newIndex);
        setEditForm({ name: '', email: '', phone: '', desg: '', dept: '', password: '' });
        setFilterTab('all');
    };

    // ─── Bulk Upload Submission ───────────────────────────────────────────────
    const handleUpload = async () => {
        setIsUploading(true);
        try {
            const validRows = previewData.filter(r => r.status === 'Valid');
            const errorRows = previewData.filter(r => r.status !== 'Valid');

            if (validRows.length === 0) {
                toast.error("No valid employee rows to upload. Please fix or remove rows with errors.");
                setIsUploading(false);
                return;
            }

            let report = null;

            // Send cleaned JSON records to backend
            try {
                const res = await adminApi.bulkCreateJson(validRows);
                report = res?.report || res;
            } catch (err) {
                if (file) {
                    const res = await adminApi.bulkUpload(file);
                    report = res?.report || res;
                } else {
                    throw err;
                }
            }

            const skippedItems = errorRows.map(r => ({
                name: r.name || 'Unnamed',
                email: r.email || r.phone || 'No contact',
                reason: r.errorMsg || 'Invalid row data'
            }));

            const finalReport = {
                total_processed: previewData.length,
                success_count: report?.success_count ?? validRows.length,
                failure_count: (report?.failure_count || 0) + errorRows.length,
                errors: report?.errors || [],
                skipped_rows: skippedItems
            };

            setUploadReport(finalReport);
            setStep(3);
            toast.success("Employee bulk import completed!");
            onComplete?.(finalReport);
        } catch (error) {
            console.error('Upload Error:', error);
            toast.error(error.message || "Bulk upload failed");
        } finally {
            setIsUploading(false);
        }
    };

    // Metrics & Filtering
    const uniqueDepts = [...new Set(previewData.map(r => r.dept).filter(d => d && d !== '—'))];
    const uniqueDesgs = [...new Set(previewData.map(r => r.desg).filter(d => d && d !== '—'))];
    const validCount = previewData.filter(r => r.status === 'Valid').length;
    const errorCount = previewData.filter(r => r.status !== 'Valid').length;

    const filteredRows = previewData.map((row, originalIndex) => ({ ...row, originalIndex })).filter(r => {
        if (filterTab === 'valid') return r.status === 'Valid';
        if (filterTab === 'error') return r.status !== 'Valid';
        return true;
    });

    const handleBack = () => {
        if (onNavigateBack) {
            onNavigateBack();
        } else {
            navigate('/admin');
        }
    };

    return (
        <div className={`w-full ${isEmbedded ? '' : 'px-4 sm:px-8 py-6 space-y-6'}`}>
            {!isEmbedded && (
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/80 dark:border-white/10">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Employee Upload</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Import employees in bulk from Excel (.xlsx) or CSV files with live preview & editing
                        </p>
                    </div>
                    <button
                        onClick={handleBack}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gh-subtle transition-colors cursor-pointer"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Employees</span>
                    </button>
                </div>
            )}

            {/* Progress Step Indicator */}
            <div className="flex items-center justify-center my-4">
                <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                        step >= 1 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}>1</div>
                    <span className={`ml-2 text-xs font-semibold ${
                        step >= 1 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                    }`}>Upload</span>
                </div>
                <div className={`w-12 sm:w-20 h-0.5 mx-2 sm:mx-3 ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                        step >= 2 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}>2</div>
                    <span className={`ml-2 text-xs font-semibold ${
                        step >= 2 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                    }`}>Preview & Edit</span>
                </div>
                <div className={`w-12 sm:w-20 h-0.5 mx-2 sm:mx-3 ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                        step >= 3 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}>3</div>
                    <span className={`ml-2 text-xs font-semibold ${
                        step >= 3 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                    }`}>Complete</span>
                </div>
            </div>

            {/* ─── STEP 1: UPLOAD AREA ─── */}
            {step === 1 && (
                <div className="w-full bg-white dark:bg-[#161b22] rounded-2xl p-6 sm:p-10 shadow-sm border border-slate-200 dark:border-white/10 text-center transition-colors">
                    {/* Template Download Card */}
                    <div className="mb-6 p-4 rounded-xl border border-indigo-100 bg-indigo-50/60 dark:border-indigo-900/40 dark:bg-indigo-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-lg bg-indigo-600 text-white shrink-0 mt-0.5 shadow-sm">
                                <FileSpreadsheet size={20} />
                            </div>
                            <div>
                                <h5 className="text-xs font-bold text-gray-900 dark:text-white">Sample Employee Template</h5>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                    Download the template with sample data, pre-configured columns, and instructions.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 self-stretch sm:self-center shrink-0">
                            <button
                                type="button"
                                onClick={() => downloadEmployeeTemplate('xlsx')}
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
                            >
                                <Download size={14} />
                                <span>Download Excel (.xlsx)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => downloadEmployeeTemplate('csv')}
                                className="inline-flex items-center justify-center px-2.5 py-2 bg-white hover:bg-gray-50 dark:bg-gh-subtle dark:hover:bg-gh-hover text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gh-border text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
                                title="Download CSV format"
                            >
                                .CSV
                            </button>
                        </div>
                    </div>

                    {/* Drag and Drop Zone */}
                    <div
                        className="border-2 border-dashed border-slate-300 dark:border-white/20 rounded-2xl p-10 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all cursor-pointer group"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleFileDrop}
                        onClick={() => document.getElementById('employeeFileInput')?.click()}
                    >
                        <input
                            type="file"
                            id="employeeFileInput"
                            className="hidden"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileSelect}
                        />
                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                            <UploadCloud size={32} />
                        </div>
                        <h4 className="text-base font-bold text-gray-900 dark:text-white mb-1">Click to upload or drag and drop</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Excel (.xlsx, .xls) or CSV files supported</p>
                        <button
                            type="button"
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
                        >
                            Select File
                        </button>
                    </div>

                    {/* Columns Guidelines */}
                    <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50/70 p-4 text-[11px] text-gray-500 dark:border-white/5 dark:bg-[#0d1117] dark:text-gray-400 text-left">
                        <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                            <Users size={14} className="text-indigo-600 dark:text-indigo-400" /> Supported Template Columns
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                            <div><strong className="text-gray-900 dark:text-white">Name:</strong> Full employee name <span className="text-red-500">*</span></div>
                            <div><strong className="text-gray-900 dark:text-white">Email:</strong> Unique email address <span className="text-red-500">*</span></div>
                            <div><strong className="text-gray-900 dark:text-white">Phone:</strong> Contact phone number</div>
                            <div><strong className="text-gray-900 dark:text-white">Department:</strong> Department name (auto-created if new)</div>
                            <div><strong className="text-gray-900 dark:text-white">Designation:</strong> Job role / title (auto-created if new)</div>
                            <div><strong className="text-gray-900 dark:text-white">Password:</strong> Optional login password</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── STEP 2: PREVIEW & INLINE EDITING ─── */}
            {step === 2 && (
                <div className="w-full bg-white dark:bg-[#161b22] rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden transition-colors">
                    {/* File Header & Filters Toolbar */}
                    <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/10 flex flex-wrap items-center justify-between gap-4 bg-slate-50/40 dark:bg-white/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                                <FileText className="text-indigo-600 dark:text-indigo-400 animate-pulse" size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                    {file?.name || 'Import File'}
                                    <span className="text-xs font-normal text-gray-400">
                                        ({(file?.size ? (file.size / 1024).toFixed(1) : '0')} KB)
                                    </span>
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Click any row to edit information before importing.
                                </p>
                            </div>
                        </div>

                        {/* Filter Tabs & Add Row Action */}
                        <div className="flex items-center gap-2">
                            <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-xl text-xs font-semibold">
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('all')}
                                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                        filterTab === 'all'
                                            ? 'bg-white dark:bg-indigo-600 text-gray-900 dark:text-white shadow-2xs font-bold'
                                            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                    }`}
                                >
                                    All ({previewData.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('valid')}
                                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                                        filterTab === 'valid'
                                            ? 'bg-white dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-2xs font-bold'
                                            : 'text-gray-500 hover:text-emerald-600 dark:text-gray-400'
                                    }`}
                                >
                                    <CheckCircle size={12} className="text-emerald-500" />
                                    <span>Valid ({validCount})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('error')}
                                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                                        filterTab === 'error'
                                            ? 'bg-white dark:bg-red-600 text-red-700 dark:text-white shadow-2xs font-bold'
                                            : 'text-gray-500 hover:text-red-600 dark:text-gray-400'
                                    }`}
                                >
                                    <AlertCircle size={12} className="text-red-500" />
                                    <span>Errors ({errorCount})</span>
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={handleAddRow}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                                title="Add a new employee row manually"
                            >
                                <Plus size={14} />
                                <span>Add Row</span>
                            </button>

                            <button
                                onClick={() => { setStep(1); setFile(null); setValidationReport(null); setEditingIdx(null); }}
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                title="Cancel and choose another file"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Interactive Table with In-Place Editing */}
                    <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 dark:bg-[#0d1117] text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wider sticky top-0 backdrop-blur-md z-10 border-b border-slate-200 dark:border-white/10">
                                <tr>
                                    <th className="px-4 py-3 w-12 text-center">#</th>
                                    <th className="px-4 py-3 min-w-[160px]">Employee Name *</th>
                                    <th className="px-4 py-3 min-w-[200px]">Email Address *</th>
                                    <th className="px-4 py-3 min-w-[130px]">Phone Number</th>
                                    <th className="px-4 py-3 min-w-[150px]">Designation / Role</th>
                                    <th className="px-4 py-3 min-w-[150px]">Department</th>
                                    <th className="px-4 py-3 min-w-[170px]">Status / Reason</th>
                                    <th className="px-4 py-3 w-24 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="p-10 text-center text-slate-400 italic">
                                            No employee records match the selected filter.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map((row) => {
                                        const isRowEditing = editingIdx === row.originalIndex;

                                        return (
                                            <tr
                                                key={row.originalIndex}
                                                className={`transition-colors ${
                                                    isRowEditing
                                                        ? 'bg-indigo-50/60 dark:bg-indigo-950/30'
                                                        : row.status === 'Error'
                                                        ? 'bg-red-50/20 dark:bg-red-950/10 hover:bg-red-50/40 dark:hover:bg-red-950/20'
                                                        : 'hover:bg-slate-50/60 dark:hover:bg-white/5'
                                                }`}
                                            >
                                                {/* Row Number */}
                                                <td className="px-4 py-3 text-center text-slate-400 font-mono text-[11px]">
                                                    {row.originalIndex + 1}
                                                </td>

                                                {/* Name */}
                                                <td className="px-4 py-2.5">
                                                    {isRowEditing ? (
                                                        <input
                                                            type="text"
                                                            value={editForm.name}
                                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                            placeholder="Full Name"
                                                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#161b22] border border-indigo-400 dark:border-indigo-500 rounded-lg text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <span className="font-semibold text-gray-900 dark:text-white block truncate max-w-[200px]" title={row.name}>
                                                            {row.name || <span className="text-red-400 italic">Missing Name</span>}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Email */}
                                                <td className="px-4 py-2.5">
                                                    {isRowEditing ? (
                                                        <input
                                                            type="email"
                                                            value={editForm.email}
                                                            onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                                            placeholder="Email address"
                                                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#161b22] border border-indigo-400 dark:border-indigo-500 rounded-lg text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                                        />
                                                    ) : (
                                                        <span className="text-slate-600 dark:text-slate-300 block truncate max-w-[220px]" title={row.email}>
                                                            {row.email || '—'}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Phone */}
                                                <td className="px-4 py-2.5">
                                                    {isRowEditing ? (
                                                        <input
                                                            type="text"
                                                            value={editForm.phone}
                                                            onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                                            placeholder="Phone Number"
                                                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#161b22] border border-indigo-400 dark:border-indigo-500 rounded-lg text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                                        />
                                                    ) : (
                                                        <span className="text-slate-600 dark:text-slate-300">
                                                            {row.phone || '—'}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Designation */}
                                                <td className="px-4 py-2.5">
                                                    {isRowEditing ? (
                                                        <input
                                                            type="text"
                                                            value={editForm.desg}
                                                            onChange={e => setEditForm({ ...editForm, desg: e.target.value })}
                                                            placeholder="Designation"
                                                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#161b22] border border-indigo-400 dark:border-indigo-500 rounded-lg text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                                        />
                                                    ) : (
                                                        <span className="text-slate-600 dark:text-slate-300 block truncate max-w-[180px]" title={row.desg}>
                                                            {row.desg}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Department */}
                                                <td className="px-4 py-2.5">
                                                    {isRowEditing ? (
                                                        <input
                                                            type="text"
                                                            value={editForm.dept}
                                                            onChange={e => setEditForm({ ...editForm, dept: e.target.value })}
                                                            placeholder="Department"
                                                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#161b22] border border-indigo-400 dark:border-indigo-500 rounded-lg text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                                        />
                                                    ) : (
                                                        <span className="text-slate-600 dark:text-slate-300 block truncate max-w-[180px]" title={row.dept}>
                                                            {row.dept}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Status / Reason Badge */}
                                                <td className="px-4 py-2.5">
                                                    {row.status === 'Valid' ? (
                                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-md border border-emerald-200/40 dark:border-emerald-800/20 whitespace-nowrap">
                                                            <CheckCircle size={12} className="shrink-0 text-emerald-500" /> Valid
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 rounded-md border border-rose-200/60 dark:border-rose-800/40 whitespace-nowrap" title={row.errorMsg}>
                                                            <AlertCircle size={13} className="shrink-0 text-rose-500" />
                                                            <span>{row.errorMsg || 'Invalid row'}</span>
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Action Buttons */}
                                                <td className="px-4 py-2.5 text-center">
                                                    {isRowEditing ? (
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveEdit(row.originalIndex)}
                                                                className="p-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer"
                                                                title="Save changes"
                                                            >
                                                                <Check size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleCancelEdit}
                                                                className="p-1 rounded-md bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20 transition-colors cursor-pointer"
                                                                title="Cancel editing"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleStartEdit(row.originalIndex, row)}
                                                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                                                title="Edit employee details in-place"
                                                            >
                                                                <Edit2 size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteRow(row.originalIndex)}
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                                                title="Remove row from import"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Import Data Summary Section */}
                    <div className="p-4 sm:p-5 bg-slate-50/60 dark:bg-[#0d1117]/50 border-t border-slate-100 dark:border-white/10">
                        <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-3">
                            Import Data Summary
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-[#161b22] border border-slate-200/70 dark:border-white/10 rounded-xl p-3">
                                <h5 className="text-[10px] text-slate-400 dark:text-slate-400 uppercase font-bold tracking-wider mb-2">
                                    Departments Detected ({uniqueDepts.length})
                                </h5>
                                <div className="flex flex-wrap gap-1.5">
                                    {uniqueDepts.length > 0 ? (
                                        uniqueDepts.map((d, i) => (
                                            <span key={i} className="px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-gh-subtle border border-slate-200 dark:border-gh-border rounded-lg text-slate-700 dark:text-slate-300">
                                                {d}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-xs text-slate-400 italic">None specified</span>
                                    )}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-[#161b22] border border-slate-200/70 dark:border-white/10 rounded-xl p-3">
                                <h5 className="text-[10px] text-slate-400 dark:text-slate-400 uppercase font-bold tracking-wider mb-2">
                                    Designations Detected ({uniqueDesgs.length})
                                </h5>
                                <div className="flex flex-wrap gap-1.5">
                                    {uniqueDesgs.length > 0 ? (
                                        uniqueDesgs.map((d, i) => (
                                            <span key={i} className="px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-gh-subtle border border-slate-200 dark:border-gh-border rounded-lg text-slate-700 dark:text-slate-300">
                                                {d}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-xs text-slate-400 italic">None specified</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="p-4 border-t border-slate-100 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#161b22]">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            Ready to import <strong className="text-emerald-600 dark:text-emerald-400">{validCount}</strong> valid employee accounts.
                            {errorCount > 0 && (
                                <span className="ml-1 text-red-500 font-semibold">
                                    ({errorCount} records have errors and will be skipped).
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => { setStep(1); setFile(null); setEditingIdx(null); }}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                            >
                                Cancel &amp; Re-upload
                            </button>
                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={isUploading || validCount === 0}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        <span>Importing Employees...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Import {validCount} Employees</span>
                                        <ChevronRight size={14} />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── STEP 3: DONE / UPLOAD REPORT ─── */}
            {step === 3 && (
                <div className="w-full bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 rounded-2xl p-6 sm:p-10 shadow-sm text-center transition-colors">
                    <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <CheckCircle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Upload Completed!</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                        The uploaded employee records have been parsed and processed into your organization.
                    </p>

                    {/* Metrics Cards */}
                    <div className="grid grid-cols-3 gap-3 mb-6 max-w-md mx-auto">
                        <div className="bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 p-3 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Processed</span>
                            <span className="text-xl font-extrabold text-slate-800 dark:text-white">{uploadReport?.total_processed || 0}</span>
                        </div>
                        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30 p-3 rounded-xl">
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-0.5">Succeeded</span>
                            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{uploadReport?.success_count || 0}</span>
                        </div>
                        <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 p-3 rounded-xl">
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-0.5">Skipped</span>
                            <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{uploadReport?.skipped_rows?.length || uploadReport?.failure_count || 0}</span>
                        </div>
                    </div>

                    {/* Skipped Items Table */}
                    {uploadReport?.skipped_rows?.length > 0 && (
                        <div className="mb-6 text-left max-w-xl mx-auto">
                            <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                Skipped Rows ({uploadReport.skipped_rows.length})
                            </h4>
                            <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-2xs">
                                <div className="overflow-y-auto max-h-52">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 dark:bg-white/5 text-[10px] uppercase text-slate-400 dark:text-slate-400 font-bold sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2">Name</th>
                                                <th className="px-3 py-2">Email / Contact</th>
                                                <th className="px-3 py-2 text-right">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                            {uploadReport.skipped_rows.map((row, i) => (
                                                <tr key={i} className="hover:bg-slate-50/40 dark:hover:bg-white/5">
                                                    <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">{row.name}</td>
                                                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400 truncate max-w-[150px]">{row.email}</td>
                                                    <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400 font-semibold text-[11px]">{row.reason}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Errors from Backend */}
                    {uploadReport?.errors?.length > 0 && (
                        <div className="mb-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 p-3 rounded-xl text-left max-w-xl mx-auto">
                            <h4 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wide mb-1">Server Errors:</h4>
                            <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-300 space-y-0.5">
                                {uploadReport.errors.map((err, i) => (
                                    <li key={i}>{typeof err === 'string' ? err : err.message || JSON.stringify(err)}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-center gap-3">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 transition-colors cursor-pointer"
                        >
                            View Employee Directory
                        </button>
                        <button
                            type="button"
                            onClick={() => { setStep(1); setFile(null); setUploadReport(null); setPreviewData([]); setEditingIdx(null); }}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer"
                        >
                            Upload More
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
