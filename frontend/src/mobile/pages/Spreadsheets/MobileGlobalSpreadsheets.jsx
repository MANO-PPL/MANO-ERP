import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, Copy, FileSpreadsheet, Plus, Upload } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { deleteWorkbook, getConstructionTemplates, getSavedWorkbooksList, getWorkbookById, importFromFile, saveWorkbook } from '../../../utils/spreadsheetConverters';
import { ExcelFormulaAssistantModal } from '../../../components/common/ExcelFormulas';
import MobilePageHeader from '../../components/MobilePageHeader';
import MobileCard from '../../components/MobileCard';
import MobileConfirmModal from '../../components/MobileConfirmModal';
import MobileEmptyState from '../../components/MobileEmptyState';
import MobileSearchBar from '../../components/MobileSearchBar';
import MobileSpreadsheetEditor from '../ProjectDetails/Spreadsheets/MobileSpreadsheetEditor';
import MobileWorkbookActionsSheet from '../ProjectDetails/Spreadsheets/MobileWorkbookActionsSheet';
import {
    GLOBAL_EDITOR_WORKSPACE,
    GLOBAL_SPREADSHEET_DISCLOSURE,
    canWriteGlobalSpreadsheets,
    createGlobalWorkbook,
    createImportedGlobalWorkbook,
    duplicateGlobalWorkbook,
    filterGlobalWorkbooks,
    isGlobalWorkbookOwner,
    isGlobalWorkbookReachable,
} from './mobileGlobalSpreadsheetModel';

const defaultStorage = { deleteWorkbook, getSavedWorkbooksList, getWorkbookById, importFromFile, saveWorkbook };

export default function MobileGlobalSpreadsheets({ authOverride, storage: storageOverride }) {
    const auth = useAuth();
    const activeAuth = authOverride || auth;
    const storage = useMemo(() => ({ ...defaultStorage, ...storageOverride }), [storageOverride]);
    const canWrite = canWriteGlobalSpreadsheets(activeAuth);
    const inputRef = useRef(null);
    const generationRef = useRef(0);
    const [workbooks, setWorkbooks] = useState([]);
    const [query, setQuery] = useState('');
    const [activeId, setActiveId] = useState(null);
    const [actionWorkbook, setActionWorkbook] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [message, setMessage] = useState('');
    const [formulaOpen, setFormulaOpen] = useState(false);
    const templates = useMemo(() => getConstructionTemplates('MANO Enterprise', 'CORP-01'), []);

    const refresh = useCallback(() => {
        const indexed = storage.getSavedWorkbooksList(null) || [];
        setWorkbooks(indexed.filter(isGlobalWorkbookOwner));
    }, [storage]);

    useEffect(() => {
        generationRef.current += 1;
        setActiveId(null);
        setActionWorkbook(null);
        setDeleteTarget(null);
        setMessage('');
        refresh();
    }, [refresh]);

    const saveNew = useCallback((workbook) => {
        if (!canWrite) return false;
        const result = storage.saveWorkbook(workbook, null);
        if (!result?.success) {
            setMessage(result?.error || 'The workbook could not be stored locally.');
            return false;
        }
        refresh();
        setActiveId(result.workbook.id);
        return true;
    }, [canWrite, refresh, storage]);

    const openWorkbook = useCallback((id) => {
        const workbook = storage.getWorkbookById(id);
        if (!isGlobalWorkbookReachable(workbook, workbooks)) {
            setMessage('This workbook is unavailable in Global Spreadsheets.');
            return;
        }
        setActionWorkbook(null);
        setActiveId(workbook.id);
    }, [storage, workbooks]);

    const handleImport = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !canWrite) return;
        const token = ++generationRef.current;
        setMessage('Importing workbook…');
        try {
            const parsed = await storage.importFromFile(file);
            if (token !== generationRef.current) return;
            if (!parsed?.success || !parsed?.sheets) throw new Error(parsed?.error || 'The selected file could not be parsed.');
            saveNew(createImportedGlobalWorkbook(parsed, file));
        } catch (error) {
            if (token === generationRef.current) setMessage(error?.message || 'Import failed.');
        }
    };

    const duplicate = () => {
        if (!canWrite || !actionWorkbook) return;
        const workbook = storage.getWorkbookById(actionWorkbook.id);
        if (!isGlobalWorkbookReachable(workbook, workbooks)) {
            setMessage('This workbook is unavailable in Global Spreadsheets.');
            setActionWorkbook(null);
            return;
        }
        setActionWorkbook(null);
        saveNew(duplicateGlobalWorkbook(workbook));
    };

    if (activeId) return <MobileSpreadsheetEditor
        projectId={null}
        workbookId={activeId}
        canWrite={canWrite}
        onBack={() => { setActiveId(null); refresh(); }}
        storage={storage}
        workspace={GLOBAL_EDITOR_WORKSPACE}
        globalIndex={workbooks}
    />;

    const visible = filterGlobalWorkbooks(workbooks, query);
    return <section data-mobile-global-spreadsheets className="min-w-0 space-y-4 px-4 pb-28">
        <MobilePageHeader eyebrow="MANO ERP" title="Spreadsheets" subtitle="Global browser-local workbooks" />
        <MobileCard className="p-4">
            <div className="flex items-start gap-3"><span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><FileSpreadsheet size={21} /></span><div><h2 className="text-base font-bold text-gray-950 dark:text-gh-text">Global workbooks</h2><p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gh-muted">FortuneSheet editing with the existing MANO workbook format.</p></div></div>
            <ul className="mt-3 space-y-1 text-[11px] leading-5 text-amber-800 dark:text-amber-200">{GLOBAL_SPREADSHEET_DISCLOSURE.map((line) => <li key={line}>• {line}</li>)}</ul>
            {!canWrite && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">View only. Local create, import, edit, duplicate, and delete controls are disabled.</p>}
        </MobileCard>
        <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setFormulaOpen(true)} className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold dark:border-gh-border dark:bg-gh-subtle"><Calculator size={17} className="mr-1 inline text-blue-600" />Formula Assistant</button>
            {canWrite && <><button type="button" onClick={() => saveNew(createGlobalWorkbook(templates[0]))} className="min-h-11 rounded-xl bg-blue-600 px-3 text-sm font-bold text-white"><Plus size={17} className="mr-1 inline" />New workbook</button><button type="button" onClick={() => inputRef.current?.click()} className="col-span-2 min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold dark:border-gh-border dark:bg-gh-subtle"><Upload size={17} className="mr-1 inline" />Import XLSX, XLS, or CSV</button><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" /></>}
        </div>
        {message && <p role="status" className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">{message}</p>}
        <MobileSearchBar value={query} onChange={setQuery} placeholder="Search global workbooks" />
        {visible.length === 0 ? <MobileEmptyState icon={FileSpreadsheet} title={query ? 'No matching workbooks' : 'No global workbooks'} description={canWrite ? 'Create a workbook, choose a source-proven template, or import XLSX, XLS, or CSV.' : 'No locally stored global workbook is available.'} /> : <div className="space-y-3">{visible.map((workbook) => <MobileCard key={workbook.id} className="p-4"><button type="button" onClick={() => openWorkbook(workbook.id)} className="w-full text-left"><div className="flex items-start gap-3"><FileSpreadsheet size={20} className="mt-0.5 shrink-0 text-emerald-600" /><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold text-gray-950 dark:text-gh-text">{workbook.name}</h3><p className="mt-1 text-xs text-gray-500 dark:text-gh-muted">{workbook.sheetCount || 1} sheet{workbook.sheetCount === 1 ? '' : 's'} · {workbook.updatedAt ? new Date(workbook.updatedAt).toLocaleString() : 'Stored locally'}</p></div></div></button><button type="button" aria-label={`Actions for ${workbook.name}`} onClick={() => setActionWorkbook(workbook)} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 text-xs font-bold dark:border-gh-border"><Copy size={17} />Actions</button></MobileCard>)}</div>}
        {canWrite && <div><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gh-muted">Construction templates</h3><div className="grid grid-cols-1 gap-2">{templates.slice(1).map((template) => <button key={template.id} type="button" onClick={() => saveNew(createGlobalWorkbook(template))} className="min-h-12 rounded-xl border border-gray-200 bg-white px-3 text-left text-sm font-semibold dark:border-gh-border dark:bg-gh-subtle"><Copy size={16} className="mr-2 inline text-blue-600" />{template.name}</button>)}</div></div>}
        <MobileWorkbookActionsSheet open={Boolean(actionWorkbook)} onClose={() => setActionWorkbook(null)} workbook={actionWorkbook} canWrite={canWrite} onOpen={() => openWorkbook(actionWorkbook?.id)} onDuplicate={duplicate} onDelete={() => { setDeleteTarget(actionWorkbook); setActionWorkbook(null); }} />
        <MobileConfirmModal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => { if (!canWrite || !deleteTarget) return; const workbook = storage.getWorkbookById(deleteTarget.id); if (!isGlobalWorkbookReachable(workbook, workbooks)) setMessage('This workbook is unavailable in Global Spreadsheets.'); else { const result = storage.deleteWorkbook(deleteTarget.id, null); if (!result?.success) setMessage(result?.error || 'Delete failed.'); refresh(); } setDeleteTarget(null); }} title="Delete workbook" message={`Permanently remove “${deleteTarget?.name || 'this workbook'}” from local browser storage?`} confirmLabel="Delete" danger />
        <ExcelFormulaAssistantModal isOpen={formulaOpen} onClose={() => setFormulaOpen(false)} />
    </section>;
}
