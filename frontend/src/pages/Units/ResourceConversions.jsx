import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus, Trash2, RefreshCw, Search, ArrowLeftRight,
    ChevronDown, ChevronRight, Box, Package, AlertCircle
} from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';
import { unitApi } from '../../services/unitApi';
import ConversionForm from './ConversionForm';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_BADGE = {
    material: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    item:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

// ─── Conversion Badge Row ─────────────────────────────────────────────────────

const ConversionBadge = ({ conv, resourceId, onRemove, canWrite }) => {
    const [removing, setRemoving] = useState(false);
    const [error, setError] = useState('');

    const handleRemove = async () => {
        if (!window.confirm(`Remove "${conv.name}"?`)) return;
        setRemoving(true);
        setError('');
        try {
            await resourceApi.removeConversion(resourceId, conv.id);
            onRemove();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to remove');
        } finally {
            setRemoving(false);
        }
    };

    return (
        <div className="group flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-lg">
            <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-gray-700 dark:text-gray-200">1 {conv.name}</span>
                <ArrowLeftRight size={11} className="text-gray-400 shrink-0" />
                <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">
                    {parseFloat(conv.quantity)} {conv.unit_symbol}
                </span>
                <span className="text-gray-400 text-[10px]">({conv.unit_name})</span>
            </div>
            <div className="flex items-center gap-1">
                {error && <span className="text-red-500 text-[10px]">{error}</span>}
                {canWrite && (
                    <button
                        onClick={handleRemove}
                        disabled={removing}
                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all opacity-0 group-hover:opacity-100"
                        title="Remove conversion"
                    >
                        {removing ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                )}
            </div>
        </div>
    );
};

// ─── Resource Row ─────────────────────────────────────────────────────────────

const ResourceRow = ({ resource, units, onConversionChange, canWrite }) => {
    const [expanded, setExpanded] = useState(false);
    const [detail, setDetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [fetchError, setFetchError] = useState('');

    const loadDetail = async () => {
        if (detail) return; // already loaded
        setLoadingDetail(true);
        setFetchError('');
        try {
            const data = await resourceApi.getResourceById(resource.id);
            setDetail(data.resource);
        } catch (err) {
            setFetchError(err.response?.data?.message || 'Failed to load detail');
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleToggle = () => {
        const next = !expanded;
        setExpanded(next);
        if (next) loadDetail();
    };

    const handleConversionSaved = async () => {
        setShowForm(false);
        // Refresh detail
        setDetail(null);
        setLoadingDetail(true);
        setFetchError('');
        try {
            const data = await resourceApi.getResourceById(resource.id);
            setDetail(data.resource);
        } catch (err) {
            setFetchError(err.response?.data?.message || 'Failed to reload');
        } finally {
            setLoadingDetail(false);
        }
        onConversionChange?.();
    };

    const convCount = detail?.conversions?.length ?? 0;
    const badgeCls = TYPE_BADGE[resource.type] ?? TYPE_BADGE.material;

    return (
        <>
            {/* Resource Row */}
            <tr
                className="group cursor-pointer hover:bg-blue-50/30 dark:hover:bg-white/[0.02] transition-colors border-b border-gray-100 dark:border-white/5 text-gray-700 dark:text-gray-300"
                onClick={handleToggle}
            >
                {/* Expand icon */}
                <td className="px-4 py-3 w-8">
                    {expanded
                        ? <ChevronDown size={15} className="text-blue-500" />
                        : <ChevronRight size={15} className="text-gray-400" />}
                </td>
                {/* ID */}
                <td className="px-2 py-3 font-mono text-xs text-gray-400 w-12">{resource.id}</td>
                {/* Name */}
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 text-sm">{resource.name}</td>
                {/* Code */}
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{resource.code || '—'}</td>
                {/* Type */}
                <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${badgeCls}`}>
                        {resource.type}
                    </span>
                </td>
                {/* Base unit */}
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {resource.base_unit_name} <span className="text-gray-400">({resource.base_unit_symbol})</span>
                </td>
                {/* Conversions count */}
                <td className="px-4 py-3 text-center">
                    {detail !== null ? (
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${convCount > 0 ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-gray-100 text-gray-400 dark:bg-white/5'}`}>
                            {convCount}
                        </span>
                    ) : (
                        <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                    )}
                </td>
                {/* Add action */}
                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                    {canWrite && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setExpanded(true); loadDetail(); setShowForm(true); }}
                            className="p-1.5 text-gray-300 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Add conversion"
                        >
                            <Plus size={15} />
                        </button>
                    )}
                </td>
            </tr>

            {/* Expanded panel */}
            {expanded && (
                <tr className="border-b border-gray-100 dark:border-white/5">
                    <td colSpan={8} className="bg-gray-50/80 dark:bg-white/[0.01] px-8 py-4">
                        {fetchError ? (
                            <div className="flex items-center gap-2 text-red-500 text-xs">
                                <AlertCircle size={14} /> {fetchError}
                            </div>
                        ) : loadingDetail ? (
                            <div className="flex items-center gap-2 text-gray-400 text-xs">
                                <RefreshCw size={14} className="animate-spin" /> Loading…
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Resource Conversions
                                        <span className="ml-2 normal-case font-normal text-gray-400">
                                            — named aliases mapped to a unit quantity
                                        </span>
                                    </p>
                                    {canWrite && (
                                        <button
                                            onClick={() => setShowForm(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-all"
                                        >
                                            <Plus size={13} /> Add
                                        </button>
                                    )}
                                </div>

                                {/* Conversion badges */}
                                {detail?.conversions?.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic">No conversions yet. Add one above.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {detail?.conversions?.map(conv => (
                                            <ConversionBadge
                                                key={conv.id}
                                                conv={conv}
                                                resourceId={resource.id}
                                                onRemove={handleConversionSaved}
                                                canWrite={canWrite}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </td>
                </tr>
            )}

            {/* Add conversion form modal */}
            {showForm && (
                <ConversionForm
                    resource={resource}
                    units={units}
                    onClose={() => setShowForm(false)}
                    onSave={handleConversionSaved}
                />
            )}
        </>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ResourceConversions = ({ canWrite }) => {
    const [resources, setResources] = useState([]);
    const [units, setUnits]         = useState([]);
    const [isLoading, setIsLoading]  = useState(true);
    const [fetchError, setFetchError] = useState('');
    const [search, setSearch]        = useState('');
    const [filterType, setFilterType] = useState('');

    const fetchAll = async () => {
        setIsLoading(true);
        setFetchError('');
        try {
            const [rData, uData] = await Promise.all([
                resourceApi.getResources(),
                unitApi.getUnits(),
            ]);
            setResources(rData.resources || []);
            setUnits(uData.units || []);
        } catch (err) {
            setFetchError(err.response?.data?.message || 'Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const filtered = useMemo(() => {
        return resources.filter(r => {
            const typeMatch = filterType ? r.type === filterType : true;
            const q = search.toLowerCase();
            const sMatch = !q || r.name.toLowerCase().includes(q) || (r.code && r.code.toLowerCase().includes(q));
            return typeMatch && sMatch;
        });
    }, [resources, search, filterType]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors h-full">

            {/* Toolbar */}
            <div className="px-8 py-3 flex items-center justify-between border-b border-gray-100 dark:border-white/5 shrink-0 bg-gray-50/50 dark:bg-white/[0.01]">
                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search resource…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-8 pr-3 py-2 text-xs bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 w-48 transition"
                        />
                    </div>
                    {/* Type filter */}
                    <select
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                        className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition"
                    >
                        <option value="">All Types</option>
                        <option value="material">Material</option>
                        <option value="item">Item</option>
                    </select>
                </div>
                <button
                    onClick={fetchAll}
                    className="p-2 text-gray-500 hover:text-purple-600 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                        <RefreshCw size={28} className="animate-spin text-purple-500/60" />
                        <p className="text-sm">Loading resources…</p>
                    </div>
                ) : fetchError ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm text-center max-w-sm">
                            {fetchError}
                        </div>
                        <button onClick={fetchAll} className="text-xs text-purple-500 hover:underline">Try again</button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                        <Box size={36} className="opacity-30" />
                        <p className="text-sm font-medium">No resources found</p>
                        <p className="text-xs">Add resources from the Resources page first</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-[13px] border-collapse">
                        <colgroup><col className="w-8" /><col className="w-12" /><col /><col className="w-28" /><col className="w-24" /><col className="w-32" /><col className="w-24" /><col className="w-16" /></colgroup>
                        <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-white/5 tracking-widest text-[10px] uppercase font-bold sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3"></th>
                                <th className="px-2 py-3">ID</th>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Code</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Base Unit</th>
                                <th className="px-4 py-3 text-center">Conv.</th>
                                <th className="px-4 py-3 text-center">Add</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(resource => (
                                <ResourceRow
                                    key={resource.id}
                                    resource={resource}
                                    units={units}
                                    onConversionChange={fetchAll}
                                    canWrite={canWrite}
                                />
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default ResourceConversions;
