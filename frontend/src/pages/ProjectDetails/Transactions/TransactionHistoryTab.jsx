import React, { useState, useMemo } from 'react';
import {
    Plus,
    FileText,
    RefreshCw,
    X,
    Layers,
    Trash2,
    AlertCircle,
    CheckCircle2,
    ShieldAlert,
    ArrowRightLeft
} from 'lucide-react';
import { toast } from 'react-toastify';
import { ledgerApi } from '../../../services/ledgerApi';
import CustomSelect from '../../../components/CustomSelect';
import { ExcelGrid } from '../../../components/ExcelGrid';

// Safe date formatter
const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
    } catch (e) {
        return '-';
    }
};

export const TransactionHistoryTab = ({
    project,
    canWrite,
    isAdmin,
    transactions = [],
    loading = false,
    projectParties = [],
    projectResources = [],
    masterUnits = [],
    stockMap = {},
    onRefresh,
    getPartyName,
    getResourceLabel,
    getStockAvailability
}) => {
    const projectId = project?.id;
    const orgId = project?.org_id || 1;

    const [viewingTxn, setViewingTxn] = useState(null);

    // Modal state for New Transaction
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [txnType, setTxnType] = useState('SUPPLY_ASSIGN');
    const [txnRemarks, setTxnRemarks] = useState('');

    // Dynamic Multi-Party & Multi-Item Double Entry Lines
    const [lines, setLines] = useState([
        { partyId: '', projectResourceId: '', direction: 'OUT', qty: '', uomId: '', role: 'OWNER' },
        { partyId: '', projectResourceId: '', direction: 'IN', qty: '', uomId: '', role: 'OWNER' }
    ]);

    const handleOpenModal = () => {
        setTxnType('SUPPLY_ASSIGN');
        setTxnRemarks('');
        setLines([
            { partyId: '', projectResourceId: '', direction: 'OUT', qty: '', uomId: '', role: 'OWNER' },
            { partyId: '', projectResourceId: '', direction: 'IN', qty: '', uomId: '', role: 'OWNER' }
        ]);
        setShowModal(true);
    };

    const handleAddLine = () => {
        setLines(prev => [
            ...prev,
            { partyId: '', projectResourceId: '', direction: 'IN', qty: '', uomId: '', role: 'OWNER' }
        ]);
    };

    const handleRemoveLine = (index) => {
        if (lines.length <= 2) {
            toast.warning('A valid double-entry transaction requires at least 2 lines.');
            return;
        }
        setLines(prev => prev.filter((_, i) => i !== index));
    };

    const handleLineChange = (index, field, value) => {
        setLines(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };

            // Auto-fill Unit/UOM when project resource selected
            if (field === 'projectResourceId') {
                const res = projectResources.find(r => String(r.project_resource_id) === String(value));
                if (res && res.base_unit_code) {
                    const matchUnit = masterUnits.find(u => {
                        const unitCode = String(u.code || u.symbol || u.name || '').toLowerCase();
                        return unitCode === String(res.base_unit_code).toLowerCase();
                    });
                    if (matchUnit) {
                        next[index].uomId = String(matchUnit.id);
                    }
                }
            }
            return next;
        });
    };

    const getDerivedUnitsForResource = (resId) => {
        if (!resId) return masterUnits;
        const res = projectResources.find(r => String(r.project_resource_id) === String(resId));
        if (!res) return masterUnits;
        return masterUnits;
    };

    // Live Per-Resource Zero-Sum Validation
    const resourceTallies = useMemo(() => {
        const tallies = {};
        lines.forEach(l => {
            if (!l.projectResourceId) return;
            const resId = String(l.projectResourceId);
            const num = parseFloat(l.qty) || 0;
            const signed = l.direction === 'OUT' ? -num : num;
            tallies[resId] = (tallies[resId] || 0) + signed;
        });
        return tallies;
    }, [lines]);

    const hasUnbalancedResources = useMemo(() => {
        const activeResIds = Object.keys(resourceTallies);
        if (activeResIds.length === 0) return true;
        return activeResIds.some(resId => Math.abs(resourceTallies[resId]) > 1e-6);
    }, [resourceTallies]);

    // Live Stock Deficit Verification
    const stockDeficits = useMemo(() => {
        const deficits = [];
        lines.forEach((l, idx) => {
            if (l.direction === 'OUT' && l.partyId && l.projectResourceId) {
                const requested = parseFloat(l.qty) || 0;
                const info = getStockAvailability ? getStockAvailability(l.partyId, l.projectResourceId) : { available: Infinity, isSupplier: false };
                if (!info.isSupplier && requested > info.available) {
                    deficits.push({
                        lineIdx: idx + 1,
                        partyName: getPartyName ? getPartyName(l.partyId) : l.partyId,
                        resName: getResourceLabel ? getResourceLabel(l.projectResourceId) : l.projectResourceId,
                        available: info.available,
                        requested
                    });
                }
            }
        });
        return deficits;
    }, [lines, getStockAvailability, getPartyName, getResourceLabel]);

    const hasStockDeficit = stockDeficits.length > 0;

    const isFormValid = useMemo(() => {
        if (!lines || lines.length < 2) return false;
        const allFilled = lines.every(l =>
            l.partyId &&
            l.projectResourceId &&
            parseFloat(l.qty) > 0
        );
        return allFilled && !hasUnbalancedResources && !hasStockDeficit;
    }, [lines, hasUnbalancedResources, hasStockDeficit]);

    const handleSubmitTransaction = async (e) => {
        e.preventDefault();
        if (!isFormValid) {
            if (hasStockDeficit) {
                toast.error('Cannot submit: One or more outflow parties do not have sufficient stock.');
            } else if (hasUnbalancedResources) {
                toast.error('Double-entry imbalance: All material quantities must balance to 0.');
            } else {
                toast.error('Please complete all line fields with valid quantities.');
            }
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                org_id: orgId,
                project_id: projectId,
                txn_type: txnType,
                txn_date: new Date(),
                status: 'CONFIRMED',
                remarks: txnRemarks || `Transfer (${lines.length} lines)`,
                lines: lines.map(l => {
                    const num = Math.abs(parseFloat(l.qty));
                    const signed = l.direction === 'OUT' ? -num : num;
                    return {
                        party_id: parseInt(l.partyId, 10),
                        project_resource_id: parseInt(l.projectResourceId, 10),
                        signed_qty: signed,
                        uom_id: l.uomId ? parseInt(l.uomId, 10) : null,
                        role: l.role || (l.direction === 'OUT' ? 'SENDER' : 'RECEIVER')
                    };
                })
            };

            await ledgerApi.createTransaction(payload);
            toast.success('Resource transaction recorded successfully!');
            setShowModal(false);
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Transaction failed');
        } finally {
            setSubmitting(false);
        }
    };

    // ExcelGrid Data & Columns
    const gridData = useMemo(() => {
        return transactions.map(txn => {
            const fromLine = txn.lines?.find(l => Number(l.signed_qty) < 0);
            const toLine = txn.lines?.find(l => Number(l.signed_qty) > 0);
            const qtyVal = Math.abs(Number(fromLine?.signed_qty || toLine?.signed_qty || 0));
            const resId = fromLine?.project_resource_id || toLine?.project_resource_id;
            const resLabel = getResourceLabel ? getResourceLabel(resId) : resId;
            const fromName = fromLine && getPartyName ? getPartyName(fromLine.party_id) : '—';
            const toName = toLine && getPartyName ? getPartyName(toLine.party_id) : '—';

            return {
                id: txn.id,
                txn_type: txn.txn_type || 'TRANSFER_PARTY',
                txn_date: txn.txn_date ? String(txn.txn_date).split('T')[0] : '',
                from_party: fromName,
                to_party: toName,
                material: resLabel,
                qty: qtyVal || 0,
                status: txn.status || 'CONFIRMED',
                remarks: txn.remarks || '',
                rawTxn: txn
            };
        });
    }, [transactions, projectParties, projectResources, getPartyName, getResourceLabel]);

    const gridColumns = useMemo(() => [
        {
            key: 'id',
            label: 'Txn ID',
            width: '95px',
            minWidth: '85px',
            renderCell: (val) => (
                <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono text-xs">
                    #{val}
                </span>
            )
        },
        {
            key: 'txn_type',
            label: 'Type',
            type: 'select',
            options: ['SUPPLY_ASSIGN', 'TRANSFER_PARTY'],
            width: '155px',
            minWidth: '140px',
            renderCell: (val) => (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${val === 'SUPPLY_ASSIGN'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    }`}>
                    {val}
                </span>
            )
        },
        {
            key: 'txn_date',
            label: 'Date',
            width: '115px',
            minWidth: '100px',
            renderCell: (val) => (
                <span className="text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
                    {formatDate(val)}
                </span>
            )
        },
        {
            key: 'from_party',
            label: 'From (Source)',
            width: '210px',
            minWidth: '170px',
            renderCell: (val) => (
                <span className="font-medium text-rose-700 dark:text-rose-400 truncate block text-xs" title={val}>
                    {val}
                </span>
            )
        },
        {
            key: 'material',
            label: 'Material / Resource',
            width: '240px',
            minWidth: '190px',
            renderCell: (val) => (
                <span className="font-semibold text-gray-900 dark:text-white truncate block text-xs" title={val}>
                    {val}
                </span>
            )
        },
        {
            key: 'qty',
            label: 'Quantity',
            width: '100px',
            minWidth: '85px',
            align: 'right',
            renderCell: (val) => (
                <span className="font-mono font-bold text-xs text-gray-900 dark:text-white">
                    {Number(val).toLocaleString()}
                </span>
            )
        },
        {
            key: 'to_party',
            label: 'To (Destination)',
            width: '210px',
            minWidth: '170px',
            renderCell: (val) => (
                <span className="font-medium text-emerald-700 dark:text-emerald-400 truncate block text-xs" title={val}>
                    {val}
                </span>
            )
        },
        {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: ['CONFIRMED', 'DRAFT', 'CANCELLED'],
            width: '115px',
            minWidth: '100px',
            renderCell: (val) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    {val || 'CONFIRMED'}
                </span>
            )
        },
        {
            key: 'remarks',
            label: 'Remarks / Notes',
            width: '240px',
            minWidth: '160px',
            renderCell: (val) => (
                <span className="text-gray-500 dark:text-gray-400 italic truncate block text-xs" title={val}>
                    {val || '—'}
                </span>
            )
        }
    ], []);

    return (
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden">
            <ExcelGrid
                data={gridData}
                columns={gridColumns}
                primaryKey="id"
                entityName="Transactions"
                canWrite={canWrite || isAdmin}
                isLoading={loading}
                onRefresh={onRefresh}
                onViewRow={(row) => setViewingTxn(row.rawTxn || row)}
                emptyMessage="No transactions found in database"
                initialPageSize={50}
                customActions={
                    (canWrite || isAdmin) && (
                        <button
                            type="button"
                            onClick={handleOpenModal}
                            disabled={projectParties.length < 2}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                            <Plus size={13} className="stroke-[3]" />
                            <span>New Transaction</span>
                        </button>
                    )
                }
            />

            {/* DYNAMIC MULTI-PARTY & MULTI-ITEM TRANSACTION MODAL */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/70 dark:bg-gray-900/50 shrink-0">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                                    New Resource Transaction (Stock Verified)
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Suppliers have unlimited supply capacity · Contractors can only transfer within available stock balance.
                                </p>
                            </div>
                            <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-1 rounded-lg cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Form Body */}
                        <form onSubmit={handleSubmitTransaction} className="p-5 space-y-5 overflow-y-auto flex-1">
                            {/* Txn Type & Header Remarks */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Transaction Category</label>
                                    <CustomSelect
                                        value={txnType}
                                        onChange={(e) => setTxnType(e.target.value)}
                                        options={[
                                            { label: 'SUPPLY_ASSIGN (Supplier/PMC → Contractor)', value: 'SUPPLY_ASSIGN' },
                                            { label: 'TRANSFER_PARTY (Inter-Contractor)', value: 'TRANSFER_PARTY' }
                                        ]}
                                        buttonClassName="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-bold text-gray-900 dark:text-white shadow-2xs hover:border-blue-500/40 text-left"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Transaction Notes / Explanation</label>
                                    <input
                                        type="text"
                                        value={txnRemarks}
                                        onChange={(e) => setTxnRemarks(e.target.value)}
                                        placeholder="Add business context or reason for transfer..."
                                        className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* Dynamic Double-Entry Lines Builder */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                        <Layers className="w-4 h-4 text-blue-500" />
                                        Double-Entry Transaction Lines ({lines.length} lines)
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={handleAddLine}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add Line
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {lines.map((line, idx) => {
                                        const derivedUnits = getDerivedUnitsForResource(line.projectResourceId);
                                        const stockInfo = getStockAvailability ? getStockAvailability(line.partyId, line.projectResourceId) : { available: Infinity, isSupplier: false };
                                        const requestedVal = Math.abs(Number(line.qty) || 0);
                                        const isOutflowExceeded = line.direction === 'OUT' && !stockInfo.isSupplier && line.partyId && line.projectResourceId && requestedVal > stockInfo.available;

                                        return (
                                            <div key={idx} className={`p-3.5 rounded-xl border transition grid grid-cols-1 sm:grid-cols-12 gap-3 items-center ${isOutflowExceeded
                                                ? 'bg-rose-50/80 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800'
                                                : 'bg-gray-50/60 dark:bg-gray-900/40 border-gray-200 dark:border-gray-800'
                                                }`}>
                                                {/* Line Direction */}
                                                <div className="sm:col-span-2">
                                                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Direction</label>
                                                    <CustomSelect
                                                        value={line.direction}
                                                        onChange={(e) => handleLineChange(idx, 'direction', e.target.value)}
                                                        options={[
                                                            { label: 'OUT (- Sender)', value: 'OUT' },
                                                            { label: 'IN (+ Receiver)', value: 'IN' }
                                                        ]}
                                                        buttonClassName={`w-full flex items-center justify-between px-2 py-1.5 border rounded-lg text-xs font-bold text-left shadow-2xs ${line.direction === 'OUT'
                                                            ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
                                                            : 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                                                            }`}
                                                    />
                                                </div>

                                                {/* Party Select */}
                                                <div className="sm:col-span-3">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <label className="block text-[10px] font-semibold text-gray-500">Party</label>
                                                        {line.direction === 'OUT' && line.partyId && line.projectResourceId && (
                                                            <span className={`text-[9px] font-bold font-mono ${stockInfo.isSupplier
                                                                ? 'text-indigo-600 dark:text-indigo-400'
                                                                : (isOutflowExceeded ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'text-emerald-600 dark:text-emerald-400')
                                                                }`}>
                                                                {stockInfo.label}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <CustomSelect
                                                        value={line.partyId}
                                                        onChange={(e) => handleLineChange(idx, 'partyId', e.target.value)}
                                                        options={projectParties.map(v => ({
                                                            label: v.category ? `${v.name} (${v.category})` : v.name,
                                                            value: String(v.pv_id)
                                                        }))}
                                                        placeholder="Select Party"
                                                        buttonClassName="w-full flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white shadow-2xs hover:border-blue-500/40 text-left"
                                                    />
                                                </div>

                                                {/* Material / Resource Select */}
                                                <div className="sm:col-span-3">
                                                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Material / Item</label>
                                                    <CustomSelect
                                                        value={line.projectResourceId}
                                                        onChange={(e) => handleLineChange(idx, 'projectResourceId', e.target.value)}
                                                        options={projectResources.map(r => ({
                                                            label: `${r.name} (${r.base_unit_code || r.type || 'RES'})`,
                                                            value: String(r.project_resource_id)
                                                        }))}
                                                        placeholder="Select Material"
                                                        buttonClassName="w-full flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white shadow-2xs hover:border-blue-500/40 text-left"
                                                    />
                                                </div>

                                                {/* Quantity */}
                                                <div className="sm:col-span-2">
                                                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Quantity</label>
                                                    <input
                                                        type="number"
                                                        value={line.qty}
                                                        onChange={(e) => handleLineChange(idx, 'qty', e.target.value)}
                                                        required
                                                        min="0.0001"
                                                        step="any"
                                                        placeholder="0.00"
                                                        className={`w-full text-xs bg-white dark:bg-gray-800 border rounded-lg p-2 font-bold font-mono text-gray-900 dark:text-white ${isOutflowExceeded
                                                            ? 'border-rose-500 text-rose-600 focus:ring-rose-500'
                                                            : 'border-gray-300 dark:border-gray-700'
                                                            }`}
                                                    />
                                                </div>

                                                {/* Derived Unit / UOM Select */}
                                                <div className="sm:col-span-1">
                                                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Unit</label>
                                                    <CustomSelect
                                                        value={line.uomId}
                                                        onChange={(e) => handleLineChange(idx, 'uomId', e.target.value)}
                                                        options={derivedUnits.map(u => ({
                                                            label: u.code || u.symbol || String(u.id),
                                                            value: String(u.id)
                                                        }))}
                                                        placeholder="Unit"
                                                        buttonClassName="w-full flex items-center justify-between px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white font-mono shadow-2xs hover:border-blue-500/40 text-left"
                                                    />
                                                </div>

                                                {/* Remove Action */}
                                                <div className="sm:col-span-1 flex justify-end pt-3 sm:pt-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveLine(idx)}
                                                        className="p-1.5 text-gray-400 hover:text-rose-600 transition rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                                        title="Remove Line"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Stock Deficit Warning Banner */}
                            {hasStockDeficit && (
                                <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                                    <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                                    <div>
                                        <span className="font-bold">Insufficient Contractor Stock:</span>{' '}
                                        {stockDeficits.map((d, i) => (
                                            <span key={i}>
                                                <strong>{d.partyName}</strong> has only <strong>{d.available.toFixed(2)}</strong> of <em>{d.resName}</em> available (requested: {d.requested}).
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Live Per-Resource Zero-Sum Verifier */}
                            <div className={`p-4 rounded-xl border transition text-xs ${hasUnbalancedResources || hasStockDeficit
                                ? 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800'
                                : 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
                                }`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold flex items-center gap-1.5 text-xs">
                                        {hasUnbalancedResources || hasStockDeficit ? (
                                            <>
                                                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                                <span className="text-rose-800 dark:text-rose-300">Untallied or Insufficient Stock: Transaction Cannot Be Submitted</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                <span className="text-emerald-800 dark:text-emerald-300">Transaction Fully Balanced & Verified (All Materials Tally = 0.00)</span>
                                            </>
                                        )}
                                    </span>
                                </div>

                                <div className="space-y-1 font-mono text-[11px] pt-1">
                                    {Object.entries(resourceTallies).map(([resId, sum]) => {
                                        const resName = getResourceLabel ? getResourceLabel(resId) : resId;
                                        const isBalanced = Math.abs(sum) < 1e-6;
                                        return (
                                            <div key={resId} className="flex items-center justify-between border-t border-gray-200/50 dark:border-gray-800/50 pt-1">
                                                <span>Material: {resName}</span>
                                                <span className={`font-bold ${isBalanced ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                                                    SUM = {sum > 0 ? `+${sum.toFixed(2)}` : sum.toFixed(2)} {isBalanced ? '✓ (Balanced)' : '✗ (Needs Counterparty Line)'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Form Action Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-800 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || !isFormValid}
                                    className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {submitting ? 'Confirming...' : 'Confirm & Commit Transaction'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TRANSACTION DETAILS MODAL */}
            {viewingTxn && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/70 dark:bg-gray-900/50">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                    Transaction #{viewingTxn.id} Details
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {formatDate(viewingTxn.txn_date)} • {viewingTxn.txn_type} • <span className="font-semibold text-emerald-600 dark:text-emerald-400">{viewingTxn.status}</span>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewingTxn(null)}
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            {viewingTxn.remarks && (
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-800 text-xs text-gray-700 dark:text-gray-300">
                                    <span className="font-semibold text-gray-500 block mb-0.5 text-[10px] uppercase">Remarks / Purpose</span>
                                    {viewingTxn.remarks}
                                </div>
                            )}

                            <div>
                                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Double-Entry Ledger Lines
                                </h4>
                                <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-800">
                                            <tr>
                                                <th className="p-3">Party Name</th>
                                                <th className="p-3">Material / Item</th>
                                                <th className="p-3">Role</th>
                                                <th className="p-3 text-right">Signed Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {viewingTxn.lines?.map((line, i) => {
                                                const signedQty = Number(line?.signed_qty || 0);
                                                return (
                                                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800/60">
                                                        <td className="p-3 font-semibold text-gray-900 dark:text-white">
                                                            {getPartyName ? getPartyName(line.party_id) : line.party_id}
                                                        </td>
                                                        <td className="p-3 font-medium text-gray-700 dark:text-gray-300">
                                                            {getResourceLabel ? getResourceLabel(line.project_resource_id) : line.project_resource_id}
                                                        </td>
                                                        <td className="p-3 text-gray-500 font-mono text-[11px]">
                                                            {line.role || 'Transfer Line'}
                                                        </td>
                                                        <td className={`p-3 text-right font-mono font-bold ${signedQty < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                                                            }`}>
                                                            {signedQty > 0 ? `+${signedQty}` : signedQty}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setViewingTxn(null)}
                                className="px-4 py-1.5 text-xs font-semibold bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg transition cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionHistoryTab;
