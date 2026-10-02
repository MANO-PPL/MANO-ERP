import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ChevronDown, ChevronRight, FileSpreadsheet, Link2, Network, Phone, Mail, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { MobileCard } from '../../../components/MobileCard';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import MobileConfirmModal from '../../../components/MobileConfirmModal';
import MobileEmptyState from '../../../components/MobileEmptyState';
import MobileFAB from '../../../components/MobileFAB';
import MobileLoadingState from '../../../components/MobileLoadingState';
import MobileSearchBar from '../../../components/MobileSearchBar';
import MobileSelect from '../../../components/MobileSelect';
import MobileTabs from '../../../components/MobileTabs';
import { createGeneralDocumentsRequestGuard, directoryPayload, normalizeAvailableParties, normalizeDirectory } from './mobileGeneralDocumentsModel';

const CATEGORY_OPTIONS = ['All', 'Client', 'PMC', 'Contractor', 'Consultant', 'Supplier', 'Other'];

const CATEGORY_BADGES = {
    Client: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    PMC: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800',
    Contractor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    Consultant: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800',
    Supplier: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
    Other: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gh-hover dark:text-gh-muted dark:border-gh-border'
};

const inputClass = 'mt-1 min-h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-normal outline-none focus:border-blue-500 dark:border-gh-border dark:bg-gh-input dark:text-gh-text';

export default function MobileProjectDirectoryOrgChart({
    projectId,
    canWrite,
    api,
    initialTab = 'directory'
}) {
    const [tab, setTab] = useState(initialTab === 'chart' ? 'chart' : 'directory');
    const [contacts, setContacts] = useState([]);
    const [parties, setParties] = useState([]);
    const [orgData, setOrgData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');

    // Expand state for companies in Directory
    const [expandedCompanyIds, setExpandedCompanyIds] = useState(new Set());

    // CRM Linking modal
    const [isLinkCrmOpen, setIsLinkCrmOpen] = useState(false);
    const [crmCandidates, setCrmCandidates] = useState([]);
    const [chosenCrmIds, setChosenCrmIds] = useState(new Set());
    const [crmLoading, setCrmLoading] = useState(false);

    // Contact/Personnel editor modal
    const [editor, setEditor] = useState(null);

    // Deletion confirmation modal
    const [confirmDelete, setConfirmDelete] = useState(null); // { type: 'person' | 'party', item }
    const [pending, setPending] = useState(false);

    const guard = useRef(createGeneralDocumentsRequestGuard());
    const activeProject = useRef(projectId);
    const current = (origin) => String(activeProject.current) === String(origin);

    const loadData = useCallback(async (origin = projectId) => {
        const token = guard.current.begin(origin, 'directory-orgchart');
        if (current(origin)) {
            setLoading(true);
            setError('');
        }
        try {
            const [dirRes, partiesRes, orgRes] = await Promise.all([
                api.getDirectory(origin),
                api.getParties(origin),
                api.getOrgChart(origin)
            ]);
            if (current(origin) && guard.current.isCurrent(token)) {
                const normDir = normalizeDirectory(dirRes);
                setContacts(normDir);
                setParties(partiesRes.parties || []);
                setOrgData(orgRes?.data || orgRes || null);
            }
        } catch (err) {
            if (current(origin) && guard.current.isCurrent(token)) {
                setError(err?.response?.status === 403 ? 'Access denied by current ERP permission policy.' : 'Failed to load project directory & organisation data.');
            }
        } finally {
            if (current(origin) && guard.current.isCurrent(token)) {
                setLoading(false);
            }
        }
    }, [api, projectId]);

    useEffect(() => {
        activeProject.current = projectId;
        setContacts([]);
        setParties([]);
        setOrgData(null);
        setEditor(null);
        setConfirmDelete(null);
        setPending(false);
        setIsLinkCrmOpen(false);
        setTab(initialTab === 'chart' ? 'chart' : 'directory');
        loadData(projectId);
    }, [initialTab, loadData, projectId]);

    // Group directory contacts by party/company
    const groupedCompanies = useMemo(() => {
        const map = new Map();

        // 1. Seed with linked parties
        parties.forEach((p) => {
            const id = p.id || p.pv_id || p.party_id;
            const key = `party_${id}`;
            map.set(key, {
                key,
                partyId: id,
                name: p.name || p.company_name || 'Unnamed Company',
                category: p.category || 'Contractor',
                jobNature: p.job_nature || p.job_name || '',
                address: p.address || p.address_line || '',
                personnel: []
            });
        });

        // 2. Associate contacts with parties or create company group
        contacts.forEach((c) => {
            const partyKey = c.partyId ? `party_${c.partyId}` : `company_${(c.companyName || 'General Directory').trim().toLowerCase()}`;
            if (!map.has(partyKey)) {
                map.set(partyKey, {
                    key: partyKey,
                    partyId: c.partyId || null,
                    name: c.companyName || 'General Directory',
                    category: c.category || 'Other',
                    jobNature: c.jobNature || '',
                    address: c.addressLine || '',
                    personnel: []
                });
            }
            map.get(partyKey).personnel.push(c);
        });

        return Array.from(map.values());
    }, [contacts, parties]);

    // Filtered companies based on query and category
    const filteredCompanies = useMemo(() => {
        return groupedCompanies.filter((company) => {
            const matchesCategory = categoryFilter === 'All' || (company.category || '').toLowerCase() === categoryFilter.toLowerCase();
            const searchTarget = [
                company.name,
                company.category,
                company.jobNature,
                ...company.personnel.flatMap((p) => [p.contactPerson, p.designation, p.mobileNo, p.email, p.responsibilities])
            ].filter(Boolean).join(' ').toLowerCase();
            const matchesQuery = !query || searchTarget.includes(query.toLowerCase());
            return matchesCategory && matchesQuery;
        });
    }, [categoryFilter, groupedCompanies, query]);

    // Toggle company expansion
    const toggleCompany = (companyKey) => {
        setExpandedCompanyIds((prev) => {
            const next = new Set(prev);
            if (next.has(companyKey)) next.delete(companyKey);
            else next.add(companyKey);
            return next;
        });
    };

    // Open CRM link modal
    const openCrmLink = async () => {
        const origin = projectId;
        if (!canWrite || !current(origin)) return;
        setIsLinkCrmOpen(true);
        setChosenCrmIds(new Set());
        setCrmLoading(true);
        try {
            const res = await api.getAvailableParties(origin, { limit: 1000 });
            if (current(origin)) {
                setCrmCandidates(normalizeAvailableParties(res));
            }
        } catch {
            if (current(origin)) setError('Available CRM contacts could not be loaded.');
        } finally {
            if (current(origin)) setCrmLoading(false);
        }
    };

    // Commit CRM links
    const handleCommitLink = async () => {
        const origin = projectId;
        const ids = Array.from(chosenCrmIds);
        if (!canWrite || !ids.length || !current(origin)) return;
        setPending(true);
        try {
            await api.addParties(origin, ids);
            if (!current(origin)) return;
            setIsLinkCrmOpen(false);
            await loadData(origin);
        } catch {
            if (current(origin)) setError('Failed to link selected contacts.');
        } finally {
            if (current(origin)) setPending(false);
        }
    };

    // Save contact (add or update)
    const handleSaveContact = async (event) => {
        event.preventDefault();
        const origin = projectId;
        if (!canWrite || !current(origin)) return;
        const editing = editor;
        const formValues = Object.fromEntries(new FormData(event.currentTarget).entries());
        setPending(true);
        try {
            const payload = directoryPayload(formValues);
            if (editing?.id) {
                await api.updateDirectoryItem(origin, editing.id, payload);
            } else {
                await api.addDirectoryItem(origin, payload);
            }
            if (!current(origin)) return;
            setEditor(null);
            await loadData(origin);
        } catch {
            if (current(origin)) setError('Directory contact could not be saved.');
        } finally {
            if (current(origin)) setPending(false);
        }
    };

    // Delete item (personnel or party)
    const handleConfirmDelete = async () => {
        const origin = projectId;
        const target = confirmDelete;
        if (!canWrite || !target || !current(origin)) return;
        setPending(true);
        try {
            if (target.type === 'person') {
                await api.deleteDirectoryItem(origin, target.item.id);
            } else if (target.type === 'party') {
                await api.deleteParty(origin, target.item.partyId);
            }
            if (!current(origin)) return;
            setConfirmDelete(null);
            await loadData(origin);
        } catch {
            if (current(origin)) setError(`Failed to delete ${target.type === 'person' ? 'contact' : 'party'}.`);
        } finally {
            if (current(origin)) setPending(false);
        }
    };

    if (loading) {
        return <div className="w-full min-w-0 space-y-2 px-2 sm:px-3 pb-24"><MobileLoadingState rows={3} /></div>;
    }

    return (
        <div data-m6-view="directory-orgchart" className="w-full min-w-0 space-y-2 px-2 sm:px-3 pb-24">
            {/* Top View Switcher Tabs matching Desktop */}
            <MobileTabs
                segmented
                label="Directory & Org Chart view"
                value={tab}
                onChange={setTab}
                items={[
                    { value: 'directory', label: 'Directory', count: contacts.length },
                    { value: 'chart', label: 'Organisation Chart', count: groupedCompanies.length }
                ]}
            />

            {error && <p role="alert" className="rounded-lg bg-red-50 p-2.5 text-xs font-normal text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

            {/* TAB: DIRECTORY */}
            {tab === 'directory' && (
                <div className="space-y-2">
                    {/* Action Bar */}
                    <div className="flex items-center gap-1.5">
                        <div className="min-w-0 flex-1">
                            <MobileSearchBar value={query} onChange={setQuery} placeholder="Search companies or personnel" />
                        </div>
                        {canWrite && (
                            <button
                                type="button"
                                onClick={openCrmLink}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                            >
                                <UserPlus size={14} />
                                <span className="hidden sm:inline">Import from CRM</span>
                                <span className="sm:hidden">CRM</span>
                            </button>
                        )}
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                        {CATEGORY_OPTIONS.map((cat) => {
                            const active = categoryFilter === cat;
                            return (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setCategoryFilter(cat)}
                                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs transition-all ${
                                        active
                                            ? 'bg-blue-600 font-semibold text-white'
                                            : 'bg-gray-100 font-normal text-gray-700 hover:bg-gray-200 dark:bg-gh-hover dark:text-gh-muted'
                                    }`}
                                >
                                    {cat}
                                </button>
                            );
                        })}
                    </div>

                    {/* Company Cards List */}
                    <div className="space-y-2">
                        {filteredCompanies.map((company) => {
                            const isExpanded = expandedCompanyIds.has(company.key);
                            const categoryClass = CATEGORY_BADGES[company.category] || CATEGORY_BADGES.Other;

                            return (
                                <MobileCard key={company.key} className="p-2.5 sm:p-3">
                                    {/* Company Header */}
                                    <div className="flex items-start justify-between gap-2">
                                        <button
                                            type="button"
                                            onClick={() => toggleCompany(company.key)}
                                            className="min-w-0 flex-1 text-left"
                                        >
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="text-xs font-semibold text-gray-900 dark:text-gh-text">
                                                    {company.name}
                                                </span>
                                                <span className={`rounded px-1.5 py-0.2 text-[9px] font-normal uppercase border ${categoryClass}`}>
                                                    {company.category}
                                                </span>
                                                {company.jobNature && (
                                                    <span className="rounded bg-gray-100 px-1.5 py-0.2 text-[9px] font-normal text-gray-600 dark:bg-gh-hover dark:text-gh-muted">
                                                        {company.jobNature}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-[11px] font-normal text-gray-500">
                                                {company.personnel.length} team member{company.personnel.length === 1 ? '' : 's'}
                                                {company.address ? ` · ${company.address}` : ''}
                                            </p>
                                        </button>

                                        <div className="flex items-center gap-1">
                                            {canWrite && (
                                                <button
                                                    type="button"
                                                    title="Add personnel to this company"
                                                    onClick={() => setEditor({ partyId: company.partyId, companyName: company.name })}
                                                    className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            )}
                                            {canWrite && company.partyId && (
                                                <button
                                                    type="button"
                                                    title="Unlink company"
                                                    onClick={() => setConfirmDelete({ type: 'party', item: company })}
                                                    className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                                onClick={() => toggleCompany(company.key)}
                                                className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gh-hover"
                                            >
                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Personnel Subgrid List */}
                                    {isExpanded && (
                                        <div className="mt-2.5 space-y-1.5 border-t border-gray-100 pt-2 dark:border-gh-border">
                                            {company.personnel.map((person) => (
                                                <div
                                                    key={person.id}
                                                    className="rounded-lg border border-gray-100 bg-gray-50/50 p-2 dark:border-gh-border dark:bg-gh-hover/50"
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-semibold text-gray-900 dark:text-gh-text">
                                                                {person.contactPerson || 'Unnamed member'}
                                                            </p>
                                                            {person.designation && (
                                                                <p className="text-[11px] font-medium text-gray-700 dark:text-gh-muted">
                                                                    {person.designation}
                                                                </p>
                                                            )}
                                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-normal text-gray-500">
                                                                {person.mobileNo && (
                                                                    <a href={`tel:${person.mobileNo}`} className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                                                        <Phone size={11} /> {person.mobileNo}
                                                                    </a>
                                                                )}
                                                                {person.email && (
                                                                    <a href={`mailto:${person.email}`} className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                                                        <Mail size={11} /> {person.email}
                                                                    </a>
                                                                )}
                                                            </div>
                                                            {person.responsibilities && (
                                                                <p className="mt-1 text-[11px] font-normal text-gray-600 dark:text-gh-muted leading-relaxed">
                                                                    {person.responsibilities}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {canWrite && (
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditor(person)}
                                                                    className="min-h-7 px-2 text-[11px] font-semibold text-blue-600 dark:text-blue-400"
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setConfirmDelete({ type: 'person', item: person })}
                                                                    className="min-h-7 px-1.5 text-[11px] font-normal text-red-600"
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                            {company.personnel.length === 0 && (
                                                <div className="rounded-lg border border-dashed border-gray-200 py-3 text-center text-xs font-normal text-gray-500 dark:border-gh-border">
                                                    No personnel recorded for this company.
                                                    {canWrite && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditor({ partyId: company.partyId, companyName: company.name })}
                                                            className="ml-1 font-semibold text-blue-600 dark:text-blue-400"
                                                        >
                                                            + Add Team Member
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </MobileCard>
                            );
                        })}

                        {filteredCompanies.length === 0 && (
                            <MobileEmptyState
                                icon={Building2}
                                title="No directory records found"
                                description={query || categoryFilter !== 'All' ? 'Try adjusting your search or category filter.' : 'Link CRM contacts or add personnel to establish the project directory.'}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* TAB: ORGANISATION CHART */}
            {tab === 'chart' && (
                <div className="space-y-2">
                    {/* Project Overview Card */}
                    <MobileCard className="border-blue-200 bg-blue-50/70 p-2.5 dark:border-blue-900 dark:bg-blue-950/20">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                    Project Organisation
                                </p>
                                <h3 className="mt-0.5 text-xs font-semibold text-gray-900 dark:text-gh-text">
                                    {orgData?.project_name || 'Project'}
                                </h3>
                                <p className="mt-0.5 text-[11px] font-normal text-gray-600 dark:text-gh-muted">
                                    {[orgData?.client_name, orgData?.project_location].filter(Boolean).join(' · ') || 'No client or location'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setTab('directory')}
                                className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 text-[11px] font-semibold text-blue-700 shadow-xs dark:border-blue-800 dark:bg-gh-subtle dark:text-blue-300"
                            >
                                <FileSpreadsheet size={13} />
                                View Directory
                            </button>
                        </div>
                    </MobileCard>

                    {/* Roles Hierarchy Tree */}
                    <div className="space-y-2">
                        {CATEGORY_OPTIONS.filter((cat) => cat !== 'All').map((category) => {
                            const matchingCompanies = groupedCompanies.filter(
                                (c) => (c.category || '').toLowerCase() === category.toLowerCase()
                            );
                            if (matchingCompanies.length === 0) return null;

                            const categoryBadge = CATEGORY_BADGES[category] || CATEGORY_BADGES.Other;

                            return (
                                <div key={category} className="space-y-1.5">
                                    <div className="flex items-center gap-2 px-1">
                                        <span className={`h-2 w-2 rounded-full ${category === 'Client' ? 'bg-emerald-500' : category === 'PMC' ? 'bg-violet-500' : category === 'Contractor' ? 'bg-amber-500' : category === 'Consultant' ? 'bg-cyan-500' : 'bg-blue-500'}`} />
                                        <h4 className="text-xs font-semibold text-gray-900 dark:text-gh-text">
                                            {category} ({matchingCompanies.length})
                                        </h4>
                                    </div>

                                    <div className="space-y-1.5 pl-3 border-l-2 border-gray-200 dark:border-gh-border">
                                        {matchingCompanies.map((company) => (
                                            <MobileCard key={company.key} className="p-2.5 sm:p-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs font-semibold text-gray-900 dark:text-gh-text">
                                                                {company.name}
                                                            </span>
                                                            {company.jobNature && (
                                                                <span className="rounded bg-gray-100 px-1.5 py-0.2 text-[9px] font-normal text-gray-600 dark:bg-gh-hover dark:text-gh-muted">
                                                                    {company.jobNature}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {company.personnel.length > 0 && (
                                                            <div className="mt-2 space-y-1">
                                                                {company.personnel.map((person) => (
                                                                    <div key={person.id} className="flex items-center justify-between text-[11px]">
                                                                        <span className="font-semibold text-gray-800 dark:text-gh-text">
                                                                            {person.contactPerson}
                                                                        </span>
                                                                        <span className="font-normal text-gray-500">
                                                                            {person.designation || 'Representative'}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setTab('directory');
                                                            setExpandedCompanyIds(new Set([company.key]));
                                                        }}
                                                        className="min-h-7 rounded px-1.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                                                    >
                                                        Details
                                                    </button>
                                                </div>
                                            </MobileCard>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {groupedCompanies.length === 0 && (
                            <MobileEmptyState
                                icon={Network}
                                title="No organisation structure"
                                description="Link parties and team members in the Directory to generate the organisation chart."
                            />
                        )}
                    </div>
                </div>
            )}

            {/* FAB: Add Contact when in directory mode */}
            {canWrite && tab === 'directory' && (
                <MobileFAB
                    extended
                    label="Add Contact"
                    icon={Plus}
                    onClick={() => setEditor({ contactPerson: '', designation: '', responsibilities: '', mobileNo: '', email: '', addressLine: '', partyId: '' })}
                />
            )}

            {/* Add / Edit Contact Modal */}
            <MobileBottomSheet
                open={editor !== null}
                onClose={() => !pending && setEditor(null)}
                closeDisabled={pending}
                title={editor?.id ? 'Edit Directory Contact' : 'Add Directory Contact'}
                footer={
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setEditor(null)}
                            disabled={pending}
                            className="min-h-9 flex-1 rounded-lg border border-gray-200 text-xs font-semibold dark:border-gh-border"
                        >
                            Cancel
                        </button>
                        <button
                            form="mobile-contact-form"
                            type="submit"
                            disabled={pending}
                            className="min-h-9 flex-1 rounded-lg bg-blue-600 text-xs font-semibold text-white disabled:opacity-50"
                        >
                            {pending ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                }
            >
                <form id="mobile-contact-form" onSubmit={handleSaveContact} className="space-y-2.5">
                    <MobileSelect
                        label="Linked Company / Party"
                        name="partyId"
                        defaultValue={editor?.partyId || ''}
                        options={[
                            { value: '', label: 'No linked company' },
                            ...parties.map((p) => ({
                                value: p.id || p.pv_id,
                                label: `${p.name || p.company_name} (${p.category || 'Contractor'})`
                            }))
                        ]}
                    />

                    <label className="block text-xs font-medium">
                        Contact Person <span className="text-red-500">*</span>
                        <input required name="contactPerson" defaultValue={editor?.contactPerson || ''} className={inputClass} placeholder="Full Name" />
                    </label>

                    <label className="block text-xs font-medium">
                        Designation
                        <input name="designation" defaultValue={editor?.designation || ''} className={inputClass} placeholder="e.g. Project Manager, Lead Consultant" />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-medium">
                            Mobile Number
                            <input name="mobileNo" type="tel" defaultValue={editor?.mobileNo || ''} className={inputClass} placeholder="Phone" />
                        </label>
                        <label className="block text-xs font-medium">
                            Email Address
                            <input name="email" type="email" defaultValue={editor?.email || ''} className={inputClass} placeholder="email@example.com" />
                        </label>
                    </div>

                    <label className="block text-xs font-medium">
                        Responsibilities
                        <textarea name="responsibilities" rows={2} defaultValue={editor?.responsibilities || ''} className={`${inputClass} min-h-14 py-1.5`} placeholder="Key duties & site responsibilities" />
                    </label>

                    <label className="block text-xs font-medium">
                        Address
                        <textarea name="addressLine" rows={2} defaultValue={editor?.addressLine || ''} className={`${inputClass} min-h-14 py-1.5`} placeholder="Office / Site Address" />
                    </label>
                </form>
            </MobileBottomSheet>

            {/* CRM Contact Linking Modal */}
            <MobileBottomSheet
                open={isLinkCrmOpen}
                onClose={() => setIsLinkCrmOpen(false)}
                title="Import from CRM"
                description="Select contacts from CRM vendor and client directories to link to this project."
                footer={
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setIsLinkCrmOpen(false)}
                            className="min-h-9 flex-1 rounded-lg border border-gray-200 text-xs font-semibold dark:border-gh-border"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={pending || !chosenCrmIds.size}
                            onClick={handleCommitLink}
                            className="min-h-9 flex-1 rounded-lg bg-blue-600 text-xs font-semibold text-white disabled:opacity-50"
                        >
                            {pending ? 'Linking…' : `Link Selected (${chosenCrmIds.size})`}
                        </button>
                    </div>
                }
            >
                <div className="space-y-2">
                    {crmLoading && <MobileLoadingState rows={3} />}
                    {!crmLoading && crmCandidates.map((candidate) => {
                        const id = candidate.id || candidate.contact_id || candidate.pv_id;
                        const isChecked = chosenCrmIds.has(id);
                        return (
                            <label
                                key={id}
                                className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border p-2 text-xs transition-colors ${
                                    isChecked
                                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30'
                                        : 'border-gray-200 hover:bg-gray-50 dark:border-gh-border dark:hover:bg-gh-hover'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => setChosenCrmIds((prev) => {
                                        const next = new Set(prev);
                                        if (isChecked) next.delete(id);
                                        else next.add(id);
                                        return next;
                                    })}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-gray-900 dark:text-gh-text">
                                        {candidate.name || candidate.company_name}
                                    </p>
                                    <p className="truncate text-[11px] font-normal text-gray-500">
                                        {[candidate.category, candidate.job_nature, candidate.contact_person].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                            </label>
                        );
                    })}
                    {!crmLoading && crmCandidates.length === 0 && (
                        <MobileEmptyState title="No available CRM contacts" description="All eligible vendors and clients are already linked to this project." />
                    )}
                </div>
            </MobileBottomSheet>

            {/* Confirm Delete Modal */}
            <MobileConfirmModal
                open={confirmDelete !== null}
                pending={pending}
                danger
                title={confirmDelete?.type === 'person' ? 'Delete Directory Contact?' : 'Unlink Project Party?'}
                message={
                    confirmDelete?.type === 'person'
                        ? `Are you sure you want to remove ${confirmDelete?.item?.contactPerson || 'this contact'} from the directory?`
                        : `Are you sure you want to unlink ${confirmDelete?.item?.name || 'this company'} from this project?`
                }
                confirmLabel={confirmDelete?.type === 'person' ? 'Delete Contact' : 'Unlink Company'}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
