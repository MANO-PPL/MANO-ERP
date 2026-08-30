import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    RefreshCw,
    Building2,
    FileText,
    X,
    Eye
} from 'lucide-react';
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

export const PartyStockAndStatementsTab = ({
    project,
    projectParties = [],
    projectResources = [],
    getPartyName,
    getResourceLabel,
    transactions = []
}) => {
    const projectId = project?.id;

    const [selectedPartyId, setSelectedPartyId] = useState(() => {
        return projectParties.length > 0 ? String(projectParties[0].pv_id) : '';
    });
    const [partyPositions, setPartyPositions] = useState([]);
    const [partyLedgerLines, setPartyLedgerLines] = useState([]);
    const [partyLoading, setPartyLoading] = useState(false);
    const [viewingTxn, setViewingTxn] = useState(null);

    // Default select first party if not selected
    useEffect(() => {
        if (!selectedPartyId && projectParties.length > 0) {
            setSelectedPartyId(String(projectParties[0].pv_id));
        }
    }, [projectParties, selectedPartyId]);

    const loadPartyHubData = useCallback(async (partyId) => {
        if (!projectId || !partyId) {
            setPartyPositions([]);
            setPartyLedgerLines([]);
            return;
        }
        setPartyLoading(true);
        try {
            const [posRes, stmtRes] = await Promise.all([
                ledgerApi.getPartyPositions(projectId, partyId),
                ledgerApi.getPartyStatement(projectId, partyId)
            ]);
            setPartyPositions(Array.isArray(posRes?.data) ? posRes.data : []);
            setPartyLedgerLines(Array.isArray(stmtRes?.data) ? stmtRes.data : []);
        } catch (e) {
            console.warn('Failed to load party hub details:', e);
        } finally {
            setPartyLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (selectedPartyId) {
            loadPartyHubData(selectedPartyId);
        }
    }, [selectedPartyId, loadPartyHubData]);

    // Party Passbook Grid Data
    const partyPassbookData = useMemo(() => {
        return partyLedgerLines.map(line => {
            const signedQty = Number(line?.signed_qty || 0);
            const resId = line.project_resource_id;
            const resLabel = getResourceLabel ? getResourceLabel(resId) : resId;
            const dateStr = line.txn_date ? String(line.txn_date).split('T')[0] : '';
            const txnType = line.txn_type || 'SUPPLY_ASSIGN';

            return {
                id: line.id || `line_${line.transaction_id}_${Math.random().toString(36).substr(2, 4)}`,
                date: dateStr,
                txn_type: txnType,
                transaction_id: line.transaction_id ? `#${line.transaction_id}` : '—',
                txn_num: line.transaction_id,
                material: resLabel,
                signed_qty: signedQty,
                impact: signedQty > 0 ? `+${signedQty}` : String(signedQty),
                running_balance: line.running_balance,
                remarks: line.remarks || '',
                rawLine: line
            };
        });
    }, [partyLedgerLines, getResourceLabel]);

    const partyPassbookColumns = useMemo(() => [
        {
            key: 'date',
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
            key: 'txn_type',
            label: 'Type',
            type: 'select',
            options: ['SUPPLY_ASSIGN', 'TRANSFER_PARTY'],
            width: '150px',
            minWidth: '135px',
            renderCell: (val) => (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    val === 'SUPPLY_ASSIGN'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                }`}>
                    {val}
                </span>
            )
        },
        {
            key: 'transaction_id',
            label: 'Txn #',
            width: '100px',
            minWidth: '85px',
            renderCell: (val) => (
                <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono text-xs cursor-pointer hover:underline">
                    {val}
                </span>
            )
        },
        {
            key: 'material',
            label: 'Material / Resource',
            width: '250px',
            minWidth: '200px',
            renderCell: (val) => (
                <span className="font-semibold text-gray-900 dark:text-white truncate block text-xs" title={val}>
                    {val}
                </span>
            )
        },
        {
            key: 'impact',
            label: 'Impact',
            width: '120px',
            minWidth: '100px',
            align: 'right',
            renderCell: (val, row) => {
                const num = Number(row?.signed_qty || 0);
                return (
                    <span className={`font-mono font-bold text-xs ${
                        num < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                        {num > 0 ? `+${num}` : num}
                    </span>
                );
            }
        },
        {
            key: 'running_balance',
            label: 'Balance',
            width: '120px',
            minWidth: '100px',
            align: 'right',
            renderCell: (val) => (
                <span className="font-mono font-extrabold text-xs text-gray-900 dark:text-white bg-blue-50/60 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800/40">
                    {val ?? 0}
                </span>
            )
        },
        {
            key: 'remarks',
            label: 'Remarks / Notes',
            width: '260px',
            minWidth: '180px',
            renderCell: (val) => (
                <span className="text-gray-500 dark:text-gray-400 italic truncate block text-xs" title={val}>
                    {val || '—'}
                </span>
            )
        }
    ], []);

    const handleViewPassbookRow = async (row) => {
        const txnId = row.rawLine?.transaction_id || row.txn_num;
        if (txnId) {
            const found = transactions.find(t => String(t.id) === String(txnId));
            if (found) {
                setViewingTxn(found);
                return;
            }
            try {
                const res = await ledgerApi.getTransaction(txnId);
                if (res?.data) {
                    setViewingTxn(res.data);
                    return;
                }
            } catch (e) {
                console.warn('Could not fetch full transaction:', e);
            }
        }
        setViewingTxn({
            id: txnId || row.id,
            txn_date: row.date,
            txn_type: row.txn_type,
            status: 'CONFIRMED',
            remarks: row.remarks,
            lines: [
                {
                    party_id: selectedPartyId,
                    project_resource_id: row.rawLine?.project_resource_id,
                    signed_qty: row.signed_qty,
                    role: 'Passbook Record'
                }
            ]
        });
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden">
            {/* Top Toolbar / Party Selector */}
            <div className="px-3 py-2 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-[#161b22]/30 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Select Party:</span>
                    <CustomSelect
                        value={selectedPartyId}
                        onChange={(e) => setSelectedPartyId(e.target.value)}
                        options={projectParties.map(v => ({
                            label: v.category ? `${v.name} (${v.category})` : v.name,
                            value: String(v.pv_id)
                        }))}
                        placeholder="Select Party"
                        buttonClassName="w-64 flex items-center justify-between px-3 py-1.5 bg-white dark:bg-[#161b22] border border-gray-300 dark:border-white/10 rounded-lg text-xs font-bold text-gray-900 dark:text-white shadow-2xs hover:border-blue-500/40 text-left"
                    />
                    <button
                        type="button"
                        onClick={() => loadPartyHubData(selectedPartyId)}
                        disabled={partyLoading || !selectedPartyId}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#161b22] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition cursor-pointer disabled:opacity-50"
                        title="Refresh Party Statement"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${partyLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {selectedPartyId && (
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Holding for <strong className="text-gray-800 dark:text-gray-200">{getPartyName ? getPartyName(selectedPartyId) : selectedPartyId}</strong>
                    </span>
                )}
            </div>

            {/* Net Stock Positions Banner */}
            <div className="px-3 py-2 border-b border-gray-200 dark:border-white/5 bg-gray-50/30 dark:bg-[#161b22]/20 shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Net Stock Balance
                    </h3>
                </div>

                {!selectedPartyId ? (
                    <div className="py-2.5 px-3 rounded-lg border border-gray-200 dark:border-white/5 bg-white dark:bg-[#161b22] text-xs text-gray-400 italic">
                        Select a party from the dropdown above to view inventory balances and ledger statement.
                    </div>
                ) : partyLoading ? (
                    <div className="py-3 text-xs text-gray-500 flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Loading stock balances...
                    </div>
                ) : partyPositions.length === 0 ? (
                    <div className="py-2.5 px-3 rounded-lg border border-gray-200 dark:border-white/5 bg-white dark:bg-[#161b22] text-xs text-gray-500 italic">
                        No material holdings recorded yet for this party.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {partyPositions.map((pos, idx) => {
                            const netQty = Number(pos?.net_qty || 0);
                            return (
                                <div
                                    key={idx}
                                    className="p-2.5 px-3 rounded-lg border border-gray-200 dark:border-white/5 bg-white dark:bg-[#161b22] shadow-2xs flex items-center justify-between hover:border-blue-500/40 transition"
                                >
                                    <div className="min-w-0 pr-2">
                                        <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                            {getResourceLabel ? getResourceLabel(pos?.project_resource_id) : pos?.project_resource_id}
                                        </div>
                                        <div className="text-[10px] font-medium text-gray-400 dark:text-gray-400 mt-0.5">
                                            Net Inventory Balance
                                        </div>
                                    </div>
                                    <div
                                        className={`px-2.5 py-0.5 rounded-md border font-mono text-xs font-extrabold shrink-0 ${
                                            netQty < 0
                                                ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
                                                : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                                        }`}
                                    >
                                        {netQty > 0 ? `+${netQty}` : netQty}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Centralized ExcelGrid Component for Passbook */}
            <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden">
                <ExcelGrid
                    data={partyPassbookData}
                    columns={partyPassbookColumns}
                    primaryKey="id"
                    entityName="Passbook Entries"
                    canWrite={false}
                    isLoading={partyLoading}
                    onRefresh={() => loadPartyHubData(selectedPartyId)}
                    onViewRow={handleViewPassbookRow}
                    emptyMessage={
                        !selectedPartyId
                            ? 'Select a party from the dropdown above to view passbook activity'
                            : 'No passbook activity recorded for this party'
                    }
                    initialPageSize={50}
                />
            </div>

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

export default PartyStockAndStatementsTab;
