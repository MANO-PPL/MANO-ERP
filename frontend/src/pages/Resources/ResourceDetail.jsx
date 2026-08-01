import React, { useState, useEffect, useMemo } from 'react';
import {
    X, Plus, Trash2, Package, Layers, Users, ArrowRight, RefreshCw, RotateCcw,
    Copy, Check, DollarSign, ArrowLeftRight, Save, ChevronDown, Edit3, Sparkles, AlertCircle, Calendar
} from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';
import { UNIT_OPTIONS, UNIT_REGISTRY, UNIT_GROUPS } from './resourceConstants';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../../components/ConfirmModal';

const unitTypeLabel = { weight: 'Weight', volume: 'Volume', length: 'Length', area: 'Area', count: 'Count', time: 'Time' };
const today = () => new Date().toISOString().slice(0, 10);
const nextDate = (value) => {
    if (!value) return today();
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
};

const TYPE_CONFIG = {
    material: { label: 'Material', Icon: Package, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-500/20' },
    item: { label: 'Item (Composite)', Icon: Layers, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-200 dark:border-purple-500/20' },
    labour: { label: 'Labour', Icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-500/20' },
};

const SectionHeader = ({ title, badge }) => (
    <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{title}</h3>
        {badge && <span className="text-[10px] font-semibold text-gray-400">{badge}</span>}
    </div>
);

const ResourceDetail = ({
    resourceId,
    onClose,
    onUpdate,
    onNavigateTab,
    canWrite = true,
    isDrawer = false,
    isModified = false,
    onRevert,
    onDelete,
    showToast,
    setConfirmModal: setExternalConfirmModal
}) => {
    const [copied, setCopied] = useState(false);
    const [resource, setResource] = useState(null);
    const [compositionHistory, setCompositionHistory] = useState([]);
    const [compositionEffectiveFrom, setCompositionEffectiveFrom] = useState(today());
    const [resolvedRate, setResolvedRate] = useState(null);
    const [allResourcesList, setAllResourcesList] = useState([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasLocalChanges, setHasLocalChanges] = useState(false);
    const [compositionChanged, setCompositionChanged] = useState(false);

    // Editable form state
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        type: 'material',
        base_unit_code: 'kg',
        description: '',
        remarks: '',
        rate: '',
        rate_source: 'manual',
        conversions: [],
        compositions: []
    });

    // Sub-forms for adding new rows
    const [isAddingConv, setIsAddingConv] = useState(false);
    const [convForm, setConvForm] = useState({ name: '', quantity: '1', unit_code: 'kg' });
    const [convError, setConvError] = useState('');

    const [isAddingComp, setIsAddingComp] = useState(false);
    const [compForm, setCompForm] = useState({ component_resource_id: '', quantity: '1', unit_code: 'kg' });
    const [compError, setCompError] = useState('');

    // Internal Confirm Modal fallback
    const [internalConfirmModal, setInternalConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        variant: 'danger',
        isLoading: false,
        onConfirm: () => { }
    });

    const triggerConfirm = (config) => {
        if (setExternalConfirmModal) {
            setExternalConfirmModal({ isOpen: true, ...config });
        } else {
            setInternalConfirmModal({ isOpen: true, ...config });
        }
    };

    const fetchDetail = async (isRefresh = false) => {
        if (isRefresh) setIsRefreshing(true);
        else setIsLoading(true);
        try {
            const [data, rateData, listData, historyData] = await Promise.all([
                resourceApi.getResourceById(resourceId),
                resourceApi.getResolvedRate(resourceId).catch(() => null),
                resourceApi.getResources().catch(() => ({ resources: [] })),
                resourceApi.getCompositionHistory(resourceId).catch(() => ({ compositions: [] }))
            ]);
            
            const resObj = data.resource;
            setResource(resObj);
            setAllResourcesList(listData.resources || []);
            const historyRows = historyData.compositions || [];
            setCompositionHistory(historyRows);
            const latestCompositionDate = historyRows
                .map(row => row.effective_from)
                .filter(Boolean)
                .map(value => String(value).slice(0, 10))
                .sort()
                .pop();

            const effRate = rateData?.rate || null;
            if (effRate) setResolvedRate(effRate);

            setFormData({
                name: resObj.name || '',
                code: resObj.code || '',
                type: resObj.type || 'material',
                base_unit_code: resObj.base_unit_code || 'kg',
                description: resObj.description || '',
                remarks: resObj.remarks || '',
                rate: effRate?.rate !== undefined && effRate?.rate !== null ? effRate.rate : '',
                rate_source: effRate?.source || 'manual',
                conversions: resObj.conversions ? [...resObj.conversions] : [],
                compositions: resObj.compositions ? [...resObj.compositions] : []
            });
            setCompositionEffectiveFrom(latestCompositionDate ? nextDate(latestCompositionDate) : today());

            setHasLocalChanges(false);
            setCompositionChanged(false);
        } catch (err) {
            console.error('Failed to load resource detail:', err);
            if (showToast) showToast('error', 'Fetch Error', 'Failed to load resource details.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (resourceId) fetchDetail();
    }, [resourceId]);

    const updateFormField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setHasLocalChanges(true);
    };

    const latestCompositionDate = useMemo(() => compositionHistory
        .map(row => row.effective_from)
        .filter(Boolean)
        .map(value => String(value).slice(0, 10))
        .sort()
        .pop(), [compositionHistory]);

    const handleCopy = () => {
        if (!formData) return;
        const detailsText = `RESOURCE DETAILS: ${formData.name}
========================================
Resource Name : ${formData.name || '-'}
Resource Code : ${formData.code || '-'}
Type          : ${(formData.type || '').toUpperCase()}
Base Unit     : ${formData.base_unit_code || '-'}
Effective Rate: ₹${formData.rate || '-'}
Description   : ${formData.description || '-'}
Remarks       : ${formData.remarks || '-'}
========================================`.trim();

        navigator.clipboard.writeText(detailsText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        if (showToast) showToast('sparkle', 'Copied to Clipboard', 'Structured resource details copied!');
    };

    // Save All Edits
    const handleSaveAll = async () => {
        if (!formData.name || !formData.name.trim()) {
            if (showToast) showToast('error', 'Name Required', 'Resource name cannot be blank.');
            return;
        }
        if (!formData.base_unit_code) {
            if (showToast) showToast('error', 'Unit Required', 'Base unit code is required.');
            return;
        }

        setIsSaving(true);
        try {
            // Update resource base fields, conversions, compositions
            await resourceApi.updateResource(resourceId, {
                name: formData.name.trim(),
                code: formData.code ? formData.code.trim() : '',
                type: formData.type,
                base_unit_code: formData.base_unit_code,
                description: formData.description,
                remarks: formData.remarks,
                conversions: formData.conversions,
                ...(formData.type === 'item' && compositionChanged
                    ? {
                        compositions: formData.compositions,
                        effective_from: compositionEffectiveFrom
                    }
                    : {})
            });

            // Save manual rate if specified
            if (formData.rate !== '' && formData.rate !== null && !isNaN(Number(formData.rate))) {
                const numRate = Number(formData.rate);
                if (numRate >= 0) {
                    await resourceApi.addRate(resourceId, {
                        rate: numRate,
                        unit_code: formData.base_unit_code,
                        effective_from: new Date().toISOString().slice(0, 10)
                    }).catch(err => console.warn('Rate update note:', err));
                }
            }

            if (showToast) showToast('success', 'Changes Saved', `Updated details for "${formData.name}".`);
            setHasLocalChanges(false);
            fetchDetail(true);
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error('Failed to save resource drawer edits:', err);
            const msg = err.response?.data?.message || 'Failed to save changes';
            if (showToast) showToast('error', 'Save Error', msg);
        } finally {
            setIsSaving(false);
        }
    };

    // Conversions Manager
    const handleAddConversion = (e) => {
        e.preventDefault();
        setConvError('');
        if (!convForm.name || !convForm.name.trim()) {
            setConvError('Scale name is required (e.g. Box, Pack)');
            return;
        }
        if (!convForm.quantity || Number(convForm.quantity) <= 0) {
            setConvError('Quantity must be greater than 0');
            return;
        }
        if (!convForm.unit_code) {
            setConvError('Target unit code is required');
            return;
        }

        const newConv = {
            id: `temp_conv_${Date.now()}`,
            name: convForm.name.trim(),
            quantity: parseFloat(convForm.quantity),
            unit_code: convForm.unit_code
        };

        setFormData(prev => ({
            ...prev,
            conversions: [...prev.conversions, newConv]
        }));

        setConvForm({ name: '', quantity: '1', unit_code: formData.base_unit_code || 'kg' });
        setIsAddingConv(false);
        setHasLocalChanges(true);
        if (showToast) showToast('sparkle', 'Scale Added', `Added 1 ${newConv.name} scale. Click "Save Changes" to commit.`);
    };

    const handleDeleteConversion = (convId, convName) => {
        triggerConfirm({
            title: 'Remove Conversion Scale?',
            message: `Are you sure you want to remove conversion scale "${convName}"?`,
            confirmText: 'Remove Scale',
            variant: 'danger',
            onConfirm: () => {
                setFormData(prev => ({
                    ...prev,
                    conversions: prev.conversions.filter(c => String(c.id) !== String(convId))
                }));
                setHasLocalChanges(true);
                if (showToast) showToast('info', 'Scale Removed', `Removed conversion scale "${convName}".`);
                if (setExternalConfirmModal) setExternalConfirmModal(prev => ({ ...prev, isOpen: false }));
                else setInternalConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    // Compositions Manager (for Items)
    const handleAddComposition = (e) => {
        e.preventDefault();
        setCompError('');
        if (!compForm.component_resource_id) {
            setCompError('Please select a component resource');
            return;
        }
        if (!compForm.quantity || Number(compForm.quantity) <= 0) {
            setCompError('Quantity must be greater than 0');
            return;
        }

        const compRes = allResourcesList.find(r => String(r.id) === String(compForm.component_resource_id));
        const newComp = {
            id: `temp_comp_${Date.now()}`,
            component_resource_id: Number(compForm.component_resource_id),
            component_name: compRes ? compRes.name : `Component #${compForm.component_resource_id}`,
            component_code: compRes ? compRes.code : '',
            quantity: parseFloat(compForm.quantity),
            unit_code: compForm.unit_code || (compRes ? compRes.base_unit_code : 'kg')
        };

        setFormData(prev => ({
            ...prev,
            compositions: [...prev.compositions, newComp]
        }));

        setCompForm({ component_resource_id: '', quantity: '1', unit_code: formData.base_unit_code || 'kg' });
        setIsAddingComp(false);
        setHasLocalChanges(true);
        setCompositionChanged(true);
        if (showToast) showToast('sparkle', 'Ingredient Added', `Added component "${newComp.component_name}". Click "Save Changes" to commit.`);
    };

    const handleDeleteComposition = (compId, compName) => {
        triggerConfirm({
            title: 'Remove Ingredient Component?',
            message: `Are you sure you want to remove component "${compName}"?`,
            confirmText: 'Remove Component',
            variant: 'danger',
            onConfirm: () => {
                setFormData(prev => ({
                    ...prev,
                    compositions: prev.compositions.filter(c => String(c.id) !== String(compId))
                }));
                setHasLocalChanges(true);
                setCompositionChanged(true);
                if (showToast) showToast('info', 'Ingredient Removed', `Removed component "${compName}".`);
                if (setExternalConfirmModal) setExternalConfirmModal(prev => ({ ...prev, isOpen: false }));
                else setInternalConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const tc = TYPE_CONFIG[formData.type || 'material'] || TYPE_CONFIG.material;
    const TypeIcon = tc.Icon;

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center">
                        <RefreshCw size={24} className="animate-spin text-blue-500 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Loading spreadsheet details...</p>
                    </div>
                </div>
            );
        }

        if (!resource) {
            return (
                <div className="flex-1 flex items-center justify-center p-8">
                    <p className="text-sm text-gray-400">Resource record not found.</p>
                </div>
            );
        }

        return (
            <>
                {/* Header with Title & Save Action Bar */}
                <div className={`px-6 py-4 border-b border-gray-200 dark:border-white/10 shrink-0 ${tc.bg}`}>
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tc.bg} ${tc.border} border shadow-sm`}>
                                <TypeIcon size={18} className={tc.color} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => updateFormField('name', e.target.value)}
                                    className="w-full bg-transparent font-bold text-base text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded px-1 -ml-1 border border-transparent hover:border-gray-300 dark:hover:border-white/20 transition truncate"
                                    placeholder="Resource Name..."
                                    title="Click to edit Resource Name"
                                />
                                <div className="flex items-center gap-2 mt-0.5">
                                    <select
                                        value={formData.type}
                                        onChange={e => updateFormField('type', e.target.value)}
                                        className={`text-[10px] font-extrabold uppercase bg-white/70 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded px-1.5 py-0.5 ${tc.color} focus:outline-none`}
                                    >
                                        <option value="material">Material</option>
                                        <option value="item">Item (Composite)</option>
                                        <option value="labour">Labour</option>
                                    </select>
                                    <span className="text-gray-300 dark:text-white/20">·</span>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={e => updateFormField('code', e.target.value)}
                                        className="text-[10px] font-mono text-gray-600 dark:text-gray-400 bg-white/70 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded px-1.5 py-0.5 focus:outline-none w-24 uppercase"
                                        placeholder="CODE"
                                        title="Click to edit Resource Code"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                            {isRefreshing && <RefreshCw size={14} className="animate-spin text-gray-400" />}

                            {/* Save Button */}
                            {canWrite && (
                                <button
                                    onClick={handleSaveAll}
                                    disabled={isSaving || !hasLocalChanges}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                                        isSaving
                                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 cursor-wait'
                                            : hasLocalChanges
                                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 cursor-pointer active:scale-95'
                                                : 'bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-white/10'
                                    }`}
                                    title={hasLocalChanges ? 'Save all sidebar edits' : 'No changes to save'}
                                >
                                    {isSaving ? (
                                        <>
                                            <RefreshCw size={13} className="animate-spin" />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save size={13} className="stroke-[2.5]" />
                                            <span>Save Edits</span>
                                            {hasLocalChanges && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
                                        </>
                                    )}
                                </button>
                            )}

                            <button
                                onClick={handleCopy}
                                className="p-1.5 bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold transition"
                                title="Copy Structured Resource Details"
                            >
                                {copied ? <Check size={14} className="text-emerald-500 stroke-[3]" /> : <Copy size={14} />}
                            </button>

                            {canWrite && onDelete && (
                                <button
                                    onClick={onDelete}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white/50 dark:hover:bg-white/5 rounded-lg transition"
                                    title="Delete resource"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}

                            <button
                                onClick={onClose}
                                className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5 rounded-lg transition"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Body - Excel-Style Inspector Panel */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
                    
                    {/* Unsaved Changes Banner */}
                    {hasLocalChanges && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 rounded-xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-400">
                            <span className="flex items-center gap-1.5 font-bold">
                                <AlertCircle size={14} /> Unsaved edits in sidebar inspector
                            </span>
                            <button
                                onClick={handleSaveAll}
                                className="px-2.5 py-1 bg-amber-600 text-white rounded text-[11px] font-bold hover:bg-amber-700 transition"
                            >
                                Save Now
                            </button>
                        </div>
                    )}

                    {/* Live Rate Editor Card */}
                    <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-500/20 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase text-emerald-800 dark:text-emerald-400 flex items-center gap-1">
                                <DollarSign size={12} /> Effective Unit Rate (₹)
                            </span>
                            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                formData.rate_source === 'manual'
                                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                    : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                            }`}>
                                {formData.rate_source === 'manual' ? 'Manual Override' : 'Recipe Computed'}
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-mono font-black text-gray-900 dark:text-white">₹</span>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.rate ?? ''}
                                onChange={e => {
                                    updateFormField('rate', e.target.value);
                                    updateFormField('rate_source', 'manual');
                                }}
                                className="flex-1 px-3 py-1.5 bg-white dark:bg-[#0d1117] border border-emerald-300 dark:border-emerald-500/30 rounded-lg text-lg font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-inner"
                                placeholder="Enter manual unit rate..."
                            />
                            <span className="text-xs font-semibold text-gray-500">per {formData.base_unit_code}</span>
                        </div>
                    </div>

                    {/* General Information Inspector */}
                    <section>
                        <SectionHeader title="General Information Inspector" />
                        <div className="bg-gray-50/70 dark:bg-white/[0.02] rounded-xl border border-gray-200/70 dark:border-white/10 p-3 space-y-3">
                            {/* Base Unit Selector */}
                            <div className="flex items-center justify-between gap-3">
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 w-28">Base Unit <span className="text-red-500">*</span></label>
                                <select
                                    value={formData.base_unit_code}
                                    onChange={e => updateFormField('base_unit_code', e.target.value)}
                                    className="flex-1 px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                >
                                    {Object.entries(UNIT_GROUPS).map(([groupType, units]) => (
                                        <optgroup key={groupType} label={unitTypeLabel[groupType] || groupType}>
                                            {units.map(u => (
                                                <option key={u.code} value={u.code}>{u.name} ({u.symbol})</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>

                            {/* Description Input */}
                            <div className="flex items-start justify-between gap-3">
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 w-28 pt-1.5">Description</label>
                                <textarea
                                    rows="2"
                                    value={formData.description}
                                    onChange={e => updateFormField('description', e.target.value)}
                                    className="flex-1 px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
                                    placeholder="Enter resource description..."
                                />
                            </div>

                            {/* Remarks Input */}
                            <div className="flex items-center justify-between gap-3">
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 w-28">Remarks</label>
                                <input
                                    type="text"
                                    value={formData.remarks}
                                    onChange={e => updateFormField('remarks', e.target.value)}
                                    className="flex-1 px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    placeholder="Internal specs or remarks..."
                                />
                            </div>
                        </div>
                    </section>

                    {/* Unit Conversions Table Inspector */}
                    <section>
                        <div className="flex items-center justify-between mb-2">
                            <SectionHeader title="Unit Conversion Scales" badge={`${formData.conversions?.length || 0} Defined`} />
                            {canWrite && (
                                <button
                                    onClick={() => { setIsAddingConv(v => !v); setConvError(''); }}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition"
                                >
                                    <Plus size={11} /> Add Scale
                                </button>
                            )}
                        </div>

                        {/* Inline Form */}
                        <AnimatePresence>
                            {isAddingConv && (
                                <motion.form
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    onSubmit={handleAddConversion}
                                    className="mb-3 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 space-y-2"
                                >
                                    {convError && <p className="text-[10px] text-red-500 font-bold">{convError}</p>}
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">New Scale: 1 [Scale Name] = [Qty] [Unit]</p>
                                    <div className="grid grid-cols-[1fr_60px_80px_auto] gap-2 items-center">
                                        <input
                                            required
                                            placeholder="Name (e.g. Box)"
                                            value={convForm.name}
                                            onChange={e => setConvForm({ ...convForm, name: e.target.value })}
                                            className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none"
                                        />
                                        <input
                                            required
                                            type="number"
                                            step="any"
                                            placeholder="10"
                                            value={convForm.quantity}
                                            onChange={e => setConvForm({ ...convForm, quantity: e.target.value })}
                                            className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none"
                                        />
                                        <select
                                            value={convForm.unit_code}
                                            onChange={e => setConvForm({ ...convForm, unit_code: e.target.value })}
                                            className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-1.5 py-1 text-xs font-bold focus:outline-none"
                                        >
                                            {UNIT_OPTIONS.map(u => (
                                                <option key={u.code} value={u.code}>{u.code}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="submit"
                                            className="px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </motion.form>
                            )}
                        </AnimatePresence>

                        {/* Conversions Table */}
                        {(!formData.conversions || formData.conversions.length === 0) ? (
                            <div className="text-xs text-gray-400 italic py-3 text-center bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                                No unit conversion scales configured.
                            </div>
                        ) : (
                            <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                                <table className="w-full text-left text-xs bg-white dark:bg-transparent">
                                    <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                                        <tr>
                                            <th className="px-3 py-2">Scale Name</th>
                                            <th className="px-3 py-2">Equals Quantity</th>
                                            <th className="px-3 py-2 w-8 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                        {formData.conversions.map((c, idx) => (
                                            <tr key={c.id || idx} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                                                <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">1 {c.name}</td>
                                                <td className="px-3 py-2 text-gray-700 dark:text-gray-300 font-mono font-bold">
                                                    = {c.quantity} {c.unit_code}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    {canWrite && (
                                                        <button
                                                            onClick={() => handleDeleteConversion(c.id, c.name)}
                                                            className="p-1 text-gray-400 hover:text-red-500 rounded transition"
                                                            title="Remove scale"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    {/* Composite Recipe Ingredients Inspector (Items Only) */}
                    {formData.type === 'item' && (
                        <section>
                            <div className="flex items-center justify-between mb-2">
                                <SectionHeader title="Composite Recipe Ingredients" badge={`${formData.compositions?.length || 0} Ingredients`} />
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-[9px] font-bold text-gray-500 uppercase">
                                        <Calendar size={11} />
                                        <span>Effective</span>
                                        <input
                                            type="date"
                                            required
                                            disabled={!canWrite}
                                            value={compositionEffectiveFrom}
                                            onChange={e => {
                                                setCompositionEffectiveFrom(e.target.value);
                                                setHasLocalChanges(true);
                                                setCompositionChanged(true);
                                            }}
                                            className="bg-transparent text-[10px] font-semibold text-gray-800 dark:text-gray-200 outline-none normal-case"
                                        />
                                    </label>
                                    {canWrite && (
                                        <button
                                            onClick={() => { setIsAddingComp(v => !v); setCompError(''); }}
                                            className="flex items-center gap-1 px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 rounded-lg text-[10px] font-bold hover:bg-purple-100 transition"
                                        >
                                            <Plus size={11} /> Add Ingredient
                                        </button>
                                    )}
                                </div>
                            </div>
                            {latestCompositionDate && (
                                <p className="text-[10px] text-gray-400 mb-2">Latest saved version: {latestCompositionDate}. New versions must use a later date.</p>
                            )}

                            {/* Inline Ingredient Form */}
                            <AnimatePresence>
                                {isAddingComp && (
                                    <motion.form
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        onSubmit={handleAddComposition}
                                        className="mb-3 p-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-900/30 space-y-2"
                                    >
                                        {compError && <p className="text-[10px] text-red-500 font-bold">{compError}</p>}
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">New Ingredient Component</p>
                                        <div className="grid grid-cols-[1fr_60px_75px_auto] gap-2 items-center">
                                            <select
                                                required
                                                value={compForm.component_resource_id}
                                                onChange={e => setCompForm({ ...compForm, component_resource_id: e.target.value })}
                                                className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none"
                                            >
                                                <option value="">Select component resource...</option>
                                                {allResourcesList
                                                    .filter(r => String(r.id) !== String(resourceId))
                                                    .map(r => (
                                                        <option key={r.id} value={r.id}>{r.name} ({r.base_unit_code})</option>
                                                    ))
                                                }
                                            </select>
                                            <input
                                                required
                                                type="number"
                                                step="any"
                                                placeholder="Qty"
                                                value={compForm.quantity}
                                                onChange={e => setCompForm({ ...compForm, quantity: e.target.value })}
                                                className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none"
                                            />
                                            <select
                                                value={compForm.unit_code}
                                                onChange={e => setCompForm({ ...compForm, unit_code: e.target.value })}
                                                className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-1.5 py-1 text-xs font-bold focus:outline-none"
                                            >
                                                {UNIT_OPTIONS.map(u => (
                                                    <option key={u.code} value={u.code}>{u.code}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="submit"
                                                className="px-2.5 py-1 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </motion.form>
                                )}
                            </AnimatePresence>

                            {/* Compositions Table */}
                            {(!formData.compositions || formData.compositions.length === 0) ? (
                                <div className="text-xs text-gray-400 italic py-3 text-center bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                                    No recipe ingredients defined for this item.
                                </div>
                            ) : (
                                <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-xs bg-white dark:bg-transparent">
                                        <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                                            <tr>
                                                <th className="px-3 py-2">Ingredient Component</th>
                                                <th className="px-3 py-2 text-right">Quantity</th>
                                                <th className="px-3 py-2 w-8 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                            {formData.compositions.map((comp, idx) => (
                                                <tr key={comp.id || idx} className="hover:bg-purple-50/30 dark:hover:bg-purple-900/10">
                                                    <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">
                                                        {comp.component_name || `Component #${comp.component_resource_id}`}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                                                        {comp.quantity} {comp.unit_code}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        {canWrite && (
                                                            <button
                                                                onClick={() => handleDeleteComposition(comp.id, comp.component_name)}
                                                                className="p-1 text-gray-400 hover:text-red-500 rounded transition"
                                                                title="Remove ingredient"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* Sticky Footer Save Action Bar */}
                {canWrite && (
                    <div className="p-3 px-5 bg-gray-50 dark:bg-[#161b22] border-t border-gray-200 dark:border-white/10 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            {hasLocalChanges ? (
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                    <AlertCircle size={13} /> Unsaved edits pending
                                </span>
                            ) : (
                                <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
                                    <Check size={13} className="text-emerald-500" /> Synced to cloud
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {hasLocalChanges && (
                                <button
                                    onClick={() => fetchDetail(true)}
                                    className="px-3 py-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white text-xs font-semibold"
                                >
                                    Discard
                                </button>
                            )}
                            <button
                                onClick={handleSaveAll}
                                disabled={isSaving || !hasLocalChanges}
                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                                    isSaving
                                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 cursor-wait'
                                        : hasLocalChanges
                                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-95 cursor-pointer'
                                            : 'bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-white/10'
                                }`}
                            >
                                {isSaving ? (
                                    <>
                                        <RefreshCw size={13} className="animate-spin" />
                                        <span>Saving Changes...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={13} className="stroke-[2.5]" />
                                        <span>Save Changes</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </>
        );
    };

    if (isDrawer) {
        return (
            <div className="w-full h-full bg-white dark:bg-[#0d1117] flex flex-col overflow-hidden relative border-l border-gray-200 dark:border-white/10">
                <ConfirmModal
                    isOpen={internalConfirmModal.isOpen}
                    onClose={() => setInternalConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    onConfirm={internalConfirmModal.onConfirm}
                    title={internalConfirmModal.title}
                    message={internalConfirmModal.message}
                    confirmText={internalConfirmModal.confirmText}
                    cancelText={internalConfirmModal.cancelText}
                    variant={internalConfirmModal.variant}
                    isLoading={internalConfirmModal.isLoading}
                />
                {renderContent()}
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[5000] flex"
        >
            <ConfirmModal
                isOpen={internalConfirmModal.isOpen}
                onClose={() => setInternalConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={internalConfirmModal.onConfirm}
                title={internalConfirmModal.title}
                message={internalConfirmModal.message}
                confirmText={internalConfirmModal.confirmText}
                cancelText={internalConfirmModal.cancelText}
                variant={internalConfirmModal.variant}
                isLoading={internalConfirmModal.isLoading}
            />
            <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="w-[480px] h-full bg-white dark:bg-[#0d1117] shadow-2xl border-l border-gray-200 dark:border-white/10 flex flex-col"
            >
                {renderContent()}
            </motion.div>
        </motion.div>
    );
};

export default ResourceDetail;
