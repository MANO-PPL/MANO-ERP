import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, FileSpreadsheet, MoreHorizontal, Plus, Upload } from 'lucide-react';
import { customToast } from '../../../../components/Toast';
import { deleteWorkbook, getConstructionTemplates, getSavedWorkbooksList, getWorkbookById, importFromFile, saveWorkbook } from '../../../../utils/spreadsheetConverters';
import MobileCard from '../../../components/MobileCard';
import MobileConfirmModal from '../../../components/MobileConfirmModal';
import MobileEmptyState from '../../../components/MobileEmptyState';
import MobileFAB from '../../../components/MobileFAB';
import MobileSearchBar from '../../../components/MobileSearchBar';
import { createImportedWorkbook, createProjectWorkbook, createSpreadsheetProjectGuard, duplicateProjectWorkbook, filterProjectWorkbooks, LOCAL_SPREADSHEET_DISCLOSURE, workbookBelongsToProject } from './mobileSpreadsheetModel';
import MobileSpreadsheetEditor from './MobileSpreadsheetEditor';
import MobileWorkbookActionsSheet from './MobileWorkbookActionsSheet';

const defaultStorage = { deleteWorkbook, getSavedWorkbooksList, getWorkbookById, importFromFile, saveWorkbook };

export default function MobileProjectSpreadsheets({ project, projectId, canWrite, services = {} }) {
    const storage = useMemo(() => ({ ...defaultStorage, ...(services.spreadsheets || {}) }), [services.spreadsheets]);
    const guardRef = useRef(createSpreadsheetProjectGuard());
    const inputRef = useRef(null);
    const [workbooks, setWorkbooks] = useState([]);
    const [query, setQuery] = useState('');
    const [activeId, setActiveId] = useState(null);
    const [actionWorkbook, setActionWorkbook] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [message, setMessage] = useState('');
    const templates = useMemo(() => getConstructionTemplates(project?.name, project?.project_code), [project?.name, project?.project_code]);

    const refresh = () => setWorkbooks(storage.getSavedWorkbooksList(projectId).filter((item) => workbookBelongsToProject(item, projectId)));

    useEffect(() => {
        guardRef.current.begin(projectId);
        setActiveId(null);
        setActionWorkbook(null);
        setDeleteTarget(null);
        setMessage('');
        refresh();
        return () => guardRef.current.invalidate('');
    }, [projectId, storage]);

    const saveNew = (workbook) => {
        if (!canWrite) return;
        const result = storage.saveWorkbook(workbook, projectId);
        if (result?.success) {
            refresh();
            setActiveId(result.workbook.id);
            customToast.success(`Workbook "${workbook.name || 'Untitled'}" saved.`, 'Spreadsheet');
        } else {
            const err = result?.error || 'The workbook could not be stored locally.';
            setMessage(err);
            customToast.error(err, 'Spreadsheet Error');
        }
    };

    const handleImport = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !canWrite) return;
        const token = guardRef.current.begin(projectId);
        setMessage('Importing workbook…');
        try {
            const parsed = await storage.importFromFile(file);
            if (!guardRef.current.isCurrent(token, projectId)) return;
            if (!parsed?.success || !parsed?.sheets) throw new Error(parsed?.error || 'The selected file could not be parsed.');
            saveNew(createImportedWorkbook(parsed, file, project));
            customToast.success(`Imported "${file.name}" successfully.`, 'Import');
        } catch (error) {
            if (guardRef.current.isCurrent(token, projectId)) {
                const err = error?.message || 'Import failed.';
                setMessage(err);
                customToast.error(err, 'Import Error');
            }
        }
    };

    if (activeId) return <MobileSpreadsheetEditor project={project} projectId={projectId} workbookId={activeId} canWrite={canWrite} onBack={() => { setActiveId(null); refresh(); }} storage={storage} />;

    const visible = filterProjectWorkbooks(workbooks, query);
    return <div data-mobile-project-spreadsheets className="w-full min-w-0 space-y-2 px-2 sm:px-3 pb-28">
        <MobileCard className="p-2.5 sm:p-3">
            <div className="flex items-start gap-2.5"><span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><FileSpreadsheet size={16} /></span><div><h2 className="text-xs font-semibold text-gray-950 dark:text-gh-text">Project spreadsheets</h2><p className="mt-0.5 text-[11px] leading-4 font-normal text-gray-500 dark:text-gh-muted">FortuneSheet editing with the existing MANO workbook format.</p></div></div>
            <ul className="mt-2 space-y-0.5 text-[10px] leading-4 text-amber-800 dark:text-amber-200 font-normal">{LOCAL_SPREADSHEET_DISCLOSURE.map((line) => <li key={line}>• {line}</li>)}</ul>
            {!canWrite && <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-normal text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">View only. Local create, import, edit, duplicate, and delete controls are disabled.</p>}
        </MobileCard>
        {canWrite && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => saveNew(createProjectWorkbook(templates[0], project))} className="min-h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white"><Plus size={14} className="mr-1 inline" />Blank workbook</button><button type="button" onClick={() => inputRef.current?.click()} className="min-h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold dark:border-gh-border dark:bg-gh-subtle"><Upload size={14} className="mr-1 inline" />Import</button><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" /></div>}
        {message && <p role="status" className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-normal text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">{message}</p>}
        <MobileSearchBar value={query} onChange={setQuery} placeholder="Search project workbooks" />
        {visible.length === 0 ? <MobileEmptyState icon={FileSpreadsheet} title={query ? 'No matching workbooks' : 'No project workbooks'} description={canWrite ? 'Create a blank workbook, choose a source-proven template, or import XLSX, XLS, or CSV.' : 'No locally stored workbook is available for this project.'} /> : <div className="space-y-2">{visible.map((workbook) => <MobileCard key={workbook.id} className="p-2.5 sm:p-3"><button type="button" onClick={() => setActiveId(workbook.id)} className="w-full text-left"><div className="flex items-start gap-2.5"><FileSpreadsheet size={16} className="mt-0.5 shrink-0 text-emerald-600" /><div className="min-w-0 flex-1"><h3 className="truncate text-xs font-semibold text-gray-950 dark:text-gh-text">{workbook.name}</h3><p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-gh-muted">{workbook.sheetCount || 1} sheet{workbook.sheetCount === 1 ? '' : 's'} · {workbook.updatedAt ? new Date(workbook.updatedAt).toLocaleString() : 'Stored locally'}</p></div></div></button><button type="button" aria-label={`Actions for ${workbook.name}`} onClick={() => setActionWorkbook(workbook)} className="mt-2 inline-flex min-h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-xs font-semibold dark:border-gh-border"><MoreHorizontal size={14} />Actions</button></MobileCard>)}</div>}
        {canWrite && <div><h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gh-muted">Construction templates</h3><div className="grid grid-cols-1 gap-1.5">{templates.slice(1).map((template) => <button key={template.id} type="button" onClick={() => saveNew(createProjectWorkbook(template, project))} className="min-h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-left text-xs font-semibold dark:border-gh-border dark:bg-gh-subtle"><Copy size={13} className="mr-1.5 inline text-blue-600" />{template.name}</button>)}</div></div>}
        {canWrite && <MobileFAB label="New workbook" onClick={() => saveNew(createProjectWorkbook(templates[0], project))} />}
        <MobileWorkbookActionsSheet open={Boolean(actionWorkbook)} onClose={() => setActionWorkbook(null)} workbook={actionWorkbook} canWrite={canWrite} onOpen={() => setActiveId(actionWorkbook?.id)} onDuplicate={() => { const saved = storage.getWorkbookById(actionWorkbook?.id); if (workbookBelongsToProject(saved, projectId)) saveNew(duplicateProjectWorkbook(saved, project)); }} onDelete={() => setDeleteTarget(actionWorkbook)} />
        <MobileConfirmModal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => { if (!canWrite || !deleteTarget) return; const result = storage.deleteWorkbook(deleteTarget.id, projectId); if (!result?.success) { const err = result?.error || 'Delete failed.'; setMessage(err); customToast.error(err, 'Delete Error'); } else { customToast.success('Workbook deleted successfully.', 'Spreadsheet'); } setDeleteTarget(null); refresh(); }} title="Delete workbook" message={`Permanently remove “${deleteTarget?.name || 'this workbook'}” from local browser storage?`} confirmLabel="Delete" danger />
    </div>;
}
