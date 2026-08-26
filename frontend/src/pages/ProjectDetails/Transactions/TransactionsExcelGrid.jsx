import React, { useState, useMemo, useCallback } from 'react';
import { Download, RefreshCw, FileSpreadsheet, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { ExcelGrid } from '../../../components/ExcelGrid';
import CustomSelect from '../../../components/CustomSelect';
import CustomDatePicker from '../../../components/CustomDatePicker';
import { ledgerApi } from '../../../services/ledgerApi';

const CREATE_BLANK_ROW = (idx = 1) => ({
    id: `reg_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
    date: new Date().toISOString().split('T')[0],
    txn_type: 'SUPPLY_ASSIGN',
    from_party_id: '',
    to_party_id: '',
    project_resource_id: '',
    qty: '',
    uom_id: '',
    remarks: '',
    status: 'CONFIRMED'
});

const INITIAL_ROWS = () => [
    CREATE_BLANK_ROW(1),
    CREATE_BLANK_ROW(2),
    CREATE_BLANK_ROW(3),
    CREATE_BLANK_ROW(4),
    CREATE_BLANK_ROW(5)
];

const TYPE_OPTIONS = [
    { label: 'SUPPLY_ASSIGN (Supply)', value: 'SUPPLY_ASSIGN' },
    { label: 'TRANSFER_PARTY (Transfer)', value: 'TRANSFER_PARTY' }
];

const STATUS_OPTIONS = [
    { label: 'CONFIRMED', value: 'CONFIRMED' },
    { label: 'DRAFT', value: 'DRAFT' }
];

export const TransactionsExcelGrid = ({
    project,
    canWrite = true,
    projectParties = [],
    projectResources = [],
    masterUnits = [],
    stockMap = {},
    onSuccess
}) => {
    const projectId = project?.id;
    const orgId = project?.org_id || 1;

    // Working rows for Entry Register
    const [rows, setRows] = useState(INITIAL_ROWS);
    const [isSaving, setIsSaving] = useState(false);

    // Fast lookup dictionaries
    const partyMap = useMemo(() => {
        const map = {};
        projectParties.forEach(p => {
            map[String(p.pv_id)] = p;
        });
        return map;
    }, [projectParties]);

    const partyNameMap = useMemo(() => {
        const map = {};
        projectParties.forEach(p => {
            if (p.name) map[p.name.trim().toLowerCase()] = p;
        });
        return map;
    }, [projectParties]);

    const resourceMap = useMemo(() => {
        const map = {};
        projectResources.forEach(r => {
            map[String(r.project_resource_id)] = r;
        });
        return map;
    }, [projectResources]);

    const resourceNameMap = useMemo(() => {
        const map = {};
        projectResources.forEach(r => {
            if (r.name) map[r.name.trim().toLowerCase()] = r;
            if (r.code) map[r.code.trim().toLowerCase()] = r;
        });
        return map;
    }, [projectResources]);

    const uomMap = useMemo(() => {
        const map = {};
        masterUnits.forEach(u => {
            map[String(u.id)] = u;
        });
        return map;
    }, [masterUnits]);

    const uomNameMap = useMemo(() => {
        const map = {};
        masterUnits.forEach(u => {
            if (u.code) map[u.code.trim().toLowerCase()] = u;
            if (u.symbol) map[u.symbol.trim().toLowerCase()] = u;
            if (u.name) map[u.name.trim().toLowerCase()] = u;
        });
        return map;
    }, [masterUnits]);

    // Dropdown Select Options
    const partyOptions = useMemo(() => {
        return projectParties.map(p => ({
            label: p.category ? `${p.name} (${p.category})` : p.name,
            value: String(p.pv_id)
        }));
    }, [projectParties]);

    const resourceOptions = useMemo(() => {
        return projectResources.map(r => ({
            label: r.code ? `${r.name} (${r.code})` : r.name,
            value: String(r.project_resource_id)
        }));
    }, [projectResources]);

    const uomOptions = useMemo(() => {
        return masterUnits.map(u => ({
            label: u.code || u.symbol || u.name,
            value: String(u.id)
        }));
    }, [masterUnits]);

    // Helpers
    const getAvailableStock = (pvId, resId) => {
        if (!pvId || !resId) return { available: 0, isSupplier: false, label: '-' };
        const party = partyMap[String(pvId)] || partyNameMap[String(pvId).trim().toLowerCase()];
        const category = (party?.category || '').toLowerCase();
        const isSupplier = category.includes('supplier');

        if (isSupplier) {
            return { available: Infinity, isSupplier: true, label: 'Unlimited (Supplier)' };
        }

        const key = `${party?.pv_id || pvId}_${resId}`;
        const available = stockMap[key] || 0;
        return { available, isSupplier: false, label: `${Number(available).toFixed(2)} in stock` };
    };

    // Direct Row Updater for Custom Dropdowns & Date
    const updateRowField = useCallback((rowId, field, value) => {
        setRows(prev => {
            return prev.map(r => {
                if (r.id !== rowId) return r;
                const updated = { ...r, [field]: value };

                // Auto set UOM if material changed
                if (field === 'project_resource_id') {
                    const res = resourceMap[String(value)] || resourceNameMap[String(value).trim().toLowerCase()];
                    if (res && res.base_unit_code) {
                        const foundUom = masterUnits.find(u => {
                            const vals = [u.id, u.code, u.symbol, u.name].filter(Boolean).map(v => String(v).toLowerCase());
                            return vals.includes(String(res.base_unit_code).toLowerCase());
                        });
                        if (foundUom) updated.uom_id = String(foundUom.id);
                    }
                }

                // Auto set txn_type if supplier party selected
                if (field === 'from_party_id') {
                    const party = partyMap[String(value)] || partyNameMap[String(value).trim().toLowerCase()];
                    const isSupplier = (party?.category || '').toLowerCase().includes('supplier');
                    if (isSupplier) {
                        updated.txn_type = 'SUPPLY_ASSIGN';
                    } else if (updated.to_party_id) {
                        updated.txn_type = 'TRANSFER_PARTY';
                    }
                }

                return updated;
            });
        });
    }, [resourceMap, resourceNameMap, masterUnits, partyMap, partyNameMap]);

    // Column Definitions
    const columns = useMemo(() => [
        {
            key: 'date',
            label: 'Date',
            type: 'date',
            defaultValue: new Date().toISOString().split('T')[0],
            width: '160px',
            minWidth: '150px',
            aliases: ['date', 'txn_date', 'transaction date', 'entry date'],
            renderCell: (val, row, col, setGridVal) => (
                <CustomDatePicker
                    value={val || row.date}
                    onChange={(e) => {
                        const nextVal = e.target.value;
                        updateRowField(row.id, 'date', nextVal);
                        if (setGridVal) setGridVal(nextVal);
                    }}
                    disabled={!canWrite}
                    buttonClassName="w-full h-7 px-2 bg-gray-50/60 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-md text-xs font-semibold text-gray-900 dark:text-white flex items-center justify-between shadow-2xs hover:border-blue-500/40 cursor-pointer"
                />
            )
        },
        {
            key: 'txn_type',
            label: 'Txn Type',
            type: 'select',
            options: TYPE_OPTIONS,
            defaultValue: 'SUPPLY_ASSIGN',
            width: '190px',
            minWidth: '175px',
            aliases: ['type', 'txn_type', 'transaction type', 'nature', 'txn type'],
            renderCell: (val, row, col, setGridVal) => {
                const currentType = val || row.txn_type || 'SUPPLY_ASSIGN';
                return (
                    <CustomSelect
                        options={TYPE_OPTIONS}
                        value={currentType}
                        onChange={(e) => {
                            const nextVal = e.target.value;
                            updateRowField(row.id, 'txn_type', nextVal);
                            if (setGridVal) setGridVal(nextVal);
                        }}
                        placeholder="Select Type"
                        disabled={!canWrite}
                        buttonClassName={`w-full h-7 px-2 rounded-md text-xs font-bold flex items-center justify-between border cursor-pointer ${
                            currentType === 'SUPPLY_ASSIGN'
                                ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50'
                                : 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50'
                        }`}
                    />
                );
            }
        },
        {
            key: 'from_party_id',
            label: 'From (Source)',
            type: 'select',
            width: '240px',
            minWidth: '210px',
            aliases: ['from', 'from party', 'from_party', 'source', 'sender', 'vendor', 'supplier', 'source party'],
            renderCell: (val, row, col, setGridVal) => {
                const currentVal = val || row.from_party_id;
                const stockInfo = getAvailableStock(currentVal, row.project_resource_id);
                return (
                    <div className="flex flex-col gap-0.5 w-full py-0.5">
                        <CustomSelect
                            options={partyOptions}
                            value={currentVal || ''}
                            onChange={(e) => {
                                const nextVal = e.target.value;
                                updateRowField(row.id, 'from_party_id', nextVal);
                                if (setGridVal) setGridVal(nextVal);
                            }}
                            placeholder="Select Source Party"
                            disabled={!canWrite}
                            buttonClassName={`w-full h-7 px-2 rounded-md text-xs font-semibold flex items-center justify-between border cursor-pointer ${
                                currentVal
                                    ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40 text-gray-900 dark:text-white'
                                    : 'bg-gray-50/60 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-400'
                            }`}
                        />
                        {currentVal && row.project_resource_id && (
                            <span className={`text-[10px] px-1 font-mono truncate ${
                                stockInfo.isSupplier
                                    ? 'text-blue-500 dark:text-blue-400'
                                    : stockInfo.available <= 0
                                    ? 'text-rose-500 dark:text-rose-400 font-bold'
                                    : 'text-gray-400'
                            }`}>
                                {stockInfo.label}
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            key: 'to_party_id',
            label: 'To (Destination)',
            type: 'select',
            width: '240px',
            minWidth: '210px',
            aliases: ['to', 'to party', 'to_party', 'destination', 'recipient', 'contractor', 'client', 'destination party'],
            renderCell: (val, row, col, setGridVal) => {
                const currentVal = val || row.to_party_id;
                return (
                    <CustomSelect
                        options={partyOptions}
                        value={currentVal || ''}
                        onChange={(e) => {
                            const nextVal = e.target.value;
                            updateRowField(row.id, 'to_party_id', nextVal);
                            if (setGridVal) setGridVal(nextVal);
                        }}
                        placeholder="Select Destination Party"
                        disabled={!canWrite}
                        buttonClassName={`w-full h-7 px-2 rounded-md text-xs font-semibold flex items-center justify-between border cursor-pointer ${
                            currentVal
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-gray-900 dark:text-white'
                                : 'bg-gray-50/60 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-400'
                        }`}
                    />
                );
            }
        },
        {
            key: 'project_resource_id',
            label: 'Material / Resource',
            type: 'select',
            width: '250px',
            minWidth: '210px',
            aliases: ['material', 'item', 'resource', 'product', 'material name', 'item name', 'resource name'],
            renderCell: (val, row, col, setGridVal) => {
                const currentVal = val || row.project_resource_id;
                return (
                    <CustomSelect
                        options={resourceOptions}
                        value={currentVal || ''}
                        onChange={(e) => {
                            const nextVal = e.target.value;
                            updateRowField(row.id, 'project_resource_id', nextVal);
                            if (setGridVal) setGridVal(nextVal);
                        }}
                        placeholder="Select Material / Item"
                        disabled={!canWrite}
                        buttonClassName={`w-full h-7 px-2 rounded-md text-xs font-semibold flex items-center justify-between border cursor-pointer ${
                            currentVal
                                ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/40 text-gray-900 dark:text-white'
                                : 'bg-gray-50/60 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-400'
                        }`}
                    />
                );
            }
        },
        {
            key: 'qty',
            label: 'Quantity',
            type: 'number',
            required: true,
            width: '120px',
            minWidth: '100px',
            align: 'right',
            aliases: ['qty', 'quantity', 'amount', 'count', 'units']
        },
        {
            key: 'uom_id',
            label: 'Unit (UOM)',
            type: 'select',
            width: '130px',
            minWidth: '110px',
            aliases: ['uom', 'unit', 'measure', 'base unit', 'unit of measure'],
            renderCell: (val, row, col, setGridVal) => {
                const currentVal = val || row.uom_id;
                return (
                    <CustomSelect
                        options={uomOptions}
                        value={currentVal || ''}
                        onChange={(e) => {
                            const nextVal = e.target.value;
                            updateRowField(row.id, 'uom_id', nextVal);
                            if (setGridVal) setGridVal(nextVal);
                        }}
                        placeholder="Unit"
                        disabled={!canWrite}
                        buttonClassName="w-full h-7 px-2 bg-gray-50/60 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-md text-xs font-mono font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between cursor-pointer"
                    />
                );
            }
        },
        {
            key: 'remarks',
            label: 'Remarks / Notes',
            type: 'text',
            width: '240px',
            minWidth: '180px',
            aliases: ['remarks', 'notes', 'comments', 'description', 'remark', 'note']
        },
        {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: STATUS_OPTIONS,
            defaultValue: 'CONFIRMED',
            width: '135px',
            minWidth: '115px',
            aliases: ['status', 'state'],
            renderCell: (val, row, col, setGridVal) => {
                const currentStatus = val || row.status || 'CONFIRMED';
                return (
                    <CustomSelect
                        options={STATUS_OPTIONS}
                        value={currentStatus}
                        onChange={(e) => {
                            const nextVal = e.target.value;
                            updateRowField(row.id, 'status', nextVal);
                            if (setGridVal) setGridVal(nextVal);
                        }}
                        placeholder="Status"
                        disabled={!canWrite}
                        buttonClassName={`w-full h-7 px-2 rounded-md text-xs font-semibold flex items-center justify-between border cursor-pointer transition-colors ${
                            currentStatus === 'CONFIRMED'
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400'
                                : 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400'
                        }`}
                    />
                );
            }
        }
    ], [projectParties, projectResources, masterUnits, updateRowField, canWrite, stockMap, partyOptions, resourceOptions, uomOptions]);

    // Download Sample CSV Template
    const handleDownloadTemplate = () => {
        const sampleFrom = projectParties[0]?.name || 'UltraTech Supplies';
        const sampleTo = projectParties[1]?.name || 'Main Civil Contractor';
        const sampleMat = projectResources[0]?.name || 'Cement 53 Grade';
        const sampleUom = masterUnits[0]?.code || 'Bags';

        const headers = ["Date", "Transaction Type", "From Party", "To Party", "Material Name", "Quantity", "Unit", "Remarks"];
        const sampleRow1 = ["2026-03-01", "SUPPLY_ASSIGN", sampleFrom, sampleTo, sampleMat, "500", sampleUom, "PO-402 Delivery"];
        const sampleRow2 = ["2026-03-02", "TRANSFER_PARTY", sampleTo, sampleFrom, sampleMat, "50", sampleUom, "Excess Stock Return"];

        const csvContent = "data:text/csv;charset=utf-8," + [
            headers.join(","),
            sampleRow1.join(","),
            sampleRow2.join(",")
        ].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `entry_register_template_${project?.project_code || 'project'}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.info('Sample CSV template downloaded');
    };

    // Add Rows Handler
    const handleAddRows = (count = 1) => {
        setRows(prev => [
            ...prev,
            ...Array.from({ length: count }, (_, idx) => CREATE_BLANK_ROW(prev.length + idx + 1))
        ]);
    };

    // Batch Save Handler for ExcelGrid
    const handleSaveGridBatch = async (batchPayload) => {
        const { created = [], updated = [], allCurrentRows = [] } = batchPayload || {};
        const allCandidates = allCurrentRows.length > 0 ? allCurrentRows : [...rows, ...created, ...updated];

        // Deduplicate by row id
        const uniqueMap = new Map();
        allCandidates.forEach(r => {
            if (r?.id) uniqueMap.set(r.id, r);
        });

        const rowsToProcess = Array.from(uniqueMap.values()).filter(r => {
            const hasFrom = r.from_party_id || r.fromPartyId;
            const hasTo = r.to_party_id || r.toPartyId;
            const hasRes = r.project_resource_id || r.projectResourceId;
            const hasQty = Number(r.qty) > 0;
            return hasFrom && hasTo && hasRes && hasQty;
        });

        if (rowsToProcess.length === 0) {
            toast.warning('Please complete at least one row with From, To, Material, and Quantity (> 0).');
            return;
        }

        setIsSaving(true);
        try {
            // Validation step
            for (let i = 0; i < rowsToProcess.length; i++) {
                const r = rowsToProcess[i];
                const fromId = String(r.from_party_id || r.fromPartyId || '');
                const toId = String(r.to_party_id || r.toPartyId || '');
                const resId = String(r.project_resource_id || r.projectResourceId || '');
                const numQty = Number(r.qty);

                const resolvedFrom = partyMap[fromId] || partyNameMap[fromId.toLowerCase()];
                const resolvedTo = partyMap[toId] || partyNameMap[toId.toLowerCase()];
                const resolvedRes = resourceMap[resId] || resourceNameMap[resId.toLowerCase()];

                if (!resolvedFrom || !resolvedTo) {
                    toast.error(`Row ${i + 1}: Could not find selected party.`);
                    return;
                }

                if (String(resolvedFrom.pv_id) === String(resolvedTo.pv_id)) {
                    toast.error(`Row ${i + 1}: Source (From) and Destination (To) cannot be the same party.`);
                    return;
                }

                if (!resolvedRes) {
                    toast.error(`Row ${i + 1}: Could not find selected resource/material.`);
                    return;
                }

                // Check stock sufficiency
                const stockInfo = getAvailableStock(resolvedFrom.pv_id, resolvedRes.project_resource_id);
                if (!stockInfo.isSupplier && numQty > stockInfo.available) {
                    toast.error(`Row ${i + 1}: ${resolvedFrom.name} has insufficient stock for ${resolvedRes.name}. Available: ${stockInfo.available}, Requested: ${numQty}`);
                    return;
                }
            }

            // Submit transactions
            let count = 0;
            for (const r of rowsToProcess) {
                const fromId = String(r.from_party_id || r.fromPartyId || '');
                const toId = String(r.to_party_id || r.toPartyId || '');
                const resId = String(r.project_resource_id || r.projectResourceId || '');
                const uomId = String(r.uom_id || r.uomId || '');

                const resolvedFrom = partyMap[fromId] || partyNameMap[fromId.toLowerCase()];
                const resolvedTo = partyMap[toId] || partyNameMap[toId.toLowerCase()];
                const resolvedRes = resourceMap[resId] || resourceNameMap[resId.toLowerCase()];
                const resolvedUom = uomMap[uomId] || uomNameMap[uomId.toLowerCase()];

                const numQty = Math.abs(Number(r.qty));
                const payload = {
                    org_id: orgId,
                    project_id: projectId,
                    txn_type: r.txn_type || r.txnType || (resolvedFrom.category?.toLowerCase().includes('supplier') ? 'SUPPLY_ASSIGN' : 'TRANSFER_PARTY'),
                    txn_date: r.date ? new Date(r.date) : new Date(),
                    status: r.status || 'CONFIRMED',
                    remarks: r.remarks ? `[Entry Register] ${r.remarks}` : '[Entry Register Batch]',
                    lines: [
                        {
                            party_id: Number(resolvedFrom.pv_id),
                            project_resource_id: Number(resolvedRes.project_resource_id),
                            signed_qty: -numQty,
                            uom_id: resolvedUom ? Number(resolvedUom.id) : null,
                            role: 'OWNER'
                        },
                        {
                            party_id: Number(resolvedTo.pv_id),
                            project_resource_id: Number(resolvedRes.project_resource_id),
                            signed_qty: numQty,
                            uom_id: resolvedUom ? Number(resolvedUom.id) : null,
                            role: 'OWNER'
                        }
                    ]
                };

                await ledgerApi.createTransaction(payload);
                count++;
            }

            toast.success(`Successfully saved ${count} transaction(s) to ledger!`);
            setRows(INITIAL_ROWS());
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Failed to commit Entry Register rows:', err);
            toast.error(err.response?.data?.message || 'Failed to save batch transactions');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0d1117]">
            <ExcelGrid
                data={rows}
                columns={columns}
                primaryKey="id"
                entityName="Register Rows"
                canWrite={canWrite}
                isLoading={isSaving}
                onSave={handleSaveGridBatch}
                onAddRows={handleAddRows}
                emptyMessage="No register entry rows. Click '+ Add Row' in the toolbar to add transactions."
                initialPageSize={50}
                customActions={
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                            title="Download CSV Template for Bulk Entry"
                        >
                            <Download size={13} className="text-blue-500 stroke-[2.5]" />
                            <span>CSV Template</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setRows(INITIAL_ROWS())}
                            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="Reset register to clean rows"
                        >
                            <RefreshCw size={12} />
                            <span>Clear Grid</span>
                        </button>
                    </div>
                }
            />
        </div>
    );
};

export default TransactionsExcelGrid;
