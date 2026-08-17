import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, AlertCircle } from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';
import { unitApi } from '../../services/unitApi';

const defaultForm = {
    name: '',
    quantity: '',
    unit_id: '',
};

/**
 * Modal to add a new resource conversion.
 * e.g. name="Bag", quantity=50, unit_id=<kg unit id>
 */
const ConversionForm = ({ resource, units, onClose, onSave }) => {
    const baseUnit = units.find(u => u.id === resource.base_unit_code || u.symbol === resource.base_unit_code);
    const compatibleUnits = baseUnit ? units.filter(u => u.unit_type === baseUnit.unit_type) : units;

    const [form, setForm] = useState({
        ...defaultForm,
        unit_id: resource.base_unit_code || (compatibleUnits[0]?.id || '')
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            await resourceApi.addConversion(resource.id, {
                name: form.name.trim(),
                quantity: parseFloat(form.quantity),
                unit_code: form.unit_id,
            });
            onSave();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to add conversion');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-white dark:bg-[#161b22] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500" />

                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Add Conversion</h2>
                        <p className="text-xs text-gray-400 mt-0.5">For: <span className="font-medium text-gray-600 dark:text-gray-300">{resource.name}</span></p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
                    {error && (
                        <div className="flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Conversion Name */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            name="name"
                            required
                            value={form.name}
                            onChange={handleChange}
                            placeholder="e.g. Bag, Truck, Sack"
                            className="w-full bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition"
                        />
                    </div>

                    {/* Quantity + Unit row */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                                Quantity <span className="text-red-500">*</span>
                            </label>
                            <input
                                name="quantity"
                                type="number"
                                step="any"
                                min="0"
                                required
                                value={form.quantity}
                                onChange={handleChange}
                                placeholder="e.g. 50"
                                className="w-full bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                                Unit <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="unit_id"
                                required
                                value={form.unit_id}
                                onChange={handleChange}
                                className="w-full bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition"
                            >
                                <option value="">Select compatible unit</option>
                                {compatibleUnits.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Live preview */}
                    {form.name && form.quantity && form.unit_id && (
                        <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/50 rounded-lg text-xs text-purple-700 dark:text-purple-300 font-mono">
                            1 {form.name} = {form.quantity} {units.find(u => String(u.id) === String(form.unit_id) || u.symbol === form.unit_id)?.symbol ?? form.unit_id}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-all"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            {saving ? 'Adding…' : 'Add'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ConversionForm;
