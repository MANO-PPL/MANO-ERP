import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
    UploadCloud,
    ClipboardPaste,
    FileSpreadsheet,
    FileText,
    CheckCircle,
    X,
    Check,
    AlertCircle
} from 'lucide-react';
import { parseRawRowsToEntities, parseTSV } from './excelUtils';

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
    const fileInputRef = useRef(null);

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

    const handleCommit = () => {
        if (parsedData.length === 0) return;
        onCommitImport(parsedData, importMode);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[6000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            <FileSpreadsheet size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                Import {entityName} Spreadsheet
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Upload Excel/CSV file or paste copied cells directly from Excel
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-5 pt-3 border-b border-gray-200 dark:border-white/10 flex items-center gap-4 bg-gray-50/20 dark:bg-transparent text-xs font-bold">
                    <button
                        onClick={() => {
                            setActiveTab('upload');
                            setErrorMsg('');
                        }}
                        className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                            activeTab === 'upload'
                                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                    >
                        <UploadCloud size={14} />
                        <span>Upload File (.xlsx, .csv)</span>
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('paste');
                            setErrorMsg('');
                        }}
                        className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                            activeTab === 'paste'
                                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                    >
                        <ClipboardPaste size={14} />
                        <span>Paste from Excel / Clipboard</span>
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 overflow-y-auto space-y-4 flex-1">
                    {/* Tab 1: Upload File */}
                    {activeTab === 'upload' && (
                        <div>
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
                                className="border-2 border-dashed border-gray-300 dark:border-white/10 hover:border-blue-500 dark:hover:border-blue-500/50 rounded-xl p-8 text-center cursor-pointer transition-all bg-gray-50/50 dark:bg-white/[0.01]"
                            >
                                <UploadCloud size={36} className="mx-auto text-blue-600 dark:text-blue-400 mb-2" />
                                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                    {fileName ? fileName : 'Click to select or drag & drop spreadsheet file'}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-1">Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv)</p>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Paste Textarea */}
                    {activeTab === 'paste' && (
                        <div>
                            <textarea
                                rows={6}
                                value={pasteText}
                                onChange={(e) => handlePasteTextParse(e.target.value)}
                                placeholder="Click here and press Ctrl+V to paste copied cells from Microsoft Excel or Google Sheets..."
                                className="w-full p-3 text-xs font-mono bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    )}

                    {/* Error Message */}
                    {errorMsg && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-semibold">
                            <AlertCircle size={14} className="shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Preview Table */}
                    {parsedData.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                    <CheckCircle size={14} className="text-emerald-500" />
                                    Parsed {parsedData.length} valid row(s) ready to import
                                </span>

                                {/* Append vs Replace Mode */}
                                <div className="flex items-center gap-2 text-xs font-semibold">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="importMode"
                                            value="append"
                                            checked={importMode === 'append'}
                                            onChange={() => setImportMode('append')}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span>Append to Table</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer ml-2">
                                        <input
                                            type="radio"
                                            name="importMode"
                                            value="replace"
                                            checked={importMode === 'replace'}
                                            onChange={() => setImportMode('replace')}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span>Replace Existing</span>
                                    </label>
                                </div>
                            </div>

                            {/* Preview Grid Table */}
                            <div className="max-h-48 overflow-auto border border-gray-200 dark:border-white/10 rounded-lg text-xs scrollbar-thin">
                                <table className="w-full border-collapse">
                                    <thead className="sticky top-0 bg-gray-100 dark:bg-[#161b22] text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-white/10">
                                        <tr>
                                            <th className="px-2.5 py-1.5 text-center w-8">#</th>
                                            {columns.slice(0, 6).map((c) => (
                                                <th key={c.key} className="px-2.5 py-1.5 text-left truncate">
                                                    {c.label || c.key}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                        {parsedData.slice(0, 10).map((r, i) => (
                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                                                <td className="px-2.5 py-1.5 text-center text-gray-400 font-mono text-[10px]">
                                                    {i + 1}
                                                </td>
                                                {columns.slice(0, 6).map((c) => (
                                                    <td key={c.key} className="px-2.5 py-1.5 truncate max-w-[140px] text-gray-800 dark:text-gray-200">
                                                        {r[c.key] !== undefined && r[c.key] !== null ? String(r[c.key]) : '—'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {parsedData.length > 10 && (
                                <p className="text-[10px] text-gray-400 italic">Showing first 10 of {parsedData.length} rows</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-200 dark:border-white/10 flex items-center justify-end gap-2 bg-gray-50/50 dark:bg-white/[0.02]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleCommit}
                        disabled={parsedData.length === 0}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                        <Check size={13} className="stroke-[3]" />
                        <span>Import {parsedData.length > 0 ? `(${parsedData.length} Rows)` : ''}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExcelImportModal;
