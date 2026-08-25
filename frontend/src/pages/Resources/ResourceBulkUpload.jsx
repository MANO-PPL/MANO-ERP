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
    Layers,
    Package,
    Users
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import { resourceApi } from '../../services/resourceApi';

const ResourceBulkUpload = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Upload, 2: Preview & Verify, 3: Complete
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
            const res = await resourceApi.bulkValidate(data);
            const report = res.validation || {};
            setValidation(report);

            const duplicateRows = new Set((report.duplicates || []).map(d => d.row));
            const missingFieldRows = new Map((report.missing_fields || []).map(m => [m.row, m.reason]));
            const invalidTypeRows = new Map((report.invalid_types || []).map(t => [t.row, t.reason]));

            const processed = data.map((row, idx) => {
                const rowNum = idx + 1;
                const name = (row['Name'] || row['name'] || row['Resource Name'] || row['resource_name'] || row['Item Name'] || '').toString().trim();
                const code = (row['Code'] || row['code'] || row['Resource Code'] || row['resource_code'] || '').toString().trim();
                const type = (row['Type'] || row['type'] || row['Resource Type'] || row['resource_type'] || 'material').toString().toLowerCase().trim();
                const unit = (row['Base Unit'] || row['base_unit'] || row['Unit'] || row['unit'] || row['Unit Code'] || row['base_unit_code'] || '').toString().trim();
                const rawRate = row['Rate'] !== undefined ? row['Rate'] : (row['rate'] !== undefined ? row['rate'] : row['Price']);
                const rate = (rawRate !== undefined && rawRate !== null && rawRate !== '') ? Number(rawRate) : '';
                const rateUnit = (row['Rate Unit'] || row['rate_unit'] || unit).toString().trim();
                const description = (row['Description'] || row['description'] || '').toString().trim();
                const remarks = (row['Remarks'] || row['remarks'] || '').toString().trim();

                const errors = [];
                if (duplicateRows.has(rowNum)) {
                    const dup = (report.duplicates || []).find(d => d.row === rowNum);
                    errors.push(dup?.reason || 'Duplicate resource');
                }
                if (missingFieldRows.has(rowNum)) {
                    errors.push(missingFieldRows.get(rowNum));
                }
                if (invalidTypeRows.has(rowNum)) {
                    errors.push(invalidTypeRows.get(rowNum));
                }

                if (!name) errors.push('Missing Name');
                if (!unit) errors.push('Missing Base Unit');
                if (type && !['material', 'item', 'labour'].includes(type)) errors.push('Invalid type (must be material, item, or labour)');

                const status = errors.length > 0 ? 'Error' : 'Valid';

                return {
                    ...row,
                    rowNum,
                    status,
                    errorMsg: errors.join('; '),
                    name,
                    code,
                    type,
                    base_unit_code: unit,
                    rate: rate !== '' && !Number.isNaN(rate) ? rate : undefined,
                    rate_unit_code: rateUnit || unit,
                    description,
                    remarks
                };
            });

            setPreviewData(processed);
            setStep(2);
        } catch (error) {
            console.error('Validation Error:', error);
            toast.error("Failed to validate resource file against database.");
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
                toast.error("No valid resources to upload");
                setIsUploading(false);
                return;
            }

            const cleanPayload = validRows.map(r => ({
                name: r.name,
                code: r.code || undefined,
                type: r.type,
                base_unit_code: r.base_unit_code,
                rate: r.rate,
                rate_unit_code: r.rate_unit_code,
                description: r.description || undefined,
                remarks: r.remarks || undefined
            }));

            const response = await resourceApi.bulkJson(cleanPayload);

            if (response.success) {
                const results = response.report || {};
                const finalReport = {
                    total_processed: validRows.length,
                    success_count: results.successCount || validRows.length,
                    errors: results.errors || [],
                    skipped_rows: previewData.filter(r => r.status === 'Error')
                };

                setUploadReport(finalReport);
                setStep(3);
                toast.success('Bulk upload processed successfully');
            } else {
                toast.error("Bulk upload failed");
            }
        } catch (error) {
            console.error('Upload Error:', error);
            toast.error(error.response?.data?.message || error.message || "Upload failed");
        } finally {
            setIsUploading(false);
        }
    };

    const downloadSample = () => {
        const csvContent = "Name,Code,Type,Base Unit,Rate,Rate Unit,Description,Remarks\n" +
            "River Sand,MAT-SND,material,kg,2.50,kg,Fine graded river sand,High quality\n" +
            "Portland Cement 53 Grade,MAT-CEM,material,kg,8.00,kg,Standard Portland cement,50kg bags\n" +
            "Mason Grade 1,LAB-MAS,labour,hr,450.00,hr,Skilled masonry labour,Certified\n" +
            "Ready Mix Concrete M20,ITM-RMC20,item,cum,,,Composite concrete mix (recipes configured in app),Item recipe";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "resources_bulk_upload_template.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getTypeBadge = (type) => {
        switch (type) {
            case 'item':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40"><Layers size={11} /> Item</span>;
            case 'labour':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40"><Users size={11} /> Labour</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40"><Package size={11} /> Material</span>;
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Resource Bulk Upload</h2>

            {/* Back Button */}
            <button
                onClick={() => navigate('/resources')}
                className="flex items-center gap-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
            >
                <ArrowLeft size={18} />
                <span className="text-sm font-medium">Back to Resources</span>
            </button>

            {/* Progress Steps */}
            <div className="flex items-center justify-center mb-6">
                <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'} transition-colors`}>1</div>
                    <span className={`ml-2 text-sm font-medium ${step >= 1 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>Upload File</span>
                </div>
                <div className={`w-16 h-0.5 mx-4 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'} transition-colors`}>2</div>
                    <span className={`ml-2 text-sm font-medium ${step >= 2 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>Preview & Verify</span>
                </div>
                <div className={`w-16 h-0.5 mx-4 ${step >= 3 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'} transition-colors`}>3</div>
                    <span className={`ml-2 text-sm font-medium ${step >= 3 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>Complete</span>
                </div>
            </div>

            {/* Step 1: Upload Area */}
            {step === 1 && (
                <div className="bg-white dark:bg-[#161b22] rounded-2xl p-8 sm:p-12 shadow-sm border border-slate-200 dark:border-white/10 text-center transition-colors duration-300">
                    <div
                        className="border-2 border-dashed border-slate-300 dark:border-white/20 rounded-xl p-10 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer group"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleFileDrop}
                        onClick={() => document.getElementById('resourceFileInput').click()}
                    >
                        <input
                            type="file"
                            id="resourceFileInput"
                            className="hidden"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileSelect}
                        />
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                            <UploadCloud size={32} />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">Click to upload or drag and drop</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">Excel (.xlsx, .xls) or CSV files supported</p>
                        <button className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm">
                            Select File
                        </button>
                    </div>

                    <div
                        onClick={downloadSample}
                        className="mt-6 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer font-medium hover:underline"
                    >
                        <Download size={16} />
                        <span>Download Sample CSV Template</span>
                    </div>

                    <div className="mt-8 text-left bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                        <div className="font-bold text-slate-800 dark:text-slate-200">Tips for resource bulk upload:</div>
                        <div>• <b>Name</b>, <b>Type</b> (<code>material</code>, <code>item</code>, <code>labour</code>), and <b>Base Unit</b> are required for each row.</div>
                        <div>• <b>Rate</b> is optional. For composite items, rates can be left blank and configured via recipes later.</div>
                        <div>• Duplicate names or codes already in your master inventory will be flagged.</div>
                    </div>
                </div>
            )}

            {/* Step 2: Preview & Validation Table */}
            {step === 2 && (
                <div className="bg-white dark:bg-[#161b22] rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Review & Verify Resources</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Found {previewData.length} row(s) • {previewData.filter(r => r.status === 'Valid').length} Valid, {previewData.filter(r => r.status === 'Error').length} Error(s)
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => { setStep(1); setFile(null); setPreviewData([]); }}
                                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition"
                            >
                                Cancel / Re-upload
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={isUploading || previewData.filter(r => r.status === 'Valid').length === 0}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-sm transition active:scale-[0.98] flex items-center gap-2"
                            >
                                {isUploading ? 'Uploading...' : `Upload ${previewData.filter(r => r.status === 'Valid').length} Resource(s)`}
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[500px] border border-slate-200 dark:border-white/10 rounded-xl">
                        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                            <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 uppercase font-semibold sticky top-0 z-10 border-b border-slate-200 dark:border-white/10">
                                <tr>
                                    <th className="px-3 py-2.5">Row</th>
                                    <th className="px-3 py-2.5">Status</th>
                                    <th className="px-3 py-2.5">Name</th>
                                    <th className="px-3 py-2.5">Code</th>
                                    <th className="px-3 py-2.5">Type</th>
                                    <th className="px-3 py-2.5">Base Unit</th>
                                    <th className="px-3 py-2.5">Rate</th>
                                    <th className="px-3 py-2.5">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {previewData.map((row, idx) => (
                                    <tr key={idx} className={row.status === 'Error' ? 'bg-red-50/50 dark:bg-red-950/20' : 'hover:bg-slate-50/50 dark:hover:bg-white/5'}>
                                        <td className="px-3 py-2 font-mono text-slate-400">{row.rowNum}</td>
                                        <td className="px-3 py-2">
                                            {row.status === 'Valid' ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                                    <CheckCircle size={14} /> Valid
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold" title={row.errorMsg}>
                                                    <AlertCircle size={14} /> {row.errorMsg || 'Error'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 font-semibold text-slate-800 dark:text-white">{row.name || '—'}</td>
                                        <td className="px-3 py-2 font-mono text-slate-500">{row.code || '—'}</td>
                                        <td className="px-3 py-2">{getTypeBadge(row.type)}</td>
                                        <td className="px-3 py-2 font-mono">{row.base_unit_code || '—'}</td>
                                        <td className="px-3 py-2 font-mono font-medium">
                                            {row.rate !== undefined ? `₹${Number(row.rate).toFixed(2)}` : <span className="text-slate-400 italic">No rate</span>}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500 max-w-[200px] truncate">{row.remarks || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Step 3: Complete / Summary */}
            {step === 3 && uploadReport && (
                <div className="bg-white dark:bg-[#161b22] rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-white/10 text-center space-y-6">
                    <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle size={36} />
                    </div>

                    <div>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white">Bulk Upload Completed!</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Successfully imported {uploadReport.success_count} resource(s) into your organization inventory.
                        </p>
                    </div>

                    {uploadReport.errors && uploadReport.errors.length > 0 && (
                        <div className="text-left bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 p-4 rounded-xl text-xs space-y-1">
                            <div className="font-bold text-red-700 dark:text-red-300">Errors Encountered:</div>
                            {uploadReport.errors.map((e, idx) => (
                                <div key={idx} className="text-red-600 dark:text-red-400">
                                    • Row {e.index + 1} ({e.name}): {e.error}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-center gap-4 pt-2">
                        <button
                            onClick={() => navigate('/resources')}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition shadow-sm"
                        >
                            Go to Resource Inventory
                        </button>
                        <button
                            onClick={() => { setStep(1); setFile(null); setPreviewData([]); setUploadReport(null); }}
                            className="px-5 py-2.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 font-medium rounded-lg text-sm transition"
                        >
                            Upload Another File
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResourceBulkUpload;
