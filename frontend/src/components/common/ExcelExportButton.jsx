import React, { useState, useRef, useEffect } from 'react';
import { FileSpreadsheet, Download, ChevronDown, FileText, Sparkles, Loader2 } from 'lucide-react';
import { exportProfessionalExcel, exportProfessionalCSV, downloadProfessionalTemplate } from '../../utils/excelExportEngine';
import { customToast } from '../../utils/toast';

/**
 * Universal Professional Excel & CSV Export Component
 * 
 * Reusable across every page in MANO-ERP for consistent,
 * executive-grade Excel exports with auto-adjusted columns and premium themes.
 */
export const ExcelExportButton = ({
    data = [],
    columns = [],
    entityName = 'Data',
    fileName = null,
    sheetName = null,
    theme = 'navy',
    sampleRows = [],
    variant = 'dropdown', // 'dropdown' | 'button' | 'toolbar' | 'outline' | 'icon'
    buttonText = 'Export',
    className = '',
    onBeforeExport = null,
    showTemplate = false,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const containerRef = useRef(null);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getData = () => {
        if (typeof data === 'function') return data();
        return data || [];
    };

    const handleExportExcel = async (e) => {
        if (e) e.stopPropagation();
        setIsOpen(false);
        setIsExporting(true);
        try {
            if (onBeforeExport) await onBeforeExport();
            const exportRows = getData();
            if (!exportRows.length) {
                customToast.error('No data available to export');
                return;
            }
            await exportProfessionalExcel({
                data: exportRows,
                columns,
                entityName,
                sheetName,
                fileName,
                theme
            });
            customToast.success(`${entityName} exported to Excel successfully!`);
        } catch (err) {
            console.error('Export error:', err);
            customToast.error('Failed to export Excel file');
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportCSV = async (e) => {
        if (e) e.stopPropagation();
        setIsOpen(false);
        setIsExporting(true);
        try {
            if (onBeforeExport) await onBeforeExport();
            const exportRows = getData();
            if (!exportRows.length) {
                customToast.error('No data available to export');
                return;
            }
            exportProfessionalCSV({
                data: exportRows,
                columns,
                entityName,
                fileName
            });
            customToast.success(`${entityName} exported to CSV successfully!`);
        } catch (err) {
            console.error('Export error:', err);
            customToast.error('Failed to export CSV file');
        } finally {
            setIsExporting(false);
        }
    };

    const handleDownloadTemplate = async (e) => {
        if (e) e.stopPropagation();
        setIsOpen(false);
        setIsExporting(true);
        try {
            await downloadProfessionalTemplate({
                columns,
                entityName,
                sampleRows,
                theme
            });
            customToast.success(`${entityName} starter template downloaded!`);
        } catch (err) {
            console.error('Template download error:', err);
            customToast.error('Failed to download template');
        } finally {
            setIsExporting(false);
        }
    };

    // Styling variants
    const baseBtnClass = "inline-flex items-center gap-1.5 transition-all text-xs font-semibold rounded-lg shadow-2xs select-none disabled:opacity-50 disabled:cursor-not-allowed";
    
    let variantClass = "px-3 py-2 bg-white dark:bg-[#161b22] text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gh-border hover:bg-gray-50 dark:hover:bg-white/5";
    if (variant === 'primary') {
        variantClass = "px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm";
    } else if (variant === 'toolbar') {
        variantClass = "px-2.5 py-1.5 bg-transparent hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 text-xs";
    } else if (variant === 'outline') {
        variantClass = "px-3 py-1.5 border border-slate-200 dark:border-gh-border bg-white dark:bg-gh-subtle text-slate-700 dark:text-slate-200 hover:border-slate-300";
    }

    // Direct single-click button mode
    if (variant === 'button') {
        return (
            <button
                type="button"
                onClick={handleExportExcel}
                disabled={disabled || isExporting}
                className={`${baseBtnClass} ${variantClass} ${className}`}
                title="Export to Microsoft Excel (.xlsx)"
            >
                {isExporting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                <span>{buttonText}</span>
            </button>
        );
    }

    // Dropdown mode (Excel + CSV + Template)
    return (
        <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                disabled={disabled || isExporting}
                className={`${baseBtnClass} ${variantClass}`}
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                {isExporting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                <span>{buttonText}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-1.5 w-52 rounded-xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-xl py-1.5 z-50 text-xs animate-in fade-in-50 zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        <span>Export Options</span>
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono">
                            <Sparkles className="w-2.5 h-2.5" /> PRO
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={handleExportExcel}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors text-left cursor-pointer"
                    >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                            <div className="font-semibold">Excel Workbook (.xlsx)</div>
                            <div className="text-[10px] text-gray-400">Auto-fit columns &amp; styled headers</div>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={handleExportCSV}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-left cursor-pointer"
                    >
                        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <div>
                            <div className="font-semibold">CSV Document (.csv)</div>
                            <div className="text-[10px] text-gray-400">Standard comma-separated format</div>
                        </div>
                    </button>

                    {showTemplate && (
                        <>
                            <div className="my-1 border-t border-gray-100 dark:border-white/5" />
                            <button
                                type="button"
                                onClick={handleDownloadTemplate}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-950/20 hover:text-purple-700 dark:hover:text-purple-300 transition-colors text-left cursor-pointer"
                            >
                                <Download className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                                <div>
                                    <div className="font-semibold">Starter Template</div>
                                    <div className="text-[10px] text-gray-400">Pre-formatted with demo rows</div>
                                </div>
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ExcelExportButton;

