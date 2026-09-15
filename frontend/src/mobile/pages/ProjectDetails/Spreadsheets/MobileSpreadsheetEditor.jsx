import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, FileDown, Printer, Save } from 'lucide-react';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import '../../../../components/common/Spreadsheet/spreadsheet-theme.css';
import { exportToCSV, exportToXLSX, getWorkbookById, saveWorkbook } from '../../../../utils/spreadsheetConverters';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import MobileEmptyState from '../../../components/MobileEmptyState';
import { createSpreadsheetProjectGuard, workbookBelongsToProject } from './mobileSpreadsheetModel';

const defaultStorage = { getWorkbookById, saveWorkbook, exportToCSV, exportToXLSX };

export default function MobileSpreadsheetEditor({ project, projectId, workbookId, canWrite, onBack, storage: storageOverride, workspace, globalIndex }) {
    const storage = useMemo(() => ({ ...defaultStorage, ...storageOverride }), [storageOverride]);
    const guardRef = useRef(createSpreadsheetProjectGuard());
    const timerRef = useRef(null);
    const [workbook, setWorkbook] = useState(null);
    const [sheets, setSheets] = useState([]);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [exportOpen, setExportOpen] = useState(false);
    const workspaceConfig = useMemo(() => ({
        key: workspace?.key || `project:${projectId ?? ''}`,
        label: workspace?.label || project?.project_code || 'Project',
        ownsWorkbook: workspace?.ownsWorkbook || workbookBelongsToProject,
        unavailableDescription: workspace?.unavailableDescription || 'This workbook does not belong to the current project or is no longer stored on this device.',
    }), [project?.project_code, projectId, workspace]);

    useEffect(() => {
        const token = guardRef.current.begin(projectId);
        clearTimeout(timerRef.current);
        setMessage('');
        setExportOpen(false);
        const saved = storage.getWorkbookById(workbookId);
        if (!guardRef.current.isCurrent(token, projectId)) return undefined;
        const isOwned = workspaceConfig.ownsWorkbook(saved, projectId);
        const isIndexed = workspaceConfig.key !== 'global' || (globalIndex || []).some((item) => String(item?.id) === String(saved?.id));
        if (!isOwned || !isIndexed) {
            setWorkbook(null);
            setSheets([]);
            setName('');
            return undefined;
        }
        setWorkbook(saved);
        setSheets(saved.sheets || []);
        setName(saved.name || 'Untitled Spreadsheet');
        return () => {
            clearTimeout(timerRef.current);
            guardRef.current.invalidate('');
        };
    }, [globalIndex, projectId, storage, workbookId, workspaceConfig]);

    const persist = useCallback((nextSheets = sheets, nextName = name, announce = true) => {
        if (!canWrite || !workbook) return false;
        const token = guardRef.current.begin(projectId);
        setSaving(true);
        const result = storage.saveWorkbook({ ...workbook, name: nextName.trim() || workbook.name, sheets: nextSheets }, projectId);
        if (!guardRef.current.isCurrent(token, projectId)) return false;
        setSaving(false);
        if (result?.success) {
            setWorkbook(result.workbook);
            if (announce) setMessage('Saved locally on this device.');
            return true;
        }
        setMessage(result?.error || 'The workbook could not be saved locally.');
        return false;
    }, [canWrite, name, projectId, sheets, storage, workbook]);

    const handleChange = useCallback((nextSheets) => {
        if (!canWrite) return;
        setSheets(nextSheets);
        clearTimeout(timerRef.current);
        const originProjectId = String(projectId);
        timerRef.current = setTimeout(() => {
            if (String(projectId) !== originProjectId) return;
            persist(nextSheets, name, false);
        }, 1500);
    }, [canWrite, name, persist, projectId]);

    if (!workbook) return <MobileEmptyState title="Workbook unavailable" description={workspaceConfig.unavailableDescription} action={<button type="button" onClick={onBack} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">Back to workbooks</button>} />;

    const exportFile = (format) => {
        const filename = name.trim() || 'Spreadsheet';
        const result = format === 'csv'
            ? storage.exportToCSV(sheets, 0, `${filename}.csv`)
            : storage.exportToXLSX(sheets, `${filename}.xlsx`);
        setMessage(result?.success ? `Downloaded ${result.fileName}.` : result?.error || 'Export failed.');
        setExportOpen(false);
    };

    return <div data-mobile-spreadsheet-editor className="min-w-0 space-y-3 px-4 pb-28">
        <div className="flex items-center gap-2">
            <button type="button" aria-label="Back to workbooks" onClick={onBack} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-gh-border dark:bg-gh-subtle"><ArrowLeft size={19} /></button>
            <div className="min-w-0 flex-1">
                <label htmlFor="mobile-workbook-name" className="sr-only">Workbook name</label>
                <input id="mobile-workbook-name" value={name} readOnly={!canWrite} onChange={(event) => setName(event.target.value)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-950 outline-none focus:border-blue-500 read-only:bg-gray-50 dark:border-gh-border dark:bg-gh-input dark:text-gh-text dark:read-only:bg-gh-subtle" />
                <p className="mt-1 truncate text-[11px] text-gray-500 dark:text-gh-muted">{project?.project_code || 'Project'} · {canWrite ? 'Local autosave enabled' : 'View only'}</p>
            </div>
            {canWrite && <button type="button" disabled={saving} aria-label="Save workbook" onClick={() => persist()} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-50"><Save size={18} /></button>}
            <button type="button" aria-label="Export workbook" onClick={() => setExportOpen(true)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-gh-border dark:bg-gh-subtle"><Download size={18} /></button>
        </div>
        {message && <p role="status" className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">{message}</p>}
        <div className="overflow-x-auto overscroll-x-contain rounded-2xl border border-gray-200 bg-white dark:border-gh-border dark:bg-[#0d1117]" data-testid="mobile-fortune-sheet-scroll">
            <div className="h-[min(66dvh,660px)] min-h-[480px] min-w-[760px]" data-testid="mobile-fortune-sheet">
                <Workbook
                    key={`${workspaceConfig.key}:${workbookId}`}
                    data={sheets}
                    onChange={handleChange}
                    showToolbar
                    showFormulaBar
                    showSheetTabs
                    showContextmenu={false}
                    showStatisticBar={false}
                    defaultFontSize={12}
                    defaultRowHeight={24}
                    defaultColWidth={88}
                    rowHeaderWidth={46}
                    columnHeaderHeight={26}
                    row={Math.max(sheets?.[0]?.row || 80, 80)}
                    column={Math.max(sheets?.[0]?.column || 30, 30)}
                    lang="en"
                    currency="₹"
                    allowEdit={canWrite}
                />
            </div>
        </div>
        <MobileBottomSheet open={exportOpen} onClose={() => setExportOpen(false)} title="Export workbook" description="Exports do not change the locally stored workbook.">
            <div className="space-y-2">
                <button type="button" onClick={() => exportFile('xlsx')} className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-gray-50 px-3 text-sm font-semibold dark:bg-gh-input"><FileDown size={18} />Export all sheets as XLSX</button>
                <button type="button" onClick={() => exportFile('csv')} className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-gray-50 px-3 text-sm font-semibold dark:bg-gh-input"><FileDown size={18} />Export active sheet as CSV</button>
                <button type="button" onClick={() => { window.print(); setExportOpen(false); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-gray-50 px-3 text-sm font-semibold dark:bg-gh-input"><Printer size={18} />Print from browser</button>
            </div>
        </MobileBottomSheet>
    </div>;
}
