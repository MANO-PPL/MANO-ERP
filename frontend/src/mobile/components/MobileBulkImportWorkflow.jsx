import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import MobileCard from './MobileCard';
import MobileConfirmModal from './MobileConfirmModal';
import MobileEmptyState from './MobileEmptyState';
import MobilePageHeader from './MobilePageHeader';
import MobileStickyActions from './MobileStickyActions';
import { isSupportedTabularFile, parseTabularFile } from '../utils/parseTabularFile.js';

export default function MobileBulkImportWorkflow({
    title,
    entityLabel,
    canWrite,
    validateRows,
    normalizeRows,
    importRows,
    buildPayload = (rows) => rows,
    atomic = false,
    onBack,
}) {
    const [phase, setPhase] = useState('select');
    const [file, setFile] = useState(null);
    const [rows, setRows] = useState([]);
    const [report, setReport] = useState(null);
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const validRows = useMemo(() => rows.filter((row) => row.status === 'Valid'), [rows]);
    const invalidRows = rows.length - validRows.length;

    const reset = () => {
        setPhase('select'); setFile(null); setRows([]); setReport(null); setError(''); setConfirmOpen(false);
    };

    const selectFile = async (selected) => {
        setError('');
        if (!isSupportedTabularFile(selected)) {
            setError('Choose a CSV, XLSX, or XLS file.');
            return;
        }
        setPending(true);
        try {
            const parsed = await parseTabularFile(selected);
            const validation = await validateRows(parsed);
            setFile(selected);
            setRows(normalizeRows(parsed, validation?.validation || validation || {}));
            setPhase('preview');
        } catch (nextError) {
            setError(nextError?.response?.data?.message || nextError?.message || 'The file could not be validated.');
        } finally {
            setPending(false);
        }
    };

    const runImport = async () => {
        if (!canWrite || pending || validRows.length === 0) return;
        setPending(true);
        setError('');
        try {
            const result = await importRows(buildPayload(validRows));
            if (!result?.success && !result?.ok) throw new Error(result?.message || 'Import failed.');
            const raw = result.report || {};
            const successCount = raw.success_count ?? raw.successCount ?? validRows.length;
            const failureCount = raw.failure_count ?? raw.errors?.length ?? 0;
            setReport({
                total: validRows.length,
                successCount: atomic && raw.errors?.length ? 0 : successCount,
                failureCount,
                errors: raw.errors || [],
                skipped: rows.filter((row) => row.status !== 'Valid'),
                atomic,
            });
            setPhase('result');
            setConfirmOpen(false);
        } catch (nextError) {
            const raw = nextError?.response?.data?.report;
            if (atomic && raw) {
                setReport({ total: validRows.length, successCount: 0, failureCount: validRows.length, errors: raw.errors || [], skipped: rows.filter((row) => row.status !== 'Valid'), atomic: true });
                setPhase('result');
                setConfirmOpen(false);
            } else {
                setError(nextError?.response?.data?.message || nextError?.message || 'Import failed.');
            }
        } finally {
            setPending(false);
        }
    };

    if (!canWrite) {
        return (
            <div data-mobile-page="bulk-access-denied" className="mx-auto w-full max-w-2xl px-4 pb-28">
                <MobilePageHeader eyebrow="Import" title={title} onBack={onBack} />
                <MobileEmptyState title="Write access required" description={`You can view ${entityLabel}, but importing records requires Write access.`} />
            </div>
        );
    }

    return (
        <div data-mobile-page="bulk-import" className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-28">
            <MobilePageHeader eyebrow="Import" title={title} subtitle={phase === 'select' ? 'Select a file to validate' : phase === 'preview' ? 'Review validation before importing' : 'Import result'} onBack={onBack} />

            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

            {phase === 'select' && (
                <MobileCard className="p-5 text-center">
                    <FileSpreadsheet className="mx-auto text-blue-600" size={34} aria-hidden="true" />
                    <p className="mt-3 text-sm font-bold">CSV or Excel file</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gh-muted">The file is parsed locally, then validated by the existing ERP endpoint.</p>
                    <label className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">
                        <Upload size={17} aria-hidden="true" />{pending ? 'Validating…' : 'Choose file'}
                        <input aria-label={`Choose ${entityLabel} import file`} disabled={pending} type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={(event) => selectFile(event.target.files?.[0])} />
                    </label>
                </MobileCard>
            )}

            {phase === 'preview' && (
                <>
                    <MobileCard className="p-4">
                        <p className="truncate text-sm font-bold">{file?.name}</p>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                            <div><p className="font-black">{rows.length}</p><p className="text-gray-500">Rows</p></div>
                            <div><p className="font-black text-emerald-600">{validRows.length}</p><p className="text-gray-500">Valid</p></div>
                            <div><p className="font-black text-red-600">{invalidRows}</p><p className="text-gray-500">Issues</p></div>
                        </div>
                    </MobileCard>
                    <div className="space-y-2" aria-label="Import preview">
                        {rows.slice(0, 100).map((row) => (
                            <MobileCard key={row.rowNumber} className="p-3">
                                <div className="flex items-start gap-3">
                                    {row.status === 'Valid' ? <CheckCircle2 size={18} className="shrink-0 text-emerald-600" /> : <AlertCircle size={18} className="shrink-0 text-red-600" />}
                                    <div className="min-w-0"><p className="truncate text-sm font-bold">{row.name || `Row ${row.rowNumber}`}</p><p className="text-xs text-gray-500 dark:text-gh-muted">Row {row.rowNumber}{row.contact_no ? ` · ${row.contact_no}` : ''}</p>{row.issues?.length > 0 && <p className="mt-1 text-xs text-red-600 dark:text-red-300">{row.issues.join('; ')}</p>}</div>
                                </div>
                            </MobileCard>
                        ))}
                    </div>
                    <MobileStickyActions>
                        <button type="button" disabled={pending} onClick={reset} className="min-h-11 flex-1 rounded-xl border border-gray-200 text-sm font-bold dark:border-gh-border">Choose another</button>
                        <button type="button" disabled={pending || validRows.length === 0} onClick={() => setConfirmOpen(true)} className="min-h-11 flex-[1.3] rounded-xl bg-blue-600 px-3 text-sm font-bold text-white disabled:opacity-50">Import {validRows.length}</button>
                    </MobileStickyActions>
                </>
            )}

            {phase === 'result' && report && (
                <>
                    <MobileCard className="p-5 text-center">
                        {report.failureCount > 0 ? <AlertCircle className="mx-auto text-amber-600" size={34} /> : <CheckCircle2 className="mx-auto text-emerald-600" size={34} />}
                        <h2 className="mt-3 text-lg font-black">{report.atomic && report.failureCount ? 'Import rolled back' : report.failureCount ? 'Import completed with issues' : 'Import complete'}</h2>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gh-muted">Created: {report.successCount} · Failed: {report.failureCount} · Validation skipped: {report.skipped.length}</p>
                        {report.atomic && report.failureCount > 0 && <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-300">The resource import is atomic. No rows from this import were created.</p>}
                    </MobileCard>
                    {report.errors.length > 0 && <MobileCard className="p-4"><h3 className="text-sm font-bold">Import errors</h3><ul className="mt-2 space-y-1 text-xs text-red-600 dark:text-red-300">{report.errors.map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.error || JSON.stringify(item)}</li>)}</ul></MobileCard>}
                    <button type="button" onClick={reset} className="min-h-11 w-full rounded-xl bg-blue-600 text-sm font-bold text-white">Import another file</button>
                </>
            )}

            <MobileConfirmModal open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={runImport} pending={pending} title={`Import ${validRows.length} ${entityLabel}?`} message={atomic ? 'Resource import is atomic. If any server row fails, the complete import is rolled back.' : `Invalid rows will be skipped. The server may return a partial result for the remaining ${entityLabel}.`} confirmLabel="Confirm import" />
        </div>
    );
}
