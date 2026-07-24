import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Package, Layers, Users, ArrowRight, RefreshCw, RotateCcw } from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';
import { UNIT_OPTIONS, UNIT_REGISTRY, UNIT_GROUPS } from './resourceConstants';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../../components/ConfirmModal';

const unitTypeLabel = { weight: 'Weight', volume: 'Volume', length: 'Length', area: 'Area', count: 'Count', time: 'Time' };

const TYPE_CONFIG = {
    material: { label: 'Material', Icon: Package, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-500/20' },
    item: { label: 'Item', Icon: Layers, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-200 dark:border-purple-500/20' },
    labour: { label: 'Labour', Icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-500/20' },
};

const InfoRow = ({ label, value }) => (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-100 dark:border-white/5 last:border-0">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</span>
        <span className="text-xs font-semibold text-gray-900 dark:text-white text-right max-w-[60%] break-words">{value || '—'}</span>
    </div>
);

const SectionHeader = ({ title }) => (
    <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">{title}</h3>
);

const ResourceDetail = ({
    resourceId,
    onClose,
    onUpdate,
    canWrite = true,
    isDrawer = false,
    isModified = false,
    onRevert,
    onDelete,
    showToast,
    setConfirmModal: setExternalConfirmModal
}) => {
    const [resource, setResource] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Add conversion form
    const [isAddingConv, setIsAddingConv] = useState(false);
    const [convForm, setConvForm] = useState({ name: '', quantity: '', unit_code: '' });
    const [convError, setConvError] = useState('');
    const [isSavingConv, setIsSavingConv] = useState(false);

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
            setExternalConfirmModal({
                isOpen: true,
                ...config
            });
        } else {
            setInternalConfirmModal({
                isOpen: true,
                ...config
            });
        }
    };

    const fetchDetail = async (isRefresh = false) => {
        if (isRefresh) setIsRefreshing(true);
        else setIsLoading(true);
        try {
            const data = await resourceApi.getResourceById(resourceId);
            setResource(data.resource);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (resourceId) fetchDetail();
    }, [resourceId]);

    const handleAddConversion = async (e) => {
        e.preventDefault();
        setConvError('');
        setIsSavingConv(true);
        try {
            await resourceApi.addConversion(resource.id, {
                name: convForm.name,
                quantity: parseFloat(convForm.quantity),
                unit_code: convForm.unit_code
            });
            setIsAddingConv(false);
            setConvForm({ name: '', quantity: '', unit_code: '' });
            fetchDetail(true);
            if (onUpdate) onUpdate();
            if (showToast) showToast('success', 'Conversion Added', `Added 1 ${convForm.name} conversion.`);
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to add conversion';
            setConvError(msg);
            if (showToast) showToast('error', 'Add Conversion Failed', msg);
        } finally {
            setIsSavingConv(false);
        }
    };

    const handleDeleteConversion = (convId, convName) => {
        triggerConfirm({
            title: 'Delete Conversion?',
            message: `Are you sure you want to delete conversion scale "${convName || 'item'}"?`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: async () => {
                try {
                    await resourceApi.removeConversion(resource.id, convId);
                    fetchDetail(true);
                    if (onUpdate) onUpdate();
                    if (setExternalConfirmModal) setExternalConfirmModal(prev => ({ ...prev, isOpen: false }));
                    setInternalConfirmModal(prev => ({ ...prev, isOpen: false }));
                    if (showToast) showToast('success', 'Conversion Deleted', 'Removed conversion scale.');
                } catch (err) {
                    if (setExternalConfirmModal) setExternalConfirmModal(prev => ({ ...prev, isOpen: false }));
                    setInternalConfirmModal(prev => ({ ...prev, isOpen: false }));
                    if (showToast) showToast('error', 'Delete Failed', err.response?.data?.message || 'Failed to delete conversion');
                }
            }
        });
    };

    const tc = resource ? (TYPE_CONFIG[resource.type] || TYPE_CONFIG.material) : TYPE_CONFIG.material;
    const TypeIcon = tc.Icon;

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <RefreshCw size={24} className="animate-spin text-blue-500 mx-auto mb-3" />
                        <p className="text-sm text-gray-400">Loading details...</p>
                    </div>
                </div>
            );
        }

        if (!resource) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-gray-400">Resource not found.</p>
                </div>
            );
        }

        return (
            <>
                {/* Header */}
                <div className={`px-6 py-5 border-b border-gray-200 dark:border-white/10 shrink-0 ${tc.bg}`}>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tc.bg} ${tc.border} border`}>
                                <TypeIcon size={20} className={tc.color} />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">{resource.name}</h2>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-[10px] font-bold uppercase ${tc.color}`}>{tc.label}</span>
                                    {resource.code && (
                                        <>
                                            <span className="text-gray-300 dark:text-white/20">·</span>
                                            <span className="text-[10px] font-mono text-gray-500">{resource.code}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {isRefreshing && <RefreshCw size={14} className="animate-spin text-gray-400" />}
                            {isModified && (
                                <button
                                    onClick={onRevert}
                                    className="p-1.5 text-gray-450 hover:text-orange-500 hover:bg-white/50 dark:hover:bg-white/5 rounded-lg transition-colors"
                                    title="Revert draft changes"
                                >
                                    <RotateCcw size={15} />
                                </button>
                            )}
                            {canWrite && (
                                <button
                                    onClick={onDelete}
                                    className="p-1.5 text-gray-455 hover:text-red-500 hover:bg-white/50 dark:hover:bg-white/5 rounded-lg transition-colors"
                                    title="Delete resource"
                                >
                                    <Trash2 size={15} />
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                    {/* General Info */}
                    <section>
                        <SectionHeader title="General Information" />
                        <div className="bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/5 px-4">
                            <InfoRow label="ID" value={`#${resource.id}`} />
                            <InfoRow label="Base Unit" value={`${resource.base_unit_name} (${resource.base_unit_symbol})`} />
                            <InfoRow label="Unit Code" value={resource.base_unit_code} />
                            <InfoRow label="Description" value={resource.description} />
                            <InfoRow label="Remarks" value={resource.remarks} />
                        </div>
                    </section>

                    {/* Unit Conversions */}
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <SectionHeader title={`Unit Conversions (${resource.conversions?.length || 0})`} />
                            {canWrite && (
                                <button
                                    onClick={() => { setIsAddingConv(v => !v); setConvError(''); }}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-colors"
                                >
                                    <Plus size={11} /> Add
                                </button>
                            )}
                        </div>

                        <AnimatePresence>
                            {isAddingConv && (
                                <motion.form
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    onSubmit={handleAddConversion}
                                    className="mb-3 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 space-y-2"
                                >
                                    {convError && (
                                        <p className="text-[10px] text-red-500 font-medium">{convError}</p>
                                    )}
                                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                        New Conversion: 1 [name] = [qty] [unit]
                                    </p>
                                    <div className="grid grid-cols-[1fr_70px_100px_auto] gap-2 items-center">
                                        <input
                                            required
                                            placeholder="Name (e.g. Bag)"
                                            value={convForm.name}
                                            onChange={e => setConvForm({ ...convForm, name: e.target.value })}
                                            className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        />
                                        <input
                                            required
                                            type="number"
                                            step="any"
                                            placeholder="50"
                                            value={convForm.quantity}
                                            onChange={e => setConvForm({ ...convForm, quantity: e.target.value })}
                                            className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        />
                                        <select
                                            required
                                            value={convForm.unit_code}
                                            onChange={e => setConvForm({ ...convForm, unit_code: e.target.value })}
                                            className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
                                            type="submit"
                                            disabled={isSavingConv}
                                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                        >
                                            {isSavingConv ? '...' : 'Save'}
                                        </button>
                                    </div>
                                </motion.form>
                            )}
                        </AnimatePresence>

                        {!resource.conversions || resource.conversions.length === 0 ? (
                            <div className="text-xs text-gray-400 italic py-3 text-center bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                                No conversions defined.
                            </div>
                        ) : (
                            <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                                <table className="w-full text-left text-xs bg-white dark:bg-transparent">
                                    <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-400 uppercase tracking-wider text-[10px]">
                                        <tr>
                                            <th className="px-3 py-2">Scale Name</th>
                                            <th className="px-3 py-2">Equals</th>
                                            <th className="px-3 py-2 w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                        {resource.conversions.map(c => (
                                            <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                                                <td className="px-3 py-2.5 font-semibold text-gray-900 dark:text-white">1 {c.name}</td>
                                                <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">
                                                    <span className="flex items-center gap-1.5">
                                                        <ArrowRight size={11} className="text-gray-400" />
                                                        {c.quantity} {c.unit_symbol}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-right">
                                                    {canWrite && (
                                                        <button
                                                            onClick={() => handleDeleteConversion(c.id, c.name)}
                                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-md transition-colors"
                                                            title="Remove conversion"
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

                    {/* Compositions (Items only) */}
                    {resource.type === 'item' && (
                        <section>
                            <SectionHeader title={`Composition (${resource.compositions?.length || 0} components)`} />
                            {!resource.compositions || resource.compositions.length === 0 ? (
                                <div className="text-xs text-gray-400 italic py-3 text-center bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                                    No components defined. Edit to add composition.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {resource.compositions.map(c => (
                                        <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/5">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{c.component_name}</p>
                                                {c.component_code && (
                                                    <p className="text-[10px] font-mono text-gray-400">{c.component_code}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 bg-white dark:bg-[#161b22] px-3 py-1.5 rounded-lg border border-gray-100 dark:border-white/5 shadow-sm">
                                                <span className="text-sm font-black text-gray-900 dark:text-white">{c.quantity}</span>
                                                <span className="text-xs text-gray-500 font-medium">{c.unit_symbol}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}
                </div>
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
