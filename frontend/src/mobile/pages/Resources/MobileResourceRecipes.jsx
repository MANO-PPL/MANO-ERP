import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { resourceApi } from '../../../services/resourceApi.js';
import { projectApi } from '../../../services/projectApi.js';
import { loadMobileProjects } from '../../hooks/useMobileProjects.js';
import MobileCard from '../../components/MobileCard';
import MobileConfirmModal from '../../components/MobileConfirmModal';
import MobileDatePicker from '../../components/MobileDatePicker';
import MobileEmptyState from '../../components/MobileEmptyState';
import MobileSearchBar from '../../components/MobileSearchBar';
import MobileSelect from '../../components/MobileSelect';
import { UNIT_OPTIONS } from '../../../pages/Resources/resourceConstants.js';
import { isAccessDenied } from './resourceModel.js';

const today = () => new Date().toISOString().slice(0, 10);
const dateOnly = (value) => value ? String(value).slice(0, 10) : '';

export default function MobileResourceRecipes({ resources = [], canWrite, service = resourceApi, projectService = projectApi, loadProjects = loadMobileProjects, onRefresh, onAccessDenied }) {
    const items = useMemo(() => resources.filter((item) => item.type === 'item'), [resources]);
    const components = useMemo(() => resources.filter((item) => item.type === 'material' || item.type === 'labour'), [resources]);
    const [query, setQuery] = useState(''); const [selectedId, setSelectedId] = useState(''); const [projectId, setProjectId] = useState(''); const [projects, setProjects] = useState([]); const [effectiveFrom, setEffectiveFrom] = useState(today()); const [rows, setRows] = useState([]); const [history, setHistory] = useState([]); const [rates, setRates] = useState({}); const [loading, setLoading] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState(''); const [removeIndex, setRemoveIndex] = useState(null);
    const filtered = useMemo(() => items.filter((item) => !query || `${item.name} ${item.code || ''}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
    const latestDate = useMemo(() => history.map((item) => dateOnly(item.effective_from)).filter(Boolean).sort().pop() || '', [history]);
    const imported = !projectId || history.length > 0;
    const fail = (nextError, fallback) => { if (isAccessDenied(nextError)) onAccessDenied?.(nextError); else setError(nextError?.response?.data?.message || nextError?.message || fallback); };

    useEffect(() => { loadProjects().then((result) => setProjects(result?.projects || [])).catch(() => setProjects([])); }, [loadProjects]);
    useEffect(() => { if (!selectedId && items[0]) setSelectedId(String(items[0].id)); }, [items, selectedId]);
    useEffect(() => {
        if (!selectedId) return;
        let active = true; setLoading(true); setError('');
        const historyRequest = projectId ? projectService.getProjectCompositionHistory(projectId, selectedId) : service.getCompositionHistory(selectedId);
        const rateRequest = projectId ? projectService.getResolvedResourceRates(projectId, components.map((item) => item.id), effectiveFrom) : service.getResolvedRates(components.map((item) => item.id), effectiveFrom);
        Promise.all([service.getResourceById(selectedId, effectiveFrom), historyRequest, rateRequest]).then(([detail, historyResult, rateResult]) => {
            if (!active) return;
            const nextHistory = historyResult?.compositions || []; const detailRows = detail?.resource?.compositions || [];
            setHistory(nextHistory); setRows((projectId ? nextHistory.filter((item) => dateOnly(item.effective_from) <= effectiveFrom) : detailRows).map((item) => ({ component_resource_id: String(item.component_resource_id), quantity: String(item.quantity), unit_code: item.unit_code || '' })));
            setRates(Object.fromEntries((rateResult?.rates || []).map((item) => [String(item.resourceId), Number(item.rate) || 0])));
        }).catch((nextError) => { if (active) fail(nextError, 'Recipe could not be loaded'); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [components, effectiveFrom, projectId, projectService, selectedId, service]);

    const setRow = (index, key, value) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
    const save = async () => {
        if (!canWrite || !selectedId) return;
        if (projectId && !imported) { setError('Import this item into the selected project before saving a project recipe.'); return; }
        if (latestDate && effectiveFrom <= latestDate) { setError(`Choose an effective date after ${latestDate}.`); return; }
        const payload = rows.filter((row) => row.component_resource_id && Number(row.quantity) > 0 && row.unit_code).map((row) => ({ component_resource_id: Number(row.component_resource_id), quantity: Number(row.quantity), unit_code: row.unit_code, effective_from: effectiveFrom }));
        setPending(true); setError('');
        try { if (projectId) await projectService.setProjectCompositions(projectId, selectedId, payload, effectiveFrom); else await service.setCompositions(selectedId, payload, effectiveFrom); await onRefresh?.(); const next = projectId ? await projectService.getProjectCompositionHistory(projectId, selectedId) : await service.getCompositionHistory(selectedId); setHistory(next?.compositions || []); }
        catch (nextError) { fail(nextError, 'Recipe could not be saved'); } finally { setPending(false); }
    };
    const importItem = async () => { if (!canWrite || !projectId || !selectedId) return; setPending(true); setError(''); try { await projectService.importResource(projectId, selectedId, effectiveFrom); const next = await projectService.getProjectCompositionHistory(projectId, selectedId); setHistory(next?.compositions || []); await onRefresh?.(); } catch (nextError) { fail(nextError, 'Item could not be imported'); } finally { setPending(false); } };
    const total = rows.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (rates[String(row.component_resource_id)] || 0), 0);

    if (items.length === 0) return <MobileEmptyState title="No composite items" description="Create an Item resource before defining recipes." />;
    return <div className="space-y-4" data-resource-workspace="recipes">
        <MobileSearchBar value={query} onChange={setQuery} placeholder="Search composite items" />
        <MobileSelect label="Item" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} options={filtered.map((item) => ({ value: String(item.id), label: `${item.name}${item.code ? ` · ${item.code}` : ''}` }))} />
        <MobileSelect label="Scope" value={projectId} onChange={(event) => setProjectId(event.target.value)} options={[{ value: '', label: 'Master / Organization' }, ...projects.map((item) => ({ value: String(item.id), label: item.name }))]} />
        <MobileDatePicker label="Effective from" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        {loading ? <p className="py-8 text-center text-sm text-gray-500">Loading recipe…</p> : projectId && !imported ? <MobileCard><p className="text-sm font-bold">Item is not imported into this project.</p>{canWrite && <button disabled={pending} onClick={importItem} className="mt-3 min-h-11 w-full rounded-xl bg-blue-600 text-sm font-bold text-white">Import current master recipe</button>}</MobileCard> : <>
            <MobileCard><div className="flex items-center"><div className="min-w-0 flex-1"><h3 className="text-sm font-black">Recipe draft</h3><p className="text-xs text-gray-500">Estimated current cost: ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p></div>{canWrite && <button onClick={() => setRows((current) => [...current, { component_resource_id: '', quantity: '1', unit_code: '' }])} className="min-h-11 px-2 text-blue-600"><Plus size={19} /></button>}</div><div className="mt-3 space-y-3">{rows.length === 0 ? <p className="text-xs text-gray-500">No ingredients in this version.</p> : rows.map((row, index) => <div key={index} className="space-y-2 rounded-xl bg-gray-50 p-3 dark:bg-gh-bg"><MobileSelect label="Component" disabled={!canWrite} value={row.component_resource_id} onChange={(event) => { const component = components.find((item) => String(item.id) === event.target.value); setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, component_resource_id: event.target.value, unit_code: component?.base_unit_code || '' } : item)); }} options={[{ value: '', label: 'Select component' }, ...components.map((item) => ({ value: String(item.id), label: `${item.name} (${item.type})` }))]} /><label className="text-xs font-semibold">Quantity<input disabled={!canWrite} type="number" min="0" step="any" value={row.quantity} onChange={(event) => setRow(index, 'quantity', event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 dark:border-gh-border dark:bg-gh-input" /></label><MobileSelect label="Unit" disabled={!canWrite} value={row.unit_code} onChange={(event) => setRow(index, 'unit_code', event.target.value)} options={UNIT_OPTIONS.map((item) => ({ value: item.code, label: `${item.symbol} — ${item.name}` }))} />{canWrite && <button onClick={() => setRemoveIndex(index)} className="min-h-11 text-xs font-bold text-red-600"><Trash2 className="mr-1 inline" size={15} />Remove ingredient</button>}</div>)}</div>{canWrite && <button disabled={pending} onClick={save} className="mt-4 min-h-11 w-full rounded-xl bg-blue-600 text-sm font-bold text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save new recipe version'}</button>}</MobileCard>
            <MobileCard><h3 className="text-sm font-black">Version history</h3>{history.length === 0 ? <p className="mt-2 text-xs text-gray-500">No recipe versions.</p> : <div className="mt-2 space-y-2">{[...new Set(history.map((item) => dateOnly(item.effective_from)))].filter(Boolean).sort().reverse().map((date) => <div key={date} className="rounded-xl border border-gray-100 p-3 text-xs dark:border-gh-border"><span className="font-bold">Effective {date}</span><span className="float-right">{history.filter((item) => dateOnly(item.effective_from) === date).length} components</span></div>)}</div>}</MobileCard>
        </>}
        <MobileConfirmModal open={removeIndex !== null} onClose={() => setRemoveIndex(null)} onConfirm={() => { setRows((current) => current.filter((_, index) => index !== removeIndex)); setRemoveIndex(null); }} danger title="Remove ingredient?" message="This removes the row from the draft. Save the recipe to create a new version." confirmLabel="Remove" />
    </div>;
}
