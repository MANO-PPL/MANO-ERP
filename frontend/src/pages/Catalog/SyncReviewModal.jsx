import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Check, AlertTriangle, ArrowRight, Loader2, GitCompare } from 'lucide-react';
import catalogApi from '../../services/catalogApi';
import { showCatalogErrorToast } from './catalogErrors';
import { customToast } from '../../utils/toast';

export default function SyncReviewModal({
    isOpen,
    entityType = 'resource', // 'resource' | 'activity'
    itemId,
    itemName = '',
    itemCode = '',
    onClose,
    onSuccess
}) {
    const [loading, setLoading] = useState(true);
    const [diffData, setDiffData] = useState(null);
    const [selectedFields, setSelectedFields] = useState(new Set());
    const [syncRates, setSyncRates] = useState(false);
    const [syncConversions, setSyncConversions] = useState(false);
    const [syncNorms, setSyncNorms] = useState(false);
    const [reason, setReason] = useState('Sync master updates into project copy');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen || !itemId) return;

        let active = true;
        setLoading(true);
        setSelectedFields(new Set());
        setSyncRates(false);
        setSyncConversions(false);
        setSyncNorms(false);

        const fetchDiff = async () => {
            try {
                const data = entityType === 'resource'
                    ? await catalogApi.getResourceSyncDiff(itemId)
                    : await catalogApi.getActivitySyncDiff(itemId);

                if (active) {
                    setDiffData(data);
                }
            } catch (err) {
                if (active) {
                    showCatalogErrorToast(err, 'Failed to fetch sync diff');
                    onClose();
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchDiff();

        return () => {
            active = false;
        };
    }, [isOpen, itemId, entityType]);

    if (!isOpen) return null;

    const fields = diffData?.fields || {};
    const changedFieldKeys = Object.keys(fields).filter(k => fields[k]?.changed);
    const hasRatesChanged = Boolean(diffData?.rates?.changed);
    const hasConversionsChanged = Boolean(diffData?.conversions?.changed);
    const hasNormsChanged = Boolean(diffData?.norms?.changed);

    const totalDiffsCount = changedFieldKeys.length +
        (hasRatesChanged ? 1 : 0) +
        (hasConversionsChanged ? 1 : 0) +
        (hasNormsChanged ? 1 : 0);

    const toggleField = (fieldKey) => {
        setSelectedFields(prev => {
            const next = new Set(prev);
            if (next.has(fieldKey)) next.delete(fieldKey);
            else next.add(fieldKey);
            return next;
        });
    };

    const handleSelectAll = () => {
        setSelectedFields(new Set(changedFieldKeys));
        if (hasRatesChanged) setSyncRates(true);
        if (hasConversionsChanged) setSyncConversions(true);
        if (hasNormsChanged) setSyncNorms(true);
    };

    const handleClearAll = () => {
        setSelectedFields(new Set());
        setSyncRates(false);
        setSyncConversions(false);
        setSyncNorms(false);
    };

    const countSelected = selectedFields.size +
        (syncRates ? 1 : 0) +
        (syncConversions ? 1 : 0) +
        (syncNorms ? 1 : 0);

    const handleAccept = async () => {
        if (countSelected === 0) return;
        setSubmitting(true);
        try {
            const selection = {
                fields: Array.from(selectedFields),
                rates: syncRates,
                conversions: syncConversions,
                norms: syncNorms,
            };

            if (entityType === 'resource') {
                await catalogApi.acceptResourceSync(itemId, selection, reason.trim() || undefined);
            } else {
                await catalogApi.acceptActivitySync(itemId, selection, reason.trim() || undefined);
            }

            customToast.success(`Successfully synced selected changes from master`, 'Sync Accepted');
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to accept sync changes');
        } finally {
            setSubmitting(false);
        }
    };

    const fieldLabels = {
        code: 'Code',
        name: 'Name',
        base_unit_id: 'Base Unit ID',
        output_unit_id: 'Output Unit ID',
        description: 'Description',
        remarks: 'Remarks',
        status: 'Status',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-3xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gh-border">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                            <GitCompare size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                Sync Review: {itemCode} - {itemName}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Compare project copy (v{diffData?.syncedVersion ?? '—'}) against Master (v{diffData?.masterVersion ?? '—'}). Select which differences to accept.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <Loader2 size={28} className="animate-spin mb-2 text-blue-500" />
                            <span className="text-sm">Inspecting differences with master...</span>
                        </div>
                    ) : totalDiffsCount === 0 ? (
                        <div className="text-center py-8">
                            <div className="inline-flex p-3 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mb-2">
                                <Check size={24} />
                            </div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                In Sync With Master
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
                                No differences detected between the project copy and the master catalog.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Toolbar */}
                            <div className="flex items-center justify-between bg-gray-50 dark:bg-gh-subtle p-3 rounded-lg border border-gray-200 dark:border-gh-border text-xs">
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                    {totalDiffsCount} difference{totalDiffsCount > 1 ? 's' : ''} detected &bull; {countSelected} selected
                                </span>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleSelectAll}
                                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                    >
                                        Select All
                                    </button>
                                    <span className="text-gray-300 dark:text-gray-600">|</span>
                                    <button
                                        type="button"
                                        onClick={handleClearAll}
                                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {/* Differences Table */}
                            <div className="border border-gray-200 dark:border-gh-border rounded-lg overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-100 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase">
                                        <tr>
                                            <th className="py-2.5 px-3 w-10 text-center">Accept</th>
                                            <th className="py-2.5 px-3 w-36">Field / Section</th>
                                            <th className="py-2.5 px-3">Current Project Copy</th>
                                            <th className="py-2.5 px-3">Latest Master Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                        {/* Field Differences */}
                                        {changedFieldKeys.map((key) => {
                                            const item = fields[key];
                                            const isChecked = selectedFields.has(key);
                                            return (
                                                <tr
                                                    key={key}
                                                    onClick={() => toggleField(key)}
                                                    className={`cursor-pointer transition-colors ${isChecked ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'hover:bg-gray-50 dark:hover:bg-gh-hover/40'}`}
                                                >
                                                    <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => toggleField(key)}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100">
                                                        {fieldLabels[key] || key}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                                                        {item.project === null || item.project === undefined ? (
                                                            <span className="italic text-gray-400">(empty)</span>
                                                        ) : (
                                                            String(item.project)
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-semibold text-blue-600 dark:text-blue-400">
                                                        {item.master === null || item.master === undefined ? (
                                                            <span className="italic text-gray-400">(empty)</span>
                                                        ) : (
                                                            String(item.master)
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {/* Rates Differences */}
                                        {hasRatesChanged && (
                                            <tr
                                                onClick={() => setSyncRates(v => !v)}
                                                className={`cursor-pointer transition-colors ${syncRates ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'hover:bg-gray-50 dark:hover:bg-gh-hover/40'}`}
                                            >
                                                <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={syncRates}
                                                        onChange={() => setSyncRates(v => !v)}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100">
                                                    Rate Ledger
                                                </td>
                                                <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                                                    {diffData?.rates?.project?.length || 0} rate period(s) defined in project
                                                </td>
                                                <td className="py-2.5 px-3 font-semibold text-blue-600 dark:text-blue-400">
                                                    {diffData?.rates?.master?.length || 0} rate period(s) from master (will replace project rates)
                                                </td>
                                            </tr>
                                        )}

                                        {/* Conversions Differences */}
                                        {hasConversionsChanged && (
                                            <tr
                                                onClick={() => setSyncConversions(v => !v)}
                                                className={`cursor-pointer transition-colors ${syncConversions ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'hover:bg-gray-50 dark:hover:bg-gh-hover/40'}`}
                                            >
                                                <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={syncConversions}
                                                        onChange={() => setSyncConversions(v => !v)}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100">
                                                    Packaging Conversions
                                                </td>
                                                <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                                                    {diffData?.conversions?.project?.length || 0} rule(s)
                                                </td>
                                                <td className="py-2.5 px-3 font-semibold text-blue-600 dark:text-blue-400">
                                                    {diffData?.conversions?.master?.length || 0} rule(s) from master
                                                </td>
                                            </tr>
                                        )}

                                        {/* Norms Differences (Activity) */}
                                        {hasNormsChanged && (
                                            <tr
                                                onClick={() => setSyncNorms(v => !v)}
                                                className={`cursor-pointer transition-colors ${syncNorms ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'hover:bg-gray-50 dark:hover:bg-gh-hover/40'}`}
                                            >
                                                <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={syncNorms}
                                                        onChange={() => setSyncNorms(v => !v)}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100">
                                                    Composition Norms
                                                </td>
                                                <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                                                    Project norms differ from master
                                                </td>
                                                <td className="py-2.5 px-3 font-semibold text-blue-600 dark:text-blue-400">
                                                    Pull latest master norms (and auto-import needed resources)
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Reason for Audit */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Audit Reason for Sync
                                </label>
                                <input
                                    type="text"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Reason for pulling master updates..."
                                    className="w-full px-3 py-2 text-xs border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gh-border bg-gray-50 dark:bg-gh-subtle">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {countSelected > 0 ? `${countSelected} item(s) selected to accept` : 'Select items to accept'}
                    </span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gh-hover border border-gray-300 dark:border-gh-border rounded-lg hover:bg-gray-100 dark:hover:bg-gh-subtle transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleAccept}
                            disabled={submitting || countSelected === 0}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            {submitting && <Loader2 size={14} className="animate-spin" />}
                            Accept Selected ({countSelected})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

