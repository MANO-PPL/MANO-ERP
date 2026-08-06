import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Calculator,
    CheckCircle2,
    ChevronDown,
    FlaskConical,
    Layers,
    LoaderCircle,
    Plus,
    RefreshCw,
    RotateCcw,
    Save,
    Trash2,
    WandSparkles,
    X
} from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';
import { UNIT_GROUPS, UNIT_REGISTRY } from './resourceConstants';
import { useAuth } from '../../context/AuthContext';

const today = () => new Date().toISOString().slice(0, 10);
const dateOnly = (value) => (value ? String(value).slice(0, 10) : '');
const isAggregatedRow = (row) => row.rate === null || row.rate === undefined;

const TYPE_STYLES = {
    material: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    labour: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    item: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
};

const errorMessage = (error) => (
    error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Request failed'
);

const FieldLabel = ({ children }) => (
    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
        {children}
    </label>
);

const Select = ({ value, onChange, children, disabled = false }) => (
    <div className="relative">
        <select
            value={value}
            onChange={onChange}
            disabled={disabled}
            className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-xs text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-white/10 dark:bg-[#0d1117] dark:text-gray-200 dark:disabled:bg-white/[0.03]"
        >
            {children}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-2.5 text-gray-400" />
    </div>
);

const Button = ({ children, onClick, disabled = false, variant = 'primary', className = '', type = 'button' }) => {
    const variants = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900/40',
        secondary: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.07]',
        ghost: 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100',
        danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-900/10 dark:text-red-300'
    };

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
        >
            {children}
        </button>
    );
};

const ResourceBadge = ({ resource }) => (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${TYPE_STYLES[resource?.type] || TYPE_STYLES.material}`}>
        {resource?.type || 'resource'}
    </span>
);

const ResourceRate = () => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('resources', 2);

    const [resources, setResources] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isWorking, setIsWorking] = useState(false);
    const [message, setMessage] = useState(null);

    // Step 1 — manual rates (any resource type)
    const [manualResourceId, setManualResourceId] = useState('');
    const [manualRate, setManualRate] = useState('');
    const [manualUnitCode, setManualUnitCode] = useState('');
    const [manualFrom, setManualFrom] = useState(today());
    const [rateHistory, setRateHistory] = useState([]);
    const [aggregatedHistoryRates, setAggregatedHistoryRates] = useState({});
    const [rateHistoryLoading, setRateHistoryLoading] = useState(false);

    // Step 2 — compositions (items only)
    const [selectedParentId, setSelectedParentId] = useState('');
    const [selectedComponentId, setSelectedComponentId] = useState('');
    const [compositionDate, setCompositionDate] = useState(today());
    const [compositionRows, setCompositionRows] = useState([]);
    const [quantity, setQuantity] = useState('1');
    const [unitCode, setUnitCode] = useState('');
    const [componentRates, setComponentRates] = useState({});
    const [componentRatesLoading, setComponentRatesLoading] = useState(false);

    // Step 3 — resolve
    const [rateDate, setRateDate] = useState(today());
    const [resolvedRate, setResolvedRate] = useState(null);

    const [demoIds, setDemoIds] = useState([]);

    const items = useMemo(() => resources.filter(resource => resource.type === 'item'), [resources]);
    const componentResources = useMemo(() => resources.filter(resource => resource.type === 'material' || resource.type === 'labour'), [resources]);
    const manualRateResources = resources;
    const selectedParent = resources.find(resource => String(resource.id) === String(selectedParentId));
    const selectedComponent = resources.find(resource => String(resource.id) === String(selectedComponentId));
    const selectedManualResource = resources.find(resource => String(resource.id) === String(manualResourceId));

    // The active aggregated marker is also active, but only a non-null active
    // row can be reverted from manual to aggregated.
    const activeManualRateRow = rateHistory.find(row => (
        Number(row.is_active) === 1 && row.rate !== null && row.rate !== undefined
    ));
    const canRevertToComputed = selectedManualResource?.type === 'item' && !!activeManualRateRow;

    const loadResources = async (keepSelection = true) => {
        setIsLoading(true);
        try {
            const result = await resourceApi.getResources({ limit: 500, include_details: false, include_rates: false });
            const nextResources = result.resources || [];
            setResources(nextResources);

            if (!keepSelection || !nextResources.some(resource => String(resource.id) === String(manualResourceId))) {
                const firstRateable = nextResources[0];
                setManualResourceId(firstRateable ? String(firstRateable.id) : '');
            }
            if (!keepSelection || !nextResources.some(resource => String(resource.id) === String(selectedParentId))) {
                const firstItem = nextResources.find(resource => resource.type === 'item');
                setSelectedParentId(firstItem ? String(firstItem.id) : '');
            }
        } catch (error) {
            setMessage({ type: 'error', text: errorMessage(error) });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadResources(false);
        // This page intentionally loads its own test data rather than sharing
        // the spreadsheet state in the normal Resources screen.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedManualResource) {
            setManualUnitCode(selectedManualResource.base_unit_code || '');
        } else {
            setManualUnitCode('');
        }
    }, [manualResourceId, selectedManualResource]);

    useEffect(() => {
        if (!selectedComponent) {
            setUnitCode('');
            return;
        }
        const componentUnit = selectedComponent.base_unit_code;
        const isSameCategory = unitCode && UNIT_REGISTRY[unitCode]?.type === UNIT_REGISTRY[componentUnit]?.type;
        if (!isSameCategory) setUnitCode(componentUnit || '');
    }, [selectedComponentId, selectedComponent, unitCode]);

    const loadRateHistory = async (resourceId = manualResourceId) => {
        if (!resourceId) {
            setRateHistory([]);
            return;
        }
        setRateHistoryLoading(true);
        try {
            const result = await resourceApi.getRateHistory(resourceId);
            const rates = result.rates || [];
            setRateHistory(rates);

            const aggregatedRows = rates.filter(isAggregatedRow);
            const resolvedAggregatedRates = await Promise.all(aggregatedRows.map(async row => {
                try {
                    const resolved = await resourceApi.getResolvedRate(resourceId, dateOnly(row.effective_from));
                    return [row.id, resolved.rate];
                } catch {
                    return [row.id, null];
                }
            }));
            setAggregatedHistoryRates(Object.fromEntries(resolvedAggregatedRates));
        } catch {
            setRateHistory([]);
            setAggregatedHistoryRates({});
        } finally {
            setRateHistoryLoading(false);
        }
    };

    useEffect(() => {
        loadRateHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [manualResourceId]);

    useEffect(() => {
        const loadComposition = async () => {
            if (!selectedParentId) {
                setCompositionRows([]);
                return;
            }
            try {
                const result = await resourceApi.getResourceById(selectedParentId, compositionDate);
                setCompositionRows((result.resource?.compositions || []).map(row => ({
                    component_resource_id: String(row.component_resource_id),
                    quantity: String(row.quantity),
                    unit_code: row.unit_code,
                    component_name: row.component_name
                })));
            } catch (error) {
                setMessage({ type: 'error', text: errorMessage(error) });
            }
        };
        loadComposition();
    }, [selectedParentId, compositionDate]);

    useEffect(() => {
        const loadComponentRates = async () => {
            const componentIds = [...new Set(compositionRows.map(row => String(row.component_resource_id)))];
            if (componentIds.length === 0) {
                setComponentRates({});
                return;
            }

            setComponentRatesLoading(true);
            const results = await Promise.all(componentIds.map(async id => {
                try {
                    const result = await resourceApi.getResolvedRate(id, rateDate);
                    return [id, result.rate];
                } catch {
                    return [id, null];
                }
            }));
            setComponentRates(Object.fromEntries(results));
            setComponentRatesLoading(false);
        };

        loadComponentRates();
    }, [compositionRows, rateDate]);

    const showSuccess = (text) => setMessage({ type: 'success', text });

    const resolveRate = async (idOverride) => {
        const id = idOverride || selectedParentId;
        if (!id) {
            setMessage({ type: 'error', text: 'Choose an item to resolve.' });
            return;
        }
        setIsWorking(true);
        setMessage(null);
        try {
            const result = await resourceApi.getResolvedRate(id, rateDate);
            setResolvedRate(result.rate);
        } catch (error) {
            setResolvedRate(null);
            setMessage({ type: 'error', text: errorMessage(error) });
        } finally {
            setIsWorking(false);
        }
    };

    const addManualRate = async () => {
        if (!canWrite) return;
        if (!manualResourceId || !manualRate || !manualUnitCode) {
            setMessage({ type: 'error', text: 'Choose a resource and provide rate and unit.' });
            return;
        }
        setIsWorking(true);
        setMessage(null);
        try {
            await resourceApi.addRate(manualResourceId, {
                rate: Number(manualRate),
                unit_code: manualUnitCode,
                effective_from: manualFrom,
                remarks: 'Created from Resource Rate Lab'
            });
            await loadRateHistory(manualResourceId);
            showSuccess(`Manual rate added for ${selectedManualResource?.name || 'resource'}.`);
            if (String(manualResourceId) === String(selectedParentId)) await resolveRate();
        } catch (error) {
            setMessage({ type: 'error', text: errorMessage(error) });
        } finally {
            setIsWorking(false);
        }
    };

    const revertToComputed = async () => {
        if (!canWrite || !canRevertToComputed) return;
        setIsWorking(true);
        setMessage(null);
        try {
            await resourceApi.clearManualRate(manualResourceId, manualFrom);
            await loadRateHistory(manualResourceId);
            showSuccess(`${selectedManualResource?.name || 'Item'} will use its computed rate from ${manualFrom} onward.`);
            if (String(manualResourceId) === String(selectedParentId)) await resolveRate();
        } catch (error) {
            setMessage({ type: 'error', text: errorMessage(error) });
        } finally {
            setIsWorking(false);
        }
    };

    const saveComposition = async () => {
        if (!canWrite) return;
        if (!selectedParentId) return setMessage({ type: 'error', text: 'Choose an item first.' });

        setIsWorking(true);
        setMessage(null);
        try {
            await resourceApi.setCompositions(
                selectedParentId,
                compositionRows.map(row => ({
                    component_resource_id: Number(row.component_resource_id),
                    quantity: Number(row.quantity),
                    unit_code: row.unit_code,
                    effective_from: compositionDate
                })),
                compositionDate
            );
            showSuccess(`Composition version saved for ${compositionDate}.`);
            await resolveRate();
        } catch (error) {
            setMessage({ type: 'error', text: errorMessage(error) });
        } finally {
            setIsWorking(false);
        }
    };

    const addCompositionRow = () => {
        if (!selectedComponentId || !quantity || Number(quantity) <= 0) {
            setMessage({ type: 'error', text: 'Choose a component and enter a positive quantity.' });
            return;
        }
        setCompositionRows(rows => ([
            ...rows,
            {
                component_resource_id: String(selectedComponentId),
                quantity: String(quantity),
                unit_code: unitCode || selectedComponent?.base_unit_code,
                component_name: selectedComponent?.name
            }
        ]));
        setQuantity('1');
        setMessage(null);
    };

    const createDemoScenario = async () => {
        if (!canWrite) return;
        setIsWorking(true);
        setMessage(null);
        const suffix = Date.now().toString().slice(-6);
        const created = [];
        try {
            const cement = await resourceApi.createResource({
                name: `Rate Lab Cement ${suffix}`,
                code: `RATE-CEMENT-${suffix}`,
                type: 'material',
                base_unit_code: 'kg'
            });
            created.push(cement.id);
            const sand = await resourceApi.createResource({
                name: `Rate Lab Sand ${suffix}`,
                code: `RATE-SAND-${suffix}`,
                type: 'material',
                base_unit_code: 'kg'
            });
            created.push(sand.id);
            const labour = await resourceApi.createResource({
                name: `Rate Lab Labour ${suffix}`,
                code: `RATE-LABOUR-${suffix}`,
                type: 'labour',
                base_unit_code: 'hr'
            });
            created.push(labour.id);
            const item = await resourceApi.createResource({
                name: `Rate Lab Concrete ${suffix}`,
                code: `RATE-ITEM-${suffix}`,
                type: 'item',
                base_unit_code: 'Nos'
            });
            created.push(item.id);

            await Promise.all([
                resourceApi.addRate(cement.id, { rate: 8.5, unit_code: 'kg', effective_from: today(), remarks: 'Rate Lab demo' }),
                resourceApi.addRate(sand.id, { rate: 2.4, unit_code: 'kg', effective_from: today(), remarks: 'Rate Lab demo' }),
                resourceApi.addRate(labour.id, { rate: 450, unit_code: 'hr', effective_from: today(), remarks: 'Rate Lab demo' })
            ]);
            await resourceApi.setCompositions(item.id, [
                { component_resource_id: cement.id, quantity: 50, unit_code: 'kg' },
                { component_resource_id: sand.id, quantity: 100, unit_code: 'kg' },
                { component_resource_id: labour.id, quantity: 2, unit_code: 'hr' }
            ], today());

            setDemoIds(created);
            await loadResources(false);
            setSelectedParentId(String(item.id));
            setRateDate(today());
            setCompositionDate(today());
            showSuccess('Demo resources, manual rates, and a computed item rate were created.');
            const result = await resourceApi.getResolvedRate(item.id, today());
            setResolvedRate(result.rate);
        } catch (error) {
            setMessage({ type: 'error', text: `${errorMessage(error)}${created.length ? ' Some demo rows were created; use cleanup when available.' : ''}` });
            setDemoIds(created);
        } finally {
            setIsWorking(false);
        }
    };

    const cleanupDemoScenario = async () => {
        if (!canWrite || demoIds.length === 0) return;
        setIsWorking(true);
        setMessage(null);
        try {
            // Delete the item first because its components are referenced by
            // res_compositions and the backend correctly blocks those deletes.
            const failures = [];
            for (const id of [...demoIds].reverse()) {
                try {
                    await resourceApi.deleteResource(id);
                } catch (error) {
                    if (error.response?.status !== 404) failures.push(errorMessage(error));
                }
            }
            if (failures.length > 0) {
                throw new Error(failures.join('; '));
            }
            setDemoIds([]);
            setResolvedRate(null);
            await loadResources(false);
            showSuccess('Demo resources removed.');
        } catch (error) {
            setMessage({ type: 'error', text: errorMessage(error) });
        } finally {
            setIsWorking(false);
        }
    };

    const manualUnits = selectedManualResource
        ? (UNIT_GROUPS[UNIT_REGISTRY[selectedManualResource.base_unit_code]?.type] || [])
        : [];
    const componentUnits = selectedComponent
        ? (UNIT_GROUPS[UNIT_REGISTRY[selectedComponent.base_unit_code]?.type] || [])
        : [];

    return (
        <div className="flex h-[calc(100vh-44px)] w-full flex-col overflow-y-auto bg-gray-50 dark:bg-[#0d1117]">
            <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-[#0d1117]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-blue-100 p-2.5 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                            <FlaskConical size={21} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-gray-900 dark:text-white">Resource Rate Lab</h2>
                            <p className="mt-0.5 max-w-2xl text-xs text-gray-500 dark:text-gray-400">
                                Set manual rates for any resource, layer item compositions on top, and resolve the effective rate.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => loadResources()} disabled={isLoading || isWorking}>
                            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} /> Refresh
                        </Button>
                        <Button onClick={createDemoScenario} disabled={!canWrite || isWorking}>
                            <WandSparkles size={13} /> Create demo scenario
                        </Button>
                        {demoIds.length > 0 && (
                            <Button variant="danger" onClick={cleanupDemoScenario} disabled={!canWrite || isWorking}>
                                <Trash2 size={13} /> Cleanup demo
                            </Button>
                        )}
                    </div>
                </div>
                {!canWrite && (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-500/20 dark:bg-amber-900/10 dark:text-amber-300">
                        You have read-only access. You can resolve rates, but create/update test actions require Resource write permission.
                    </p>
                )}
                {message && (
                    <div className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${message.type === 'error'
                        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-900/10 dark:text-red-300'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-900/10 dark:text-emerald-300'
                        }`}>
                        {message.type === 'error' ? <AlertCircle size={14} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={14} className="mt-0.5 shrink-0" />}
                        <span>{message.text}</span>
                        <button className="ml-auto opacity-60 hover:opacity-100" onClick={() => setMessage(null)}><X size={13} /></button>
                    </div>
                )}
            </div>

            <div className="grid flex-1 grid-cols-1 gap-4 p-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
                <div className="space-y-4">
                    {/* STEP 1 — Manual rate, any resource type */}
                    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#161b22]">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Step 1</p>
                                <div className="mt-1 flex items-center gap-2">
                                    <h3 className="text-sm font-black text-gray-900 dark:text-white">Add a manual rate</h3>
                                    {selectedManualResource && <ResourceBadge resource={selectedManualResource} />}
                                </div>
                            </div>
                            <Calculator size={18} className="text-amber-500" />
                        </div>
                        <p className="mb-3 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
                            Works for any resource — material, labour, or item. For materials/labour this is the only source of rate.
                            For an item, it overrides the computed composition rate until you revert it.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="lg:col-span-2">
                                <FieldLabel>Resource</FieldLabel>
                                <Select value={manualResourceId} onChange={event => setManualResourceId(event.target.value)}>
                                    <option value="">{isLoading ? 'Loading resources…' : 'Select resource'}</option>
                                    {manualRateResources.map(resource => <option key={resource.id} value={resource.id}>{resource.name} · {resource.base_unit_code}</option>)}
                                </Select>
                            </div>
                            <div><FieldLabel>Rate</FieldLabel><input type="number" min="0" step="any" value={manualRate} onChange={event => setManualRate(event.target.value)} placeholder="0.00" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 dark:border-white/10 dark:bg-[#0d1117] dark:text-gray-200" /></div>
                            <div><FieldLabel>Rate unit</FieldLabel><Select value={manualUnitCode} onChange={event => setManualUnitCode(event.target.value)} disabled={!selectedManualResource}><option value="">Unit</option>{manualUnits.map(unit => <option key={unit.code} value={unit.code}>{unit.code}</option>)}</Select></div>
                            <div><FieldLabel>Effective from</FieldLabel><input type="date" value={manualFrom} onChange={event => setManualFrom(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 dark:border-white/10 dark:bg-[#0d1117] dark:text-gray-200" /><p className="mt-1 text-[9px] text-gray-400">Used for both adding a manual rate and reverting to computed.</p></div>
                        </div>
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                            {canRevertToComputed && (
                                <Button variant="secondary" onClick={revertToComputed} disabled={!canWrite || isWorking}>
                                    <RotateCcw size={13} /> Revert to computed
                                </Button>
                            )}
                            <Button onClick={addManualRate} disabled={!canWrite || isWorking}><Plus size={13} /> Add manual rate</Button>
                        </div>

                        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
                            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400">Rate history</div>
                            <table className="w-full text-left text-[11px]">
                                <thead className="text-[9px] uppercase tracking-wider text-gray-400"><tr><th className="px-3 py-2">Rate</th><th className="px-3 py-2">Effective from</th><th className="px-3 py-2">Effective to</th><th className="px-3 py-2">Status</th></tr></thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    {rateHistory.map(row => (
                                        <tr key={row.id}>
                                            <td className="px-3 py-2 font-bold text-gray-800 dark:text-gray-200">
                                                {isAggregatedRow(row) ? (() => {
                                                    const aggregate = aggregatedHistoryRates[row.id];
                                                    return (
                                                        <span className="inline-flex flex-wrap items-center gap-1.5">
                                                            <span>{aggregate?.rate !== null && aggregate?.rate !== undefined
                                                                ? `${Number(aggregate.rate).toLocaleString(undefined, { maximumFractionDigits: 4 })} / ${aggregate.unitCode || row.unit_code}`
                                                                : '—'}</span>
                                                            <span className="text-blue-500 dark:text-blue-300">· Aggregated</span>
                                                        </span>
                                                    );
                                                })() : `${Number(row.rate).toLocaleString(undefined, { maximumFractionDigits: 4 })} / ${row.unit_code}`}
                                            </td>
                                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{dateOnly(row.effective_from)}</td>
                                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{dateOnly(row.effective_to) || 'open-ended'}</td>
                                            <td className="px-3 py-2">
                                                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase ${Number(row.is_active) === 1 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'}`}>
                                                    {Number(row.is_active) === 1 ? 'active' : 'inactive'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {rateHistory.length === 0 && <tr><td colSpan="4" className="px-3 py-4 text-center text-gray-400">{rateHistoryLoading ? 'Loading rate history…' : 'No manual rates for this resource — an item with no rows here uses its computed rate.'}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* STEP 2 — Composition, items only */}
                    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#161b22]">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Step 2</p>
                                <div className="mt-1 flex items-center gap-2"><h3 className="text-sm font-black text-gray-900 dark:text-white">Choose an item and edit its composition</h3>{selectedParent && <ResourceBadge resource={selectedParent} />}</div>
                            </div>
                            <Layers size={18} className="text-purple-500" />
                        </div>
                        <p className="mb-3 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
                            Only applies to items. An item's rate is computed from these components unless a manual rate from Step 1 is active for it.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                            <div>
                                <FieldLabel>Parent item</FieldLabel>
                                <Select value={selectedParentId} onChange={event => setSelectedParentId(event.target.value)} disabled={isLoading}>
                                    <option value="">{isLoading ? 'Loading resources…' : 'Select an item'}</option>
                                    {items.map(resource => <option key={resource.id} value={resource.id}>{resource.name} · {resource.base_unit_code}</option>)}
                                </Select>
                            </div>
                            <div>
                                <FieldLabel>Effective from</FieldLabel>
                                <input type="date" value={compositionDate} onChange={event => setCompositionDate(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-[#0d1117] dark:text-gray-200" />
                            </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-3 dark:border-white/10">
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_100px_110px_auto] sm:items-end">
                                <div>
                                    <FieldLabel>Component</FieldLabel>
                                    <Select value={selectedComponentId} onChange={event => setSelectedComponentId(event.target.value)} disabled={isLoading}>
                                        <option value="">Select material/labour</option>
                                        {componentResources.map(resource => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
                                    </Select>
                                </div>
                                <div>
                                    <FieldLabel>Quantity</FieldLabel>
                                    <input type="number" min="0" step="any" value={quantity} onChange={event => setQuantity(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 dark:border-white/10 dark:bg-[#0d1117] dark:text-gray-200" />
                                </div>
                                <div>
                                    <FieldLabel>Unit</FieldLabel>
                                    <Select value={unitCode} onChange={event => setUnitCode(event.target.value)} disabled={!selectedComponent}>
                                        <option value="">Unit</option>
                                        {componentUnits.map(unit => <option key={unit.code} value={unit.code}>{unit.code}</option>)}
                                    </Select>
                                </div>
                                <Button variant="secondary" onClick={addCompositionRow} disabled={!canWrite || !selectedParentId}>
                                    <Plus size={14} /> Add
                                </Button>
                            </div>
                        </div>

                        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
                                    <tr><th className="px-3 py-2">Component</th><th className="px-3 py-2">Quantity</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Rate</th><th className="w-8 px-2" /></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    {compositionRows.map((row, index) => {
                                        const component = resources.find(resource => String(resource.id) === String(row.component_resource_id));
                                        const componentRate = componentRates[String(row.component_resource_id)];
                                        return (
                                            <tr key={`${row.component_resource_id}-${index}`}>
                                                <td className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-200">{component?.name || row.component_name || `Resource ${row.component_resource_id}`}</td>
                                                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.quantity}</td>
                                                <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">{row.unit_code}</td>
                                                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                                                    {componentRatesLoading ? <span className="text-gray-400">Loading…</span> : componentRate ? (
                                                        <span className="whitespace-nowrap"><b>{Number(componentRate.rate).toLocaleString(undefined, { maximumFractionDigits: 4 })}</b> / {componentRate.unitCode}<span className="ml-1 text-[9px] uppercase text-gray-400">{componentRate.source}</span>{componentRate.effectiveTo && <span className="ml-1 text-[9px] text-gray-400">to {componentRate.effectiveTo}</span>}</span>
                                                    ) : <span className="text-gray-400">No rate</span>}
                                                </td>
                                                <td className="px-2 py-2 text-right"><button onClick={() => setCompositionRows(rows => rows.filter((_, rowIndex) => rowIndex !== index))} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"><Trash2 size={13} /></button></td>
                                            </tr>
                                        );
                                    })}
                                    {compositionRows.length === 0 && <tr><td colSpan="5" className="px-3 py-6 text-center text-gray-400">No rows. Add components — every component must already have a rate from Step 1.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3 flex justify-end">
                            <Button onClick={saveComposition} disabled={!canWrite || isWorking || !selectedParentId}>
                                {isWorking ? <LoaderCircle size={13} className="animate-spin" /> : <Save size={13} />} Save composition version
                            </Button>
                        </div>
                    </section>
                </div>

                <div className="space-y-4">
                    {/* STEP 3 — Resolve */}
                    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#161b22]">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Step 3</p>
                                <h3 className="mt-1 text-sm font-black text-gray-900 dark:text-white">Resolve the rate</h3>
                            </div>
                            <Calculator size={18} className="text-emerald-500" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                            <div><FieldLabel>Item</FieldLabel><Select value={selectedParentId} onChange={event => setSelectedParentId(event.target.value)}><option value="">Select item</option>{items.map(resource => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</Select></div>
                            <div><FieldLabel>As of date</FieldLabel><input type="date" value={rateDate} onChange={event => setRateDate(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 dark:border-white/10 dark:bg-[#0d1117] dark:text-gray-200" /></div>
                        </div>
                        <Button className="mt-3 w-full" onClick={() => resolveRate()} disabled={isWorking || !selectedParentId}>
                            {isWorking ? <LoaderCircle size={14} className="animate-spin" /> : <Calculator size={14} />} Resolve effective rate
                        </Button>

                        {resolvedRate && (
                            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-900/10">
                                <div className="flex items-start justify-between gap-3">
                                    <div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300">Resolved result</p><p className="mt-1 text-2xl font-black text-gray-900 dark:text-white">{Number(resolvedRate.rate).toLocaleString(undefined, { maximumFractionDigits: 4 })} <span className="text-sm font-bold text-gray-500">/ {resolvedRate.unitCode}</span></p><p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">Effective: {dateOnly(resolvedRate.effectiveFrom) || rateDate} → {dateOnly(resolvedRate.effectiveTo) || 'open-ended'}</p></div>
                                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${resolvedRate.source === 'manual' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>{resolvedRate.source}</span>
                                </div>
                                {resolvedRate.breakdown?.length > 0 && (
                                    <div className="mt-4 space-y-2 border-t border-emerald-200/70 pt-3 dark:border-emerald-500/20">
                                        {resolvedRate.breakdown.map((row, index) => (
                                            <div key={`${row.resourceId}-${index}`} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate text-gray-700 dark:text-gray-300">{row.resourceName} <span className="text-gray-400">({row.quantity} {row.quantityUnitCode})</span><span className="ml-1 text-[10px] text-gray-400">@ {Number(row.rate).toLocaleString(undefined, { maximumFractionDigits: 4 })}/{row.rateUnitCode}</span></span><span className="shrink-0 text-right"><span className="block font-bold text-gray-800 dark:text-gray-200">{Number(row.cost).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span><span className="block text-[9px] uppercase text-gray-400">{row.source}</span></span></div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#161b22]">
                        <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-slate-100 p-2 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"><FlaskConical size={16} /></div>
                            <div>
                                <h3 className="text-sm font-black text-gray-900 dark:text-white">What this page verifies</h3>
                                <ul className="mt-3 space-y-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                    <li>• A row in <code className="rounded bg-gray-100 px-1 dark:bg-white/[0.08]">res_rates</code> resolves as <b>manual</b>, for any resource type.</li>
                                    <li>• An item with no effective rate row resolves as <b>computed</b> from its components.</li>
                                    <li>• An item can be reverted from manual back to computed without losing rate history.</li>
                                    <li>• Composition changes create a dated version instead of deleting history.</li>
                                    <li>• Duplicate components and circular references are rejected before insert.</li>
                                    <li>• Unit conversion is applied before each component cost is added.</li>
                                </ul>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default ResourceRate;
