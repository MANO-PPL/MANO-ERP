import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus, Edit2, Trash2, RefreshCw, ArrowLeftRight,
    Weight, Droplets, Hash, Search
} from 'lucide-react';
import { unitApi } from '../../services/unitApi';
import UnitForm from './UnitForm';

// ─── Constants ────────────────────────────────────────────────────────────────

const UNIT_TYPES = ['all', 'weight', 'volume', 'count'];

const TYPE_META = {
    weight: {
        icon: Weight,
        label: 'Weight',
        gradient: 'from-amber-500 to-orange-500',
        badgeCls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-700/30',
        ringCls: 'ring-amber-400',
        bgCls: 'bg-amber-50 dark:bg-amber-900/10',
    },
    volume: {
        icon: Droplets,
        label: 'Volume',
        gradient: 'from-blue-500 to-cyan-500',
        badgeCls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-700/30',
        ringCls: 'ring-blue-400',
        bgCls: 'bg-blue-50 dark:bg-blue-900/10',
    },
    count: {
        icon: Hash,
        label: 'Count',
        gradient: 'from-emerald-500 to-teal-500',
        badgeCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/30',
        ringCls: 'ring-emerald-400',
        bgCls: 'bg-emerald-50 dark:bg-emerald-900/10',
    },
};

// ─── Helper: format conversion label ─────────────────────────────────────────

const conversionLabel = (unit, unitsMap) => {
    if (!unit.base_unit_id) return <span className="text-gray-400 dark:text-gray-500 italic text-xs">Base unit</span>;
    const base = unitsMap[unit.base_unit_id];
    const factor = parseFloat(unit.conversion_factor);
    const baseLabel = base ? `${base.name} (${base.symbol})` : `#${unit.base_unit_id}`;
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-mono">
            <span className="text-gray-700 dark:text-gray-200 font-semibold">1 {unit.symbol}</span>
            <ArrowLeftRight size={11} className="text-gray-400" />
            <span className="text-blue-600 dark:text-blue-400 font-semibold">{factor} {base?.symbol ?? ''}</span>
            <span className="text-gray-400 hidden sm:inline">({baseLabel})</span>
        </span>
    );
};

// ─── Summary Card ─────────────────────────────────────────────────────────────

const SummaryCard = ({ type, count, selected, onClick }) => {
    const meta = type === 'all'
        ? { icon: ArrowLeftRight, label: 'All Units', gradient: 'from-violet-500 to-blue-500', bgCls: 'bg-violet-50 dark:bg-violet-900/10' }
        : TYPE_META[type];
    const Icon = meta.icon;
    const isActive = selected === type;

    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left
                ${isActive
                    ? `bg-gradient-to-r ${meta.gradient} text-white border-transparent shadow-lg shadow-blue-500/20 scale-[1.02]`
                    : 'bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/[0.04] text-gray-700 dark:text-gray-300'
                }`}
        >
            <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : meta.bgCls}`}>
                <Icon size={16} className={isActive ? 'text-white' : 'text-gray-600 dark:text-gray-400'} />
            </div>
            <div>
                <div className={`text-lg font-bold leading-tight ${isActive ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{count}</div>
                <div className={`text-[10px] font-semibold uppercase tracking-wider ${isActive ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>{meta.label}</div>
            </div>
        </button>
    );
};

// ─── Unit Row ─────────────────────────────────────────────────────────────────

const UnitRow = ({ unit, unitsMap, onEdit, onDelete }) => {
    const meta = TYPE_META[unit.unit_type] ?? TYPE_META.weight;
    const Icon = meta.icon;

    return (
        <tr className="group hover:bg-blue-50/30 dark:hover:bg-white/[0.02] transition-colors text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-white/5">
            {/* ID */}
            <td className="px-6 py-3 text-center font-mono text-xs text-gray-400 w-14">{unit.id}</td>

            {/* Symbol chip */}
            <td className="px-4 py-3">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${meta.bgCls}`}>
                    <Icon size={12} className="opacity-70" />
                    <span className="font-mono font-bold text-xs text-gray-800 dark:text-gray-100">{unit.symbol}</span>
                </div>
            </td>

            {/* Name */}
            <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 text-sm">{unit.name}</td>

            {/* Type badge */}
            <td className="px-4 py-3">
                <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${meta.badgeCls}`}>
                    {unit.unit_type}
                </span>
            </td>

            {/* Conversion */}
            <td className="px-4 py-3">{conversionLabel(unit, unitsMap)}</td>

            {/* Actions */}
            <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        id={`edit-unit-${unit.id}`}
                        onClick={() => onEdit(unit)}
                        className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all"
                        title="Edit unit"
                    >
                        <Edit2 size={15} />
                    </button>
                    <button
                        id={`delete-unit-${unit.id}`}
                        onClick={() => onDelete(unit)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        title="Delete unit"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </td>
        </tr>
    );
};

// ─── Confirm Delete Dialog ────────────────────────────────────────────────────

const ConfirmDelete = ({ unit, onConfirm, onCancel, deleting, error }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
        <div className="relative w-full max-w-sm bg-white dark:bg-[#161b22] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 p-6 text-center">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Delete Unit</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {unit.name} ({unit.symbol})
                </span>?
            </p>
            <p className="text-xs text-gray-400 mb-5">This action cannot be undone.</p>

            {error && (
                <div className="mb-4 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs text-left">
                    {error}
                </div>
            )}

            <div className="flex gap-3">
                <button
                    onClick={onCancel}
                    className="flex-1 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                    Cancel
                </button>
                <button
                    id="confirm-delete-unit-btn"
                    onClick={onConfirm}
                    disabled={deleting}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl transition-all"
                >
                    {deleting ? 'Deleting…' : 'Delete'}
                </button>
            </div>
        </div>
    </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const UnitList = () => {
    const [units, setUnits] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState('');
    const [activeType, setActiveType] = useState('all');
    const [search, setSearch] = useState('');

    // Modal state
    const [formOpen, setFormOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState(null);
    const [deletingUnit, setDeletingUnit] = useState(null);
    const [deleteError, setDeleteError] = useState('');
    const [deleting, setDeleting] = useState(false);

    const fetchUnits = async () => {
        setIsLoading(true);
        setFetchError('');
        try {
            const data = await unitApi.getUnits();
            setUnits(data.units || []);
        } catch (err) {
            console.error('Failed to load units', err);
            setFetchError(err.response?.data?.message || 'Failed to load units. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchUnits(); }, []);

    // Build a quick ID → unit map for base-unit lookups
    const unitsMap = useMemo(() => {
        const m = {};
        units.forEach(u => { m[u.id] = u; });
        return m;
    }, [units]);

    // Counts per type
    const counts = useMemo(() => {
        const c = { all: units.length, weight: 0, volume: 0, count: 0 };
        units.forEach(u => { if (c[u.unit_type] !== undefined) c[u.unit_type]++; });
        return c;
    }, [units]);

    const filtered = useMemo(() => {
        return units.filter(u => {
            const typeMatch = activeType === 'all' || u.unit_type === activeType;
            const q = search.toLowerCase();
            const searchMatch = !q || u.name.toLowerCase().includes(q) || u.symbol.toLowerCase().includes(q);
            return typeMatch && searchMatch;
        });
    }, [units, activeType, search]);

    // Group filtered units by type for a cleaner table view
    const grouped = useMemo(() => {
        if (activeType !== 'all') return { [activeType]: filtered };
        const g = {};
        filtered.forEach(u => {
            if (!g[u.unit_type]) g[u.unit_type] = [];
            g[u.unit_type].push(u);
        });
        return g;
    }, [filtered, activeType]);

    const handleEdit = (unit) => {
        setEditingUnit(unit);
        setFormOpen(true);
    };

    const handleAddClick = () => {
        setEditingUnit(null);
        setFormOpen(true);
    };

    const handleSaveSuccess = () => {
        setFormOpen(false);
        fetchUnits();
    };

    const handleDeleteClick = (unit) => {
        setDeletingUnit(unit);
        setDeleteError('');
    };

    const handleDeleteConfirm = async () => {
        setDeleting(true);
        setDeleteError('');
        try {
            await unitApi.deleteUnit(deletingUnit.id);
            setDeletingUnit(null);
            fetchUnits();
        } catch (err) {
            setDeleteError(err.response?.data?.message || 'Failed to delete unit');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors h-full">

            {/* ── Sub-Header: cards + Add button ── */}
            <div className="px-8 py-4 border-b border-gray-100 dark:border-white/5 shrink-0">
                <div className="flex items-center justify-between mb-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-4 gap-3 flex-1 mr-4">
                        {UNIT_TYPES.map((type) => (
                            <SummaryCard
                                key={type}
                                type={type}
                                count={counts[type] ?? 0}
                                selected={activeType}
                                onClick={() => setActiveType(type)}
                            />
                        ))}
                    </div>
                    <button
                        id="add-unit-btn"
                        onClick={handleAddClick}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] shrink-0"
                    >
                        <Plus size={16} />
                        Add Unit
                    </button>
                </div>
            </div>

            {/* ── Toolbar ── */}
            <div className="px-8 py-3 flex items-center justify-between border-b border-gray-100 dark:border-white/5 shrink-0 bg-gray-50/50 dark:bg-white/[0.01]">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                        id="unit-search"
                        type="text"
                        placeholder="Search by name or symbol…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-8 pr-3 py-2 text-xs bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-56 transition"
                    />
                </div>
                <button
                    onClick={fetchUnits}
                    className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* ── Table Area ── */}
            <div className="flex-1 overflow-auto">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                        <RefreshCw size={28} className="animate-spin text-blue-500/60" />
                        <p className="text-sm">Loading units…</p>
                    </div>
                ) : fetchError ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm text-center max-w-sm">
                            {fetchError}
                        </div>
                        <button onClick={fetchUnits} className="text-xs text-blue-500 hover:underline">Try again</button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                        <ArrowLeftRight size={36} className="opacity-30" />
                        <p className="text-sm font-medium">No units found</p>
                        <p className="text-xs">Try adjusting your filters or add a new unit</p>
                    </div>
                ) : (
                    /* Single table — one layout for all groups so columns stay aligned */
                    <table className="w-full text-left text-[13px] border-collapse">
                        {/* Fixed column widths defined once */}
                        <colgroup>
                            <col className="w-14" />   {/* ID */}
                            <col className="w-28" />   {/* Symbol */}
                            <col />                    {/* Name — grows */}
                            <col className="w-28" />   {/* Type */}
                            <col />                    {/* Conversion — grows */}
                            <col className="w-24" />   {/* Actions */}
                        </colgroup>

                        <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-white/5 tracking-widest text-[10px] uppercase font-bold sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 text-center">ID</th>
                                <th className="px-4 py-3">Symbol</th>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Conversion</th>
                                <th className="px-4 py-3 text-center">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {Object.entries(grouped).map(([type, rows]) => {
                                const meta = TYPE_META[type] ?? TYPE_META.weight;
                                const Icon = meta.icon;
                                return (
                                    <React.Fragment key={type}>
                                        {/* Group separator row — spans all 6 columns */}
                                        <tr className={`${meta.bgCls} border-b border-gray-100 dark:border-white/5`}>
                                            <td colSpan={6} className="px-6 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`inline-flex items-center justify-center w-5 h-5 rounded bg-gradient-to-br ${meta.gradient} shrink-0`}>
                                                        <Icon size={11} className="text-white" />
                                                    </div>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 capitalize">
                                                        {type}
                                                    </span>
                                                    <span className="text-xs text-gray-400">({rows.length})</span>
                                                </div>
                                            </td>
                                        </tr>

                                        {rows.map(unit => (
                                            <UnitRow
                                                key={unit.id}
                                                unit={unit}
                                                unitsMap={unitsMap}
                                                onEdit={handleEdit}
                                                onDelete={handleDeleteClick}
                                            />
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Modals ── */}
            {formOpen && (
                <UnitForm
                    unit={editingUnit}
                    units={units}
                    onClose={() => setFormOpen(false)}
                    onSave={handleSaveSuccess}
                />
            )}

            {deletingUnit && (
                <ConfirmDelete
                    unit={deletingUnit}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setDeletingUnit(null)}
                    deleting={deleting}
                    error={deleteError}
                />
            )}
        </div>
    );
};

export default UnitList;
