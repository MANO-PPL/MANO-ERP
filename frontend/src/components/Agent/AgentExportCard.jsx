import React, { useState } from 'react';
import { FileSpreadsheet, Download, CheckCircle2, ChevronDown, ChevronUp, Table } from 'lucide-react';

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function AgentExportCard({ exportData, preview = false }) {
    const [downloaded, setDownloaded] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    if (!exportData) return null;

    const {
        title = 'ERP Spreadsheet Report',
        filename = 'MANO_Report.xlsx',
        rowCount = 0,
        columnCount = 0,
        fileSizeBytes = 0,
        downloadUrl,
        columns = [],
        sampleRows = []
    } = exportData;

    const handleDownloadClick = (e) => {
        if (preview) {
            e.preventDefault();
        }
        setDownloaded(true);
        setTimeout(() => setDownloaded(false), 4000);
    };

    return (
        <section
            className="my-3 overflow-hidden rounded-xl border border-emerald-200/80 bg-white shadow-sm transition-all hover:shadow-md dark:border-emerald-900/60 dark:bg-gh-subtle"
            aria-label={`Excel Export: ${title}`}
        >
            {/* Top Accent Banner */}
            <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-slate-900 px-4 py-3 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40">
                            <FileSpreadsheet size={18} aria-hidden="true" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold tracking-wide text-white uppercase">{title}</h3>
                                {preview && (
                                    <span className="rounded bg-amber-500/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-200 ring-1 ring-amber-400/40">
                                        Preview
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-emerald-200/80">
                                Formatted Excel Workbook (.xlsx) · High-fidelity report
                            </p>
                        </div>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/20">
                        <CheckCircle2 size={11} /> Ready
                    </span>
                </div>
            </div>

            {/* Body Info & Actions */}
            <div className="p-4">
                {/* Stats Pills */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-2 text-center dark:border-gh-border dark:bg-gh-dark">
                        <span className="block text-[10px] font-medium text-gray-500 uppercase dark:text-gh-muted">Total Rows</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{rowCount}</span>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-2 text-center dark:border-gh-border dark:bg-gh-dark">
                        <span className="block text-[10px] font-medium text-gray-500 uppercase dark:text-gh-muted">Columns</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{columnCount || columns.length}</span>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-2 text-center dark:border-gh-border dark:bg-gh-dark">
                        <span className="block text-[10px] font-medium text-gray-500 uppercase dark:text-gh-muted">File Size</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatBytes(fileSizeBytes)}</span>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-2 text-center dark:border-gh-border dark:bg-gh-dark">
                        <span className="block text-[10px] font-medium text-gray-500 uppercase dark:text-gh-muted">Format</span>
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">.XLSX</span>
                    </div>
                </div>

                {/* Filename callout */}
                <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                    <span className="font-mono text-[11px] truncate max-w-[280px] sm:max-w-none">{filename}</span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 shrink-0 ml-2">Valid for 30m</span>
                </div>

                {/* Action Buttons */}
                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gh-border">
                    {sampleRows.length > 0 ? (
                        <button
                            type="button"
                            onClick={() => setShowPreview(!showPreview)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gh-hover dark:hover:text-white transition-colors"
                        >
                            <Table size={14} />
                            <span>{showPreview ? 'Hide Sample Preview' : 'Preview Sample Rows'}</span>
                            {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    ) : <div />}

                    <a
                        href={preview ? '#' : downloadUrl}
                        download={filename}
                        onClick={handleDownloadClick}
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
                            downloaded
                                ? 'bg-emerald-700 text-white'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow active:scale-[0.98] dark:bg-emerald-600 dark:hover:bg-emerald-500'
                        }`}
                    >
                        {downloaded ? (
                            <>
                                <CheckCircle2 size={15} />
                                <span>{preview ? 'Simulated Download' : 'Downloaded Successfully'}</span>
                            </>
                        ) : (
                            <>
                                <Download size={15} />
                                <span>Download Spreadsheet (.xlsx)</span>
                            </>
                        )}
                    </a>
                </div>

                {/* Collapsible Sample Table Preview */}
                {showPreview && sampleRows.length > 0 && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-50/40 dark:border-gh-border dark:bg-gh-dark">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="bg-slate-800 text-white">
                                        {columns.map((col, idx) => (
                                            <th key={idx} scope="col" className="px-3 py-2 text-[11px] font-semibold whitespace-nowrap">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                    {sampleRows.map((row, rowIdx) => (
                                        <tr
                                            key={rowIdx}
                                            className={rowIdx % 2 === 0 ? 'bg-white dark:bg-gh-subtle' : 'bg-gray-50/80 dark:bg-gh-dark'}
                                        >
                                            {row.map((cell, cellIdx) => (
                                                <td
                                                    key={cellIdx}
                                                    className="px-3 py-1.5 text-gray-700 dark:text-gray-300 whitespace-nowrap text-[11px]"
                                                >
                                                    {cell !== null && cell !== undefined ? String(cell) : '-'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-gray-100 px-3 py-1.5 text-[10px] text-gray-500 dark:bg-gh-border/50 dark:text-gh-muted">
                            Showing first {sampleRows.length} rows of {rowCount} total records.
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

export default AgentExportCard;
