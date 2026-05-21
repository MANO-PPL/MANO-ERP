import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, AlertCircle } from 'lucide-react';
import { unitApi } from '../../services/unitApi';

const UNIT_TYPES = ['weight', 'volume', 'count'];

const TYPE_COLORS = {
    weight: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    volume: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    count:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const defaultForm = {
    name: '',
    symbol: '',
    unit_type: 'weight',
    base_unit_id: '',
    conversion_factor: '',
};

const UnitForm = ({ unit, units = [], onClose, onSave }) => {
    const isEdit = !!unit;
    const [form, setForm] = useState(defaultForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (unit) {
            setForm({
                name: unit.name || '',
                symbol: unit.symbol || '',
                unit_type: unit.unit_type || 'weight',
                base_unit_id: unit.base_unit_id ?? '',
                conversion_factor: unit.conversion_factor ?? '',
            });
        }
    }, [unit]);

    // Filter potential base units: same type, not itself
    const baseUnitOptions = units.filter(
        (u) => u.unit_type === form.unit_type && u.id !== unit?.id
    );

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => {
            const next = { ...prev, [name]: value };
            // Reset base unit when type changes
            if (name === 'unit_type') {
                next.base_unit_id = '';
                next.conversion_factor = '';
            }
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                symbol: form.symbol.trim(),
                unit_type: form.unit_type,
                base_unit_id: form.base_unit_id ? parseInt(form.base_unit_id) : null,
                conversion_factor: form.conversion_factor !== '' ? parseFloat(form.conversion_factor) : 1,
            };
            if (isEdit) {
                await unitApi.updateUnit(unit.id, payload);
            } else {
                await unitApi.createUnit(payload);
            }
            onSave();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save unit');
        } finally {
            setSaving(false);
        }
    };

    const hasBaseUnit = !!form.base_unit_id;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-white dark:bg-[#161b22] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden animate-fadeIn">
                {/* Header gradient bar */}
                <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500" />

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        {isEdit ? 'Edit Unit' : 'New Unit'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

                    {/* Error banner */}
                    {error && (
                        <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs">
                            <AlertCircle size={15} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Unit Type */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                            Unit Type <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                            {UNIT_TYPES.map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => handleChange({ target: { name: 'unit_type', value: type } })}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-all capitalize
                                        ${form.unit_type === type
                                            ? `${TYPE_COLORS[type]} border-transparent ring-2 ring-offset-1 ring-blue-400 dark:ring-offset-[#161b22]`
                                            : 'bg-gray-50 dark:bg-white/[0.03] border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Name + Symbol row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                                Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="unit-name"
                                name="name"
                                required
                                value={form.name}
                                onChange={handleChange}
                                placeholder="e.g. Kilogram"
                                className="w-full bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                                Symbol <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="unit-symbol"
                                name="symbol"
                                required
                                value={form.symbol}
                                onChange={handleChange}
                                placeholder="e.g. kg"
                                className="w-full bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
                            />
                        </div>
                    </div>

                    {/* Base Unit */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                            Base Unit <span className="text-gray-400 font-normal normal-case text-[10px]">(optional — leave blank if this IS the base unit)</span>
                        </label>
                        <select
                            id="unit-base"
                            name="base_unit_id"
                            value={form.base_unit_id}
                            onChange={handleChange}
                            className="w-full bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
                        >
                            <option value="">— This is a base unit —</option>
                            {baseUnitOptions.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name} ({u.symbol})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Conversion Factor */}
                    {hasBaseUnit && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-xl">
                            <label className="block text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1.5">
                                Conversion Factor <span className="text-red-500">*</span>
                            </label>
                            <p className="text-[10px] text-blue-500 dark:text-blue-500 mb-2">
                                1 <strong>{form.symbol || 'unit'}</strong> = <strong>?</strong> {baseUnitOptions.find(u => u.id === parseInt(form.base_unit_id))?.symbol || 'base units'}
                            </p>
                            <input
                                id="unit-conversion-factor"
                                name="conversion_factor"
                                type="number"
                                step="any"
                                min="0"
                                required={hasBaseUnit}
                                value={form.conversion_factor}
                                onChange={handleChange}
                                placeholder="e.g. 1000"
                                className="w-full bg-white dark:bg-white/[0.03] border border-blue-200 dark:border-blue-800/50 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
                            />
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            id="unit-save-btn"
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                        >
                            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                            {saving ? 'Saving...' : isEdit ? 'Update Unit' : 'Create Unit'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UnitForm;
