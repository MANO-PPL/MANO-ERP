import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Info } from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';
import { UNIT_OPTIONS, UNIT_REGISTRY, UNIT_GROUPS } from './resourceConstants';
import { motion } from 'framer-motion';
import ConfirmModal from '../../components/ConfirmModal';

const unitTypeLabel = { weight: 'Weight', volume: 'Volume', length: 'Length', area: 'Area', count: 'Count', time: 'Time' };

const FormField = ({ label, required, children, hint }) => (
    <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        {children}
        {hint && <p className="mt-1 text-[10px] text-gray-400">{hint}</p>}
    </div>
);

const ResourceForm = ({ resource, onClose, onSave }) => {
    const isEditing = !!resource;

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        type: 'material',
        base_unit_code: '',
        description: '',
        remarks: ''
    });

    const [compositions, setCompositions] = useState([]);
    const [conversions, setConversions] = useState([]);
    const [allResources, setAllResources] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('basic');

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        variant: 'danger',
        isLoading: false,
        onConfirm: () => { }
    });

    useEffect(() => {
        if (resource) {
            setFormData({
                name: resource.name || '',
                code: resource.code || '',
                type: resource.type || 'material',
                base_unit_code: resource.base_unit_code || '',
                description: resource.description || '',
                remarks: resource.remarks || ''
            });
            if (resource.compositions) setCompositions(resource.compositions.map(c => ({
                component_resource_id: c.component_resource_id,
                quantity: c.quantity,
                unit_code: c.unit_code
            })));
            if (resource.conversions) setConversions(resource.conversions.map(c => ({
                name: c.name,
                quantity: c.quantity,
                unit_code: c.unit_code
            })));
        }

        const fetchMaterials = async () => {
            try {
                const res = await resourceApi.getResources();
                const components = (res.resources || []).filter(r => r.type === 'material' || r.type === 'labour');
                setAllResources(components);
            } catch (err) {
                console.error('Failed to fetch components', err);
            }
        };
        fetchMaterials();
    }, [resource]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // ─── Compositions ────────────────────────────────────────────────────────────
    const handleAddComposition = () => {
        setCompositions([...compositions, { component_resource_id: '', quantity: '', unit_code: '' }]);
    };

    const handleCompositionChange = (index, field, value) => {
        const newComps = [...compositions];
        newComps[index][field] = value;
        // Auto-fill unit based on selected material's base unit
        if (field === 'component_resource_id' && value) {
            const mat = allResources.find(r => String(r.id) === String(value));
            if (mat) newComps[index].unit_code = mat.base_unit_code;
        }
        setCompositions(newComps);
    };

    const handleRemoveComposition = (index) => {
        const comp = compositions[index];
        const compRes = allResources.find(r => String(r.id) === String(comp?.component_resource_id));
        const name = compRes?.name || `Component #${index + 1}`;
        setConfirmModal({
            isOpen: true,
            title: 'Remove Composition Ingredient?',
            message: `Are you sure you want to remove "${name}" from this resource?`,
            confirmText: 'Remove Ingredient',
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: () => {
                setCompositions(compositions.filter((_, i) => i !== index));
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    // ─── Conversions ─────────────────────────────────────────────────────────────
    const handleAddConversion = () => {
        setConversions([...conversions, { name: '', quantity: '', unit_code: '' }]);
    };

    const handleConversionChange = (index, field, value) => {
        const newConvs = [...conversions];
        newConvs[index][field] = value;
        setConversions(newConvs);
    };

    const handleRemoveConversion = (index) => {
        const conv = conversions[index];
        const name = conv?.name || `Conversion #${index + 1}`;
        setConfirmModal({
            isOpen: true,
            title: 'Remove Unit Conversion?',
            message: `Are you sure you want to remove "${name}" scale conversion?`,
            confirmText: 'Remove Conversion',
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: () => {
                setConversions(conversions.filter((_, i) => i !== index));
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    // ─── Submit ──────────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const payload = {
                name: formData.name,
                code: formData.code || undefined,
                type: formData.type,
                base_unit_code: formData.base_unit_code,
                description: formData.description || undefined,
                remarks: formData.remarks || undefined,
                conversions: conversions
                    .filter(c => c.name && c.quantity && c.unit_code)
                    .map(c => ({
                        name: c.name,
                        quantity: parseFloat(c.quantity),
                        unit_code: c.unit_code
                    })),
                compositions: formData.type === 'item'
                    ? compositions
                        .filter(c => c.component_resource_id && c.quantity && c.unit_code)
                        .map(c => ({
                            component_resource_id: parseInt(c.component_resource_id),
                            quantity: parseFloat(c.quantity),
                            unit_code: c.unit_code
                        }))
                    : []
            };

            if (isEditing) {
                await resourceApi.updateResource(resource.id, payload);
            } else {
                await resourceApi.createResource(payload);
            }
            onSave();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to save resource');
        } finally {
            setIsLoading(false);
        }
    };

    const baseUnitInfo = formData.base_unit_code ? UNIT_REGISTRY[formData.base_unit_code] : null;

    const tabs = [
        { id: 'basic', label: 'Basic Info' },
        { id: 'conversions', label: `Conversions${conversions.length > 0 ? ` (${conversions.length})` : ''}` },
        ...(formData.type === 'item' ? [{ id: 'composition', label: `Composition${compositions.length > 0 ? ` (${compositions.length})` : ''}` }] : []),
    ];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[5000] flex items-center justify-center p-4 sm:p-6 text-left"
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 10 }}
                className="relative w-full max-w-2xl bg-white dark:bg-[#161b22] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100 dark:border-white/5">
                    <div>
                        <h2 className="text-base font-bold text-gray-900 dark:text-white">
                            {isEditing ? 'Edit Resource' : 'Add New Resource'}
                        </h2>
                        {isEditing && (
                            <p className="text-[10px] text-gray-400 mt-0.5">ID: {resource.id} · Type cannot be changed</p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-6 pt-3 border-b border-gray-100 dark:border-white/5">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors -mb-px ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs border border-red-200 dark:border-red-500/30">
                            {error}
                        </div>
                    )}

                    <form id="resource-form" onSubmit={handleSubmit}>
                        {activeTab === 'basic' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField label="Name" required>
                                        <input
                                            required
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            placeholder="e.g. Portland Cement"
                                            className="w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
                                        />
                                    </FormField>
                                    <FormField label="Code" hint="Optional short identifier (e.g. CEM-OPC)">
                                        <input
                                            type="text"
                                            name="code"
                                            value={formData.code}
                                            onChange={handleChange}
                                            placeholder="e.g. CEM-OPC"
                                            className="w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
                                        />
                                    </FormField>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField label="Type" required hint={isEditing ? 'Cannot be changed after creation.' : ''}>
                                        <select
                                            required
                                            name="type"
                                            value={formData.type}
                                            onChange={handleChange}
                                            disabled={isEditing}
                                            className="w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 transition"
                                        >
                                            <option value="material">Material</option>
                                            <option value="item">Item (Composite)</option>
                                            <option value="labour">Labour</option>
                                        </select>
                                    </FormField>

                                    <FormField label="Base Unit" required hint={baseUnitInfo ? `Category: ${baseUnitInfo.type}` : ''}>
                                        <select
                                            required
                                            name="base_unit_code"
                                            value={formData.base_unit_code}
                                            onChange={handleChange}
                                            className="w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
                                        >
                                            <option value="">Select a unit...</option>
                                            {Object.entries(UNIT_GROUPS).map(([type, units]) => (
                                                <optgroup key={type} label={unitTypeLabel[type] || type}>
                                                    {units.map(u => (
                                                        <option key={u.code} value={u.code}>{u.name} ({u.symbol})</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </FormField>
                                </div>

                                <FormField label="Description">
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        rows={2}
                                        placeholder="Brief description of this resource..."
                                        className="w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition resize-none"
                                    />
                                </FormField>

                                <FormField label="Remarks">
                                    <input
                                        type="text"
                                        name="remarks"
                                        value={formData.remarks}
                                        onChange={handleChange}
                                        placeholder="Internal notes or specifications..."
                                        className="w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
                                    />
                                </FormField>

                                {formData.type === 'item' && (
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20 rounded-xl">
                                        <div className="flex gap-2">
                                            <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
                                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                                <span className="font-semibold">Items</span> are composite resources that reference materials or labour as components. Set compositions in the Composition tab.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'conversions' && (
                            <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Unit Conversions</h3>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            Define named scales (e.g., 1 Bag = 50 kg). Units must match the base unit category.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddConversion}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
                                    >
                                        <Plus size={12} /> Add Conversion
                                    </button>
                                </div>

                                {conversions.length === 0 ? (
                                    <div className="text-center py-10 bg-gray-50/50 dark:bg-white/[0.02] rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                                        <p className="text-xs text-gray-400">No conversions defined. Click "Add Conversion" to create one.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-[1fr_80px_120px_32px] gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
                                            <span>Scale Name</span>
                                            <span>Quantity</span>
                                            <span>Unit</span>
                                            <span></span>
                                        </div>
                                        {conversions.map((conv, idx) => (
                                            <div key={idx} className="grid grid-cols-[1fr_80px_120px_32px] gap-2 items-center bg-gray-50 dark:bg-white/[0.02] p-2 rounded-xl border border-gray-200 dark:border-white/10">
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Bag"
                                                    value={conv.name}
                                                    onChange={e => handleConversionChange(idx, 'name', e.target.value)}
                                                    className="bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                />
                                                <input
                                                    type="number"
                                                    step="any"
                                                    placeholder="50"
                                                    value={conv.quantity}
                                                    onChange={e => handleConversionChange(idx, 'quantity', e.target.value)}
                                                    className="bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                />
                                                <select
                                                    value={conv.unit_code}
                                                    onChange={e => handleConversionChange(idx, 'unit_code', e.target.value)}
                                                    className="bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                >
                                                    <option value="">Select unit</option>
                                                    {Object.entries(UNIT_GROUPS).map(([type, units]) => (
                                                        <optgroup key={type} label={unitTypeLabel[type] || type}>
                                                            {units.map(u => (
                                                                <option key={u.code} value={u.code}>{u.symbol}</option>
                                                            ))}
                                                        </optgroup>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveConversion(idx)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors flex items-center justify-center"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'composition' && formData.type === 'item' && (
                            <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Item Composition</h3>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            Define which materials/labour make up this item. Unit must match component's unit category.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddComposition}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
                                    >
                                        <Plus size={12} /> Add Component
                                    </button>
                                </div>

                                {compositions.length === 0 ? (
                                    <div className="text-center py-10 bg-gray-50/50 dark:bg-white/[0.02] rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                                        <p className="text-xs text-gray-400">No components. Click "Add Component" to define composition.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-[1fr_80px_100px_32px] gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
                                            <span>Component</span>
                                            <span>Quantity</span>
                                            <span>Unit</span>
                                            <span></span>
                                        </div>
                                        {compositions.map((comp, idx) => (
                                            <div key={idx} className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-center bg-gray-50 dark:bg-white/[0.02] p-2 rounded-xl border border-gray-200 dark:border-white/10">
                                                <select
                                                    value={comp.component_resource_id}
                                                    onChange={e => handleCompositionChange(idx, 'component_resource_id', e.target.value)}
                                                    className="bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                >
                                                    <option value="">Select Material/Labour</option>
                                                    {allResources.map(r => (
                                                        <option key={r.id} value={r.id}>{r.name} {r.code ? `(${r.code})` : ''}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    placeholder="Qty"
                                                    value={comp.quantity}
                                                    onChange={e => handleCompositionChange(idx, 'quantity', e.target.value)}
                                                    className="bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                />
                                                <select
                                                    value={comp.unit_code}
                                                    onChange={e => handleCompositionChange(idx, 'unit_code', e.target.value)}
                                                    className="bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                >
                                                    <option value="">Unit</option>
                                                    {Object.entries(UNIT_GROUPS).map(([type, units]) => (
                                                        <optgroup key={type} label={unitTypeLabel[type] || type}>
                                                            {units.map(u => (
                                                                <option key={u.code} value={u.code}>{u.symbol}</option>
                                                            ))}
                                                        </optgroup>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveComposition(idx)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors flex items-center justify-center"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3 rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-[#161b22] border border-gray-300 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="resource-form"
                        disabled={isLoading}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-95"
                    >
                        {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Resource'}
                    </button>
                </div>
            </motion.div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                cancelText={confirmModal.cancelText}
                variant={confirmModal.variant}
                isLoading={confirmModal.isLoading}
            />
        </motion.div>
    );
};

export default ResourceForm;
