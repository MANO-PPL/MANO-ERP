import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Building,
    Plus,
    SlidersHorizontal,
    CopyCheck,
    Download,
    Eye,
    Edit3,
    Trash2
} from 'lucide-react';
import api from '../../services/api';
import { createPartyApi } from '../../services/partyApi';
import { toast } from 'react-toastify';
import ClientDetails from './ClientDetails';
import ClientFilterDropdown from './ClientFilterDropdown';
import AddEditClient from './AddEditClient';
import ManageMetadataModal from '../../components/ManageMetadataModal';
import ImportPartyFromProjectDialog from '../../components/ImportPartyFromProjectDialog';
import PartyStatusFilter from '../../components/PartyStatusFilter';
import PartyReasonModal from '../../components/PartyReasonModal';
import { ExcelGrid } from '../../components/ExcelGrid';
import { evaluateFormula } from '../../utils/excelFormulaEngine';
import { useAuth } from '../../context/AuthContext';

const clientApi = createPartyApi('client');

const COLUMN_ALIASES = {
    name: ['company name', 'client name', 'client', 'firm', 'agency', 'organization', 'name', 'party name', 'title'],
    job_name: ['nature of job', 'job nature', 'scope of work', 'scope', 'trade', 'nature', 'work nature', 'service', 'job', 'project type'],
    sector_name: ['sector', 'sector name', 'industry', 'domain', 'business sector', 'category', 'type'],
    contact_person: ['contact person', 'contact name', 'poc', 'representative', 'person', 'contact'],
    designation: ['designation', 'position', 'title', 'job title', 'role / designation'],
    telephone_no: ['contact no', 'phone no', 'mobile no', 'telephone', 'phone', 'mobile', 'cell', 'contact number', 'telephone no', 'tel'],
    email: ['email id', 'email', 'e-mail', 'mail', 'email address', 'mail id'],
    website: ['website', 'web', 'site', 'url', 'web url', 'company website'],
    address: ['address', 'office address', 'site address', 'full address', 'street'],
    location: ['location', 'city', 'state', 'area', 'branch'],
    responsibility: ['responsibility', 'responsible', 'assigned to', 'role', 'lead'],
    reference: ['reference', 'referred by', 'ref', 'source'],
    remarks: ['remarks', 'notes', 'comments', 'description', 'remark', 'note'],
    created_at: ['created at', 'created_at', 'created on', 'creation date', 'date created', 'created']
};

/**
 * ClientsList page component managing client directory records, multi-category filters,
 * and batch spreadsheet updates through ExcelGrid.
 */
export const ClientsList = () => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('clients', 2);

    const [clients, setClients] = useState([]);
    const [statusFilter, setStatusFilter] = useState('active');
    const [isLoading, setIsLoading] = useState(true);
    const [allJobNatures, setAllJobNatures] = useState([]);
    const [allSectors, setAllSectors] = useState([]);

    // Filters
    const [activeFilters, setActiveFilters] = useState({ jobs: [], sectors: [] });
    const [filterJobSearch, setFilterJobSearch] = useState('');
    const [filterSectorSearch, setFilterSectorSearch] = useState('');

    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [viewingClient, setViewingClient] = useState(null);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [isImportFromProjectOpen, setIsImportFromProjectOpen] = useState(false);
    const [reasonAction, setReasonAction] = useState(null); // { row, type: 'archive' | 'restore' | 'delete' }
    const [isJobNatureModalOpen, setIsJobNatureModalOpen] = useState(false);
    const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
    const [isMetadataMenuOpen, setIsMetadataMenuOpen] = useState(false);

    // Fetch Metadata
    const fetchMetadata = async () => {
        try {
            const [jobRes, sectorRes] = await Promise.all([
                api.get('/admin/job-natures'),
                api.get('/admin/sectors')
            ]);
            if (jobRes.data?.success) {
                setAllJobNatures(jobRes.data.job_natures || []);
            }
            if (sectorRes.data?.success) {
                setAllSectors(sectorRes.data.sectors || []);
            }
        } catch (err) {
            console.error('Failed to fetch metadata:', err);
        }
    };

    // Fetch Clients List
    const fetchClients = async (targetStatus = statusFilter) => {
        setIsLoading(true);
        try {
            const res = await clientApi.list({ limit: 50000, status: targetStatus });
            const list = res.clients || [];
            setClients(list);
        } catch (err) {
            console.error('Failed to fetch clients:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMetadata();
    }, []);

    useEffect(() => {
        fetchClients(statusFilter);
    }, [statusFilter]);

    // Filtered data by active job/sector filters
    const filteredClients = useMemo(() => {
        const hasJobs = activeFilters.jobs.length > 0;
        const hasSectors = activeFilters.sectors.length > 0;
        if (!hasJobs && !hasSectors) return clients;

        const jobSet = new Set(activeFilters.jobs);
        const sectorSet = new Set(activeFilters.sectors);

        return clients.filter((c) => {
            if (hasJobs && !jobSet.has(c.job_name)) return false;
            if (hasSectors && !sectorSet.has(c.sector_name)) return false;
            return true;
        });
    }, [clients, activeFilters]);

    // Stats calculations
    const stats = useMemo(
        () => ({
            total: clients.length,
            jobNaturesCount: allJobNatures.length,
            sectorsCount: allSectors.length,
            hasPhone: clients.filter((c) => c.telephone_no || c.mobile).length
        }),
        [clients, allJobNatures, allSectors]
    );

    // Aggregate comprehensive list of Nature of Job and Sector options
    const jobOptions = useMemo(() => {
        const set = new Set();
        (allJobNatures || []).forEach((j) => {
            const name = typeof j === 'object' ? j?.job_name || j?.name : String(j || '');
            if (name && name.trim()) set.add(name.trim());
        });
        (clients || []).forEach((c) => {
            const name = c?.job_name || c?.job_nature;
            if (name && String(name).trim()) set.add(String(name).trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [allJobNatures, clients]);

    const sectorOptions = useMemo(() => {
        const set = new Set();
        (allSectors || []).forEach((s) => {
            const name = typeof s === 'object' ? s?.sector_name || s?.name : String(s || '');
            if (name && name.trim()) set.add(name.trim());
        });
        (clients || []).forEach((c) => {
            const name = c?.sector_name;
            if (name && String(name).trim()) set.add(String(name).trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [allSectors, clients]);

    // Column Definitions for ExcelGrid
    const columns = useMemo(() => {
        return [
            {
                key: 'name',
                label: 'Company Name',
                required: true,
                width: '220px',
                minWidth: '200px',
                aliases: COLUMN_ALIASES.name
            },
            {
                key: 'job_name',
                label: 'Nature of Job',
                type: 'select',
                options: jobOptions,
                width: '180px',
                minWidth: '170px',
                aliases: COLUMN_ALIASES.job_name
            },
            {
                key: 'sector_name',
                label: 'Sector',
                type: 'select',
                options: sectorOptions,
                width: '160px',
                minWidth: '150px',
                aliases: COLUMN_ALIASES.sector_name
            },
            {
                key: 'contact_person',
                label: 'Contact Person',
                width: '160px',
                minWidth: '150px',
                aliases: COLUMN_ALIASES.contact_person
            },
            {
                key: 'designation',
                label: 'Designation',
                width: '150px',
                minWidth: '140px',
                aliases: COLUMN_ALIASES.designation
            },
            {
                key: 'telephone_no',
                label: 'Contact No',
                width: '140px',
                minWidth: '140px',
                aliases: COLUMN_ALIASES.telephone_no
            },
            {
                key: 'email',
                label: 'Email ID',
                width: '190px',
                minWidth: '180px',
                aliases: COLUMN_ALIASES.email
            },
            {
                key: 'website',
                label: 'Website',
                width: '180px',
                minWidth: '160px',
                aliases: COLUMN_ALIASES.website
            },
            {
                key: 'address',
                label: 'Address',
                width: '240px',
                minWidth: '220px',
                aliases: COLUMN_ALIASES.address
            },
            {
                key: 'location',
                label: 'Location',
                width: '150px',
                minWidth: '140px',
                aliases: COLUMN_ALIASES.location
            },
            {
                key: 'created_by_name',
                label: 'Responsibility',
                readOnly: true,
                width: '160px',
                minWidth: '150px'
            },

            {
                key: 'remarks',
                label: 'Remarks',
                width: '200px',
                minWidth: '180px',
                aliases: COLUMN_ALIASES.remarks
            },
            {
                key: 'reference',
                label: 'Reference',
                width: '160px',
                minWidth: '150px',
                aliases: COLUMN_ALIASES.reference
            },
            {
                key: 'created_at',
                label: 'Created At',
                width: '150px',
                minWidth: '130px',
                readOnly: true,
                aliases: COLUMN_ALIASES.created_at,
                renderCell: (val) => {
                    if (!val) return <span className="text-gray-400 italic text-xs">—</span>;
                    try {
                        const d = new Date(val);
                        if (isNaN(d.getTime())) return <span className="text-xs text-gray-500">{String(val)}</span>;
                        return (
                            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium" title={d.toLocaleString()}>
                                {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                        );
                    } catch {
                        return <span className="text-xs text-gray-500">{String(val)}</span>;
                    }
                }
            },
        ];
    }, [jobOptions, sectorOptions]);

    // Unified single-transaction batch save connecting to clientApi
    const handleSaveGridBatch = async (payload) => {
        const { created = [], updated = [], deleted = [] } = payload;

        const resolveItemValues = (item) => {
            const clean = { ...item };
            Object.entries(clean).forEach(([k, v]) => {
                if (typeof v === 'string' && v.trim().startsWith('=')) {
                    const evalRes = evaluateFormula(v, item);
                    clean[k] = evalRes.success ? (evalRes.result ?? '') : v;
                }
            });
            if (clean.remarks !== undefined) clean.self_remark = clean.remarks;
            if (clean.telephone_no !== undefined) clean.contact_no = clean.telephone_no;
            if (clean.website !== undefined) clean.web_site = clean.website;
            return clean;
        };

        const resolvedCreated = created
            .map(resolveItemValues)
            .filter((item) => item.name && String(item.name).trim());

        const resolvedUpdated = updated
            .map(resolveItemValues)
            .filter((item) => item.id && item.name && String(item.name).trim());

        const realDeleted = (deleted || []).filter((id) => id && !String(id).startsWith('temp_'));

        await clientApi.batchSave({
            created: resolvedCreated,
            updated: resolvedUpdated,
            deleted: realDeleted
        });

        // Reload data
        await fetchClients();
    };

    // View Details Drawer Handler
    const handleViewClientDetails = async (client) => {
        if (!client) return;
        const isTemp = !client.id || String(client.id).startsWith('temp_') || isNaN(Number(client.id));
        if (isTemp) {
            toast.warning('Please save this client before viewing details or logging interactions.');
            return;
        }
        try {
            const res = await clientApi.getById(client.id);
            setViewingClient(res?.client || client);
        } catch (err) {
            setViewingClient(client);
        }
    };

    // Save from modal
    const handleSaveClientFromModal = async (formData) => {
        try {
            if (editingClient) {
                await clientApi.update(editingClient.id, formData);
                toast.success('Client updated successfully');
            } else {
                await clientApi.create(formData);
                toast.success('Client created successfully');
            }
            setIsAddModalOpen(false);
            setEditingClient(null);
            fetchClients();
        } catch (err) {
            console.error('Failed to save client from modal:', err);
            const msg = err.response?.data?.message || err.message || 'Failed to save client';
            toast.error(msg);
        }
    };


    return (
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0d1117]">
            {/* Top Stats Banner */}
            <div className="px-3 pt-1.5 pb-1.5 border-b border-gray-200 dark:border-white/5 shrink-0">
                <div className="grid grid-cols-4 gap-2">
                    {[
                        {
                            id: 'total',
                            label: 'Total Clients',
                            value: stats.total,
                            color: 'text-gray-900 dark:text-white',
                            bg: 'bg-gray-50 dark:bg-white/[0.03]'
                        },
                        {
                            id: 'jobs',
                            label: 'Job Natures',
                            value: stats.jobNaturesCount,
                            color: 'text-purple-600 dark:text-purple-400',
                            bg: 'bg-purple-50 dark:bg-purple-900/10'
                        },
                        {
                            id: 'sectors',
                            label: 'Sectors',
                            value: stats.sectorsCount,
                            color: 'text-amber-600 dark:text-amber-400',
                            bg: 'bg-amber-50 dark:bg-amber-900/10'
                        },
                        {
                            id: 'phone',
                            label: 'Contact Numbers',
                            value: stats.hasPhone,
                            color: 'text-blue-600 dark:text-blue-400',
                            bg: 'bg-blue-50 dark:bg-blue-900/10'
                        }
                    ].map((s) => (
                        <div
                            key={s.id}
                            className={`${s.bg} rounded-lg p-2 px-3 border border-gray-100 dark:border-white/5`}
                        >
                            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {s.label}
                            </p>
                            <p className={`text-xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Centralized ExcelGrid Component */}
            <ExcelGrid
                data={filteredClients}
                columns={columns}
                primaryKey="id"
                entityName="Clients"
                canWrite={canWrite}
                isLoading={isLoading}
                onSave={handleSaveGridBatch}
                onRefresh={fetchClients}
                isDuplicateModalOpen={isDuplicateModalOpen}
                setIsDuplicateModalOpen={setIsDuplicateModalOpen}
                onViewRow={handleViewClientDetails}
                onArchiveRow={(row) => setReasonAction({ row, type: 'archive' })}
                onRestoreRow={(row) => setReasonAction({ row, type: 'restore' })}
                onDeleteRow={(row) => setReasonAction({ row, type: 'delete' })}
                allowAddColumn={false}
                emptyMessage="No clients found in database"
                extraFilters={
                    <div className="flex items-center gap-2">
                        <PartyStatusFilter value={statusFilter} onChange={setStatusFilter} />
                        <ClientFilterDropdown
                            activeFilters={activeFilters}
                            setActiveFilters={setActiveFilters}
                            allJobNatures={allJobNatures}
                            allSectors={allSectors}
                            filterJobSearch={filterJobSearch}
                            setFilterJobSearch={setFilterJobSearch}
                            filterSectorSearch={filterSectorSearch}
                            setFilterSectorSearch={setFilterSectorSearch}
                        />
                    </div>
                }
                customActions={
                    <div className="flex items-center gap-1.5">
                        {canWrite && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingClient(null);
                                        setIsAddModalOpen(true);
                                    }}
                                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                >
                                    <Plus size={13} className="stroke-[3]" />
                                    <span>Add Client</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsDuplicateModalOpen(true)}
                                    className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                                    title="Check & Resolve Duplicate Clients"
                                >
                                    <CopyCheck size={13} className="text-amber-500 stroke-[2.5]" />
                                    <span>Resolve Duplicates</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsImportFromProjectOpen(true)}
                                    className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                                    title="Import Project-Scoped Clients to Master"
                                >
                                    <Download size={13} className="text-blue-500 stroke-[2.5]" />
                                    <span>Import from Project</span>
                                </button>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsMetadataMenuOpen((prev) => !prev)}
                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-white/10 transition cursor-pointer flex items-center gap-1"
                                        title="Manage Job Natures & Sectors"
                                    >
                                        <SlidersHorizontal size={13} />
                                    </button>
                                    {isMetadataMenuOpen && (
                                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl z-50 py-1 text-xs text-gray-700 dark:text-gray-200 font-semibold animate-in fade-in zoom-in-95">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsMetadataMenuOpen(false);
                                                    setIsJobNatureModalOpen(true);
                                                }}
                                                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                                            >
                                                <span>Manage Nature of Jobs</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsMetadataMenuOpen(false);
                                                    setIsSectorModalOpen(true);
                                                }}
                                                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                                            >
                                                <span>Manage Sectors</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                }
            />

            {/* ─── Client Details Right Drawer ─── */}
            <ClientDetails
                client={viewingClient}
                isOpen={Boolean(viewingClient)}
                canWrite={canWrite}
                onClose={() => setViewingClient(null)}
                onEdit={(c) => {
                    setEditingClient(c);
                    setIsAddModalOpen(true);
                    setViewingClient(null);
                }}
                onArchive={(id) => {
                    const target = clients.find((c) => c.id === id) || viewingClient;
                    setReasonAction({ row: target, type: 'archive' });
                }}
                onRestore={(id) => {
                    const target = clients.find((c) => c.id === id) || viewingClient;
                    setReasonAction({ row: target, type: 'restore' });
                }}
                onDelete={(id) => {
                    const target = clients.find((c) => c.id === id) || viewingClient;
                    setReasonAction({ row: target, type: 'delete' });
                }}
                onUpdate={async () => {
                    if (viewingClient?.id && !String(viewingClient.id).startsWith('temp_') && !isNaN(Number(viewingClient.id))) {
                        try {
                            const res = await clientApi.getById(viewingClient.id);
                            if (res?.client) setViewingClient(res.client);
                        } catch (err) {
                            console.error('Failed to refresh viewing client:', err);
                        }
                    }
                    fetchClients(statusFilter);
                }}
            />

            {/* ─── Add / Edit Client Modal ─── */}
            {isAddModalOpen && (
                <AddEditClient
                    isOpen={isAddModalOpen}
                    onClose={() => {
                        setIsAddModalOpen(false);
                        setEditingClient(null);
                    }}
                    onSave={handleSaveClientFromModal}
                    initialData={editingClient}
                    allJobNatures={allJobNatures}
                    allSectors={allSectors}
                    jobOptions={jobOptions}
                    sectorOptions={sectorOptions}
                    onRefreshMetadata={fetchMetadata}
                />
            )}

            {/* ─── Manage Metadata Modals ─── */}
            {isJobNatureModalOpen && (
                <ManageMetadataModal
                    isOpen={isJobNatureModalOpen}
                    onClose={() => {
                        setIsJobNatureModalOpen(false);
                        fetchMetadata();
                    }}
                    type="job_natures"
                    title="Manage Nature of Jobs"
                    onUpdate={fetchMetadata}
                />
            )}

            {isSectorModalOpen && (
                <ManageMetadataModal
                    isOpen={isSectorModalOpen}
                    onClose={() => {
                        setIsSectorModalOpen(false);
                        fetchMetadata();
                    }}
                    type="sectors"
                    title="Manage Sectors"
                    onUpdate={fetchMetadata}
                />
            )}

            <ImportPartyFromProjectDialog
                isOpen={isImportFromProjectOpen}
                partyType="client"
                onClose={() => setIsImportFromProjectOpen(false)}
                onSuccess={() => fetchClients(statusFilter)}
            />

            <PartyReasonModal
                action={reasonAction}
                entityLabel="Client"
                onArchive={clientApi.archive}
                onRestore={clientApi.restore}
                onDelete={clientApi.remove}
                onClose={() => setReasonAction(null)}
                onSuccess={() => {
                    setReasonAction(null);
                    setViewingClient(null);
                    fetchClients(statusFilter);
                }}
            />
        </div>
    );
};

export default ClientsList;
