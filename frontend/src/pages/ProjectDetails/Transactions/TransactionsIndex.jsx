import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    RefreshCw,
    Plus
} from 'lucide-react';
import { ledgerApi } from '../../../services/ledgerApi';
import { projectApi } from '../../../services/projectApi';
import { unitApi } from '../../../services/unitApi';
import TransactionHistoryTab from './TransactionHistoryTab';
import EntryRegisterTab from './EntryRegisterTab';
import PartyStockAndStatementsTab from './PartyStockAndStatementsTab';

export const TransactionsIndex = ({ project, canWrite, isAdmin }) => {
    const projectId = project?.id;

    // Sub-Tabs: 'transactions' (Transactions History), 'excel-grid' (Entry Register), 'party-hub' (Party Stock & Statements)
    const [subTab, setSubTab] = useState('transactions');

    // Shared Data states
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Project-scoped resource library & parties
    const [projectResources, setProjectResources] = useState([]);
    const [masterUnits, setMasterUnits] = useState([]);
    const [projectParties, setProjectParties] = useState([]);
    const [stockMap, setStockMap] = useState({});

    // ─── Loaders ──────────────────────────────────────────────────────────────

    const loadMasterLibraries = useCallback(async () => {
        try {
            const [projectResourceData, unitData] = await Promise.all([
                projectApi.listProjectResources(projectId).catch(() => ({ resources: [] })),
                unitApi.getUnits().catch(() => [])
            ]);
            const projectResourceArr = Array.isArray(projectResourceData?.resources)
                ? projectResourceData.resources
                : (Array.isArray(projectResourceData) ? projectResourceData : []);
            const resArr = projectResourceArr.map(resource => ({
                ...resource,
                project_resource_id: resource.project_resource_id ?? resource.resource_id ?? resource.id
            }));
            const unitArr = Array.isArray(unitData?.data) ? unitData.data : (Array.isArray(unitData?.units) ? unitData.units : (Array.isArray(unitData) ? unitData : []));
            setProjectResources(resArr);
            setMasterUnits(unitArr);
        } catch (e) {
            console.warn('Failed to load master libraries:', e);
        }
    }, [projectId]);

    const loadProjectParties = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await ledgerApi.getProjectParties(projectId);
            const parties = Array.isArray(res?.data) ? res.data : [];
            setProjectParties(parties);
        } catch (e) {
            console.warn('Failed to load project parties:', e);
        }
    }, [projectId]);

    const loadStockMap = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await ledgerApi.getProjectStock(projectId);
            const positions = Array.isArray(res?.data) ? res.data : [];
            const map = {};
            positions.forEach(p => {
                const key = `${p.party_id}_${p.project_resource_id}`;
                map[key] = parseFloat(p.net_qty) || 0;
            });
            setStockMap(map);
        } catch (e) {
            console.warn('Failed to load live stock map:', e);
        }
    }, [projectId]);

    const loadTransactions = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const res = await ledgerApi.listTransactions({
                project_id: projectId,
                limit: 1000
            });
            const txns = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            setTransactions(txns);
            loadStockMap();
        } catch (err) {
            console.warn('Failed to load transactions:', err);
        } finally {
            setLoading(false);
        }
    }, [projectId, loadStockMap]);

    useEffect(() => {
        if (projectId) {
            loadMasterLibraries();
            loadProjectParties();
            loadTransactions();
        }
    }, [projectId, loadMasterLibraries, loadProjectParties, loadTransactions]);

    // Helpers
    const getPartyName = useCallback((partyId) => {
        if (!partyId) return '—';
        const p = projectParties.find(pv => String(pv.pv_id) === String(partyId));
        return p?.name || `Party #${partyId}`;
    }, [projectParties]);

    const getResourceLabel = useCallback((resId) => {
        if (!resId) return '—';
        const res = projectResources.find(r => String(r.project_resource_id) === String(resId));
        return res?.name || `Material #${resId}`;
    }, [projectResources]);

    const getStockAvailability = useCallback((partyId, resId) => {
        if (!partyId || !resId) return { available: 0, isSupplier: false, label: '-' };
        const party = projectParties.find(pv => String(pv.pv_id) === String(partyId));
        const category = (party?.category || '').toLowerCase();
        const isSupplier = category.includes('supplier');

        if (isSupplier) {
            return { available: Infinity, isSupplier: true, label: 'Unlimited (Supplier)' };
        }

        const key = `${partyId}_${resId}`;
        const available = stockMap[key] || 0;
        return { available, isSupplier: false, label: `${available.toFixed(2)} in stock` };
    }, [projectParties, stockMap]);

    return (
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100">
            {/* Project party count warning */}
            {projectParties.length === 0 && (
                <div className="mx-3 mt-2 px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 font-medium shrink-0">
                    ⚠️ No active parties found for this project. Add parties in <strong>Project Settings → Parties</strong> to enable transactions.
                </div>
            )}

            {/* Sub-Tab Navigation */}
            <div className="px-3 py-1.5 border-b border-gray-200 dark:border-white/5 flex items-center justify-between overflow-x-auto shrink-0 gap-3 bg-white dark:bg-[#0d1117] select-none">
                <div className="flex items-center gap-1">
                    {[
                        { id: 'transactions', label: 'Transactions History' },
                        { id: 'excel-grid', label: 'Entry Register' },
                        { id: 'party-hub', label: 'Party Stock & Statements' }
                    ].map(tab => {
                        const isActive = subTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setSubTab(tab.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer ${isActive
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => { loadTransactions(); loadProjectParties(); }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#161b22] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition cursor-pointer"
                        title="Refresh Data"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Refresh
                    </button>
                </div>
            </div>

            {/* TAB 1: TRANSACTIONS HISTORY */}
            {subTab === 'transactions' && (
                <TransactionHistoryTab
                    project={project}
                    canWrite={canWrite}
                    isAdmin={isAdmin}
                    transactions={transactions}
                    loading={loading}
                    projectParties={projectParties}
                    projectResources={projectResources}
                    masterUnits={masterUnits}
                    stockMap={stockMap}
                    onRefresh={loadTransactions}
                    getPartyName={getPartyName}
                    getResourceLabel={getResourceLabel}
                    getStockAvailability={getStockAvailability}
                />
            )}

            {/* TAB 2: ENTRY REGISTER */}
            {subTab === 'excel-grid' && (
                <EntryRegisterTab
                    project={project}
                    canWrite={canWrite || isAdmin}
                    projectParties={projectParties}
                    projectResources={projectResources}
                    masterUnits={masterUnits}
                    stockMap={stockMap}
                    onSuccess={() => {
                        loadTransactions();
                    }}
                />
            )}

            {/* TAB 3: PARTY STOCK & STATEMENTS */}
            {subTab === 'party-hub' && (
                <PartyStockAndStatementsTab
                    project={project}
                    projectParties={projectParties}
                    projectResources={projectResources}
                    getPartyName={getPartyName}
                    getResourceLabel={getResourceLabel}
                    transactions={transactions}
                />
            )}
        </div>
    );
};

export default TransactionsIndex;
