import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, Plus, RefreshCw, Search, Trash2, Users, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { generalDocsApi } from '../../../services/generalDocsApi';
import { toast } from 'react-toastify';

const normalizeParty = (party, linked = true) => ({
    id: linked ? (party.pv_id ?? party.project_party_id) : party.id,
    contactId: linked ? party.party_id : party.id,
    name: party.name,
    category: party.category || party.contact_category || party.party_category || 'Uncategorized',
    person: party.contact_person,
    phone: party.mobile || party.telephone_no,
    email: party.email,
    address: party.address,
    jobNature: party.job_nature,
});

const categoryStyles = {
    client: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:text-emerald-300',
    pmc: 'bg-violet-500/10 text-violet-600 border-violet-500/25 dark:text-violet-300',
    contractor: 'bg-amber-500/10 text-amber-600 border-amber-500/25 dark:text-amber-300',
    supplier: 'bg-blue-500/10 text-blue-600 border-blue-500/25 dark:text-blue-300',
    consultants: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/25 dark:text-cyan-300',
    consultant: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/25 dark:text-cyan-300',
};

const categoryClass = (category) => (
    categoryStyles[String(category || '').toLowerCase()]
    || 'bg-gray-500/10 text-gray-600 border-gray-500/25 dark:text-gray-300'
);

const ProjectPartiesList = ({ onBack, setExtraBreadcrumbs, canWrite }) => {
    const { id: projectId } = useParams();
    const [parties, setParties] = useState([]);
    const [availableParties, setAvailableParties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [availableLoading, setAvailableLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [listSearch, setListSearch] = useState('');
    const [availableSearch, setAvailableSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [actionId, setActionId] = useState(null);

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'General Documents', onClick: onBack },
            { label: 'Project Parties' },
        ]);
    }, [onBack, projectId, setExtraBreadcrumbs]);

    const fetchParties = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const response = await generalDocsApi.getParties(projectId);
            setParties((response.parties || []).map((party) => normalizeParty(party)));
        } catch (error) {
            console.error('Failed to fetch project parties:', error);
            toast.error(error.response?.data?.message || 'Unable to load project parties');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    const fetchAvailableParties = useCallback(async () => {
        setAvailableLoading(true);
        try {
            const response = await generalDocsApi.getAvailableParties(projectId);
            setAvailableParties((response.parties || []).map((party) => normalizeParty(party, false)));
        } catch (error) {
            console.error('Failed to fetch available parties:', error);
            toast.error(error.response?.data?.message || 'Unable to load available parties');
        } finally {
            setAvailableLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchParties();
    }, [fetchParties]);

    useEffect(() => {
        if (isAdding) fetchAvailableParties();
    }, [fetchAvailableParties, isAdding]);

    const categories = useMemo(() => {
        const values = parties.map((party) => party.category).filter(Boolean);
        return [...new Set(values)].sort((a, b) => a.localeCompare(b));
    }, [parties]);

    const filteredParties = useMemo(() => {
        const search = listSearch.trim().toLowerCase();
        return parties.filter((party) => {
            const matchesCategory = categoryFilter === 'all'
                || party.category.toLowerCase() === categoryFilter.toLowerCase();
            const searchable = [party.name, party.person, party.category, party.jobNature, party.email]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return matchesCategory && (!search || searchable.includes(search));
        });
    }, [categoryFilter, listSearch, parties]);

    const filteredAvailableParties = useMemo(() => {
        const search = availableSearch.trim().toLowerCase();
        return availableParties.filter((party) => {
            const searchable = [party.name, party.person, party.category, party.jobNature, party.email]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return !search || searchable.includes(search);
        });
    }, [availableParties, availableSearch]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchParties(true);
        setRefreshing(false);
    };

    const handleAdd = async (party) => {
        setActionId(`add-${party.contactId}`);
        try {
            await generalDocsApi.addParties(projectId, [party.contactId]);
            toast.success(`${party.name} added to project parties`);
            setIsAdding(false);
            setAvailableSearch('');
            await fetchParties(true);
        } catch (error) {
            console.error('Failed to add project party:', error);
            toast.error(error.response?.data?.message || 'Unable to add party');
        } finally {
            setActionId(null);
        }
    };

    const handleDelete = async (party) => {
        if (!window.confirm(`Remove ${party.name || 'this party'} from the project?`)) return;

        setActionId(`delete-${party.id}`);
        try {
            await generalDocsApi.deleteParty(projectId, party.id);
            setParties((current) => current.filter((item) => item.id !== party.id));
            toast.success(`${party.name} removed from project parties`);
        } catch (error) {
            console.error('Failed to remove project party:', error);
            toast.error(error.response?.data?.message || 'Unable to remove party');
        } finally {
            setActionId(null);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left">
            <div className="px-5 md:px-8 py-4 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-[#0d1117]">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-start gap-3">
                        <button
                            onClick={onBack}
                            className="mt-0.5 p-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 rounded-lg transition-all active:scale-95"
                            title="Back to General Documents"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">Project Parties</h1>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                    Direct list
                                </span>
                            </div>
                            <p className="mt-1 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                                Manage every client, PMC, contractor, supplier, consultant, and other party linked to this project.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing || loading}
                            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg border border-gray-200 dark:border-white/10 disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                        {canWrite && (
                            <button
                                onClick={() => setIsAdding((current) => !current)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                            >
                                {isAdding ? <X size={16} /> : <Plus size={16} />}
                                {isAdding ? 'Close' : 'Add party'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar p-5 md:p-7">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-[#161b22] p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Users size={18} /></div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Linked parties</p>
                                <p className="text-xl font-semibold text-gray-900 dark:text-white">{parties.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-[#161b22] p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-500"><Building2 size={18} /></div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Categories</p>
                                <p className="text-xl font-semibold text-gray-900 dark:text-white">{categories.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-[#161b22] p-4">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Access</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{canWrite ? 'Editable' : 'Read only'}</p>
                        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Changes are saved immediately.</p>
                    </div>
                </div>

                <AnimatePresence>
                    {isAdding && canWrite && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, y: -8 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -8 }}
                            className="mb-5 overflow-hidden"
                        >
                            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] dark:bg-blue-500/[0.06] p-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Add a project party</h2>
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Select a contact from the CRM master. All categories are available.</p>
                                    </div>
                                    <div className="relative w-full md:w-80">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            autoFocus
                                            value={availableSearch}
                                            onChange={(event) => setAvailableSearch(event.target.value)}
                                            placeholder="Search name, category, or contact..."
                                            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22]">
                                    {availableLoading ? (
                                        <div className="px-4 py-8 text-center text-xs text-gray-500">Loading available parties...</div>
                                    ) : filteredAvailableParties.length === 0 ? (
                                        <div className="px-4 py-8 text-center text-xs text-gray-500">
                                            {availableSearch ? 'No matching parties found.' : 'All CRM parties are already linked.'}
                                        </div>
                                    ) : (
                                        filteredAvailableParties.map((party) => (
                                            <button
                                                key={party.contactId}
                                                onClick={() => handleAdd(party)}
                                                disabled={actionId === `add-${party.contactId}`}
                                                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left border-b last:border-b-0 border-gray-100 dark:border-white/5 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-xs font-semibold text-gray-900 dark:text-white">{party.name || 'Unnamed party'}</p>
                                                    <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                                                        {[party.person, party.jobNature].filter(Boolean).join(' · ') || 'No additional details'}
                                                    </p>
                                                </div>
                                                <span className={`shrink-0 px-2 py-1 rounded-full border text-[9px] font-semibold uppercase tracking-wide ${categoryClass(party.category)}`}>
                                                    {party.category}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Linked parties</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Showing {filteredParties.length} of {parties.length}
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={listSearch}
                                onChange={(event) => setListSearch(event.target.value)}
                                placeholder="Search linked parties..."
                                className="w-full sm:w-64 pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500"
                            />
                        </div>
                        <select
                            value={categoryFilter}
                            onChange={(event) => setCategoryFilter(event.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500"
                        >
                            <option value="all">All categories</option>
                            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117]">
                    {loading ? (
                        <div className="px-4 py-16 text-center text-sm text-gray-500">Loading project parties...</div>
                    ) : filteredParties.length === 0 ? (
                        <div className="px-4 py-16 text-center">
                            <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400">
                                <Users size={22} />
                            </div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                {parties.length === 0 ? 'No parties linked yet' : 'No matching parties'}
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {parties.length === 0 ? 'Add contacts from the CRM master to start this project directory.' : 'Try a different search or category filter.'}
                            </p>
                        </div>
                    ) : (
                        <table className="w-full min-w-[850px] text-left text-[12px]">
                            <thead className="bg-gray-50 dark:bg-[#161b22] border-b border-gray-200 dark:border-white/10">
                                <tr>
                                    <th className="px-4 py-3 w-14 text-center text-[10px] uppercase tracking-wider text-gray-500">#</th>
                                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500">Party</th>
                                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500">Category</th>
                                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500">Contact person</th>
                                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500">Phone</th>
                                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500">Email</th>
                                    {canWrite && <th className="px-4 py-3 w-20 text-center text-[10px] uppercase tracking-wider text-gray-500">Action</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {filteredParties.map((party, index) => (
                                    <tr key={party.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                                        <td className="px-4 py-3 text-center text-gray-400 font-mono">{index + 1}</td>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-gray-900 dark:text-white">{party.name || 'Unnamed party'}</p>
                                            {party.jobNature && <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{party.jobNature}</p>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex px-2 py-1 rounded-full border text-[9px] font-semibold uppercase tracking-wide ${categoryClass(party.category)}`}>
                                                {party.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{party.person || '-'}</td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{party.phone || '-'}</td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{party.email || '-'}</td>
                                        {canWrite && (
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleDelete(party)}
                                                    disabled={actionId === `delete-${party.id}`}
                                                    title="Remove from project"
                                                    className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectPartiesList;
