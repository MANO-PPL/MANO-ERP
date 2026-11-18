import React, { useState, useEffect } from 'react';
import { X, Layers, Loader2 } from 'lucide-react';
import catalogApi from '../../services/catalogApi';
import { showCatalogErrorToast } from './catalogErrors';
import { customToast } from '../../utils/toast';

export default function ActivityDrawer({
    isOpen,
    activity = null, // null for create, object for edit
    scope = 'master',
    projectId = null,
    units = [],
    onClose,
    onSuccess
}) {
    const isEditing = Boolean(activity);

    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [outputUnitId, setOutputUnitId] = useState('');
    const [description, setDescription] = useState('');
    const [remarks, setRemarks] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        if (activity) {
            setCode(activity.code || '');
            setName(activity.name || '');
            setOutputUnitId(activity.output_unit_id ? String(activity.output_unit_id) : '');
            setDescription(activity.description || '');
            setRemarks(activity.remarks || '');
        } else {
            setCode('');
            setName('');
            setOutputUnitId(units[0]?.id ? String(units[0].id) : '');
            setDescription('');
            setRemarks('');
        }
    }, [isOpen, activity, units]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmedCode = code.trim().toUpperCase();
        const trimmedName = name.trim();

        if (!trimmedCode || !trimmedName || !outputUnitId) {
            customToast.error('Code, Name, and Output Unit are required.', 'Missing Fields');
            return;
        }

        setSubmitting(true);
        try {
            if (isEditing) {
                await catalogApi.updateActivity(activity.id, {
                    code: trimmedCode,
                    name: trimmedName,
                    outputUnitId: Number(outputUnitId),
                    description: description.trim() || undefined,
                    remarks: remarks.trim() || undefined
                });
                customToast.success(`Activity ${trimmedCode} updated`, 'Activity Updated');
            } else {
                await catalogApi.createActivity({
                    projectId: scope === 'project' && projectId ? Number(projectId) : null,
                    code: trimmedCode,
                    name: trimmedName,
                    outputUnitId: Number(outputUnitId),
                    description: description.trim() || undefined,
                    remarks: remarks.trim() || undefined
                });
                customToast.success(`Activity ${trimmedCode} created`, 'Activity Created');
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            showCatalogErrorToast(err, isEditing ? 'Failed to update activity' : 'Failed to create activity');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-gh-border shadow-2xl flex flex-col animate-slide-left">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-gh-subtle/50">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                        <Layers size={20} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                            {isEditing ? `Edit Activity: ${activity.code}` : 'Create New Activity'}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Scope: {scope === 'project' && projectId ? `Project #${projectId}` : 'Master Catalog'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    disabled={submitting}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                    {/* Code */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                            Activity Code <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="e.g. ACT-EXC, ACT-BRICK-230"
                            className="w-full px-3 py-2 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 uppercase"
                            required
                        />
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                            Activity Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Earthwork Excavation in Ordinary Soil"
                            className="w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                            required
                        />
                    </div>

                    {/* Output Unit */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                            Output Unit <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={outputUnitId}
                            onChange={(e) => setOutputUnitId(e.target.value)}
                            className="w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 font-mono"
                            required
                        >
                            <option value="">Select Output Unit...</option>
                            {units.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.code} &mdash; {u.name} ({u.category})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                            Description
                        </label>
                        <textarea
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Scope of work, standard specifications, IS code references..."
                            className="w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                        />
                    </div>

                    {/* Remarks */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                            Remarks
                        </label>
                        <input
                            type="text"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Internal execution or machinery notes..."
                            className="w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-gh-subtle/50">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gh-hover border border-gray-300 dark:border-gh-border rounded-lg hover:bg-gray-100 dark:hover:bg-gh-subtle cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting || !code.trim() || !name.trim() || !outputUnitId}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                    >
                        {submitting && <Loader2 size={14} className="animate-spin" />}
                        {isEditing ? 'Save Changes' : 'Create Activity'}
                    </button>
                </div>
            </form>
        </div>
    );
}

