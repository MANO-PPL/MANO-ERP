import React, { useState, useEffect } from 'react';
import {
    ArrowRightLeft,
    Plus,
    CheckCircle2,
    Package,
    Search,
    Filter,
    FileText,
    RefreshCw,
    X,
    ChevronDown,
    ChevronUp,
    Building2,
    Layers,
    UserCheck,
    ArrowRight,
    Trash2,
    AlertCircle,
    ShieldAlert
} from 'lucide-react';
import { toast } from 'react-toastify';
import { ledgerApi } from '../../../services/ledgerApi';
import { projectApi } from '../../../services/projectApi';
import { unitApi } from '../../../services/unitApi';

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

const TransactionsIndex = ({ project, canWrite, isAdmin }) => {
    const projectId = project?.id;
    const orgId     = project?.org_id || 1;

    // Streamlined 2 Sub-Tabs
    const [subTab, setSubTab] = useState('transactions');

    // Data states
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedTxn, setExpandedTxn] = useState(null);

    // Project-scoped resource library
    const [projectResources, setProjectResources] = useState([]);
    const [masterUnits, setMasterUnits] = useState([]);
    // Project Parties: [{pv_id, project_id, crm_contact_id, name, category, mobile, email}]
    const [projectParties, setProjectParties] = useState([]);

    // Live Stock Map for Fast Frontend Lookups: { "pvId_resId": netQty }
    const [stockMap, setStockMap] = useState({});

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [txnType, setTxnType] = useState('SUPPLY_ASSIGN');
    const [txnRemarks, setTxnRemarks] = useState('');

    // Dynamic Multi-Party & Multi-Item Double Entry Lines
    const [lines, setLines] = useState([
        { partyId: '', projectResourceId: '', direction: 'OUT', qty: '', uomId: '', role: 'OWNER' },
        { partyId: '', projectResourceId: '', direction: 'IN',  qty: '', uomId: '', role: 'OWNER' }
    ]);

    // Party Hub
    const [selectedPartyId, setSelectedPartyId] = useState('');
    const [partyPositions, setPartyPositions] = useState([]);
    const [partyLedgerLines, setPartyLedgerLines] = useState([]);
    const [partyLoading, setPartyLoading] = useState(false);

    // ─── Loaders ──────────────────────────────────────────────────────────────

    const loadMasterLibraries = async () => {
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
    };

    const loadProjectParties = async () => {
        if (!projectId) return;
        try {
            const res = await ledgerApi.getProjectParties(projectId);
            const parties = Array.isArray(res?.data) ? res.data : [];
            setProjectParties(parties);
            if (parties.length >= 1 && !selectedPartyId) {
                setSelectedPartyId(String(parties[0].pv_id));
            }
        } catch (e) {
            console.warn('Failed to load project parties:', e);
        }
    };

    const loadTransactions = async () => {
        setLoading(true);
        try {
            const params = {};
            if (projectId)              params.project_id = projectId;
            if (typeFilter !== 'ALL')   params.txn_type   = typeFilter;
            if (statusFilter !== 'ALL') params.status     = statusFilter;

            const res = await ledgerApi.getTransactions(params);
            const txns = Array.isArray(res?.data) ? res.data : [];
            setTransactions(txns);

            // Rebuild live stock position map from confirmed transactions
            rebuildStockMap(txns);
        } catch (err) {
            console.error('Failed to load transactions:', err);
            toast.error('Failed to fetch transactions');
        } finally {
            setLoading(false);
        }
    };

    // Rebuilds live stock map: { "partyId_projectResourceId": netQty }
    const rebuildStockMap = (txnsList) => {
        const map = {};
        txnsList.forEach(t => {
            if (t.status !== 'CONFIRMED') return;
            (t.lines || []).forEach(l => {
                const key = `${l.party_id}_${l.project_resource_id}`;
                map[key] = (map[key] || 0) + Number(l.signed_qty || 0);
            });
        });
        setStockMap(map);
    };

    const loadPartyHubData = async (pvId = selectedPartyId) => {
        if (!pvId) return;
        setPartyLoading(true);
        try {
            const [posRes, ledgerRes] = await Promise.all([
                ledgerApi.getPartyResourcePosition(pvId, null, projectId, orgId).catch(() => ({ data: [] })),
                ledgerApi.getPartyLedger(pvId, projectId, orgId).catch(() => ({ data: [] }))
            ]);
            setPartyPositions(Array.isArray(posRes?.data) ? posRes.data : (posRes?.data ? [posRes.data] : []));
            setPartyLedgerLines(Array.isArray(ledgerRes?.data) ? ledgerRes.data : []);
        } catch (err) {
            console.error('Failed to fetch party hub data:', err);
            toast.error('Failed to load party stock & statement');
        } finally {
            setPartyLoading(false);
        }
    };

    useEffect(() => {
        loadTransactions();
        loadMasterLibraries();
        loadProjectParties();
    }, [projectId, typeFilter, statusFilter]);

    useEffect(() => {
        if (subTab === 'party-hub' && selectedPartyId) {
            loadPartyHubData(selectedPartyId);
        }
    }, [subTab, selectedPartyId]);

    // Initialize modal default lines when opened
    const handleOpenModal = () => {
        const v1 = projectParties.length > 0 ? String(projectParties[0].pv_id) : '';
        const v2 = projectParties.length > 1 ? String(projectParties[1].pv_id) : v1;
        const r1 = projectResources.length > 0 ? String(projectResources[0].project_resource_id) : '';
        const u1 = getDefaultUnitId(r1);

        setLines([
            { partyId: v1, projectResourceId: r1, direction: 'OUT', qty: '100', uomId: u1, role: 'OWNER' },
            { partyId: v2, projectResourceId: r1, direction: 'IN',  qty: '100', uomId: u1, role: 'OWNER' }
        ]);
        setTxnRemarks('');
        setShowModal(true);
    };

    // ─── Helpers ──────────────────────────────────────────────────────────────

    // Resolve party object from the project-party link ID.
    const getPartyObj = (pvId) => {
        if (!pvId && pvId !== 0) return null;
        return projectParties.find(party => String(party.pv_id) === String(pvId)) || null;
    };

    // Resolve party name from the project-party link ID.
    const getPartyName = (pvId) => {
        const party = getPartyObj(pvId);
        return party ? (party.name || `Party #${pvId}`) : `Party #${pvId}`;
    };

    // Resolve resource object from ID
    const getResourceObj = (projectResourceId) => {
        if (!projectResourceId && projectResourceId !== 0) return null;
        return projectResources.find(r => String(r.project_resource_id) === String(projectResourceId)) || null;
    };

    // Resolve resource label from master library
    const getResourceLabel = (projectResourceId) => {
        const r = getResourceObj(projectResourceId);
        return r ? `${r.name}${r.code ? ` (${r.code})` : ''}` : `Project Resource #${projectResourceId}`;
    };

    // Derived Units/UOMs for a selected resource
    const getDerivedUnitsForResource = (projectResourceId) => {
        const resource = getResourceObj(projectResourceId);
        if (!resource) return masterUnits;

        const baseCode = (resource.base_unit_code || '').toLowerCase();
        if (!baseCode) return masterUnits;

        const matches = masterUnits.filter(u => {
            const unitValues = [u.id, u.code, u.symbol, u.name]
                .filter(Boolean)
                .map(value => String(value).toLowerCase());
            return unitValues.includes(baseCode);
        });

        return matches.length > 0 ? matches : masterUnits;
    };

    const getDefaultUnitId = (projectResourceId) => {
        const units = getDerivedUnitsForResource(projectResourceId);
        return units.length > 0 ? String(units[0].id) : '';
    };

    // Stock sufficiency checker for a given party and resource
    const getStockAvailability = (pvId, projectResourceId) => {
        const party = getPartyObj(pvId);
        const category = (party?.category || '').toLowerCase();
        const isSupplier = category.includes('supplier');

        if (isSupplier) {
            return { isSupplier: true, available: Infinity, label: 'Unlimited (Supplier)' };
        }

        const available = stockMap[`${pvId}_${projectResourceId}`] || 0;
        return { isSupplier: false, available, label: `${available.toFixed(2)} Available` };
    };

    // ─── Dynamic Line Operations ─────────────────────────────────────────────

    const handleLineChange = (index, field, value) => {
        setLines(prev => {
            const updated = [...prev];
            const cur = { ...updated[index], [field]: value };

            if (field === 'projectResourceId') {
                cur.uomId = getDefaultUnitId(value);
            }

            // Keep the initial double-entry pair usable when one direction is
            // changed manually instead of leaving an unbalanced +/+ or -/- pair.
            if (field === 'direction' && index < 2 && updated.length >= 2) {
                const pairedIndex = index === 0 ? 1 : 0;
                if (updated[pairedIndex]?.direction === value) {
                    updated[pairedIndex] = {
                        ...updated[pairedIndex],
                        direction: value === 'OUT' ? 'IN' : 'OUT'
                    };
                }
            }

            updated[index] = cur;
            return updated;
        });
    };

    const handleAddLine = () => {
        const v1 = projectParties.length > 0 ? String(projectParties[0].pv_id) : '';
        const r1 = projectResources.length > 0 ? String(projectResources[0].project_resource_id) : '';
        const u1 = getDefaultUnitId(r1);
        setLines(prev => [
            ...prev,
            { partyId: v1, projectResourceId: r1, direction: 'IN', qty: '', uomId: u1, role: 'OWNER' }
        ]);
    };

    const handleRemoveLine = (index) => {
        if (lines.length <= 2) {
            toast.warning('Transaction must have at least 2 lines for double-entry tally');
            return;
        }
        setLines(prev => prev.filter((_, i) => i !== index));
    };

    // ─── Real-Time Zero-Sum Tally & Stock Sufficiency Validation ──────────────

    const computeResourceTallies = () => {
        const tallies = {};
        lines.forEach(l => {
            if (!l.projectResourceId) return;
            const projectResourceId = String(l.projectResourceId);
            const val   = Number(l.qty) || 0;
            const signed = l.direction === 'OUT' ? -Math.abs(val) : Math.abs(val);
            tallies[projectResourceId] = (tallies[projectResourceId] || 0) + signed;
        });
        return tallies;
    };

    // Check if any non-supplier line requests more stock than available
    const checkStockDeficits = () => {
        const deficits = [];
        lines.forEach((l, idx) => {
            if (l.direction !== 'OUT' || !l.partyId || !l.projectResourceId || !l.qty) return;
            const stockInfo = getStockAvailability(l.partyId, l.projectResourceId);
            if (!stockInfo.isSupplier) {
                const requested = Math.abs(Number(l.qty) || 0);
                if (requested > stockInfo.available) {
                    deficits.push({
                        lineIndex: idx,
                        partyName: getPartyName(l.partyId),
                        resName:   getResourceLabel(l.projectResourceId),
                        available: stockInfo.available,
                        requested
                    });
                }
            }
        });
        return deficits;
    };

    const resourceTallies = computeResourceTallies();
    const hasUnbalancedResources = Object.values(resourceTallies).some(sum => Math.abs(sum) > 1e-6);
    const stockDeficits = checkStockDeficits();
    const hasStockDeficit = stockDeficits.length > 0;

    const isFormValid = lines.length >= 2 && 
        lines.every(l => l.partyId && l.projectResourceId && Number(l.qty) > 0) &&
        !hasUnbalancedResources && 
        !hasStockDeficit;

    // ─── Submit ───────────────────────────────────────────────────────────────

    const handleSubmitTransaction = async (e) => {
        e.preventDefault();
        if (hasUnbalancedResources) {
            toast.error('Cannot submit: Transaction lines do not tally to zero per resource');
            return;
        }
        if (hasStockDeficit) {
            toast.error(`Cannot submit: ${stockDeficits[0].partyName} has insufficient stock for ${stockDeficits[0].resName}`);
            return;
        }

        setSubmitting(true);
        try {
            const linesForPayload = lines.map(l => {
                const parsedUomId = Number(l.uomId);
                return {
                    party_id:    Number(l.partyId),
                    project_resource_id: Number(l.projectResourceId),
                    signed_qty:  l.direction === 'OUT' ? -Math.abs(Number(l.qty)) : Math.abs(Number(l.qty)),
                    uom_id:      Number.isInteger(parsedUomId) ? parsedUomId : null,
                    role:        l.role || 'OWNER'
                };});

            const payload = {
                org_id:     orgId,
                project_id: projectId,
                txn_type:   txnType,
                txn_date:   new Date(),
                status:     'CONFIRMED',
                remarks:    txnRemarks || null,
                lines:      linesForPayload
            };

            const res = await ledgerApi.createTransaction(payload);

            toast.success(`Transaction confirmed! ID: ${res?.data?.id}`);
            setShowModal(false);
            loadTransactions();
            if (subTab === 'party-hub') loadPartyHubData(selectedPartyId);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Transaction failed');
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Computed Stats ───────────────────────────────────────────────────────

    const totalTxns     = transactions.length;
    const confirmedTxns = transactions.filter(t => t.status === 'CONFIRMED').length;
    const supplyTxns    = transactions.filter(t => t.txn_type === 'SUPPLY_ASSIGN').length;
    const transferTxns  = transactions.filter(t => t.txn_type === 'TRANSFER_PARTY').length;

    const filteredTxns = transactions.filter(t => {
        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        return (
            String(t.id || '').includes(s) ||
            t.txn_type?.toLowerCase().includes(s) ||
            t.remarks?.toLowerCase().includes(s) ||
            t.lines?.some(l =>
                getPartyName(l.party_id).toLowerCase().includes(s) ||
                getResourceLabel(l.project_resource_id).toLowerCase().includes(s)
            )
        );
    });

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="flex-1 w-full flex flex-col bg-[#f8fafc] dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 p-4 md:p-6 overflow-y-auto min-h-0">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        Resource Transactions & Party Ledger
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Dynamic multi-party double entry with real-time contractor stock verification — sourced from <span className="font-mono text-blue-500">pdoc_parties → crm_contacts</span>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => { loadTransactions(); loadProjectParties(); if (subTab === 'party-hub') loadPartyHubData(selectedPartyId); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Refresh
                    </button>
                    {(canWrite || isAdmin) && (
                        <button
                            type="button"
                            onClick={handleOpenModal}
                            disabled={projectParties.length < 2}
                            title={projectParties.length < 2 ? 'Need at least 2 project parties to create a transaction' : ''}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-4 h-4" />
                            New Transaction
                        </button>
                    )}
                </div>
            </div>

            {/* Project party count warning */}
            {projectParties.length === 0 && (
                <div className="mb-4 px-4 py-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium">
                    ⚠️ No active parties found for this project. Add parties in <strong>Project Settings → Parties</strong> to enable transactions.
                </div>
            )}

            {/* Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
                        <span>Total Events</span><FileText className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalTxns}</div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">{confirmedTxns} Confirmed</div>
                </div>
                <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
                        <span>Supply Assignments</span><Package className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{supplyTxns}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Supplier → Contractor</div>
                </div>
                <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
                        <span>Party Transfers</span><ArrowRightLeft className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{transferTxns}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Contractor → Contractor</div>
                </div>
                <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
                        <span>Project Parties</span><UserCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{projectParties.length}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Active in this project</div>
                </div>
            </div>

            {/* Sub-Tab Navigation */}
            <div className="flex items-center space-x-1 border-b border-gray-200 dark:border-gray-800 mb-6 overflow-x-auto shrink-0">
                <button
                    type="button"
                    onClick={() => setSubTab('transactions')}
                    className={`py-2.5 px-5 text-xs font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 cursor-pointer ${subTab === 'transactions' ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                >
                    <Layers className="w-4 h-4" />
                    Transactions History
                </button>
                <button
                    type="button"
                    onClick={() => setSubTab('party-hub')}
                    className={`py-2.5 px-5 text-xs font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 cursor-pointer ${subTab === 'party-hub' ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                >
                    <UserCheck className="w-4 h-4" />
                    Party Stock & Statements
                </button>
            </div>

            {/* TAB 1: TRANSACTIONS HISTORY */}
            {subTab === 'transactions' && (
                <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    {/* Filter Bar */}
                    <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-900/50">
                        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                            <Search className="w-4 h-4 text-gray-400 shrink-0" />
                            <input
                                type="text"
                                placeholder="Search by party name, material, remarks..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Filter className="w-3.5 h-3.5" />
                                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1">
                                    <option value="ALL">All Types</option>
                                    <option value="SUPPLY_ASSIGN">SUPPLY_ASSIGN</option>
                                    <option value="TRANSFER_PARTY">TRANSFER_PARTY</option>
                                </select>
                            </div>
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1">
                                <option value="ALL">All Status</option>
                                <option value="CONFIRMED">CONFIRMED</option>
                                <option value="DRAFT">DRAFT</option>
                                <option value="CANCELLED">CANCELLED</option>
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-xs text-gray-500">Loading transactions...</div>
                    ) : filteredTxns.length === 0 ? (
                        <div className="p-12 text-center text-xs text-gray-500">No transactions found.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-100/70 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 font-semibold">
                                        <th className="p-3">Txn ID</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Transfer Flow (From → Material → To)</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Lines</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTxns.map((txn) => {
                                        const isExpanded = expandedTxn === txn.id;
                                        const fromLine = txn.lines?.find(l => Number(l.signed_qty) < 0);
                                        const toLine   = txn.lines?.find(l => Number(l.signed_qty) > 0);
                                        const qtyVal   = Math.abs(Number(fromLine?.signed_qty || toLine?.signed_qty || 0));
                                        const resLabel = getResourceLabel(fromLine?.project_resource_id || toLine?.project_resource_id);

                                        return (
                                            <React.Fragment key={txn.id}>
                                                <tr className="border-b border-gray-200 dark:border-gray-800/60 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition">
                                                    <td className="p-3 font-semibold text-blue-600 dark:text-blue-400">#{txn.id}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${txn.txn_type === 'SUPPLY_ASSIGN' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                                                            {txn.txn_type}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(txn.txn_date)}</td>

                                                    {/* Visual Left → Right Transfer Flow */}
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <div className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 font-semibold text-[11px] max-w-[180px] truncate">
                                                                {fromLine ? getPartyName(fromLine.party_id) : 'Source'}
                                                            </div>
                                                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 font-mono text-[11px] font-bold shrink-0">
                                                                <span className="max-w-[160px] truncate">{qtyVal > 0 ? `${qtyVal} × ${resLabel}` : resLabel}</span>
                                                                <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 ml-1 shrink-0" />
                                                            </div>
                                                            <div className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold text-[11px] max-w-[180px] truncate">
                                                                {toLine ? getPartyName(toLine.party_id) : 'Destination'}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="p-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${txn.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : txn.status === 'DRAFT' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                                                            {txn.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => setExpandedTxn(isExpanded ? null : txn.id)}
                                                            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                                                        >
                                                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                            {isExpanded ? 'Hide' : 'Lines'}
                                                        </button>
                                                    </td>
                                                </tr>

                                                {isExpanded && (
                                                    <tr className="bg-blue-50/40 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-800">
                                                        <td colSpan={6} className="p-4">
                                                            <div className="mb-2 text-xs text-gray-600 dark:text-gray-400 italic">Remarks: {txn.remarks || 'None'}</div>
                                                            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/80">
                                                                <table className="w-full text-left text-[11px]">
                                                                    <thead className="bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-700">
                                                                        <tr>
                            <th className="p-2">Party</th>
                                                                            <th className="p-2">Material</th>
                                                                            <th className="p-2">Role</th>
                                                                            <th className="p-2 text-right">Signed Qty</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {txn.lines?.map(l => (
                                                                            <tr key={l.id} className="border-b border-gray-100 dark:border-gray-700/40">
                                                                                <td className="p-2 font-semibold text-gray-900 dark:text-white">
                                                                                    {getPartyName(l.party_id)}
                                                                                    <span className="ml-1 text-gray-400 font-normal font-mono text-[10px]">(pv#{l.party_id})</span>
                                                                                </td>
                                                                                <td className="p-2 text-gray-700 dark:text-gray-300">{getResourceLabel(l.project_resource_id)}</td>
                                                                                <td className="p-2 text-gray-500 font-mono">{l.role || '-'}</td>
                                                                                <td className={`p-2 text-right font-bold ${Number(l.signed_qty || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                                                    {Number(l.signed_qty || 0) > 0 ? `+${l.signed_qty}` : (l.signed_qty ?? 0)}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: PARTY STOCK & STATEMENTS */}
            {subTab === 'party-hub' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            <div>
                                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Party Stock & Passbook</h2>
                                <p className="text-xs text-gray-500">Select a project party to view stock and transaction history.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedPartyId}
                                onChange={(e) => setSelectedPartyId(e.target.value)}
                                className="text-xs font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer"
                            >
                                <option value="">— Select Party —</option>
                                {projectParties.map(v => (
                                    <option key={v.pv_id} value={v.pv_id}>
                                        {v.name} {v.category ? `(${v.category})` : ''}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => loadPartyHubData(selectedPartyId)}
                                disabled={partyLoading || !selectedPartyId}
                                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
                            >
                                {partyLoading ? 'Loading...' : 'Refresh'}
                            </button>
                        </div>
                    </div>

                    {/* Net Stock Positions */}
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                            <Package className="w-4 h-4 text-indigo-500" />
                            Net Stock — {selectedPartyId ? getPartyName(selectedPartyId) : 'Select a party'}
                        </h3>
                        {!selectedPartyId ? (
                            <div className="p-4 text-xs text-gray-400 italic">Select a party above.</div>
                        ) : partyLoading ? (
                            <div className="p-4 text-xs text-gray-500">Loading...</div>
                        ) : partyPositions.length === 0 ? (
                            <div className="p-4 text-xs text-gray-500 italic">No material holdings recorded yet.</div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {partyPositions.map((pos, idx) => {
                                    const netQty = Number(pos?.net_qty || 0);
                                    return (
                                        <div key={idx} className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1c2128] shadow-sm flex items-center justify-between hover:border-blue-500/50 transition">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 shrink-0">
                                                    <Package className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-gray-900 dark:text-white">
                                                        {getResourceLabel(pos?.project_resource_id)}
                                                    </div>
                                                    <div className="text-[10px] font-medium text-gray-400 dark:text-gray-400">
                                                        Net Inventory Balance
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`px-3 py-1.5 rounded-lg border font-mono text-sm font-extrabold ${
                                                netQty < 0 
                                                    ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300' 
                                                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                                            }`}>
                                                {netQty > 0 ? `+${netQty}` : netQty}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Passbook Table */}
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm overflow-hidden">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-blue-500" />
                            Passbook — {selectedPartyId ? getPartyName(selectedPartyId) : 'Select a party'}
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-100/70 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 font-semibold">
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3">Txn#</th>
                                        <th className="p-3">Material</th>
                                        <th className="p-3 text-right">Impact</th>
                                        <th className="p-3 text-right">Balance</th>
                                        <th className="p-3">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {partyLoading ? (
                                        <tr><td colSpan={7} className="p-8 text-center text-gray-500 text-xs">Loading...</td></tr>
                                    ) : partyLedgerLines.length === 0 ? (
                                        <tr><td colSpan={7} className="p-8 text-center text-gray-500 text-xs italic">No ledger activity found.</td></tr>
                                    ) : (
                                        partyLedgerLines.map((line, idx) => {
                                            const signedQty = Number(line?.signed_qty || 0);
                                            return (
                                                <tr key={idx} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                                                    <td className="p-3 text-gray-500">{formatDate(line?.txn_date)}</td>
                                                    <td className="p-3 font-semibold">{line?.txn_type || '-'}</td>
                                                    <td className="p-3 font-mono text-blue-600 dark:text-blue-400">#{line?.transaction_id || '-'}</td>
                                                    <td className="p-3 font-medium">{getResourceLabel(line?.project_resource_id)}</td>
                                                    <td className={`p-3 text-right font-bold ${signedQty < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                        {signedQty > 0 ? `+${signedQty}` : signedQty}
                                                    </td>
                                                    <td className="p-3 text-right font-bold font-mono text-gray-900 dark:text-white bg-blue-50/30 dark:bg-blue-900/20">
                                                        {line?.running_balance ?? 0}
                                                    </td>
                                                    <td className="p-3 text-gray-500 italic max-w-xs truncate">{line?.remarks || '-'}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* DYNAMIC MULTI-PARTY & MULTI-ITEM TRANSACTION MODAL WITH STOCK VERIFICATION */}
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
                                    <select
                                        value={txnType}
                                        onChange={(e) => setTxnType(e.target.value)}
                                        className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 font-bold cursor-pointer"
                                    >
                                        <option value="SUPPLY_ASSIGN">SUPPLY_ASSIGN (Supplier/PMC → Contractor)</option>
                                        <option value="TRANSFER_PARTY">TRANSFER_PARTY (Inter-Contractor)</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Transaction Notes / Explanation</label>
                                    <input
                                        type="text"
                                        value={txnRemarks}
                                        onChange={(e) => setTxnRemarks(e.target.value)}
                                        placeholder="Add business context or reason for transfer..."
                                        className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5"
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
                                        const stockInfo    = getStockAvailability(line.partyId, line.projectResourceId);
                                        const requestedVal = Math.abs(Number(line.qty) || 0);
                                        const isOutflowExceeded = line.direction === 'OUT' && !stockInfo.isSupplier && line.partyId && line.projectResourceId && requestedVal > stockInfo.available;

                                        return (
                                            <div key={idx} className={`p-3.5 rounded-xl border transition grid grid-cols-1 sm:grid-cols-12 gap-3 items-center ${
                                                isOutflowExceeded
                                                    ? 'bg-rose-50/80 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800'
                                                    : 'bg-gray-50/60 dark:bg-gray-900/40 border-gray-200 dark:border-gray-800'
                                            }`}>
                                                {/* Line Direction (Outflow / Inflow) */}
                                                <div className="sm:col-span-2">
                                                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Direction</label>
                                                    <select
                                                        value={line.direction}
                                                        onChange={(e) => handleLineChange(idx, 'direction', e.target.value)}
                                                        className={`w-full text-xs font-bold rounded-lg p-2 border transition cursor-pointer ${
                                                            line.direction === 'OUT'
                                                                ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
                                                                : 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                                                        }`}
                                                    >
                                                        <option value="OUT">OUT (- Sender)</option>
                                                        <option value="IN">IN (+ Receiver)</option>
                                                    </select>
                                                </div>

                                                {/* Party Select */}
                                                <div className="sm:col-span-3">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <label className="block text-[10px] font-semibold text-gray-500">Party</label>
                                                        {line.direction === 'OUT' && line.partyId && line.projectResourceId && (
                                                            <span className={`text-[9px] font-bold font-mono ${
                                                                stockInfo.isSupplier
                                                                    ? 'text-indigo-600 dark:text-indigo-400'
                                                                    : (isOutflowExceeded ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'text-emerald-600 dark:text-emerald-400')
                                                            }`}>
                                                                {stockInfo.label}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <select
                                                        value={line.partyId}
                                                        onChange={(e) => handleLineChange(idx, 'partyId', e.target.value)}
                                                        required
                                                        className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium cursor-pointer"
                                                    >
                                                        <option value="">— Select Party —</option>
                                                        {projectParties.map(v => (
                                                            <option key={v.pv_id} value={v.pv_id}>
                                                                {v.name} {v.category ? `(${v.category})` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Material / Resource Select */}
                                                <div className="sm:col-span-3">
                                                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Material / Item</label>
                                                    <select
                                                        value={line.projectResourceId}
                                                        onChange={(e) => handleLineChange(idx, 'projectResourceId', e.target.value)}
                                                        required
                                                        className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium cursor-pointer"
                                                    >
                                                        <option value="">— Select Material —</option>
                                                        {projectResources.map(r => (
                                                            <option key={r.project_resource_id} value={r.project_resource_id}>
                                                                {r.name} ({r.base_unit_code || r.type || 'RES'})
                                                            </option>
                                                        ))}
                                                    </select>
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
                                                        className={`w-full text-xs bg-white dark:bg-gray-800 border rounded-lg p-2 font-bold font-mono ${
                                                            isOutflowExceeded
                                                                ? 'border-rose-500 text-rose-600 focus:ring-rose-500'
                                                                : 'border-gray-300 dark:border-gray-700'
                                                        }`}
                                                    />
                                                </div>

                                                {/* Derived Unit / UOM Select */}
                                                <div className="sm:col-span-1">
                                                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Unit</label>
                                                    <select
                                                        value={line.uomId}
                                                        onChange={(e) => handleLineChange(idx, 'uomId', e.target.value)}
                                                        className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 cursor-pointer font-mono"
                                                    >
                                                        {derivedUnits.map(u => (
                                                            <option key={u.id} value={u.id}>
                                                                {u.code || u.symbol || u.id}
                                                            </option>
                                                        ))}
                                                    </select>
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

                            {/* Live Per-Resource Zero-Sum Verifier & Tally Status */}
                            <div className={`p-4 rounded-xl border transition text-xs ${
                                hasUnbalancedResources || hasStockDeficit
                                    ? 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800'
                                    : 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
                            }`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold flex items-center gap-1.5 text-xs">
                                        {hasUnbalancedResources || hasStockDeficit ? (
                                            <>
                                                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                                <span className="text-rose-800 dark:text-rose-300">Untallied or Insufficient Stock — Transaction Cannot Be Submitted</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                <span className="text-emerald-800 dark:text-emerald-300">Transaction Fully Balanced & Verified (All Materials Tally = 0.00)</span>
                                            </>
                                        )}
                                    </span>
                                </div>

                                {/* Resource Tally List */}
                                <div className="space-y-1 font-mono text-[11px] pt-1">
                                    {Object.entries(resourceTallies).map(([resId, sum]) => {
                                        const resName = getResourceLabel(resId);
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
        </div>
    );
};

export default TransactionsIndex;
