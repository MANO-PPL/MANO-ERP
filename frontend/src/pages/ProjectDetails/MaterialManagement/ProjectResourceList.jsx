import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, History, Package, Plus, RefreshCw, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { projectApi } from '../../../services/projectApi';
import { resourceApi } from '../../../services/resourceApi';

const dateOnly = (value) => (value ? String(value).slice(0, 10) : new Date().toISOString().slice(0, 10));

const isItemResource = (resource) => resource?.type === 'item';

const TYPE_STYLES = {
    material: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    item: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    labour: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
};

const getImportLabel = (resource) => {
    if (resource?.type === 'item') return 'Add item';
    if (resource?.type === 'material' || resource?.type === 'labour') return 'Add resource';
    return 'Add resource';
};

const getImportToastLabel = (resource) => {
    if (resource?.type === 'item') return 'item';
    if (resource?.type === 'material' || resource?.type === 'labour') return 'resource';
    return 'resource';
};

const ProjectResourceList = ({ onBack, setExtraBreadcrumbs, canWrite }) => {
    const { id: projectId } = useParams();
    const [resources, setResources] = useState([]);
    const [allResources, setAllResources] = useState([]);
    const [resolvedRates, setResolvedRates] = useState({});
    const [loading, setLoading] = useState(true);
    const [ratesLoading, setRatesLoading] = useState(true);
    const [error, setError] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [tableSearch, setTableSearch] = useState('');

    const [rateResource, setRateResource] = useState(null);
    const [rateDate, setRateDate] = useState(dateOnly());
    const [rateInfo, setRateInfo] = useState(null);
    const [rateHistory, setRateHistory] = useState([]);
    const [rateLoading, setRateLoading] = useState(false);
    const [rateSaving, setRateSaving] = useState(false);
    const [rateForm, setRateForm] = useState({ rate: '', unitCode: '', effectiveFrom: dateOnly(), remarks: '' });

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'Material Management', onClick: onBack },
            { label: 'Project Resources & Rates' }
        ]);
    }, [onBack, setExtraBreadcrumbs, projectId]);

    const loadResolvedRates = async (projectResources, masterResources) => {
        const importedIds = new Set(projectResources.map(resource => String(resource.resource_id)));
        const masterById = new Map(masterResources.map(resource => [String(resource.id), resource]));
        const importedResourceIds = projectResources.map(resource => resource.resource_id);
        const rateResponse = await projectApi.getResolvedResourceRates(projectId, importedResourceIds, dateOnly());
        const resolvedById = new Map((rateResponse.rates || [])
            .map(rate => [String(rate.resourceId), rate]));

        const entries = masterResources.map(resource => {
            if (!importedIds.has(String(resource.id))) {
                // Unimported items must not inherit a computed master recipe;
                // only an explicit master manual rate is allowed to fall back.
                const hasMasterRate = resource.rate_source === 'manual'
                    && resource.rate !== null
                    && resource.rate !== undefined;
                return [String(resource.id), {
                    rate: hasMasterRate ? Number(resource.rate) : null,
                    unitCode: resource.rate_unit_code || resource.base_unit_code,
                    source: resource.rate_source || null,
                    rateScope: hasMasterRate ? 'master' : null
                }];
            }

            const resolved = resolvedById.get(String(resource.id));
            return [String(resource.id), resolved || {
                rate: null,
                unitCode: resource.base_unit_code,
                source: null,
                rateScope: null
            }];
        });

        // Preserve imported rows whose master resource was removed or filtered
        // out, so the project view never silently loses project data.
        projectResources
            .filter(resource => !masterById.has(String(resource.resource_id)))
            .forEach(resource => {
                entries.push([
                    String(resource.resource_id),
                    resolvedById.get(String(resource.resource_id)) || {
                        rate: null,
                        unitCode: resource.base_unit_code,
                        source: null,
                        rateScope: null
                    }
                ]);
            });

        setResolvedRates(Object.fromEntries(entries));
    };

    const fetchResources = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            setRatesLoading(true);
            setError('');
            const [projectResponse, masterResponse] = await Promise.all([
                projectApi.listProjectResources(projectId),
                resourceApi.getResources({ type: 'item', limit: 5000, include_details: false })
            ]);
            const projectResources = projectResponse.resources || [];
            const masterResources = masterResponse.resources || [];
            const importedIds = new Set(projectResources.map(resource => String(resource.resource_id)));
            const masterIds = new Set(masterResources.map(resource => String(resource.id)));
            const mergedResources = [
                ...masterResources
                    .filter(isItemResource)
                    .map(resource => ({
                    ...resource,
                    resource_id: resource.id,
                    isImported: importedIds.has(String(resource.id))
                })),
                ...projectResources
                    .filter(isItemResource)
                    .filter(resource => !masterIds.has(String(resource.resource_id)))
                    .map(resource => ({ ...resource, isImported: true }))
            ];
            setAllResources(masterResources);
            setResources(mergedResources);

            // Render the catalog immediately; rate resolution is an independent
            // enrichment step and should not block the initial table.
            setLoading(false);
            try {
                await loadResolvedRates(projectResources, masterResources);
            } catch (rateError) {
                console.error('Failed to load project resource rates', rateError);
                setResolvedRates({});
                setError(rateError.response?.data?.message || 'Failed to load project resource rates');
            } finally {
                setRatesLoading(false);
            }
        } catch (err) {
            console.error('Failed to load project resources', err);
            setError(err.response?.data?.message || 'Failed to load project resources');
        } finally {
            setLoading(false);
            setRatesLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) fetchResources();
    }, [projectId]);

    const projectResourceIds = useMemo(
        () => new Set(resources
            .filter(resource => resource.isImported)
            .map(resource => String(resource.resource_id))),
        [resources]
    );

    const availableResources = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        return allResources.filter(resource => {
            if (!isItemResource(resource)) return false;
            if (projectResourceIds.has(String(resource.id))) return false;
            if (!query) return true;
            return resource.name?.toLowerCase().includes(query)
                || resource.code?.toLowerCase().includes(query)
                || resource.type?.toLowerCase().includes(query);
        });
    }, [allResources, projectResourceIds, searchTerm]);

    const visibleResources = useMemo(() => {
        const query = tableSearch.trim().toLowerCase();
        if (!query) return resources;
        return resources.filter(resource => (
            resource.name?.toLowerCase().includes(query)
            || resource.code?.toLowerCase().includes(query)
            || resource.type?.toLowerCase().includes(query)
        ));
    }, [resources, tableSearch]);

    const handleAddResource = async resource => {
        try {
            await projectApi.importResource(projectId, resource.id, dateOnly());
            toast.success(`${resource.name} added to project as ${getImportToastLabel(resource)}`);
            setIsAdding(false);
            setSearchTerm('');
            await fetchResources(true);
        } catch (err) {
            console.error('Failed to import resource into project:', err.response?.data || err);
            toast.error(err.response?.data?.message || 'Failed to import resource into project');
        }
    };

    const handleRemoveResource = async resource => {
        if (!window.confirm(`Remove ${resource.name} from this project?`)) return;
        try {
            await projectApi.removeProjectResource(projectId, resource.resource_id);
            toast.success(`${resource.name} removed from project`);
            await fetchResources(true);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to remove resource from project');
        }
    };

    const openRateEditor = async (resource) => {
        const projectResource = { ...resource, resource_id: resource.resource_id ?? resource.id };
        setRateResource(projectResource);
        setRateDate(dateOnly());
        setRateInfo(null);
        setRateHistory([]);
        setRateForm({
            rate: '',
            unitCode: projectResource.base_unit_code,
            effectiveFrom: dateOnly(),
            remarks: ''
        });
        setRateLoading(true);
        try {
            const [resolvedResponse, historyResponse] = await Promise.all([
                projectApi.getResolvedResourceRate(projectId, projectResource.resource_id, dateOnly()),
                projectApi.getResourceRateHistory(projectId, projectResource.resource_id)
            ]);
            const history = historyResponse.rates || [];
            const activeProjectRate = history.find(row => Number(row.is_active) === 1 && row.rate !== null && row.rate !== undefined);
            setRateInfo(resolvedResponse.rate || null);
            setRateHistory(history);
            if (activeProjectRate) {
                setRateForm({
                    rate: activeProjectRate.rate,
                    unitCode: activeProjectRate.unit_code || projectResource.base_unit_code,
                    effectiveFrom: dateOnly(activeProjectRate.effective_from),
                    remarks: activeProjectRate.remarks || ''
                });
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load project rate');
        } finally {
            setRateLoading(false);
        }
    };

    const refreshRateDetails = async () => {
        if (!rateResource) return;
        const [resolvedResponse, historyResponse] = await Promise.all([
            projectApi.getResolvedResourceRate(projectId, rateResource.resource_id, rateDate),
            projectApi.getResourceRateHistory(projectId, rateResource.resource_id)
        ]);
        setRateInfo(resolvedResponse.rate || null);
        setRateHistory(historyResponse.rates || []);
    };

    const handleSaveRate = async (event) => {
        event.preventDefault();
        if (!rateResource || rateForm.rate === '') return;
        setRateSaving(true);
        try {
            await projectApi.addResourceRate(projectId, rateResource.resource_id, {
                rate: Number(rateForm.rate),
                unit_code: rateForm.unitCode,
                effective_from: rateForm.effectiveFrom,
                remarks: rateForm.remarks || undefined
            });
            toast.success('Project rate saved');
            await refreshRateDetails();
            await fetchResources(true);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save project rate');
        } finally {
            setRateSaving(false);
        }
    };

    const activeProjectRate = rateHistory.find(row => Number(row.is_active) === 1 && row.rate !== null && row.rate !== undefined);

    const handleRevertToMaster = async () => {
        if (!rateResource || !activeProjectRate) return;
        setRateSaving(true);
        try {
            await projectApi.clearResourceRate(projectId, rateResource.resource_id, rateForm.effectiveFrom);
            toast.success('Project rate reverted to master rate');
            await refreshRateDetails();
            await fetchResources(true);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to revert project rate');
        } finally {
            setRateSaving(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left relative">
            <div className="flex justify-between items-center px-8 py-4 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-[#0d1117] z-20">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 rounded-lg transition-all active:scale-95"
                        title="Back to Material Management"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-medium text-gray-900 dark:text-white">Project Resources & Rates</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Item compositions and item rates only. Materials and labour are shown inside the item recipe screen.</p>
                    </div>
                </div>
                {canWrite && (
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsAdding(value => !value)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-lg shadow-blue-500/20"
                        >
                            <Plus size={15} /> Add resource
                        </button>
                        {isAdding && (
                            <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                                <div className="p-3 border-b border-gray-100 dark:border-white/5">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            autoFocus
                                            value={searchTerm}
                                            onChange={event => setSearchTerm(event.target.value)}
                                            placeholder="Search master resources by name, code, or type..."
                                            className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                                    {availableResources.length === 0 ? (
                                        <p className="p-4 text-xs text-gray-400">No matching resources available.</p>
                                    ) : availableResources.map(resource => (
                                        <button
                                            key={resource.id}
                                            type="button"
                                            onClick={() => handleAddResource(resource)}
                                            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-100 dark:border-white/5"
                                        >
                                            <span className="min-w-0">
                                                <span className="block text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{resource.name}</span>
                                                <span className="block text-[10px] text-gray-400 mt-0.5">{resource.code || 'No code'} · {resource.type} · {resource.base_unit_code}</span>
                                            </span>
                                            <span className="shrink-0 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                                {getImportLabel(resource)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {error && (
                    <div className="mb-4 p-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
                        <AlertCircle size={15} /> {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-[#161b22] p-4">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Master items</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{resources.length}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-[#161b22] p-4">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Imported items</p>
                        <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                            {resources.filter(resource => resource.isImported).length}
                        </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-[#161b22] p-4">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Item overrides</p>
                        <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                            {Object.values(resolvedRates).filter(rate => rate.rateScope === 'project').length}
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20 text-gray-400 gap-2 text-sm">
                        <RefreshCw size={18} className="animate-spin" /> Loading project resources...
                    </div>
                ) : resources.length === 0 ? (
                    <div className="text-center py-20 border border-dashed border-gray-300 dark:border-white/10 rounded-2xl">
                        <Package size={42} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No master items found.</p>
                        <p className="text-xs text-gray-400 mt-1">Create item resources in the master catalog first.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="relative max-w-md">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={tableSearch}
                                onChange={event => setTableSearch(event.target.value)}
                                placeholder="Search project resources..."
                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg text-xs outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
                            <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 dark:bg-[#161b22] text-gray-400 uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="px-4 py-3 w-14">S.No.</th>
                                    <th className="px-4 py-3">Resource</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Unit</th>
                                    <th className="px-4 py-3">Applied rate</th>
                                    <th className="px-4 py-3">Rate source</th>
                                    <th className="px-4 py-3">Project status</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {visibleResources.map((resource, index) => {
                                    const rate = resolvedRates[String(resource.resource_id)];
                                    return (
                                        <tr key={resource.resource_id} className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02]">
                                            <td className="px-4 py-4 text-gray-400">{index + 1}</td>
                                            <td className="px-4 py-4">
                                                <p className="font-bold text-gray-900 dark:text-white">{resource.name}</p>
                                                <p className="text-[10px] text-gray-400 mt-0.5">{resource.code || 'No code'}</p>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${TYPE_STYLES[resource.type] || TYPE_STYLES.material}`}>
                                                    {resource.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-gray-500 dark:text-gray-400">{resource.base_unit_code}</td>
                                            <td className="px-4 py-4 font-mono font-bold text-gray-900 dark:text-white">
                                                {ratesLoading ? 'Loading…' : rate?.rate === null || rate?.rate === undefined ? '—' : `₹${Number(rate.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                                                {!ratesLoading && rate?.unitCode && <span className="text-[10px] font-normal text-gray-400 ml-1">/ {rate.unitCode}</span>}
                                            </td>
                                            <td className="px-4 py-4">
                                                {rate?.rateScope === 'project' ? (
                                                    <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"><CheckCircle2 size={13} /> Project override</span>
                                                ) : rate?.rateScope === 'master' ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400">Master rate</span>
                                                ) : (
                                                    <span className="text-gray-400">Not configured</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                {resource.isImported ? (
                                                    <span className="text-blue-600 dark:text-blue-400 font-semibold">Imported</span>
                                                ) : (
                                                    <span className="text-gray-400">Master only</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="inline-flex items-center gap-2">
                                                    {canWrite && !resource.isImported && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddResource(resource)}
                                                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold"
                                                        >
                                                            <Plus size={13} className="inline mr-1" /> {getImportLabel(resource)}
                                                        </button>
                                                    )}
                                                    {canWrite && resource.isImported && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveResource(resource)}
                                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                            title="Remove from project"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => openRateEditor(resource)}
                                                        className="px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-semibold"
                                                    >
                                                        <History size={13} className="inline mr-1" /> Rates
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {rateResource && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onMouseDown={event => event.target === event.currentTarget && setRateResource(null)}>
                    <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#161b22] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10">
                        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-white/10">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Project rate · {rateResource.name}</h2>
                                <p className="text-xs text-gray-400 mt-1">Project override only. Reverting removes the override and uses the master rate.</p>
                            </div>
                            <button onClick={() => setRateResource(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400"><X size={18} /></button>
                        </div>

                        <div className="p-5 space-y-5">
                            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/30 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">Resolved on {rateDate}</p>
                                    <p className="text-2xl font-black font-mono text-gray-900 dark:text-white mt-1">
                                        {rateLoading ? 'Loading...' : rateInfo?.rate === undefined || rateInfo?.rate === null ? '—' : `₹${Number(rateInfo.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                                        {rateInfo?.unitCode && <span className="text-xs font-normal text-gray-500 ml-1">/ {rateInfo.unitCode}</span>}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <Calendar size={14} />
                                    <input type="date" value={rateDate} onChange={async event => { setRateDate(event.target.value); try { const result = await projectApi.getResolvedResourceRate(projectId, rateResource.resource_id, event.target.value); setRateInfo(result.rate || null); } catch { /* keep current display */ } }} className="bg-transparent outline-none" />
                                </div>
                            </div>

                            {canWrite && (
                                <form onSubmit={handleSaveRate} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                    <label className="text-xs font-semibold text-gray-500">Rate
                                        <input required type="number" min="0" step="any" value={rateForm.rate} onChange={event => setRateForm(form => ({ ...form, rate: event.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0d1117] text-sm outline-none focus:border-blue-500" />
                                    </label>
                                    <label className="text-xs font-semibold text-gray-500">Unit
                                        <input required value={rateForm.unitCode} onChange={event => setRateForm(form => ({ ...form, unitCode: event.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0d1117] text-sm outline-none focus:border-blue-500" />
                                    </label>
                                    <label className="text-xs font-semibold text-gray-500">Effective from
                                        <input required type="date" value={rateForm.effectiveFrom} onChange={event => setRateForm(form => ({ ...form, effectiveFrom: event.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0d1117] text-sm outline-none focus:border-blue-500" />
                                    </label>
                                    <button disabled={rateSaving} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50">
                                        {rateSaving ? 'Saving...' : 'Save project rate'}
                                    </button>
                                </form>
                            )}

                            {canWrite && activeProjectRate && (
                                <button disabled={rateSaving} onClick={handleRevertToMaster} className="px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50">
                                    <RotateCcw size={14} className="inline mr-1" /> Revert to master rate
                                </button>
                            )}

                            <div>
                                <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Project rate history ({rateHistory.length})</h3>
                                {rateHistory.length === 0 ? (
                                    <p className="text-xs text-gray-400 p-4 rounded-xl border border-dashed border-gray-200 dark:border-white/10">No project override has been saved. The resolved rate is inherited from master pricing.</p>
                                ) : (
                                    <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-gray-50 dark:bg-[#0d1117] text-gray-400 uppercase text-[10px]"><tr><th className="px-3 py-2">Status</th><th className="px-3 py-2">Rate</th><th className="px-3 py-2">From</th><th className="px-3 py-2">To</th><th className="px-3 py-2">Remarks</th></tr></thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                {rateHistory.map(row => (
                                                    <tr key={row.id}>
                                                        <td className="px-3 py-2">{Number(row.is_active) === 1 ? <span className="text-emerald-600">Active</span> : <span className="text-gray-400">Closed</span>}</td>
                                                        <td className="px-3 py-2 font-mono font-bold">₹{Number(row.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {row.unit_code}</td>
                                                        <td className="px-3 py-2">{row.effective_from}</td>
                                                        <td className="px-3 py-2">{row.effective_to || 'Present'}</td>
                                                        <td className="px-3 py-2 text-gray-400">{row.remarks || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectResourceList;
