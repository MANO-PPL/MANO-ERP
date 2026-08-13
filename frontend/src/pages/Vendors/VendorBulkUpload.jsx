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
    ArrowLeft
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import api from '../../services/api';

const VendorBulkUpload = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Upload, 2: Preview, 3: Success
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadReport, setUploadReport] = useState(null);
    const [validation, setValidation] = useState(null);

    const isSupportedFile = (fileObj) => {
        if (!fileObj) return false;
        const name = fileObj.name.toLowerCase();
        return name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls') || fileObj.type === 'text/csv' || fileObj.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    };

    const handleFileDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && isSupportedFile(droppedFile)) {
            setFile(droppedFile);
            parseFile(droppedFile);
        } else {
            toast.error("Please upload a valid CSV or Excel file (.csv, .xlsx, .xls)");
        }
    };

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (!isSupportedFile(selectedFile)) {
                toast.error("Please upload a valid CSV or Excel file (.csv, .xlsx, .xls)");
                return;
            }
            setFile(selectedFile);
            parseFile(selectedFile);
        }
    };

    const processParsedData = async (data) => {
        try {
            const res = await api.post('/vendors/bulk-validate', { vendors: data });
            const report = res.data.validation;
            setValidation(report);

            const processed = data.map((row, idx) => {
                const rowNum = idx + 1;
                const errorMatches = (report.duplicates || []).filter(d => d.row === rowNum);

                let status = 'Valid';
                let errorMsg = '';

                if (errorMatches.length > 0) {
                    status = 'Error';
                    errorMsg = errorMatches.map(e => e.reason).join(', ');
                } else if (!row['Name'] && !row['name'] && !row['Company'] && !row['company']) {
                    status = 'Error';
                    errorMsg = 'Missing Name';
                }

                return {
                    ...row,
                    status,
                    errorMsg,
                    name: row['Name'] || row['name'] || row['Company'] || row['company'],
                    email: row['Email'] || row['email'],
                    contact_no: row['Contact No'] || row['contact no'] || row['Mobile'] || row['mobile'] || row['Telephone'] || row['telephone'],
                    jobNature: row['Job Nature'] || row['job nature'] || row['job_nature'] || row['Nature of Job'] || row['nature of job']
                };
            });

            setPreviewData(processed);
            setStep(2);
        } catch (error) {
            console.error('Validation Error:', error);
            toast.error("Failed to validate file data against the database.");
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

    const handleUpload = async () => {
        setIsUploading(true);
        try {
            const validRows = previewData.filter(r => r.status === 'Valid');

            if (validRows.length === 0) {
                toast.error("No valid data to upload");
                setIsUploading(false);
                return;
            }

            // In Step 2, user verified exactly these values. Send whole payload.
            const response = await api.post('/vendors/bulk-json', { vendors: validRows });

            if (response.data.ok || response.data.success) {
                const results = response.data.report;

                const finalReport = {
                    total_processed: validRows.length,
                    success_count: results.success_count,
                    failure_count: results.failure_count,
                    errors: results.errors || [],
                    skipped_rows: previewData.filter(r => r.status === 'Error')
                };

                setUploadReport(finalReport);
                setStep(3);
                toast.success('Bulk upload processed successfully');
            } else {
                toast.error("Partial upload failed");
            }

        } catch (error) {
            console.error('Upload Error:', error);
            toast.error(error.message || "Upload failed");
        } finally {
            setIsUploading(false);
        }
    };

    const downloadSample = () => {
        const csvContent = "Name,Contact Person,Designation,Contact No,Email,Location,Address,Website,GST,Category,Job Nature,Responsibility,Reference,Remarks\n" +
            "Acme Corp,John Smith,CEO,011-223344,john@acme.com,New York,123 Main St,www.acme.com,GST123,Supplier,Software Development,Manager,Previous Client,N/A\n" +
            "Global Tech,Jane Doe,Director,022-556677,jane@globaltech.com,Mumbai,456 Business Park,www.globaltech.com,GST456,Supplier,IT Services,Director,Referral,N/A";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "vendor_upload_template.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Vendor Bulk Upload</h2>

            {/* Back Button */}
            <button
                onClick={() => navigate('/vendors')}
                className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors mb-4"
            >
                <ArrowLeft size={20} />
                <span>Back to Vendors</span>
            </button>

            {/* Progress Steps */}
            <div className="flex items-center justify-center mb-8">
                <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'} transition-colors`}>1</div>
                    <span className={`ml-2 text-sm font-medium ${step >= 1 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Upload</span>
                </div>
                <div className={`w-16 h-0.5 mx-4 ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'} transition-colors`}>2</div>
                    <span className={`ml-2 text-sm font-medium ${step >= 2 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Preview & Verify</span>
                </div>
                <div className={`w-16 h-0.5 mx-4 ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'} transition-colors`}>3</div>
                    <span className={`ml-2 text-sm font-medium ${step >= 3 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Complete</span>
                </div>
            </div>

            {/* Step 1: Upload Area */}
            {step === 1 && (
                <div className="bg-white dark:bg-[#161b22] rounded-2xl p-8 sm:p-12 shadow-sm border border-slate-200 dark:border-white/10 text-center transition-colors duration-300">
                    <div
                        className="border-2 border-dashed border-slate-300 dark:border-white/20 rounded-xl p-10 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer group"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleFileDrop}
                        onClick={() => document.getElementById('fileInput').click()}
                    >
                        <input
                            type="file"
                            id="fileInput"
                            className="hidden"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileSelect}
                        />
                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                            <UploadCloud size={32} />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">Click to upload or drag and drop</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">Excel (.xlsx, .xls) or CSV files supported (Max 10MB)</p>
                        <button className="px-6 py-2 bg-slate-900 dark:bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors">
                            Select File
                        </button>
                    </div>

                    <div
                        onClick={downloadSample}
                        className="mt-8 flex items-center justify-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer">
                        <Download size={16} />
                        <span>Download Sample CSV Template</span>
                    </div>
                </div>
            )}

            {/* Step 2: Preview & Verify */}
            {step === 2 && (
                <div className="bg-white dark:bg-[#161b22] rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden transition-colors duration-300">
                    <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                <FileText className="text-indigo-600 dark:text-indigo-400" size={20} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-white">{file?.name}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{(file?.size / 1024).toFixed(2)} KB</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setStep(1); setFile(null); setValidation(null); }}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Backend Validation Warnings for New Entries */}
                    {validation && (
                        <div className="p-6 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                            <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-4">Verification Check</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {validation.new_job_natures?.length > 0 && (
                                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800/50">
                                        <h5 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <AlertCircle size={14} />
                                            New Job Natures ({validation.new_job_natures.length})
                                        </h5>
                                        <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">These will be created automatically:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {validation.new_job_natures.map((j, i) => (
                                                <span key={i} className="px-2 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 rounded">
                                                    {j}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            </div>
                            {(!validation.new_job_natures?.length && !validation.new_sectors?.length) && (
                                <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2 mt-2">
                                    <CheckCircle size={16} /> All Job Natures already exist in DB.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-white/5 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold">
                                <tr>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Contact No</th>
                                    <th className="px-6 py-4">Job Nature</th>
                                    <th className="px-6 py-4">Validation</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {previewData.slice(0, 50).map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                        <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200">{row.name || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{row.contact_no || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{row.jobNature || '-'}</td>
                                        <td className="px-6 py-4">
                                            {row.status === 'Valid' ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full">
                                                    <CheckCircle size={12} /> Valid
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full whitespace-nowrap" title={row.errorMsg}>
                                                    <AlertCircle size={12} /> {row.errorMsg}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {previewData.length > 50 && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-4 text-center text-xs text-slate-500 italic">
                                            ... and {previewData.length - 50} more rows
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-6 border-t border-slate-200 dark:border-white/10 flex justify-end gap-3 bg-white dark:bg-[#161b22]">
                        <button
                            onClick={() => setStep(1)}
                            className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUpload}
                            disabled={isUploading}
                            className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70"
                        >
                            {isUploading ? 'Uploading...' :
                                <>
                                    <span>Upload & Create New Entries</span>
                                    <ChevronRight size={16} />
                                </>
                            }
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Success */}
            {step === 3 && (
                <div className="text-center py-12 bg-white dark:bg-[#161b22] border-slate-200 dark:border-white/10 rounded-2xl border">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Upload Processed!</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto">
                        Processed: {uploadReport?.total_processed || 0} <br />
                        Success: {uploadReport?.success_count || 0} <br />
                        Skipped/Failed: {(uploadReport?.failure_count || 0) + (uploadReport?.skipped_rows?.length || 0)}
                    </p>

                    {/* Skipped Items Table */}
                    {uploadReport?.skipped_rows?.length > 0 && (
                        <div className="mb-8 mx-auto max-w-2xl text-left px-6">
                            <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-4">Skipped Items</h4>
                            <div className="border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden">
                                <div className="overflow-x-auto max-h-64">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 dark:bg-white/5 text-xs uppercase text-slate-500 dark:text-slate-400 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3">Name</th>
                                                <th className="px-4 py-3">Email</th>
                                                <th className="px-4 py-3">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                            {uploadReport.skipped_rows.map((row, i) => (
                                                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{row.name}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.email}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full whitespace-nowrap">
                                                            <AlertCircle size={10} /> {row.errorMsg || 'Skipped'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Generic Errors (Backend) */}
                    {uploadReport?.errors?.length > 0 && (
                        <div className="mb-8 max-w-lg mx-auto bg-red-50 dark:bg-red-900/10 p-4 rounded-lg text-left overflow-auto max-h-40">
                            <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">Other Errors:</h4>
                            <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-300 space-y-1">
                                {uploadReport.errors.map((err, i) => (
                                    <li key={i}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="flex justify-center gap-4">
                        <button
                            onClick={() => navigate('/vendors')}
                            className="px-6 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                        >
                            View Vendor List
                        </button>
                        <button
                            onClick={() => { setStep(1); setFile(null); setUploadReport(null); }}
                            className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-colors"
                        >
                            Upload More
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VendorBulkUpload;
