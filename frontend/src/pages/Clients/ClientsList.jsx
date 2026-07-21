import React, { useState, useRef, useEffect } from 'react';
import { GripVertical, Filter, Search, ChevronDown, Pencil, Trash2, Info, Plus, X, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import ClientDetails from './ClientDetails';
import ClientFilter from './ClientFilter';
import AddEditClient from './AddEditClient';
import ManageMetadataModal from '../../components/ManageMetadataModal';
import { useAuth } from '../../context/AuthContext';

const ClientsList = () => {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('clients', 2);
    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [allJobNatures, setAllJobNatures] = useState([]);
    const [allSectors, setAllSectors] = useState([]);
    const recordsPerPage = 20;

    // Modal States
    const [viewingClient, setViewingClient] = useState(null);
    const [editingClient, setEditingClient] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isJobNatureModalOpen, setIsJobNatureModalOpen] = useState(false);
    const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
    const [isManageDropdownOpen, setIsManageDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Filter & Search States
    const [searchFilters, setSearchFilters] = useState({ company: '', jobNature: '', person: '', location: '' });
    const [debouncedSearchFilters, setDebouncedSearchFilters] = useState({ company: '', jobNature: '', person: '', location: '' });
    const [activeFilters, setActiveFilters] = useState({ jobs: [], sectors: [] });
    const [hoveredRow, setHoveredRow] = useState(null);

    const fetchClients = async (page = currentPage, force = false) => {
        const params = {
            ...debouncedSearchFilters,
            page,
            limit: recordsPerPage,
            jobs: activeFilters.jobs.join(','),
            sectors: activeFilters.sectors ? activeFilters.sectors.join(',') : ''
        };

        const cacheKey = `crm_clients_${JSON.stringify(params)}`;
        const cacheTimeKey = `crm_clients_time_${JSON.stringify(params)}`;
        const CACHE_TTL = 50000; // 50 seconds

        if (force) {
            Object.keys(sessionStorage).forEach(key => {
                if (key.startsWith('crm_clients_')) {
                    sessionStorage.removeItem(key);
                }
            });
        }

        const cached = sessionStorage.getItem(cacheKey);
        const cachedTime = sessionStorage.getItem(cacheTimeKey);
        const now = Date.now();

        if (cached && cachedTime) {
            try {
                const parsed = JSON.parse(cached);
                setClients(parsed.clients);
                setTotalRecords(parsed.total);
                setIsLoading(false);
                if (now - parseInt(cachedTime) < CACHE_TTL) {
                    return;
                }
            } catch (e) {
                console.error("Failed to parse cached clients", e);
            }
        } else {
            setIsLoading(true);
        }

        try {
            const res = await api.get('/clients', { params });
            if (res.data.success) {
                setClients(res.data.clients);
                setTotalRecords(res.data.total);
                sessionStorage.setItem(cacheKey, JSON.stringify({
                    clients: res.data.clients,
                    total: res.data.total
                }));
                sessionStorage.setItem(cacheTimeKey, now.toString());
            }
        } catch (err) {
            setError('Failed to load clients');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMetadata = async () => {
        try {
            const [jobRes, sectorRes] = await Promise.all([
                api.get('/admin/job-natures'),
                api.get('/admin/sectors')
            ]);

            if (jobRes.data.success) {
                setAllJobNatures(jobRes.data.job_natures);
            }
            if (sectorRes.data.success) {
                setAllSectors(sectorRes.data.sectors);
            }
        } catch (err) {
            console.error('Failed to fetch metadata:', err);
        }
    };

    // Debounce search filters
    useEffect(() => {
        fetchMetadata(); // Fetch once on mount
    }, []);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchFilters(searchFilters);
            setCurrentPage(1); // Reset to first page on search
        }, 500);
        return () => clearTimeout(handler);
    }, [searchFilters]);

    // Reset page on modal filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeFilters]);

    // Main fetch effect
    useEffect(() => {
        fetchClients(currentPage);
    }, [currentPage, debouncedSearchFilters, activeFilters]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsManageDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSaveClient = async (clientData) => {
        try {
            if (editingClient) {
                const res = await api.put(`/clients/${editingClient.id}`, clientData);
                if (res.data.success) {
                    toast.success('Client updated successfully');
                    fetchClients(currentPage, true);
                    fetchMetadata();
                }
            } else {
                const res = await api.post('/clients', clientData);
                if (res.data.success) {
                    toast.success('Client added successfully');
                    fetchClients(currentPage, true);
                    fetchMetadata();
                }
            }
            setIsAddModalOpen(false);
            setEditingClient(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save client');
        }
    };

    const handleDeleteClient = async (id) => {
        if (!window.confirm('Are you sure you want to delete this client?')) return;
        try {
            const res = await api.delete(`/clients/${id}`);
            if (res.data.success) {
                toast.success('Client deleted');
                fetchClients(currentPage, true);
            }
        } catch (err) {
            toast.error('Failed to delete client');
        }
    };

    const handleViewClient = async (client) => {
        try {
            const res = await api.get(`/clients/${client.id}`);
            if (res.data.success) {
                setViewingClient(res.data.client);
            }
        } catch (err) {
            console.error('Error fetching client details:', err);
            toast.error('Failed to load client details');
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors h-full">
            {/* Header Area */}
            <div className="px-8 py-3 flex items-center justify-end gap-3 border-b border-gray-200 dark:border-white/5 shrink-0 relative overflow-visible z-20">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex space-x-2">
                        <div className="relative">
                        <input
                            type="text"
                            placeholder="Search clients..."
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
                            value={searchFilters.company}
                            onChange={e => setSearchFilters(prev => ({ ...prev, company: e.target.value }))}
                        />
                        </div>
                    </div>

                    <button
                        onClick={() => setIsFilterModalOpen(true)}
                        className={`flex items-center space-x-2 px-6 py-2 border rounded-lg text-sm font-medium transition-all ${(activeFilters.jobs.length > 0 || activeFilters.sectors.length > 0) ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-blue-500 bg-blue-600 dark:bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                        <span>Filter</span>
                        <Filter size={16} fill="currentColor" className={activeFilters.jobs.length > 0 || activeFilters.sectors.length > 0 ? '' : 'text-white'} />
                        {(activeFilters.jobs.length > 0 || activeFilters.sectors.length > 0) && (
                            <span className="ml-1 bg-blue-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                                {activeFilters.jobs.length + activeFilters.sectors.length}
                            </span>
                        )}
                    </button>

                    {canWrite && (
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setIsManageDropdownOpen(!isManageDropdownOpen)}
                                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                            >
                                <span>Manage Clients</span>
                                <ChevronDown size={14} className={`transition-transform duration-200 ${isManageDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isManageDropdownOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#161b22] rounded-lg shadow-xl border border-gray-200 dark:border-white/10 z-[5000] anim-fade-in overflow-hidden">
                                    <button
                                        onClick={() => { setIsAddModalOpen(true); setIsManageDropdownOpen(false); }}
                                        className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                    >
                                        <Plus size={16} className="mr-3 text-emerald-500" />
                                        Add Manual Client
                                    </button>
                                    <button
                                        onClick={() => { navigate('/clients/bulk-upload'); setIsManageDropdownOpen(false); }}
                                        className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                    >
                                        <UploadCloud size={16} className="mr-3 text-blue-500" />
                                        Bulk Upload CSV
                                    </button>
                                    <button
                                        onClick={() => { setIsJobNatureModalOpen(true); setIsManageDropdownOpen(false); }}
                                        className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 border-t border-gray-100 dark:border-white/5 transition-colors"
                                    >
                                        <Plus size={16} className="mr-3 text-blue-500" />
                                        Manage Job Natures
                                    </button>
                                    <button
                                        onClick={() => { setIsSectorModalOpen(true); setIsManageDropdownOpen(false); }}
                                        className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 border-t border-gray-100 dark:border-white/5 transition-colors"
                                    >
                                        <Plus size={16} className="mr-3 text-blue-500" />
                                        Manage Sectors
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto custom-scrollbar p-0">
                <table className="w-full text-left whitespace-nowrap text-[13px] border-collapse bg-white dark:bg-[#0d1117]">
                    <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-white/5 tracking-widest text-[10px] uppercase font-bold">
                        <tr>
                            <th className="px-3 py-2.5 w-6"></th>
                            <th className="px-4 py-2.5 w-12 text-center">SR NO</th>
                            <th className="px-4 py-2.5">COMPANY</th>
                            <th className="px-4 py-2.5">NATURE OF THE JOB</th>
                            <th className="px-4 py-2.5">NAME OF THE PERSON</th>
                            <th className="px-4 py-2.5">DESIGNATION</th>
                            <th className="px-4 py-2.5">CONTACT NO</th>
                            <th className="px-4 py-2.5 font-sans whitespace-normal min-w-[200px]">ADDRESS</th>
                            <th className="px-4 py-2.5 text-center">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5 bg-white dark:bg-[#0d1117]">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {Array.from({ length: 9 }).map((_, j) => (
                                        <td key={j} className="px-4 py-3">
                                            <div className="h-3 bg-gray-200 dark:bg-white/10 rounded"></div>
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : clients.length > 0 ? (
                            clients.map((client, idx) => (
                                <tr
                                    key={client.id}
                                    className="hover:bg-blue-50/30 dark:hover:bg-white/[0.02] transition-colors group/row text-gray-700 dark:text-gray-300 relative"
                                    onMouseEnter={() => setHoveredRow(idx)}
                                    onMouseLeave={() => setHoveredRow(null)}
                                    onClick={() => handleViewClient(client)}
                                >
                                    <td className="px-3 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                                        <GripVertical size={14} className="text-transparent group-hover/row:text-gray-400 dark:group-hover/row:text-gray-500 hover:!text-blue-500 transition-colors mx-auto cursor-grab active:cursor-grabbing" />
                                    </td>
                                    <td className="px-4 py-1.5 text-center font-mono text-gray-400">{(currentPage - 1) * recordsPerPage + idx + 1}</td>
                                    <td className="px-4 py-1.5 font-medium text-gray-900 dark:text-gray-100 cursor-pointer">{client.name}</td>
                                    <td className="px-4 py-1.5">{client.job_name}</td>
                                    <td className="px-4 py-1.5">{client.contact_person}</td>
                                    <td className="px-4 py-1.5">{client.designation}</td>
                                    <td className="px-4 py-1.5 font-mono text-xs">{client.contact_no}</td>
                                    <td className="px-4 py-1.5 truncate max-w-[200px]" title={client.address}>{client.address}</td>
                                    <td className="px-4 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                                        <div className={`flex items-center justify-center space-x-2 transition-opacity duration-200 ${hoveredRow === idx ? 'opacity-100' : 'opacity-0'}`}>
                                            <button
                                                onClick={() => handleViewClient(client)}
                                                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all"
                                                title="View Details"
                                            >
                                                <Info size={16} />
                                            </button>
                                            {canWrite && (
                                                <>
                                                    <button
                                                        onClick={() => { setEditingClient(client); setIsAddModalOpen(true); }}
                                                        className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-all"
                                                        title="Edit Client"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClient(client.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                                        title="Delete Client"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="9" className="py-12 text-center text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                            <Search size={24} className="text-gray-400" />
                                        </div>
                                        <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">No clients found</p>
                                        <p className="text-sm">Try adjusting your filters or search terms.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-8 py-3 bg-white dark:bg-[#0d1117] border-t border-gray-200 dark:border-white/5 flex items-center justify-between shrink-0">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    Showing <span className="font-medium text-gray-900 dark:text-white">{Math.min((currentPage - 1) * recordsPerPage + 1, totalRecords)}</span> to <span className="font-medium text-gray-900 dark:text-white">{Math.min(currentPage * recordsPerPage, totalRecords)}</span> of <span className="font-medium text-gray-900 dark:text-white">{totalRecords}</span> records
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1 || isLoading}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Previous
                    </button>
                    <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.ceil(totalRecords / recordsPerPage) }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === Math.ceil(totalRecords / recordsPerPage) || Math.abs(p - currentPage) <= 1)
                            .map((pageNum, idx, array) => (
                                <React.Fragment key={pageNum}>
                                    {idx > 0 && array[idx - 1] !== pageNum - 1 && <span className="text-gray-400 px-1 text-xs">...</span>}
                                    <button
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-8 h-8 flex items-center justify-center text-xs font-medium rounded-lg transition-all ${currentPage === pageNum ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                                    >
                                        {pageNum}
                                    </button>
                                </React.Fragment>
                            ))
                        }
                    </div>
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalRecords / recordsPerPage)))}
                        disabled={currentPage === Math.ceil(totalRecords / recordsPerPage) || isLoading || totalRecords === 0}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Next
                    </button>
                </div>
            </div>

            {/* Modals */}
            <ClientFilter
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                currentFilters={activeFilters}
                availableJobs={allJobNatures.map(j => j.job_name)}
                availableSectors={allSectors.map(s => s.sector_name)}
                onApply={(filters) => setActiveFilters(filters)}
            />

            <AddEditClient
                isOpen={isAddModalOpen}
                onClose={() => { setIsAddModalOpen(false); setEditingClient(null); }}
                initialData={editingClient}
                onSave={handleSaveClient}
                availableSectors={allSectors}
                availableJobNatures={allJobNatures}
            />

            <ClientDetails
                isOpen={!!viewingClient}
                onClose={() => setViewingClient(null)}
                client={viewingClient}
                onUpdate={() => {
                    fetchClients(currentPage, true);
                    if (viewingClient) handleViewClient(viewingClient);
                }}
            />

            <ManageMetadataModal
                isOpen={isJobNatureModalOpen}
                onClose={() => setIsJobNatureModalOpen(false)}
                title="Manage Job Natures"
                endpoint="/admin/job-natures"
                itemNameKey="job_name"
                itemIdKey="job_id"
                listKey="job_natures"
                addPlaceholder="Enter Job Nature (e.g. Electrical)"
                onUpdate={() => {
                    fetchClients(currentPage, true);
                    fetchMetadata();
                }}
            />

            <ManageMetadataModal
                isOpen={isSectorModalOpen}
                onClose={() => setIsSectorModalOpen(false)}
                title="Manage Sectors"
                endpoint="/admin/sectors"
                itemNameKey="sector_name"
                itemIdKey="sector_id"
                listKey="sectors"
                addPlaceholder="Enter Sector (e.g. IT)"
                onUpdate={() => {
                    fetchClients(currentPage, true);
                    fetchMetadata();
                }}
            />
        </div>
    );
};

export default ClientsList;
