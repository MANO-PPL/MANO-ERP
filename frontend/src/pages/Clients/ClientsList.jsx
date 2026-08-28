import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Building,
    Plus,
    SlidersHorizontal,
    Sparkles,
    Eye,
    Edit3,
    Trash2
} from 'lucide-react';
import api from '../../services/api';
import clientApi from '../../services/clientApi';
import ClientDetails from './ClientDetails';
import ClientFilterDropdown from './ClientFilterDropdown';
import AddEditClient from './AddEditClient';
import ManageMetadataModal from '../../components/ManageMetadataModal';
import DuplicateResolverModal from '../../components/DuplicateResolverModal';
import { ExcelGrid } from '../../components/ExcelGrid';
import { useAuth } from '../../context/AuthContext';

const COLUMN_ALIASES = {
    name: ['company name', 'client name', 'client', 'firm', 'agency', 'organization', 'name', 'party name', 'title'],
    job_name: ['nature of job', 'job nature', 'scope of work', 'scope', 'trade', 'nature', 'work nature', 'service', 'job', 'project type'],
    sector_name: ['sector', 'sector name', 'industry', 'domain', 'business sector', 'category', 'type'],
    contact_person: ['contact person', 'contact name', 'poc', 'representative', 'person', 'contact'],
    designation: ['designation', 'position', 'title', 'job title', 'role / designation'],
    telephone_no: ['contact no', 'phone no', 'mobile no', 'telephone', 'phone', 'mobile', 'cell', 'contact number', 'telephone no', 'tel'],
    email: ['email id', 'email', 'e-mail', 'mail', 'email address', 'mail id'],
    address: ['address', 'office address', 'site address', 'full address', 'street'],
    location: ['location', 'city', 'state', 'area', 'branch'],
    remarks: ['remarks', 'notes', 'comments', 'description', 'remark', 'note']
};

export const ClientsList = () => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('clients', 2);

    const [clients, setClients] = useState([]);
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
    const [isJobNatureModalOpen, setIsJobNatureModalOpen] = useState(false);
    const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);

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
    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const res = await clientApi.getClients({ limit: 50000 });
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
        fetchClients();
    }, []);

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

    // Column Definitions for ExcelGrid
    const columns = useMemo(() => {
        const jobOptions = allJobNatures.map((j) => j.job_name || j.name || j);
        const sectorOptions = allSectors.map((s) => s.sector_name || s.name || s);

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
                key: 'remarks',
                label: 'Remarks',
                width: '200px',
                minWidth: '180px',
                aliases: COLUMN_ALIASES.remarks
            }
        ];
    }, [allJobNatures, allSectors]);

    // Batch Save Handler connecting to clientApi
    const handleSaveGridBatch = async (payload) => {
        const { created, updated, deleted } = payload;

        // 1. Delete rows
        if (deleted.length > 0) {
            await clientApi.deleteClients(deleted);
        }

        // 2. Create new rows
        if (created.length > 0) {
            for (const item of created) {
                if (item.name && item.name.trim()) {
                    await clientApi.createClient(item);
                }
            }
        }

        // 3. Update modified rows
        if (updated.length > 0) {
            for (const item of updated) {
                if (item.id && item.name && item.name.trim()) {
                    await clientApi.updateClient(item.id, item);
                }
            }
        }

        // Reload data
        await fetchClients();
    };

    // View Details Drawer Handler
    const handleViewClientDetails = async (client) => {
        try {
            const res = await clientApi.getClientById(client.id);
            setViewingClient(res?.client || client);
        } catch (err) {
            setViewingClient(client);
        }
    };

    // Save from modal
    const handleSaveClientFromModal = async (formData) => {
        try {
            if (editingClient) {
                await clientApi.updateClient(editingClient.id, formData);
            } else {
                await clientApi.createClient(formData);
            }
            setIsAddModalOpen(false);
            setEditingClient(null);
            fetchClients();
        } catch (err) {
            console.error('Failed to save client from modal:', err);
        }
    };

    // Duplicate Resolver delete
    const handleConfirmDeleteDuplicates = async (idsToDelete) => {
        if (!idsToDelete || idsToDelete.length === 0) return;
        await clientApi.deleteClients(idsToDelete);
        fetchClients();
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
                onViewRow={handleViewClientDetails}
                onEditRow={(client) => {
                    setEditingClient(client);
                    setIsAddModalOpen(true);
                }}
                emptyMessage="No clients found in database"
                extraFilters={
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
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-white/10 transition cursor-pointer"
                                    title="Check & Resolve Duplicates"
                                >
                                    <Sparkles size={13} className="text-purple-500" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsJobNatureModalOpen(true)}
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-white/10 transition cursor-pointer"
                                    title="Manage Job Natures & Sectors"
                                >
                                    <SlidersHorizontal size={13} />
                                </button>
                            </>
                        )}
                    </div>
                }
            />

            {/* ─── Client Details Right Drawer ─── */}
            <ClientDetails
                client={viewingClient}
                isOpen={Boolean(viewingClient)}
                onClose={() => setViewingClient(null)}
                onEdit={(c) => {
                    setEditingClient(c);
                    setIsAddModalOpen(true);
                    setViewingClient(null);
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
                />
            )}

            {/* ─── Manage Metadata Modal ─── */}
            {isJobNatureModalOpen && (
                <ManageMetadataModal
                    isOpen={isJobNatureModalOpen}
                    onClose={() => {
                        setIsJobNatureModalOpen(false);
                        fetchMetadata();
                    }}
                    type="job_natures"
                    title="Manage Nature of Jobs"
                />
            )}

            {/* ─── Duplicate Resolver Modal ─── */}
            {isDuplicateModalOpen && (
                <DuplicateResolverModal
                    isOpen={isDuplicateModalOpen}
                    onClose={() => setIsDuplicateModalOpen(false)}
                    onConfirm={handleConfirmDeleteDuplicates}
                    items={clients}
                    primaryKey="name"
                    entityName="Clients"
                />
            )}
        </div>
    );
};

export default ClientsList;
