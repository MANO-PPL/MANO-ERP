import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { evaluateFormula } from './excelFormulaEngine';

/**
 * Enterprise Palette Themes for Excel Worksheets
 */
export const EXCEL_THEMES = {
    navy: {
        headerFill: '1E293B',    // Slate 800 - Deep executive navy
        headerFont: 'FFFFFF',
        accentFill: '3B82F6',    // Blue 500
        zebraFill: 'F8FAFC',     // Slate 50
        borderColor: 'E2E8F0',   // Slate 200
        textColor: '1E293B',
        fontFamily: 'Calibri'
    },
    blue: {
        headerFill: '1D4ED8',    // Blue 700 - Vibrant enterprise blue
        headerFont: 'FFFFFF',
        accentFill: '2563EB',
        zebraFill: 'F0F7FF',     // Light sky tint
        borderColor: 'DBEAFE',
        textColor: '1E293B',
        fontFamily: 'Calibri'
    },
    emerald: {
        headerFill: '065F46',    // Emerald 800 - Financial ledger green
        headerFont: 'FFFFFF',
        accentFill: '10B981',
        zebraFill: 'F0FDF4',     // Light emerald tint
        borderColor: 'DCFCE7',
        textColor: '1E293B',
        fontFamily: 'Calibri'
    },
    slate: {
        headerFill: '334155',    // Slate 700 - Modern neutral
        headerFont: 'FFFFFF',
        accentFill: '64748B',
        zebraFill: 'F8FAFC',
        borderColor: 'E2E8F0',
        textColor: '1E293B',
        fontFamily: 'Calibri'
    }
};

/**
 * Calculate dynamic auto-adjusted column width based on content and headers.
 * Adds safety padding for Excel filter arrows and clamps between min and max bounds.
 */
export const calculateAutoFitColumnWidth = (column, dataRows = [], minWidth = 14, maxWidth = 55) => {
    const colKey = column.key;
    const headerLabel = String(column.label || column.key || '');
    
    // Header width + 5 for filter button & margin
    let maxLen = headerLabel.length + 5;

    // Scan sample of up to 500 rows for performance
    const sampleRows = dataRows.length > 500 ? dataRows.slice(0, 500) : dataRows;
    for (const row of sampleRows) {
        const val = row[colKey];
        if (val !== undefined && val !== null && val !== '') {
            let strVal = String(val);
            // Handle formulas
            if (strVal.startsWith('=')) {
                const evalRes = evaluateFormula(strVal, row);
                strVal = evalRes.success && evalRes.result !== undefined && evalRes.result !== null ? String(evalRes.result) : strVal;
            }
            // Multi-line values: take length of longest line
            if (strVal.includes('\n')) {
                const lines = strVal.split('\n');
                for (const line of lines) {
                    if (line.length > maxLen) maxLen = line.length;
                }
            } else {
                if (strVal.length > maxLen) maxLen = strVal.length;
            }
        }
    }

    // Add comfort padding (+4 chars)
    const computedWidth = maxLen + 4;
    return Math.min(maxWidth, Math.max(minWidth, computedWidth));
};

/**
 * Helper to determine data type of a column definition
 */
const inferColumnType = (col) => {
    if (col.type) return col.type.toLowerCase();
    const key = (col.key || '').toLowerCase();
    const label = (col.label || '').toLowerCase();
    if (key.includes('date') || label.includes('date')) return 'date';
    if (key.includes('rate') || key.includes('amount') || key.includes('price') || key.includes('cost') || key.includes('total') || key.includes('qty') || key.includes('quantity')) return 'number';
    if (key.includes('phone') || key.includes('mobile') || key.includes('contact')) return 'phone';
    if (key.includes('email')) return 'email';
    if (key.includes('url') || key.includes('website')) return 'url';
    return 'text';
};

/**
 * Core Professional Excel Export Engine
 * Generates an enterprise-ready, styled Microsoft Excel spreadsheet (.xlsx) with:
 * - Perfectly auto-adjusted column widths
 * - High-contrast executive styled headers with freeze panes
 * - Auto-filters on all header columns
 * - Subtle alternating zebra striping
 * - Proper number, date, and text alignments
 * - Native Excel formula retention
 */
export const exportProfessionalExcel = async ({
    data = [],
    columns = [],
    entityName = 'Data',
    sheetName = null,
    fileName = null,
    theme = 'navy',
    title = null
}) => {
    const activeTheme = EXCEL_THEMES[theme] || EXCEL_THEMES.navy;
    const finalSheetName = (sheetName || entityName || 'Sheet1').slice(0, 31).replace(/[\\/?*[\]]/g, '');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const finalFileName = fileName || `${entityName}_Export_${dateStamp}.xlsx`;

    // Filter out internal non-exportable action columns
    const exportColumns = columns.filter(c => {
        const k = (c.key || '').toLowerCase();
        return k !== 'actions' && k !== 'action' && k !== 'permissions_access' && k !== 'permissions_action';
    });

    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'MANO-ERP Enterprise';
        workbook.lastModifiedBy = 'MANO-ERP';
        workbook.created = new Date();
        workbook.modified = new Date();

        const worksheet = workbook.addWorksheet(finalSheetName, {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2', showGridLines: true }]
        });

        // 1. Configure Columns & Auto-Fit Widths
        const columnConfigs = exportColumns.map(col => {
            const width = calculateAutoFitColumnWidth(col, data);
            return {
                header: col.label || col.key,
                key: col.key,
                width: width
            };
        });
        worksheet.columns = columnConfigs;

        // 2. Style Header Row
        const headerRow = worksheet.getRow(1);
        headerRow.height = 30;
        headerRow.eachCell((cell, colNumber) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF' + activeTheme.headerFill }
            };
            cell.font = {
                name: activeTheme.fontFamily,
                size: 11,
                bold: true,
                color: { argb: 'FF' + activeTheme.headerFont }
            };
            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: false
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF' + activeTheme.headerFill } },
                bottom: { style: 'medium', color: { argb: 'FF' + activeTheme.accentFill } },
                left: { style: 'thin', color: { argb: 'FF334155' } },
                right: { style: 'thin', color: { argb: 'FF334155' } }
            };
        });

        // 3. Populate and Style Data Rows
        data.forEach((row, rowIndex) => {
            const isEven = rowIndex % 2 === 1;
            const rowValues = {};

            exportColumns.forEach(col => {
                const rawVal = row[col.key];
                if (rawVal === undefined || rawVal === null) {
                    rowValues[col.key] = '';
                } else if (typeof rawVal === 'string' && rawVal.trim().startsWith('=')) {
                    const formulaText = rawVal.trim().substring(1);
                    const evalRes = evaluateFormula(rawVal, row);
                    rowValues[col.key] = {
                        formula: formulaText,
                        result: evalRes.success && evalRes.result !== undefined ? evalRes.result : undefined
                    };
                } else {
                    rowValues[col.key] = rawVal;
                }
            });

            const addedRow = worksheet.addRow(rowValues);
            addedRow.height = 22;

            addedRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                const colDef = exportColumns[colNumber - 1];
                const colType = inferColumnType(colDef || {});

                // Zebra striping
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: isEven ? 'FF' + activeTheme.zebraFill : 'FFFFFFFF' }
                };

                // Crisp cell border
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF' + activeTheme.borderColor } },
                    bottom: { style: 'thin', color: { argb: 'FF' + activeTheme.borderColor } },
                    left: { style: 'thin', color: { argb: 'FF' + activeTheme.borderColor } },
                    right: { style: 'thin', color: { argb: 'FF' + activeTheme.borderColor } }
                };

                // Typography
                cell.font = {
                    name: activeTheme.fontFamily,
                    size: 10.5,
                    color: { argb: 'FF' + activeTheme.textColor }
                };

                // Alignment & Number Formats
                if (colType === 'number') {
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    // Format numeric values
                    if (typeof cell.value === 'number') {
                        cell.numFmt = Number.isInteger(cell.value) ? '#,##0' : '#,##0.00';
                    }
                } else if (colType === 'date') {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (colType === 'phone') {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else {
                    cell.alignment = {
                        vertical: 'middle',
                        horizontal: 'left',
                        wrapText: colDef?.width && colDef.width > 35
                    };
                }
            });
        });

        // 4. Set AutoFilter on all headers
        if (exportColumns.length > 0) {
            worksheet.autoFilter = {
                from: { row: 1, column: 1 },
                to: { row: 1, column: exportColumns.length }
            };
        }

        // 5. Generate and Trigger Download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFileName.endsWith('.xlsx') ? finalFileName : `${finalFileName}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return { success: true, fileName: finalFileName };
    } catch (err) {
        console.error('ExcelJS export failed, falling back to SheetJS:', err);
        // Seamless fallback to SheetJS with identical auto-adjusted column widths
        return exportFallbackSheetJS(data, exportColumns, entityName, finalFileName);
    }
};

/**
 * High-quality SheetJS Fallback Exporter with auto-fit widths and row heights
 */
const exportFallbackSheetJS = (data, columns, entityName, finalFileName) => {
    const headers = columns.map(c => c.label || c.key);
    const dataRows = data.map(row =>
        columns.map(c => {
            const val = row[c.key];
            if (val === undefined || val === null) return '';
            if (typeof val === 'string' && val.trim().startsWith('=')) {
                const evalRes = evaluateFormula(val, row);
                return evalRes.success && evalRes.result !== undefined ? evalRes.result : val;
            }
            return val;
        })
    );

    const aoa = [headers, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Apply auto-fit widths to SheetJS
    ws['!cols'] = columns.map(col => ({
        wch: calculateAutoFitColumnWidth(col, data)
    }));

    // Header row height
    ws['!rows'] = [{ hpt: 28 }, ...dataRows.map(() => ({ hpt: 20 }))];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (entityName || 'Data').slice(0, 31));
    XLSX.writeFile(wb, finalFileName);
    return { success: true, fileName: finalFileName };
};

/**
 * Downloads a starter professional Excel template pre-filled with demo rows and auto-fit columns.
 */
export const downloadProfessionalTemplate = async ({
    columns = [],
    entityName = 'Data',
    sampleRows = [],
    theme = 'navy'
}) => {
    const activeCols = columns.filter(c => {
        const k = (c.key || '').toLowerCase();
        return !c.readOnly && k !== 'actions' && k !== 'action' && k !== 'permissions_access' && k !== 'permissions_action';
    });

    return exportProfessionalExcel({
        data: sampleRows,
        columns: activeCols,
        entityName: `${entityName}_Template`,
        fileName: `${entityName}_Import_Template.xlsx`,
        theme
    });
};

/**
 * Professional CSV Exporter
 */
export const exportProfessionalCSV = ({
    data = [],
    columns = [],
    entityName = 'Data',
    fileName = null
}) => {
    const exportColumns = columns.filter(c => {
        const k = (c.key || '').toLowerCase();
        return k !== 'actions' && k !== 'action' && k !== 'permissions_access' && k !== 'permissions_action';
    });

    const headers = exportColumns.map(c => c.label || c.key);
    const dataRows = data.map(row =>
        exportColumns.map(c => {
            const val = row[c.key] ?? '';
            if (typeof val === 'string' && val.trim().startsWith('=')) {
                const evalRes = evaluateFormula(val, row);
                return evalRes.success && evalRes.result !== undefined && evalRes.result !== null ? evalRes.result : val;
            }
            return val;
        })
    );

    const csvContent = Papa.unparse({
        fields: headers,
        data: dataRows
    });

    const dateStamp = new Date().toISOString().slice(0, 10);
    const finalFileName = fileName || `${entityName}_Export_${dateStamp}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFileName.endsWith('.csv') ? finalFileName : `${finalFileName}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, fileName: finalFileName };
};

