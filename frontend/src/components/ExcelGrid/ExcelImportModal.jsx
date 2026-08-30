import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
    UploadCloud,
    ClipboardPaste,
    FileSpreadsheet,
    FileText,
    CheckCircle2,
    X,
    Check,
    AlertCircle,
    Download,
    Copy,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Eye,
    TableProperties,
    Layers,
    ShieldAlert,
    ArrowRight
} from 'lucide-react';
import {
    parseRawRowsToEntities,
    parseTSV,
    stringifyTSV,
    generateDemoSampleRows,
    downloadExcelTemplate,
    downloadCSVTemplate
} from './excelUtils';

export const ExcelImportModal = ({
    isOpen,
    onClose,
    columns = [],
    primaryKey = 'id',
    entityName = 'Items',
    onCommitImport,
    initialTab = 'upload'
}) => {
    const [activeTab, setActiveTab] = useState(initialTab); // 'upload' | 'paste'
    const [fileName, setFileName] = useState('');
    const [pasteText, setPasteText] = useState('');
    const [parsedData, setParsedData] = useState([]);
    const [importMode, setImportMode] = useState('append'); // 'append' | 'replace'
    const [errorMsg, setErrorMsg] = useState('');
    const [isCopiedSample, setIsCopiedSample] = useState(false);
    const [showDemoPreview, setShowDemoPreview] = useState(false);
    const fileInputRef = useRef(null);

    const visibleCols = useMemo(() => {
        return columns.filter(c => !c.readOnly && c.key !== 'permissions_access' && c.key !== 'permissions_action');
    }, [columns]);

    const demoSampleRows = useMemo(() => {
        return generateDemoSampleRows(visibleCols, entityName);
    }, [visibleCols, entityName]);

    // Calculate validation issue count in parsed data
    const validationIssues = useMemo(() => {
        let count = 0;
        parsedData.forEach(row => {
            if (row._errors && Object.keys(row._errors).length > 0) {
                count += Object.keys(row._errors).length;
            }
        });
        return count;
    }, [parsedData]);

    if (!isOpen) return null;

    const handleFile = (file) => {
        if (!file) return;
        setFileName(file.name);
        setErrorMsg('');
        const lower = file.name.toLowerCase();

        if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    let sheetName = workbook.SheetNames[0];
                    for (const name of workbook.SheetNames) {
                        const sheet = workbook.Sheets[name];
                        if (sheet && sheet['!ref']) {
                            sheetName = name;
                            break;
                        }
                    }
                    const sheet = workbook.Sheets[sheetName];
                    const rawAoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                    const entities = parseRawRowsToEntities(rawAoa, columns, primaryKey);
                    if (entities.length === 0) {
                        setErrorMsg('No valid rows found in selected spreadsheet sheet.');
                    } else {
                        setParsedData(entities);
                    }
                } catch (err) {
                    console.error('Excel parse error:', err);
                    setErrorMsg('Failed to parse Excel file. Please check file formatting.');
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            Papa.parse(file, {
                skipEmptyLines: true,
                complete: (results) => {
                    if (!results.data || results.data.length === 0) {
                        setErrorMsg('Uploaded CSV file contains no data.');
                        return;
                    }
                    const entities = parseRawRowsToEntities(results.data, columns, primaryKey);
                    if (entities.length === 0) {
                        setErrorMsg('No valid rows could be mapped from CSV.');
                    } else {
                        setParsedData(entities);
                    }
                },
                error: (err) => {
                    console.error('CSV parse error:', err);
                    setErrorMsg('Failed to read CSV spreadsheet file.');
                }
            });
        }
    };

    const handlePasteTextParse = (text) => {
        setPasteText(text);
        setErrorMsg('');
        if (!text || !text.trim()) {
            setParsedData([]);
            return;
        }

        const rawRows = parseTSV(text);
        if (rawRows.length === 0) {
            setParsedData([]);
            return;
        }

        const entities = parseRawRowsToEntities(rawRows, columns, primaryKey);
        if (entities.length === 0) {
            setErrorMsg('No valid rows could be mapped from pasted data.');
        } else {
            setParsedData(entities);
        }
    };

    const handleCopyDemoSample = () => {
        if (demoSampleRows.length === 0) return;
        const headers = visibleCols.map(c => c.label || c.key);
        const dataRows = demoSampleRows.map(r => visibleCols.map(c => r[c.key] ?? ''));
        const matrix = [headers, ...dataRows];
        const tsv = stringifyTSV(matrix);

        navigator.clipboard.writeText(tsv).then(() => {
            setIsCopiedSample(true);
            setTimeout(() => setIsCopiedSample(false), 2000);
        });
    };

    const handleLoadSampleDataIntoPaste = () => {
        const headers = visibleCols.map(c => c.label || c.key);
        const dataRows = demoSampleRows.map(r => visibleCols.map(c => r[c.key] ?? ''));
        const matrix = [headers, ...dataRows];
        const tsv = stringifyTSV(matrix);
        handlePasteTextParse(tsv);
    };

    const handleCommit = () => {
        if (parsedData.length === 0) return;
        onCommitImport(parsedData, importMode);
        onClose();
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[6000] bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Generous High-Visibility Right Slide-in Sidebar Drawer */}
            <div className="fixed inset-y-0 right-0 w-full max-w-2xl md:max-w-3xl lg:max-w-4xl bg-white dark:bg-[#161b22] shadow-2xl z-[6001] flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="px-5 py-3 border-b border-gray-100 dark:border-white/10 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-[#0d1117]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/50 dark:border-blue-500/20 shadow-2xs">
                            <FileSpreadsheet size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                                    Import {entityName} Spreadsheet
                                </h2>
                                <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                                    Excel / CSV
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Upload a spreadsheet file or paste copied cells directly for real-time validation and import
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tab Switcher */}
                <div className="px-5 pt-2 border-b border-gray-100 dark:border-white/10 flex items-center gap-4 bg-gray-50/30 dark:bg-transparent text-xs font-bold shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab('upload');
                            setErrorMsg('');
                        }}
                        className={`pb-2 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                            activeTab === 'upload'
                                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-bold'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                    >
                        <UploadCloud size={15} />
                        <span>Upload File (.xlsx, .csv)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab('paste');
                            setErrorMsg('');
                        }}
                        className={`pb-2 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                            activeTab === 'paste'
                                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-bold'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                    >
                        <ClipboardPaste size={15} />
                        <span>Paste from Excel / Clipboard</span>
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-4 overflow-y-auto space-y-3.5 flex-1 custom-scrollbar">
                    {/* Starter Demo Template Box */}
                    <div className="p-3 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200/70 dark:border-blue-800/40 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles size={15} className="text-blue-600 dark:text-blue-400" />
                                <span className="text-xs font-bold text-gray-900 dark:text-white">
                                    Starter Demo Template
                                </span>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400 hidden sm:inline">
                                    — formatted sample data for {entityName}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDemoPreview(!showDemoPreview)}
                                className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                                <Eye size={13} />
                                <span>{showDemoPreview ? 'Hide Sample Preview' : 'Preview Sample Structure'}</span>
                                {showDemoPreview ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                        </div>

                        {/* Quick Action Download / Copy Buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => downloadExcelTemplate(columns, entityName, true)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                title={`Download pre-filled ${entityName} Excel template`}
                            >
                                <Download size={13} className="stroke-[2.5]" />
                                <span>Download Demo (.xlsx)</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => downloadCSVTemplate(columns, entityName, true)}
                                className="px-3 py-1.5 bg-white dark:bg-[#161b22] hover:bg-gray-50 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                title={`Download pre-filled ${entityName} CSV template`}
                            >
                                <FileText size={13} className="text-blue-500" />
                                <span>Download CSV (.csv)</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleCopyDemoSample}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                    isCopiedSample
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                                        : 'bg-white dark:bg-[#161b22] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                                title="Copy sample table rows to clipboard for instant pasting"
                            >
                                {isCopiedSample ? <Check size={13} className="text-emerald-600 stroke-[3]" /> : <Copy size={13} className="text-purple-500" />}
                                <span>{isCopiedSample ? 'Copied to Clipboard!' : 'Copy Sample Rows'}</span>
                            </button>
                        </div>

                        {/* Collapsible Sample Table Preview */}
                        {showDemoPreview && (
                            <div className="pt-1.5 space-y-1.5 animate-in fade-in duration-150">
                                <div className="max-h-36 overflow-auto border border-blue-200 dark:border-blue-800/40 rounded-xl text-xs bg-white dark:bg-[#161b22] scrollbar-thin">
                                    <table className="w-full border-collapse">
                                        <thead className="sticky top-0 bg-blue-50 dark:bg-blue-950/90 text-[10px] uppercase font-bold text-blue-900 dark:text-blue-200 border-b border-blue-200 dark:border-blue-800/40">
                                            <tr>
                                                <th className="px-3 py-2 text-center w-8">#</th>
                                                {visibleCols.map(c => (
                                                    <th key={c.key} className="px-3 py-2 text-left truncate min-w-[130px]">
                                                        {c.label || c.key}
                                                        {c.required && <span className="text-red-500 ml-0.5">*</span>}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs">
                                            {demoSampleRows.map((r, i) => (
                                                <tr key={i} className="hover:bg-blue-50/30 dark:hover:bg-white/[0.02]">
                                                    <td className="px-3 py-2 text-center text-gray-400 font-mono text-[11px]">
                                                        {i + 1}
                                                    </td>
                                                    {visibleCols.map(c => (
                                                        <td key={c.key} className="px-3 py-2 truncate max-w-[180px] text-gray-800 dark:text-gray-200 font-medium">
                                                            {r[c.key] !== undefined && r[c.key] !== null ? String(r[c.key]) : '—'}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Tab 1: Upload File */}
                    {activeTab === 'upload' && (
                        <div className="space-y-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={(e) => handleFile(e.target.files?.[0])}
                                className="hidden"
                            />
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    handleFile(e.dataTransfer.files?.[0]);
                                }}
                                className="border-2 border-dashed border-gray-300 dark:border-white/10 hover:border-blue-500 dark:hover:border-blue-500/50 rounded-xl p-5 text-center cursor-pointer transition-all bg-gray-50/50 dark:bg-white/[0.01] hover:bg-blue-50/20 group"
                            >
                                <UploadCloud size={28} className="mx-auto text-blue-600 dark:text-blue-400 mb-1.5 stroke-[1.8] group-hover:scale-110 transition-transform" />
                                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                    {fileName ? fileName : 'Click to browse or drag & drop spreadsheet file (.xlsx, .csv)'}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5">Supports Microsoft Excel (.xlsx, .xls) and standard CSV (.csv)</p>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Paste Textarea */}
                    {activeTab === 'paste' && (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                                    Paste table cells copied directly from Excel (Ctrl + V):
                                </label>
                                <button
                                    type="button"
                                    onClick={handleLoadSampleDataIntoPaste}
                                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                                    title="Load starter demo sample rows into this box"
                                >
                                    <Sparkles size={13} />
                                    <span>Fill with Demo Sample</span>
                                </button>
                            </div>
                            <textarea
                                rows={4}
                                value={pasteText}
                                onChange={(e) => handlePasteTextParse(e.target.value)}
                                placeholder="Click here and press Ctrl+V to paste copied cells from Microsoft Excel or Google Sheets..."
                                className="w-full p-2.5 text-xs font-mono bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                            />
                        </div>
                    )}

                    {/* Error Message */}
                    {errorMsg && (
                        <div className="flex items-center gap-2 p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold animate-in fade-in">
                            <AlertCircle size={14} className="shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Real-time Data Preview & Confirmation Card */}
                    {parsedData.length > 0 && (
                        <div className="space-y-3 pt-1 animate-in fade-in duration-200">
                            {/* Live Status and Mode Bar */}
                            <div className="p-3 bg-gray-50/80 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                        <CheckCircle2 size={15} className="text-emerald-500" />
                                        <span>{parsedData.length} Row(s) Parsed in Real-Time</span>
                                    </span>
                                    {validationIssues > 0 && (
                                        <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold border border-amber-200 dark:border-amber-800/50 flex items-center gap-1">
                                            <ShieldAlert size={12} />
                                            <span>{validationIssues} field warning(s)</span>
                                        </span>
                                    )}
                                </div>

                                {/* Append vs Replace Mode Switcher */}
                                <div className="flex items-center gap-2 text-xs font-semibold bg-white dark:bg-[#161b22] p-1 rounded-lg border border-gray-200 dark:border-white/10 shadow-2xs">
                                    <button
                                        type="button"
                                        onClick={() => setImportMode('append')}
                                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                            importMode === 'append'
                                                ? 'bg-blue-600 text-white font-bold shadow-2xs'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                        }`}
                                    >
                                        Append (+{parsedData.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setImportMode('replace')}
                                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                            importMode === 'replace'
                                                ? 'bg-blue-600 text-white font-bold shadow-2xs'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                        }`}
                                    >
                                        Replace Existing
                                    </button>
                                </div>
                            </div>

                            {/* Clear, Large Real-Time Table Preview */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    <span>Real-Time Data Verification Preview:</span>
                                    <span>{visibleCols.length} Columns Mapped</span>
                                </div>

                                <div className="max-h-64 overflow-auto border border-gray-200 dark:border-white/10 rounded-xl text-xs bg-white dark:bg-[#161b22] shadow-xs scrollbar-thin">
                                    <table className="w-full border-collapse">
                                        <thead className="sticky top-0 bg-gray-100 dark:bg-[#0d1117] text-[11px] uppercase font-bold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-white/10 z-10">
                                            <tr>
                                                <th className="px-3 py-2.5 text-center w-10 border-r border-gray-200 dark:border-white/10">
                                                    #
                                                </th>
                                                {visibleCols.map((c) => (
                                                    <th key={c.key} className="px-3.5 py-2.5 text-left truncate min-w-[150px] border-r border-gray-200/50 dark:border-white/5 last:border-r-0">
                                                        <div className="flex items-center justify-between">
                                                            <span>{c.label || c.key}</span>
                                                            {c.required && <span className="text-red-500 font-bold ml-1">*</span>}
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                            {parsedData.map((r, i) => (
                                                <tr key={i} className="hover:bg-blue-50/30 dark:hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-3 py-2.5 text-center text-gray-400 font-mono text-xs border-r border-gray-100 dark:border-white/5">
                                                        {i + 1}
                                                    </td>
                                                    {visibleCols.map((c) => {
                                                        const val = r[c.key];
                                                        const hasError = r._errors?.[c.key];
                                                        return (
                                                            <td
                                                                key={c.key}
                                                                className={`px-3.5 py-2.5 truncate max-w-[220px] font-medium border-r border-gray-100 dark:border-white/5 last:border-r-0 ${
                                                                    hasError
                                                                        ? 'bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-bold'
                                                                        : 'text-gray-900 dark:text-gray-100'
                                                                }`}
                                                                title={hasError || String(val || '')}
                                                            >
                                                                {val !== undefined && val !== null && String(val).trim() !== '' ? (
                                                                    String(val)
                                                                ) : (
                                                                    <span className="text-gray-400 dark:text-gray-600 italic">
                                                                        {c.required ? 'Missing Required *' : '—'}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Confirmation Callout Banner */}
                            <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/40 rounded-xl flex items-center justify-between gap-3">
                                <div className="text-xs text-blue-900 dark:text-blue-200">
                                    <span className="font-bold">Confirmation Summary:</span> Ready to {importMode === 'append' ? 'append' : 'replace with'}{' '}
                                    <span className="font-extrabold">{parsedData.length} row(s)</span> into the <span className="font-bold">{entityName}</span> table.
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCommit}
                                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
                                >
                                    <span>Proceed Import</span>
                                    <ArrowRight size={13} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sticky Bottom Footer */}
                <div className="px-5 py-3 border-t border-gray-100 dark:border-white/10 flex items-center justify-between shrink-0 bg-white dark:bg-[#161b22]">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {parsedData.length > 0 ? (
                            <span>{parsedData.length} item(s) selected for import</span>
                        ) : (
                            <span>Select file or paste text to preview</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleCommit}
                            disabled={parsedData.length === 0}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95"
                        >
                            <Check size={14} className="stroke-[3]" />
                            <span>Import {parsedData.length > 0 ? `(${parsedData.length} Rows)` : ''}</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ExcelImportModal;
